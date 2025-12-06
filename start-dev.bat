@echo off
echo 🚀 Iniciando sistema em modo desenvolvimento...
echo.

REM Verificar se o backend está rodando
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; if ($response.StatusCode -eq 200) { Write-Host '✅ Backend já está rodando' -ForegroundColor Green; exit 0 } } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo 📡 Iniciando Backend...
    start "Backend - Karaokê" cmd /k "cd backend && npm run dev"
    timeout /t 3 /nobreak >nul
)

REM Verificar se o frontend está rodando
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; if ($response.StatusCode -eq 200) { Write-Host '✅ Frontend já está rodando' -ForegroundColor Green; exit 0 } } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo ⚛️ Iniciando Frontend...
    start "Frontend - Karaokê" cmd /k "cd interface && npm run dev"
    timeout /t 3 /nobreak >nul
)

echo.
echo ═══════════════════════════════════════════════════════
echo            🎤 Sistema Karaokê - Modo Dev
echo ═══════════════════════════════════════════════════════
echo.
echo 📡 Backend:  http://localhost:3001
echo ⚛️ Frontend: http://localhost:3000
echo.
echo 💡 Aguarde alguns segundos para os servidores iniciarem...
echo 💡 Duas janelas foram abertas (Backend e Frontend)
echo.
echo 🛑 Para parar: Feche as janelas ou pressione Ctrl+C
echo.
echo 🎯 Acesse: http://localhost:3000
echo.
pause

