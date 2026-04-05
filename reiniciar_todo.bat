@echo off
REM Script para reiniciar backend y frontend de Vialtros
cd /d %~dp0
start cmd /k "C:\Users\usuario\Desktop\Vialtros\venv\Scripts\python.exe C:\Users\usuario\Desktop\Vialtros\backend\manage.py runserver 8000"
start cmd /k "cd frontend && npm start"
pause
