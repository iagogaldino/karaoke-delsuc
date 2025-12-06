# Script para iniciar Backend e Frontend em modo desenvolvimento
Write-Host "Iniciando sistema em modo desenvolvimento..." -ForegroundColor Green
Write-Host ""

# Verificar se o backend esta rodando
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
        Write-Host "[OK] Backend ja esta rodando na porta 3001" -ForegroundColor Green
    }
} catch {
    Write-Host "[*] Iniciando Backend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev" -WindowStyle Normal
    Start-Sleep -Seconds 3
}

# Verificar se o frontend esta rodando
$frontendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $frontendRunning = $true
        Write-Host "[OK] Frontend ja esta rodando na porta 3000" -ForegroundColor Green
    }
} catch {
    Write-Host "[*] Iniciando Frontend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\interface'; npm run dev" -WindowStyle Normal
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "    Sistema Karaoke - Modo Desenvolvimento" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "[*] Aguarde alguns segundos para os servidores iniciarem..." -ForegroundColor Yellow
Write-Host "[*] Duas janelas PowerShell foram abertas (Backend e Frontend)" -ForegroundColor Yellow
Write-Host ""
Write-Host "[!] Para parar: Feche as janelas PowerShell ou pressione Ctrl+C" -ForegroundColor Gray
Write-Host ""

# Aguardar e verificar status
Start-Sleep -Seconds 5

Write-Host "[*] Verificando status dos servidores..." -ForegroundColor Cyan
Write-Host ""

# Verificar Backend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "[OK] Backend: ONLINE" -ForegroundColor Green
} catch {
    Write-Host "[...] Backend: Iniciando..." -ForegroundColor Yellow
}

# Verificar Frontend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3
    Write-Host "[OK] Frontend: ONLINE" -ForegroundColor Green
} catch {
    Write-Host "[...] Frontend: Iniciando..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Acesse: http://localhost:3000" -ForegroundColor Green
Write-Host ""
