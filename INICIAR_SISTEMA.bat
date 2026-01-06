@echo off
title Sistema IA Rosario - Lanzador Automatico

:: 1. Iniciar el Backend (Python) en una ventana nueva
echo Iniciando Cerebro IA (Python)...
start cmd /k "cd /d D:\ia-rosario-web && .\env_ia\Scripts\activate && python main.py"

:: 2. Iniciar el Frontend (React) en otra ventana
echo Iniciando Interfaz Web (React)...
start cmd /k "cd /d D:\ia-rosario-web && npm start"

echo.
echo ==================================================
echo EL SISTEMA SE ESTA EJECUTANDO...
echo Se abrira una pestaña en el navegador en breve.
echo No cierres las ventanas negras de comando.
echo ==================================================
pause