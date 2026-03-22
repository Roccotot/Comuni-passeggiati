@echo off
title Comuni Passeggiati
cd /d "%~dp0"

echo.
echo  Avvio Comuni Passeggiati...
echo.

:: Prova python, poi py
python --version >nul 2>&1
if %errorlevel% == 0 (
    start /B python -m http.server 8080 --bind 127.0.0.1
    goto :apri
)

py --version >nul 2>&1
if %errorlevel% == 0 (
    start /B py -m http.server 8080 --bind 127.0.0.1
    goto :apri
)

echo ERRORE: Python non trovato.
echo Scaricalo da https://www.python.org/downloads/
echo (durante l'installazione spunta "Add Python to PATH")
echo.
pause
exit

:apri
timeout /t 1 /nobreak > nul
start "" http://localhost:8080
echo  Aperto su http://localhost:8080
echo  Tieni questa finestra aperta mentre usi l'app.
echo  Chiudila quando hai finito.
echo.
pause > nul
