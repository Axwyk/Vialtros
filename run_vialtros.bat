@echo off
rem Script para iniciar backend (ASGI con WebSocket) y frontend en ventanas separadas.

cd /d "%~dp0"

rem Inicia el backend con script robusto para Windows (.venv + fallback)
start "Backend Vialtros" cmd /k "cd /d "%~dp0backend" && call "%~dp0backend\start_backend.bat""

rem Inicia el frontend de React en una ventana nueva
start "Frontend Vialtros" cmd /k "cd /d "%~dp0frontend" && npm start"

echo Backend ASGI y frontend iniciandose en ventanas separadas.
echo Si quieres ver movimiento en vivo, en otra terminal ejecuta:
echo   cd backend ^&^& python manage.py transmitir_tracking --route 1 --interval 2
pause
