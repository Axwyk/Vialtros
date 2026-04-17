@echo off
setlocal

cd /d "%~dp0"

set "VENV_PYTHON=%~dp0.venv\Scripts\python.exe"
set "BACKEND_PORT=8000"

call :ensure_port_available %BACKEND_PORT%
if errorlevel 1 goto :eof

if exist "%VENV_PYTHON%" (
  "%VENV_PYTHON%" -m daphne --version >nul 2>&1
  if errorlevel 1 (
    echo Daphne no esta disponible en el entorno virtual. Se usa runserver como respaldo.
    "%VENV_PYTHON%" manage.py runserver 0.0.0.0:%BACKEND_PORT%
    goto :eof
  )

  echo Iniciando backend ASGI con Daphne usando el entorno virtual...
  "%VENV_PYTHON%" -m daphne -b 0.0.0.0 -p %BACKEND_PORT% core.asgi:application
  goto :eof
)

echo No se encontro el entorno virtual en .venv. Se intenta con Python del sistema...
python -m daphne --version >nul 2>&1
if errorlevel 1 (
  echo Daphne no esta disponible en el Python actual. Se usa runserver como respaldo.
  python manage.py runserver 0.0.0.0:%BACKEND_PORT%
  goto :eof
)

python -m daphne -b 0.0.0.0 -p %BACKEND_PORT% core.asgi:application
goto :eof

:ensure_port_available
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %1 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo El puerto %1 ya esta en uso. Cierra el proceso actual o cambia el puerto antes de iniciar el backend.
  exit /b 1
)
exit /b 0