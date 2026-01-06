from ultralytics import YOLO

# Cargar el modelo Medium que ya tenés
model = YOLO("yolov8m.pt")

# Exportar a TensorRT
# half=True: Usa precisión de 16 bits (FP16) que es MUCHO más rápida en las GTX 1650
# device=0: Usa la GPU para la compilación
model.export(format="engine", device=0, half=True)