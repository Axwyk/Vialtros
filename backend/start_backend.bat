@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "VENV_DIR=%~dp0.venv"
set "VENV_ACTIVATE=%VENV_DIR%\Scripts\activate.bat"
set "BACKEND_PORT=8000"

:: Intentar venv alternativo si .venv no existe
if not exist "%VENV_ACTIVATE%" (
  set "VENV_DIR=%~dp0venv"
  set "VENV_ACTIVATE=%~dp0venv\Scripts\activate.bat"
)

:: Crear venv automaticamente si ninguno existe
if not exist "%VENV_ACTIVATE%" (
  echo Entorno virtual no encontrado. Creando .venv...
  python --version >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python no esta en el PATH. Instala Python 3.11+ y reinicia.
    pause
    exit /b 1
  )
  python -m venv .venv
  if errorlevel 1 (
    echo ERROR: No se pudo crear el entorno virtual.
    pause
    exit /b 1
  )
  set "VENV_DIR=%~dp0.venv"
  set "VENV_ACTIVATE=%~dp0.venv\Scripts\activate.bat"
  echo Entorno virtual creado en .venv
)

call :ensure_port_available %BACKEND_PORT%
if errorlevel 1 (
  pause
  goto :eof
)

echo Activando entorno virtual...
call "%VENV_ACTIVATE%"

:: Instalar/actualizar dependencias
echo Instalando dependencias...
python -m pip install -r requirements.txt -q
if errorlevel 1 (
  echo ERROR: Fallo la instalacion de dependencias.
  pause
  exit /b 1
)

:: Migraciones (muestra errores para diagnostico)
echo Aplicando migraciones...
python manage.py migrate
if errorlevel 1 (
  echo ADVERTENCIA: Las migraciones fallaron. Verifica la conexion a la base de datos ^(.env^).
  echo El servidor intentara iniciar de todos modos...
  echo.
)

:: Intentar Daphne, usar runserver como respaldo
python -m daphne --version >nul 2>&1
if errorlevel 1 (
  echo Daphne no disponible. Iniciando con runserver ^(WebSocket habilitado^)...
  python manage.py runserver 0.0.0.0:%BACKEND_PORT%
) else (
  echo Iniciando backend ASGI con Daphne en puerto %BACKEND_PORT%...
  python -m daphne -b 0.0.0.0 -p %BACKEND_PORT% core.asgi:application
)

goto :eof

:ensure_port_available
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %1 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo El puerto %1 ya esta en uso.
  echo Para liberarlo, ejecuta en PowerShell como administrador:
  echo   Stop-Process -Id ^(Get-NetTCPConnection -LocalPort %1 -State Listen^).OwningProcess -Force
  exit /b 1
)
exit /b 0
