@echo off
echo 🛑 Parando servidores de desenvolvimento...
echo.

REM Parar processos nas portas 3000 e 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 :3001"') do (
    echo Parando processo PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ✅ Servidores parados!
echo.
pause

