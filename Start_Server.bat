@echo off
REM Script para ejecutar Backend (Django + Daphne) y Frontend (React) en paralelo
REM Abre dos terminales independientes para cada servicio

echo ========================================
echo Vialtros - Iniciando servidores
echo ========================================

REM Terminal 1: Backend (Daphne en puerto 8000)
echo Iniciando Backend (Daphne en puerto 8000)...
start cmd /k "cd backend && python manage.py runserver"

REM Esperar un segundo para que el backend inicie
timeout /t 2 /nobreak

REM Terminal 2: Frontend (React en puerto 3000)
echo Iniciando Frontend (React en puerto 3000)...
start cmd /k "cd frontend && npm start"

echo ========================================
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo ========================================
