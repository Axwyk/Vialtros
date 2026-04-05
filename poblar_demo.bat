@echo off
REM Script para poblar la base de datos de Vialtros
cd /d %~dp0backend
call ..\venv\Scripts\activate.bat
python manage.py makemigrations
python manage.py migrate
python manage.py poblar_demo
pause
