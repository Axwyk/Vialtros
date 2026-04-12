@echo off
rem Script para iniciar backend y frontend en ventanas separadas.

cd /d "%~dp0"

rem Inicia el backend de Django en una ventana nueva
start "Backend Vialtros" cmd /k "cd /d "%~dp0backend" && if exist "%~dp0.venv\Scripts\activate.bat" call "%~dp0.venv\Scripts\activate.bat" && python manage.py runserver"

rem Inicia el frontend de React en una ventana nueva
start "Frontend Vialtros" cmd /k "cd /d "%~dp0frontend" && npm start"

echo Backend y frontend iniciándose en ventanas separadas.
pause
