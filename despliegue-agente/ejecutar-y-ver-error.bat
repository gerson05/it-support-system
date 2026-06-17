@echo off
cd /d "%~dp0"
echo Iniciando agente...
agente-it.exe > log.txt 2>&1
echo.
echo El agente termino. Mostrando log:
echo ================================
type log.txt
echo ================================
pause
