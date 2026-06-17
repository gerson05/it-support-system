# Instalar Agente IT — ejecutar como Administrador
$destino = "C:\agente-it"

New-Item -ItemType Directory -Force $destino | Out-Null

Copy-Item "$PSScriptRoot\agente-it.exe" "$destino\agente-it.exe" -Force

# Config fresco sin agent_id — cada PC se registra como agente nuevo
@'
{
  "server_url": "http://190.147.23.156:3000",
  "interval_ms": 3600000
}
'@ | Out-File -Encoding utf8 "$destino\agent-config.json"

$action    = New-ScheduledTaskAction -Execute "$destino\agente-it.exe" -WorkingDirectory $destino
$trigger   = New-ScheduledTaskTrigger -AtStartup
$settings  = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Unregister-ScheduledTask -TaskName "Agente IT" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "Agente IT" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Start-ScheduledTask -TaskName "Agente IT"

Write-Host "Agente instalado en $destino y ejecutandose" -ForegroundColor Green
Write-Host "Se iniciara automaticamente con Windows" -ForegroundColor Green
