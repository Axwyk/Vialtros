@echo off
rem Script para iniciar backend (Django/Daphne) y frontend (React) en ventanas separadas.
rem Requiere: Python 3.10+, Node.js 18+

cd /d "%~dp0"

echo.
echo ============================================
echo   Iniciando Vialtros (Backend + Frontend)
echo ============================================
echo.

rem Verificar que los directorios existan
if not exist "%~dp0backend" (
  echo ERROR: No se encontro el directorio 'backend'
  pause
  exit /b 1
)

if not exist "%~dp0frontend" (
  echo ERROR: No se encontro el directorio 'frontend'
  pause
  exit /b 1
)

rem Inicia el backend con Daphne/runserver
echo [1/2] Iniciando Backend en puerto 8000...
start "Backend Vialtros" cmd /k "cd /d "%~dp0backend" && call "%~dp0backend\start_backend.bat""

rem Pequeña pausa para que el backend inicie antes del frontend
timeout /t 3 /nobreak

rem Inicia el frontend de React
echo [2/2] Iniciando Frontend en puerto 3000...
start "Frontend Vialtros" cmd /k "cd /d "%~dp0frontend" && npm start"

echo.
echo ============================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo ============================================
echo.
echo Credenciales por defecto:
echo   Usuario: admin
echo   Contraseña: admin123
echo.
pause
