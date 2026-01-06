# Analítica Vial IA 🚦🤖

Sistema de censo y conteo vehicular inteligente desarrollado en **Rosario, Argentina**. Este proyecto utiliza **YOLOv8** optimizado mediante **NVIDIA TensorRT** para ofrecer un procesamiento de imágenes de alta velocidad, permitiendo auditorías de tráfico eficientes sobre archivos de video.



## ✨ Características Principales
- **Optimización TensorRT**: Ejecución directa en núcleos CUDA (probado en GTX 1650 Ti) para máxima fluidez.
- **Detección Direccional**: Sistema de "Línea de Cruce" que identifica el sentido del tránsito.
- **Zonas de Ocupación**: Soporte para polígonos de área en zonas de detención o semáforos.
- **Interfaz Intuitiva**: Dashboard moderno con herramientas de dibujo integradas y conteo en vivo.
- **Exportación de Datos**: Generación de reportes en **Excel (.xlsx)**, **CSV** y **PDF**.
- **100% Offline**: Una vez instalado, no requiere conexión a internet para funcionar.

## 🚀 Instalación y Configuración

### Requisitos Previos
- **GPU**: NVIDIA con soporte CUDA.
- **Python**: 3.9 o superior.
- **Node.js**: Versión LTS recomendada.

### Pasos
1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/MatiVazquez22-code/Analitica_por_video_IA.git](https://github.com/MatiVazquez22-code/Analitica_por_video_IA.git)
   cd Analitica_por_video_IA

2. **Configurar el Backend (Python):**
   python -m venv env_ia
   env_ia\Scripts\activate
   pip install -r requirements.txt

3. **Configurar el Frontend (React):**
   npm install

###Cómo usar el sistema

Inicia el sistema ejecutando el archivo INICIAR_SISTEMA.bat.
Espera a que la consola de Python confirme: ✅ Motor IA listo y caliente.
La interfaz web se abrirá en http://localhost:3000.
Carga tu video, selecciona la herramienta de dibujo y define tus puntos de conteo.
Presiona INICIAR CENSO.

Desarrollado por Matias Vazquez
