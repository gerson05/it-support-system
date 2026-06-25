export const migrations = [
  `CREATE TABLE IF NOT EXISTS kb_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria   TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    solucion    TEXT NOT NULL,
    comandos    TEXT DEFAULT '[]',
    keywords    TEXT DEFAULT '',
    fuente      TEXT DEFAULT 'manual',
    activo      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_kb_categoria ON kb_items(categoria)`,

  `CREATE TABLE IF NOT EXISTS ai_ticket_analysis (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id   INTEGER,
    problema    TEXT NOT NULL,
    kb_ids      TEXT DEFAULT '[]',
    ai_response TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO kb_items (id,categoria,titulo,descripcion,solucion,comandos,keywords,fuente) VALUES
    (1,'impresoras','Reiniciar cola de impresión',
     'La cola de impresión está bloqueada. Trabajos pendientes no se imprimen. Spooler detenido o atascado.',
     'Detener el servicio Spooler y PrintFilterPipelineSvc, eliminar archivos de cola pendientes, reiniciar servicios.',
     '[{"tipo":"shell","parametro":"net stop spooler; net stop PrintFilterPipelineSvc; Remove-Item -Path \"$env:SystemRoot\\System32\\spool\\PRINTERS\\*\" -Force -ErrorAction SilentlyContinue; net start PrintFilterPipelineSvc; net start spooler; Write-Output ''Cola reiniciada.''"}]',
     'impresora cola atascada spooler bloqueada no imprime trabajos pendientes','script-share'),

    (2,'impresoras','Listar impresoras instaladas',
     'Ver qué impresoras están instaladas en el equipo y su estado.',
     'Ejecutar Get-Printer para obtener lista completa de impresoras.',
     '[{"tipo":"shell","parametro":"Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | Format-Table -AutoSize | Out-String"}]',
     'impresoras instaladas lista ver impresora estado','script-share'),

    (3,'impresoras','Configurar impresora predeterminada',
     'Cambiar la impresora predeterminada del equipo.',
     'Usar Set-PrintConfiguration para establecer la impresora predeterminada. Requiere el nombre exacto.',
     '[{"tipo":"shell","parametro":"(New-Object -ComObject WScript.Network).SetDefaultPrinter(''NOMBRE_IMPRESORA''); Write-Output ''Impresora predeterminada configurada.''"}]',
     'impresora predeterminada cambiar configurar default printer','manual'),

    (4,'red','Limpiar caché DNS',
     'Problemas de resolución de nombres, sitios que no cargan, DNS desactualizado.',
     'Ejecutar ipconfig /flushdns para limpiar la caché DNS del equipo.',
     '[{"tipo":"shell","parametro":"ipconfig /flushdns; Write-Output ''DNS limpiado.''"}]',
     'dns cache limpiar flush dns no resuelve nombre sitio no carga','manual'),

    (5,'red','Renovar dirección IP',
     'El equipo no tiene IP o la IP es incorrecta. Problemas de conectividad DHCP.',
     'Liberar y renovar la dirección IP via DHCP.',
     '[{"tipo":"shell","parametro":"ipconfig /release; Start-Sleep 2; ipconfig /renew; ipconfig | Out-String"}]',
     'ip renovar dhcp sin conexion no conecta red ipconfig release renew','manual'),

    (6,'red','Diagnóstico de conectividad',
     'Verificar si el equipo tiene acceso a la red local e internet.',
     'Hacer ping al gateway y a DNS público para determinar dónde está el fallo.',
     '[{"tipo":"shell","parametro":"$gw=(Get-NetRoute -DestinationPrefix ''0.0.0.0/0'').NextHop | Select-Object -First 1; Write-Output \"Gateway: $gw\"; ping $gw -n 3; ping 8.8.8.8 -n 3; ping google.com -n 3"}]',
     'sin internet no conecta red prueba conectividad ping gateway','manual'),

    (7,'red','Reiniciar adaptador de red',
     'El adaptador de red está en estado incorrecto o la conexión está colgada.',
     'Deshabilitar y volver a habilitar el adaptador de red activo.',
     '[{"tipo":"shell","parametro":"$adapter = Get-NetAdapter | Where-Object {$_.Status -eq ''Up''} | Select-Object -First 1; Disable-NetAdapter -Name $adapter.Name -Confirm:$false; Start-Sleep 3; Enable-NetAdapter -Name $adapter.Name -Confirm:$false; Write-Output \"Adaptador $($adapter.Name) reiniciado.\""}]',
     'adaptador red reiniciar wifi ethernet desconectado','manual'),

    (8,'red','Fix firma SMB (Error de acceso a carpetas compartidas)',
     'No se puede acceder a carpetas compartidas de red. Error de acceso denegado o no se encuentra el recurso.',
     'Deshabilitar requerimiento de firma SMB en el cliente. Solución para entornos sin dominio.',
     '[{"tipo":"shell","parametro":"Set-SmbClientConfiguration -RequireSecuritySignature $false -Force; Write-Output ''Firma SMB desactivada.''"}]',
     'carpeta compartida smb acceso denegado error red \\\\servidor no encuentra','script-share'),

    (9,'windows','Limpiar archivos temporales',
     'El disco está casi lleno o el equipo está lento por exceso de temporales.',
     'Eliminar archivos de %TEMP% y C:\\Windows\\Temp.',
     '[{"tipo":"clear_temp"}]',
     'lento disco lleno temporales temp espacio liberar','agente'),

    (10,'windows','Ejecutar SFC (verificar archivos del sistema)',
     'Windows presenta errores, pantallas azules, o archivos del sistema corruptos.',
     'Ejecutar System File Checker para detectar y reparar archivos dañados.',
     '[{"tipo":"shell","parametro":"sfc /scannow"}]',
     'sfc archivos sistema corruptos error windows pantalla azul BSOD','manual'),

    (11,'windows','Ejecutar DISM (reparar imagen de Windows)',
     'SFC reporta errores que no puede reparar. Windows Update falla. Sistema inestable.',
     'Usar DISM para restaurar la imagen de Windows desde los servidores de Microsoft.',
     '[{"tipo":"shell","parametro":"DISM /Online /Cleanup-Image /RestoreHealth"}]',
     'dism imagen windows reparar update falla inestable corrupto','manual'),

    (12,'windows','Ver eventos recientes del sistema',
     'Obtener los últimos errores o advertencias del Visor de Eventos para diagnóstico.',
     'Listar los últimos 20 eventos de error del log System.',
     '[{"tipo":"shell","parametro":"Get-EventLog -LogName System -EntryType Error,Warning -Newest 20 | Select-Object TimeGenerated,Source,Message | Format-Table -Wrap | Out-String -Width 200"}]',
     'visor eventos errores log sistema diagnostico crash','manual'),

    (13,'windows','Ver procesos con alto consumo',
     'El equipo está muy lento. CPU o RAM al 100%.',
     'Listar los procesos ordenados por uso de CPU y memoria.',
     '[{"tipo":"shell","parametro":"Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name,Id,CPU,@{N=''RAM_MB'';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String"}]',
     'lento cpu ram 100% proceso consumo alto memoria','manual'),

    (14,'windows','Ver programas de inicio',
     'El equipo tarda mucho en arrancar. Ver qué programas inician con Windows.',
     'Listar entradas de inicio de Windows.',
     '[{"tipo":"shell","parametro":"Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | Format-Table -AutoSize | Out-String"}]',
     'inicio lento arranque startup programas inicio windows boot','manual'),

    (15,'diagnostico','Diagnóstico completo del equipo',
     'Obtener información completa del equipo: hostname, usuario, IP, OS, RAM, CPU, disco.',
     'Ejecutar diagnóstico completo para conocer el estado del equipo.',
     '[{"tipo":"shell","parametro":"$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name; $os=Get-CimInstance Win32_OperatingSystem; $cpu=Get-CimInstance Win32_Processor | Select-Object -First 1; $disk=Get-CimInstance Win32_LogicalDisk -Filter ''DriveType=3'' | Where-Object {$_.DeviceID -eq ''C:''}; $ip=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {!$_.PrefixOrigin -eq ''WellKnown'' -and $_.IPAddress -notmatch ''^127\\.''} | Select-Object -First 1).IPAddress; Write-Output \"Equipo: $env:COMPUTERNAME\"; Write-Output \"Usuario: $u\"; Write-Output \"IP: $ip\"; Write-Output \"OS: $($os.Caption) $($os.Version)\"; Write-Output \"RAM Total: $([math]::Round($os.TotalVisibleMemorySize/1MB,1)) GB\"; Write-Output \"RAM Libre: $([math]::Round($os.FreePhysicalMemory/1MB,1)) GB\"; Write-Output \"CPU: $($cpu.Name)\"; Write-Output \"Disco C: Total: $([math]::Round($disk.Size/1GB,1))GB Libre: $([math]::Round($disk.FreeSpace/1GB,1))GB\""}]',
     'diagnostico informacion equipo hostname ip ram cpu disco sistema operativo','manual'),

    (16,'diagnostico','Listar software instalado',
     'Ver qué programas están instalados en el equipo.',
     'Obtener lista de programas instalados via registro de Windows.',
     '[{"tipo":"shell","parametro":"Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object {$_.DisplayName} | Select-Object DisplayName,DisplayVersion,Publisher | Sort-Object DisplayName | Format-Table -AutoSize | Out-String -Width 200"}]',
     'software instalado programas lista aplicaciones','manual'),

    (17,'diagnostico','Ver adaptadores de red',
     'Ver todos los adaptadores de red, sus IPs, MACs y estado.',
     'Obtener información detallada de red del equipo.',
     '[{"tipo":"shell","parametro":"Get-NetAdapter | Select-Object Name,Status,MacAddress,LinkSpeed | Format-Table; Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch ''^127\\.''} | Select-Object InterfaceAlias,IPAddress,PrefixLength | Format-Table | Out-String"}]',
     'adaptadores red ip mac wifi ethernet informacion red','manual'),

    (18,'windows','Activar cuenta Administrador local',
     'Necesitar acceso de administrador local en el equipo. Cuenta admin desactivada.',
     'Activar y configurar la cuenta Administrador local con contraseña corporativa.',
     '[{"tipo":"shell","parametro":"net user Administrador M3d1v4ll3 /active:yes; if($LASTEXITCODE -ne 0){net user Administrator M3d1v4ll3 /active:yes}; Write-Output ''Cuenta Administrador activada.''"}]',
     'administrador local activar cuenta admin password contraseña','script-share'),

    (19,'office','Diagnóstico de Office/Outlook',
     'Office o Outlook no abre, da error, está lento o crashea.',
     'Obtener versión de Office instalada y verificar estado básico.',
     '[{"tipo":"shell","parametro":"$o=Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration -ErrorAction SilentlyContinue; Write-Output \"Office: $($o.VersionToReport) Canal: $($o.CDNBaseUrl)\"; Get-Process outlook,winword,excel -ErrorAction SilentlyContinue | Select-Object Name,Id,CPU | Format-Table | Out-String"}]',
     'office outlook excel word no abre error crash lento','manual'),

    (20,'windows','Estado de Windows Update',
     'Verificar si hay actualizaciones pendientes o si Windows Update tiene problemas.',
     'Consultar el estado de Windows Update y actualizaciones pendientes.',
     '[{"tipo":"shell","parametro":"$wu=New-Object -ComObject Microsoft.Update.Session; $searcher=$wu.CreateUpdateSearcher(); Write-Output ''Buscando actualizaciones...''; $result=$searcher.Search(''IsInstalled=0''); Write-Output \"Actualizaciones pendientes: $($result.Updates.Count)\"; $result.Updates | Select-Object -First 10 Title | Format-Table | Out-String"}]',
     'windows update actualizaciones pendientes windows update error','manual')
  `,
];
