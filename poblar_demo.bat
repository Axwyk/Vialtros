@echo off
REM Script para poblar la base de datos de Vialtros
setlocal

cd /d "%~dp0backend"

set "VENV_PYTHON=%~dp0.venv\Scripts\python.exe"

if exist "%VENV_PYTHON%" (
	"%VENV_PYTHON%" manage.py makemigrations
	"%VENV_PYTHON%" manage.py migrate
	"%VENV_PYTHON%" manage.py poblar_demo
) else (
	echo No se encontro el entorno virtual en .venv. Se usa Python del sistema.
	python manage.py makemigrations
	python manage.py migrate
	python manage.py poblar_demo
)

pause
