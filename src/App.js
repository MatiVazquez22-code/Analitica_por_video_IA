import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Play, Car, Bike, Bus, Truck, User, 
  Upload, FileDown, FileSpreadsheet, FileText, FileCode, Undo, Trash2 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const App = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [previewFrame, setPreviewFrame] = useState(null);
  // Estado para capturar las dimensiones reales del video cargado
  const [videoDims, setVideoDims] = useState({ width: 1280, height: 720 });
  const [tool, setTool] = useState('Line'); 
  const [zones, setZones] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState(['Auto', 'Moto', 'Colectivo', 'Bicicleta']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveCounts, setLiveCounts] = useState({});
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const countIntervalRef = useRef(null);

  const classOptions = [
    { id: 'Auto', icon: <Car size={14}/> }, { id: 'Moto', icon: <Bike size={14}/> },
    { id: 'Bicicleta', icon: <Bike size={14}/> }, { id: 'Colectivo', icon: <Bus size={14}/> },
    { id: 'Camion', icon: <Truck size={14}/> }, { id: 'Peaton', icon: <User size={14}/> }
  ];

  // --- EXPORTADORES ---
  const getRawData = () => zones.map((z, i) => ({
    Carril: z.name,
    Tipo: z.type === 'Line' ? 'Cruce' : 'Área',
    ...z.classes.reduce((acc, curr) => ({ ...acc, [curr]: liveCounts[i]?.[curr] || 0 }), {})
  }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getRawData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Censo");
    XLSX.writeFile(wb, "Reporte_Analitica_Vial.xlsx");
  };

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(getRawData());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Reporte_Analitica_Vial.csv'; a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("ANALÍTICA VIAL IA - REPORTE DE CENSO", 14, 20);
    const tableData = [];
    getRawData().forEach(r => {
      Object.keys(r).forEach(k => {
        if (k !== 'Carril' && k !== 'Tipo') {
          tableData.push([r.Carril, r.Tipo, k, r[k]]);
        }
      });
    });
    autoTable(doc, { 
      startY: 30, 
      head: [['Zona', 'Modo', 'Clase', 'Cantidad']], 
      body: tableData, 
      headStyles: { fillColor: [14, 165, 233] } 
    });
    doc.save("Reporte_Analitica_Vial.pdf");
  };

  // --- CONTROLES DE ANÁLISIS ---
  const startAnalysis = async () => {
    if (!videoFile || zones.length === 0) {
      alert("Por favor, cargue un video y dibuje al menos una línea o zona.");
      return;
    }
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("zones", JSON.stringify(zones));

    try {
      const res = await fetch("http://localhost:8000/upload_config", { method: "POST", body: formData });
      if (res.ok) {
        setIsAnalyzing(true);
        setPreviewFrame(`http://localhost:8000/video_feed?t=${Date.now()}`);
        countIntervalRef.current = setInterval(async () => {
          try {
            const r = await fetch("http://localhost:8000/get_counts");
            if (r.ok) setLiveCounts(await r.json());
          } catch (e) { console.error("Error en conteo", e); }
        }, 1000);
      }
    } catch (e) {
      alert("Error de conexión con el motor de IA. Verificá la consola de Python.");
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    
    video.onloadedmetadata = () => {
      // CAPTURAMOS LAS DIMENSIONES REALES (Evita el estiramiento)
      setVideoDims({ width: video.videoWidth, height: video.videoHeight });
      video.currentTime = 0.5;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; 
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      setPreviewFrame(canvas.toDataURL());
    };
  };

  const handleCanvasClick = (e) => {
    if (isAnalyzing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // El mapeo de clics ahora usa videoDims para ser exacto a cualquier resolución
    const x = ((e.clientX - rect.left) / rect.width) * videoDims.width;
    const y = ((e.clientY - rect.top) / rect.height) * videoDims.height;

    const newPoints = [...currentPoints, { x, y }];
    setCurrentPoints(newPoints);

    if (newPoints.length === (tool === 'Polygon' ? 4 : 2)) {
      const name = window.prompt("Nombre de la zona/línea:", `Carril ${zones.length + 1}`);
      if (name) {
        setZones([...zones, { name, points: newPoints, type: tool, classes: [...selectedClasses] }]);
      }
      setCurrentPoints([]);
    }
  };

  // --- RENDERIZADO DEL LIENZO ---
  useEffect(() => {
    if (isAnalyzing || !canvasRef.current || !previewFrame) return;
    const ctx = canvasRef.current.getContext('2d');
    const img = new Image(); 
    img.src = previewFrame;
    img.onload = () => {
      ctx.clearRect(0, 0, videoDims.width, videoDims.height);
      ctx.drawImage(img, 0, 0);
      
      zones.forEach(z => {
        ctx.strokeStyle = '#0ea5e9'; 
        ctx.lineWidth = videoDims.width * 0.005; // Grosor proporcional al ancho
        ctx.beginPath();
        ctx.moveTo(z.points[0].x, z.points[0].y);
        z.points.forEach(p => ctx.lineTo(p.x, p.y));
        if (z.type === 'Polygon') ctx.closePath();
        ctx.stroke();

        if (z.type === 'Line') {
          const p1 = z.points[0]; const p2 = z.points[1];
          const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle - Math.PI/2);
          ctx.fillStyle = '#facc15'; 
          ctx.beginPath();
          ctx.moveTo(0, -videoDims.height * 0.04); ctx.lineTo(15, 0); ctx.lineTo(-15, 0); 
          ctx.fill();
          ctx.restore();
        }
      });

      if (currentPoints.length > 0) {
        ctx.strokeStyle = '#f43f5e'; 
        ctx.lineWidth = 4; 
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        currentPoints.forEach(p => ctx.lineTo(p.x, p.y)); 
        ctx.stroke();
      }
    };
  }, [previewFrame, zones, currentPoints, isAnalyzing, tool, videoDims]);

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <div className="w-80 bg-slate-900 p-6 flex flex-col border-r border-slate-800 z-20 shadow-2xl overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo2.png" alt="Logo" className="w-20 h-20 object-contain bg-slate-850 p-2 rounded-xl" />
          <h2 className="text-lg font-black text-sky-400 italic uppercase tracking-tighter leading-tight">
            Analítica <span className="block text-xs font-light tracking-widest text-slate-400">Vial IA</span>
          </h2>
        </div>    

        <div className="mb-6">
          <input type="file" ref={fileInputRef} onChange={handleVideoUpload} className="hidden" accept="video/*"/>
          <button onClick={() => fileInputRef.current.click()} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:border-sky-500 transition-all uppercase tracking-widest shadow-lg">
            {videoFile ? "Video Cargado ✓" : "1. Cargar Video"}
          </button>
        </div>

        <div className="mb-6 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-3 font-mono tracking-widest">Herramientas de Dibujo</label>
          <select value={tool} onChange={(e) => {setTool(e.target.value); setCurrentPoints([]);}} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm mb-4 text-sky-400 font-bold outline-none cursor-pointer">
            <option value="Line">Línea de Cruce (Sentido ↑)</option>
            <option value="Polygon">Polígono (Área cerrada)</option>
          </select>
          
          <div className="grid grid-cols-3 gap-1.5">
            {classOptions.map(c => (
              <button key={c.id} onClick={() => setSelectedClasses(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                className={`p-2 text-[9px] rounded-lg border transition-all flex flex-col items-center gap-1 ${selectedClasses.includes(c.id) ? 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                {c.icon}
                {c.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          <button onClick={() => setZones(zones.slice(0, -1))} className="flex-1 py-3 bg-slate-800 text-amber-500 border border-slate-700 rounded-xl text-[10px] font-bold hover:bg-amber-500/10 transition-all uppercase">Deshacer</button>
          <button onClick={() => {setZones([]); setCurrentPoints([])}} className="flex-1 py-3 bg-slate-800 text-rose-500 border border-slate-700 rounded-xl text-[10px] font-bold hover:bg-rose-500/10 transition-all uppercase">Limpiar</button>
        </div>

        {!isAnalyzing && (
          <button onClick={startAnalysis} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm mb-4 shadow-xl flex items-center justify-center gap-2 tracking-widest transition-all transform active:scale-95">
            <Play size={18} fill="white"/> INICIAR CENSO
          </button>
        )}

        <div className="mt-auto relative">
           <button onClick={() => setIsExportOpen(!isExportOpen)} className="w-full py-3 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors">
            <FileDown size={16} /> EXPORTAR RESULTADOS
          </button>
          {isExportOpen && (
            <div className="absolute bottom-12 left-0 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50">
              <button onClick={() => {exportExcel(); setIsExportOpen(false)}} className="w-full p-3 hover:bg-sky-600 flex items-center gap-3 text-xs border-b border-slate-700 transition-colors"><FileSpreadsheet size={16}/> Excel (.xlsx)</button>
              <button onClick={() => {exportCSV(); setIsExportOpen(false)}} className="w-full p-3 hover:bg-sky-600 flex items-center gap-3 text-xs border-b border-slate-700 transition-colors"><FileCode size={16}/> CSV (.csv)</button>
              <button onClick={() => {exportPDF(); setIsExportOpen(false)}} className="w-full p-3 hover:bg-sky-600 flex items-center gap-3 text-xs transition-colors"><FileText size={16}/> PDF (.pdf)</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-[#020617] p-8">
        <div className="relative border-4 border-slate-800 rounded-2xl overflow-hidden bg-black shadow-2xl flex items-center justify-center" 
             style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}>
          {isAnalyzing ? (
            <img 
              src={previewFrame} 
              alt="IA Feed" 
              className="w-full h-full object-contain block"
            />
          ) : (
            <canvas 
              ref={canvasRef} 
              onClick={handleCanvasClick} 
              width={videoDims.width} 
              height={videoDims.height} 
              className="w-full h-full object-contain cursor-crosshair block" 
            />
          )}
          <div className="absolute bottom-4 right-6 text-white/20 font-black tracking-tighter text-2xl select-none pointer-events-none">
            ANALÍTICA POR VIDEO
          </div>
        </div>
      </div>

      <div className="w-80 bg-slate-900 p-6 border-l border-slate-800 flex flex-col shadow-2xl">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2 font-mono">Dashboard en Vivo</h3>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {zones.length === 0 && (
            <div className="text-center text-slate-600 mt-10 italic text-sm">
              Sin carriles definidos.
            </div>
          )}
          {zones.map((z, i) => (
            <div key={i} className="bg-slate-950 p-4 rounded-xl mb-4 border-l-4 border-l-sky-500 shadow-md">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] text-sky-400 font-black uppercase tracking-tighter">{z.name}</span>
                <span className="text-[9px] bg-sky-900/30 text-sky-500 px-2 py-0.5 rounded border border-sky-900/50 uppercase font-bold">
                  {z.type === 'Line' ? 'Cruce' : 'Área'}
                </span>
              </div>
              <div className="space-y-1.5">
                {z.classes.map(c => (
                  <div key={c} className="flex justify-between text-[11px] border-b border-slate-900/50 pb-1">
                    <span className="text-slate-500">{c}</span>
                    <span className="font-mono text-slate-200 font-bold">{liveCounts[i]?.[c] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
