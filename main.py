import cv2
import json
import numpy as np
import asyncio
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
from collections import Counter
import torch

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- INICIO ANTICIPADO (PRE-WARMUP) ---
print("🚀 Cargando motor TensorRT en la GPU...")
model = YOLO("yolov8m.engine", task="detect")

# Inferencia fantasma para inicializar los núcleos CUDA
# Esto evita el lag de 5-10 segundos al primer inicio
dummy_frame = np.zeros((640, 640, 3), dtype=np.uint8)
model.predict(dummy_frame, device="cuda:0", verbose=False)
print("✅ Motor IA listo y caliente.")

class_map = {0: 'Peaton', 1: 'Bicicleta', 2: 'Auto', 3: 'Moto', 5: 'Colectivo', 7: 'Camion'}

is_processing = False
video_source = None
zones_config = []
counts = {}

def intersect(p1, p2, p3, p4):
    def ccw(A, B, C):
        return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
    return ccw(p1,p3,p4) != ccw(p2,p3,p4) and ccw(p1,p2,p3) != ccw(p1,p2,p4)

@app.post("/upload_config")
async def upload_config(video: UploadFile = File(...), zones: str = Form(...)):
    global video_source, zones_config, counts, is_processing
    
    # Detenemos proceso anterior si existe para liberar recursos rápido
    is_processing = False 
    await asyncio.sleep(0.1)
    
    video_path = "temp_analysis.mp4"
    # Guardado eficiente de archivo
    with open(video_path, "wb") as f:
        content = await video.read()
        f.write(content)
    
    video_source = video_path
    zones_config = json.loads(zones)
    counts = {i: {c: 0 for c in z['classes']} for i, z in enumerate(zones_config)}
    is_processing = True
    print("🎬 Video cargado y configuración lista.")
    return {"status": "ready"}

async def generate_frames():
    global video_source, zones_config, counts, is_processing
    cap = cv2.VideoCapture(video_source)
    active_tracks = {}

    # Optimizamos lectura de video
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

    while cap.isOpened() and is_processing:
        success, frame = cap.read()
        if not success: break

        # Inferencia de alto rendimiento
        results = model.track(frame, persist=True, device="cuda:0", verbose=False, conf=0.25, iou=0.45)

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.int().cpu().tolist()
            clss = results[0].boxes.cls.int().cpu().tolist()

            for box, obj_id, cls in zip(boxes, ids, clss):
                x1, y1, x2, y2 = box
                cx, cy = (x1 + x2) / 2, y2 
                label = class_map.get(cls)
                if not label: continue

                if obj_id not in active_tracks:
                    active_tracks[obj_id] = {"pos": (cx, cy), "labels": [], "counted": set()}
                
                prev_pos = active_tracks[obj_id]["pos"]
                curr_pos = (cx, cy)
                active_tracks[obj_id]["labels"].append(label)

                for i, z in enumerate(zones_config):
                    if i in active_tracks[obj_id]["counted"]: continue
                    
                    if z['type'] == 'Line':
                        p1 = (z['points'][0]['x'], z['points'][0]['y'])
                        p2 = (z['points'][1]['x'], z['points'][1]['y'])
                        if intersect(p1, p2, prev_pos, curr_pos):
                            most_common = Counter(active_tracks[obj_id]["labels"]).most_common(1)[0][0]
                            if most_common in z['classes']:
                                counts[i][most_common] += 1
                                active_tracks[obj_id]["counted"].add(i)
                                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 3)
                    else:
                        pts = np.array([(p['x'], p['y']) for p in z['points']], np.int32)
                        if cv2.pointPolygonTest(pts, (float(cx), float(cy)), False) >= 0:
                            most_common = Counter(active_tracks[obj_id]["labels"]).most_common(1)[0][0]
                            if most_common in z['classes']:
                                counts[i][most_common] += 1
                                active_tracks[obj_id]["counted"].add(i)
                                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 3)

                active_tracks[obj_id]["pos"] = curr_pos

        # Dibujado de zonas rápido
        for z in zones_config:
            pts = np.array([(p['x'], p['y']) for p in z['points']], np.int32)
            cv2.polylines(frame, [pts], z['type'] == 'Polygon', (255, 255, 0), 2)

        # Compresión JPEG optimizada para streaming (Calidad 80 para balance velocidad/peso)
        _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        
        # Pequeño respiro para el event loop de FastAPI
        await asyncio.sleep(0.001)

    cap.release()

@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(generate_frames(), 
                             media_type="multipart/x-mixed-replace; boundary=frame",
                             headers={
                                 "Cache-Control": "no-cache, no-store, must-revalidate",
                                 "Pragma": "no-cache",
                                 "Expires": "0",
                             })

@app.get("/get_counts")
async def get_counts(): return counts

if __name__ == "__main__":
    import uvicorn
    # Ejecución directa
    uvicorn.run(app, host="0.0.0.0", port=8000)