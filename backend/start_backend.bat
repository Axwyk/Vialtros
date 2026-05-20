@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "VENV_ACTIVATE=%~dp0venv\Scripts\activate.bat"
set "VENV_PYTHON=%~dp0venv\Scripts\python.exe"
set "BACKEND_PORT=8000"

call :ensure_port_available %BACKEND_PORT%
if errorlevel 1 goto :eof

if exist "%VENV_ACTIVATE%" (
  echo Activando entorno virtual...
  call "%VENV_ACTIVATE%"
  
  python -m daphne --version >nul 2>&1
  if errorlevel 1 (
    echo Daphne no esta disponible. Se usa runserver como respaldo.
    echo Iniciando Django con runserver en puerto %BACKEND_PORT%...
    python manage.py migrate >nul 2>&1
    python manage.py runserver 0.0.0.0:%BACKEND_PORT%
    goto :eof
  )

  echo Iniciando backend ASGI con Daphne...
  python manage.py migrate >nul 2>&1
  python -m daphne -b 0.0.0.0 -p %BACKEND_PORT% core.asgi:application
  goto :eof
)

echo No se encontro el entorno virtual. Verifica que exista en: %VENV_ACTIVATE%
exit /b 1

:ensure_port_available
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %1 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo El puerto %1 ya esta en uso. Cierra el proceso actual antes de iniciar el backend.
  exit /b 1
)
exit /b 0