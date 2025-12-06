# Script para parar os servidores de desenvolvimento
Write-Host "Parando servidores de desenvolvimento..." -ForegroundColor Yellow
Write-Host ""

# Parar processos do Node.js nas portas 3000 e 3001
$ports = @(3000, 3001)

foreach ($port in $ports) {
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($processes) {
        foreach ($pid in $processes) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "Parando processo na porta $port (PID: $pid)..." -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Host "Nenhum processo rodando na porta $port" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Servidores parados!" -ForegroundColor Green
