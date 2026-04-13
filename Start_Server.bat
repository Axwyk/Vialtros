@echo off
REM =========================================================
REM Vialtros - Iniciar Backend (ASGI) + Frontend (React)
REM =========================================================
REM
REM REQUISITOS PREVIOS:
REM   pip install -r backend/requirements.txt
REM   cd frontend && npm install
REM
REM Para transmitir tracking en una TERCERA ventana (opcional):
REM   cd backend
REM   python manage.py transmitir_tracking --route <ID> --interval 2
REM =========================================================

echo ========================================
echo Vialtros - Iniciando servidores
echo ========================================

REM Terminal 1: Backend ASGI (Daphne en puerto 8000)
REM Daphne es necesario para WebSockets (channels). runserver no soporta WS.
echo Iniciando Backend ASGI (daphne) en puerto 8000...
start "Backend Vialtros" cmd /k "cd /d "%~dp0backend" && if exist "%~dp0.venv\Scripts\activate.bat" call "%~dp0.venv\Scripts\activate.bat" && daphne -b 0.0.0.0 -p 8000 core.asgi:application"

REM Esperar que el backend arranque antes de lanzar el frontend
timeout /t 3 /nobreak >nul

REM Terminal 2: Frontend React en puerto 3000
echo Iniciando Frontend (React) en puerto 3000...
start "Frontend Vialtros" cmd /k "cd /d "%~dp0frontend" && npm start"

echo.
echo ========================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo Admin:    http://localhost:8000/admin
echo ========================================
echo.
echo Para enviar coordenadas al mapa, abre una nueva terminal y ejecuta:
echo   cd backend
echo   python manage.py transmitir_tracking --route ^<ID^> --interval 2
echo ========================================
