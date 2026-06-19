import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../database/tickets.db');
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

// Asegurar que exista el directorio de la base de datos
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

// Inicializar tablas usando el esquema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migraciones incrementales (columnas nuevas en tablas existentes)
const migrations = [
  `ALTER TABLE tickets ADD COLUMN title TEXT DEFAULT ''`,
  `ALTER TABLE conversations ADD COLUMN warned_inactive INTEGER DEFAULT 0`,
  `ALTER TABLE messages ADD COLUMN attachment TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN chat_id TEXT DEFAULT NULL`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    entity_number TEXT,
    details TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS despachos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    fecha TEXT DEFAULT (date('now','localtime')),
    destinatario TEXT NOT NULL,
    sede TEXT,
    area TEXT,
    articulos TEXT NOT NULL,
    observaciones TEXT,
    requiere_acta INTEGER DEFAULT 0,
    acta_numero TEXT,
    acta_firmada INTEGER DEFAULT 0,
    ticket_id INTEGER,
    agente TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  )`,
  `CREATE TABLE IF NOT EXISTS despacho_borradores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agente        TEXT NOT NULL UNIQUE,
    destinatario  TEXT DEFAULT '',
    sede          TEXT DEFAULT '',
    area          TEXT DEFAULT '',
    articulos     TEXT DEFAULT '[]',
    observaciones TEXT DEFAULT '',
    requiere_acta INTEGER DEFAULT 0,
    ticket_id     INTEGER DEFAULT NULL,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS acta_uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('tech_request','despacho')),
    entity_id   INTEGER NOT NULL,
    entity_ref  TEXT NOT NULL,
    filename    TEXT,
    filepath    TEXT,
    uploaded_at TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_acta_uploads_entity
   ON acta_uploads(entity_type, entity_id)`,
  `CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id       INTEGER NOT NULL,
    active        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    updated_at    TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (1, 'it',        'Equipo IT — acceso completo'),
    (2, 'farmacias', 'Acceso solo al directorio de farmacias')`,
  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (1, 'full'),
    (2, 'farmacias')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1,1),(1,2),(2,2)`,

  // ── Granular permissions ──────────────────────────────────────────────────
  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (3,  'metrics:read'),
    (4,  'tickets:read'),       (5,  'tickets:create'),
    (6,  'tickets:edit'),       (7,  'tickets:delete'),
    (8,  'tech-requests:read'), (9,  'tech-requests:create'),
    (10, 'tech-requests:edit'), (11, 'tech-requests:delete'),
    (12, 'faqs:read'),          (13, 'faqs:create'),
    (14, 'faqs:edit'),          (15, 'faqs:delete'),
    (16, 'sedes:read'),         (17, 'sedes:create'),
    (18, 'sedes:edit'),         (19, 'sedes:delete'),
    (20, 'despacho:read'),      (21, 'despacho:create'),
    (22, 'despacho:edit'),      (23, 'despacho:delete'),
    (24, 'audit:read'),
    (25, 'farmacias:read'),     (26, 'farmacias:create'),
    (27, 'farmacias:edit'),     (28, 'farmacias:delete'),
    (29, 'settings:read'),      (30, 'settings:edit')  -- reserved: it role accesses via full bypass`,

  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (3, 'supervisor', 'Gestión de tickets y requerimientos'),
    (4, 'almacen',    'Gestión de despachos'),
    (5, 'auditor',    'Lectura completa + auditoría'),
    (6, 'viewer',     'Solo lectura en todos los módulos')`,

  // r=read c=create e=edit d=delete
  // supervisor (3): metrics:r + tickets:rce + tech-requests:rce + faqs:rce + sedes:r + despacho:r
  // almacen   (4): metrics:r + sedes:r + despacho:rce
  // auditor   (5): metrics:r + tickets:r + tech-requests:r + faqs:r + sedes:r + despacho:r + audit:r
  // viewer    (6): metrics:r + tickets:r + tech-requests:r + faqs:r + sedes:r + despacho:r
  // farmacias (2): gains granular farmacias:* (already has old id=2 perm, add new ones)
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (3,3),(3,4),(3,5),(3,6),(3,8),(3,9),(3,10),(3,12),(3,13),(3,14),(3,16),(3,20),
    (4,3),(4,16),(4,20),(4,21),(4,22),
    (5,3),(5,4),(5,8),(5,12),(5,16),(5,20),(5,24),
    (6,3),(6,4),(6,8),(6,12),(6,16),(6,20),
    (2,25),(2,26),(2,27),(2,28)`,

  // ── Inventario ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS inventario_equipos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    placa            TEXT NOT NULL UNIQUE,
    marca            TEXT NOT NULL,
    nombre_equipo    TEXT NOT NULL,
    serial           TEXT NOT NULL UNIQUE,
    procesador       TEXT,
    ram              TEXT,
    tipo_ram         TEXT,
    cap_disco        TEXT,
    tipo_disco       TEXT,
    serial_cargador  TEXT,
    area             TEXT,
    responsable      TEXT,
    fecha_compra     TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS inventario_celulares (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_registro   TEXT DEFAULT (date('now','localtime')),
    area             TEXT,
    ciudad           TEXT,
    nombre_completo  TEXT NOT NULL,
    cedula           TEXT,
    linea            TEXT,
    operador         TEXT,
    equipo           TEXT,
    almacenamiento   TEXT,
    ram              TEXT,
    modelo           TEXT,
    imei             TEXT UNIQUE,
    imei2            TEXT,
    estado           TEXT DEFAULT 'nuevo',
    accesorio        TEXT,
    fecha_entrega    TEXT,
    entregado_por    TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (31, 'inventario:read'),
    (32, 'inventario:create'),
    (33, 'inventario:edit'),
    (34, 'inventario:delete')`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (1,31),(1,32),(1,33),(1,34),
    (3,31),(3,32),(3,33),
    (4,31),
    (5,31),
    (6,31)`,

  `CREATE TABLE IF NOT EXISTS registro_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    tipo       TEXT NOT NULL DEFAULT 'equipos',
    label      TEXT,
    created_by TEXT,
    expires_at TEXT,
    max_uses   INTEGER,
    use_count  INTEGER DEFAULT 0,
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS inventario_ups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    placa           TEXT NOT NULL UNIQUE,
    marca           TEXT,
    nombre_equipo   TEXT,
    serial          TEXT,
    area            TEXT,
    voltaje         TEXT,
    fecha_compra    TEXT,
    fecha_despacho  TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1,16)`,

  // ── Tracking de paquetes ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS paquete_tracking (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    despacho_id INTEGER NOT NULL UNIQUE,
    token       TEXT    NOT NULL UNIQUE,
    estado      TEXT    NOT NULL DEFAULT 'creado',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (despacho_id) REFERENCES despachos(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_eventos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id      INTEGER NOT NULL,
    tipo             TEXT NOT NULL,
    recibido_por     TEXT NOT NULL,
    entregado_por    TEXT NOT NULL,
    ubicacion        TEXT NOT NULL,
    sede_id          INTEGER,
    cargo_receptor   TEXT,
    observaciones    TEXT,
    foto_path        TEXT NOT NULL,
    foto_filename    TEXT NOT NULL,
    estado_paquete   TEXT NOT NULL,
    ip               TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_entrega_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id         INTEGER NOT NULL,
    item_index        INTEGER NOT NULL,
    equipment_name    TEXT NOT NULL,
    cantidad          INTEGER NOT NULL DEFAULT 1,
    recibido_conforme INTEGER NOT NULL DEFAULT 1,
    observacion_item  TEXT,
    FOREIGN KEY (evento_id) REFERENCES paquete_eventos(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_acta_final (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id  INTEGER NOT NULL UNIQUE,
    filepath     TEXT NOT NULL,
    filename     TEXT NOT NULL,
    firmado_por  TEXT NOT NULL,
    cargo        TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_paquete_tracking_despacho ON paquete_tracking(despacho_id)`,
  `CREATE INDEX IF NOT EXISTS idx_paquete_tracking_token    ON paquete_tracking(token)`,
  `CREATE INDEX IF NOT EXISTS idx_paquete_eventos_tracking  ON paquete_eventos(tracking_id)`,

  // ── Monitoreo de equipos ─────────────────────────────────────────────────
  `INSERT OR IGNORE INTO permissions (id, name) VALUES (35, 'monitoring:read')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, 35)`,

  // ── Comandos remotos de agentes ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS comandos_agente (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agente_id   INTEGER NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL,
    parametro   TEXT,
    estado      TEXT DEFAULT 'pendiente',
    output      TEXT DEFAULT '',
    exit_code   INTEGER,
    creado_por  TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comandos_agente ON comandos_agente(agente_id, estado)`,
  `ALTER TABLE despachos ADD COLUMN cedula TEXT DEFAULT NULL`,
  `INSERT OR IGNORE INTO permissions (id, name) VALUES (36, 'monitoring:command')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, 36)`,

  // ── Knowledge base IT (RAG) ──────────────────────────────────────────────
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

  // Seed inicial: scripts del share y soluciones conocidas
  `INSERT OR IGNORE INTO kb_items (id,categoria,titulo,descripcion,solucion,comandos,keywords,fuente) VALUES
    (1,'impresoras','Reiniciar cola de impresión',
     'La cola de impresión está bloqueada. Trabajos pendientes no se imprimen. Spooler detenido o atascado.',
     'Detener el servicio Spooler y PrintFilterPipelineSvc, eliminar archivos de cola pendientes, reiniciar servicios.',
     '[{"tipo":"shell","parametro":"net stop spooler; net stop PrintFilterPipelineSvc; Remove-Item -Path \"$env:SystemRoot\\System32\\spool\\PRINTERS\\*\" -Force -ErrorAction SilentlyContinue; net start PrintFilterPipelineSvc; net start spooler; Write-Output ''Cola reiniciada.''"}]',
     'impresora cola atascada spooler bloqueada no imprime trabajos pendientes',
     'script-share'),

    (2,'impresoras','Listar impresoras instaladas',
     'Ver qué impresoras están instaladas en el equipo y su estado.',
     'Ejecutar Get-Printer para obtener lista completa de impresoras.',
     '[{"tipo":"shell","parametro":"Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | Format-Table -AutoSize | Out-String"}]',
     'impresoras instaladas lista ver impresora estado',
     'script-share'),

    (3,'impresoras','Configurar impresora predeterminada',
     'Cambiar la impresora predeterminada del equipo.',
     'Usar Set-PrintConfiguration para establecer la impresora predeterminada. Requiere el nombre exacto.',
     '[{"tipo":"shell","parametro":"(New-Object -ComObject WScript.Network).SetDefaultPrinter(''NOMBRE_IMPRESORA''); Write-Output ''Impresora predeterminada configurada.''"}]',
     'impresora predeterminada cambiar configurar default printer',
     'manual'),

    (4,'red','Limpiar caché DNS',
     'Problemas de resolución de nombres, sitios que no cargan, DNS desactualizado.',
     'Ejecutar ipconfig /flushdns para limpiar la caché DNS del equipo.',
     '[{"tipo":"shell","parametro":"ipconfig /flushdns; Write-Output ''DNS limpiado.''"}]',
     'dns cache limpiar flush dns no resuelve nombre sitio no carga',
     'manual'),

    (5,'red','Renovar dirección IP',
     'El equipo no tiene IP o la IP es incorrecta. Problemas de conectividad DHCP.',
     'Liberar y renovar la dirección IP via DHCP.',
     '[{"tipo":"shell","parametro":"ipconfig /release; Start-Sleep 2; ipconfig /renew; ipconfig | Out-String"}]',
     'ip renovar dhcp sin conexion no conecta red ipconfig release renew',
     'manual'),

    (6,'red','Diagnóstico de conectividad',
     'Verificar si el equipo tiene acceso a la red local e internet.',
     'Hacer ping al gateway y a DNS público para determinar dónde está el fallo.',
     '[{"tipo":"shell","parametro":"$gw=(Get-NetRoute -DestinationPrefix ''0.0.0.0/0'').NextHop | Select-Object -First 1; Write-Output \"Gateway: $gw\"; ping $gw -n 3; ping 8.8.8.8 -n 3; ping google.com -n 3"}]',
     'sin internet no conecta red prueba conectividad ping gateway',
     'manual'),

    (7,'red','Reiniciar adaptador de red',
     'El adaptador de red está en estado incorrecto o la conexión está colgada.',
     'Deshabilitar y volver a habilitar el adaptador de red activo.',
     '[{"tipo":"shell","parametro":"$adapter = Get-NetAdapter | Where-Object {$_.Status -eq ''Up''} | Select-Object -First 1; Disable-NetAdapter -Name $adapter.Name -Confirm:$false; Start-Sleep 3; Enable-NetAdapter -Name $adapter.Name -Confirm:$false; Write-Output \"Adaptador $($adapter.Name) reiniciado.\""}]',
     'adaptador red reiniciar wifi ethernet desconectado',
     'manual'),

    (8,'red','Fix firma SMB (Error de acceso a carpetas compartidas)',
     'No se puede acceder a carpetas compartidas de red. Error de acceso denegado o no se encuentra el recurso.',
     'Deshabilitar requerimiento de firma SMB en el cliente. Solución para entornos sin dominio.',
     '[{"tipo":"shell","parametro":"Set-SmbClientConfiguration -RequireSecuritySignature $false -Force; Write-Output ''Firma SMB desactivada.''"}]',
     'carpeta compartida smb acceso denegado error red \\\\servidor no encuentra',
     'script-share'),

    (9,'windows','Limpiar archivos temporales',
     'El disco está casi lleno o el equipo está lento por exceso de temporales.',
     'Eliminar archivos de %TEMP% y C:\\Windows\\Temp.',
     '[{"tipo":"clear_temp"}]',
     'lento disco lleno temporales temp espacio liberar',
     'agente'),

    (10,'windows','Ejecutar SFC (verificar archivos del sistema)',
     'Windows presenta errores, pantallas azules, o archivos del sistema corruptos.',
     'Ejecutar System File Checker para detectar y reparar archivos dañados.',
     '[{"tipo":"shell","parametro":"sfc /scannow"}]',
     'sfc archivos sistema corruptos error windows pantalla azul BSOD',
     'manual'),

    (11,'windows','Ejecutar DISM (reparar imagen de Windows)',
     'SFC reporta errores que no puede reparar. Windows Update falla. Sistema inestable.',
     'Usar DISM para restaurar la imagen de Windows desde los servidores de Microsoft.',
     '[{"tipo":"shell","parametro":"DISM /Online /Cleanup-Image /RestoreHealth"}]',
     'dism imagen windows reparar update falla inestable corrupto',
     'manual'),

    (12,'windows','Ver eventos recientes del sistema',
     'Obtener los últimos errores o advertencias del Visor de Eventos para diagnóstico.',
     'Listar los últimos 20 eventos de error del log System.',
     '[{"tipo":"shell","parametro":"Get-EventLog -LogName System -EntryType Error,Warning -Newest 20 | Select-Object TimeGenerated,Source,Message | Format-Table -Wrap | Out-String -Width 200"}]',
     'visor eventos errores log sistema diagnostico crash',
     'manual'),

    (13,'windows','Ver procesos con alto consumo',
     'El equipo está muy lento. CPU o RAM al 100%.',
     'Listar los procesos ordenados por uso de CPU y memoria.',
     '[{"tipo":"shell","parametro":"Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name,Id,CPU,@{N=''RAM_MB'';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize | Out-String"}]',
     'lento cpu ram 100% proceso consumo alto memoria',
     'manual'),

    (14,'windows','Ver programas de inicio',
     'El equipo tarda mucho en arrancar. Ver qué programas inician con Windows.',
     'Listar entradas de inicio de Windows.',
     '[{"tipo":"shell","parametro":"Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | Format-Table -AutoSize | Out-String"}]',
     'inicio lento arranque startup programas inicio windows boot',
     'manual'),

    (15,'diagnostico','Diagnóstico completo del equipo',
     'Obtener información completa del equipo: hostname, usuario, IP, OS, RAM, CPU, disco.',
     'Ejecutar diagnóstico completo para conocer el estado del equipo.',
     '[{"tipo":"shell","parametro":"$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name; $os=Get-CimInstance Win32_OperatingSystem; $cpu=Get-CimInstance Win32_Processor | Select-Object -First 1; $disk=Get-CimInstance Win32_LogicalDisk -Filter ''DriveType=3'' | Where-Object {$_.DeviceID -eq ''C:''}; $ip=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {!$_.PrefixOrigin -eq ''WellKnown'' -and $_.IPAddress -notmatch ''^127\\.''} | Select-Object -First 1).IPAddress; Write-Output \"Equipo: $env:COMPUTERNAME\"; Write-Output \"Usuario: $u\"; Write-Output \"IP: $ip\"; Write-Output \"OS: $($os.Caption) $($os.Version)\"; Write-Output \"RAM Total: $([math]::Round($os.TotalVisibleMemorySize/1MB,1)) GB\"; Write-Output \"RAM Libre: $([math]::Round($os.FreePhysicalMemory/1MB,1)) GB\"; Write-Output \"CPU: $($cpu.Name)\"; Write-Output \"Disco C: Total: $([math]::Round($disk.Size/1GB,1))GB Libre: $([math]::Round($disk.FreeSpace/1GB,1))GB\""}]',
     'diagnostico informacion equipo hostname ip ram cpu disco sistema operativo',
     'manual'),

    (16,'diagnostico','Listar software instalado',
     'Ver qué programas están instalados en el equipo.',
     'Obtener lista de programas instalados via registro de Windows.',
     '[{"tipo":"shell","parametro":"Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object {$_.DisplayName} | Select-Object DisplayName,DisplayVersion,Publisher | Sort-Object DisplayName | Format-Table -AutoSize | Out-String -Width 200"}]',
     'software instalado programas lista aplicaciones',
     'manual'),

    (17,'diagnostico','Ver adaptadores de red',
     'Ver todos los adaptadores de red, sus IPs, MACs y estado.',
     'Obtener información detallada de red del equipo.',
     '[{"tipo":"shell","parametro":"Get-NetAdapter | Select-Object Name,Status,MacAddress,LinkSpeed | Format-Table; Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch ''^127\\.''} | Select-Object InterfaceAlias,IPAddress,PrefixLength | Format-Table | Out-String"}]',
     'adaptadores red ip mac wifi ethernet informacion red',
     'manual'),

    (18,'windows','Activar cuenta Administrador local',
     'Necesitar acceso de administrador local en el equipo. Cuenta admin desactivada.',
     'Activar y configurar la cuenta Administrador local con contraseña corporativa.',
     '[{"tipo":"shell","parametro":"net user Administrador M3d1v4ll3 /active:yes; if($LASTEXITCODE -ne 0){net user Administrator M3d1v4ll3 /active:yes}; Write-Output ''Cuenta Administrador activada.''"}]',
     'administrador local activar cuenta admin password contraseña',
     'script-share'),

    (19,'office','Diagnóstico de Office/Outlook',
     'Office o Outlook no abre, da error, está lento o crashea.',
     'Obtener versión de Office instalada y verificar estado básico.',
     '[{"tipo":"shell","parametro":"$o=Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration -ErrorAction SilentlyContinue; Write-Output \"Office: $($o.VersionToReport) Canal: $($o.CDNBaseUrl)\"; Get-Process outlook,winword,excel -ErrorAction SilentlyContinue | Select-Object Name,Id,CPU | Format-Table | Out-String"}]',
     'office outlook excel word no abre error crash lento',
     'manual'),

    (20,'windows','Estado de Windows Update',
     'Verificar si hay actualizaciones pendientes o si Windows Update tiene problemas.',
     'Consultar el estado de Windows Update y actualizaciones pendientes.',
     '[{"tipo":"shell","parametro":"$wu=New-Object -ComObject Microsoft.Update.Session; $searcher=$wu.CreateUpdateSearcher(); Write-Output ''Buscando actualizaciones...''; $result=$searcher.Search(''IsInstalled=0''); Write-Output \"Actualizaciones pendientes: $($result.Updates.Count)\"; $result.Updates | Select-Object -First 10 Title | Format-Table | Out-String"}]',
     'windows update actualizaciones pendientes windows update error',
     'manual')
  `,

  // ── Tipos de artículo para rótulos ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tipos_articulo (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL UNIQUE,
    activo     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `INSERT OR IGNORE INTO tipos_articulo (nombre) VALUES
    ('TONER'),('EQUIPO'),('CARGADOR'),('IMPRESORA'),('UPS'),('MONITOR'),
    ('TURNERO'),('TECLADO'),('ESCANER'),('MOUSE'),('VGA')`,

  // ── Confirmaciones de entrega (sin acta) ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS confirmaciones_entrega (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    despacho_id INTEGER NOT NULL UNIQUE REFERENCES despachos(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    confirmed_at TEXT,
    ip          TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_confirmaciones_token ON confirmaciones_entrega(token)`,

  `CREATE TABLE IF NOT EXISTS requerimientos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_num         TEXT UNIQUE NOT NULL,
    area               TEXT NOT NULL,
    nombre             TEXT NOT NULL,
    correo             TEXT DEFAULT '',
    punto              TEXT NOT NULL,
    tipo               TEXT NOT NULL,
    descripcion        TEXT NOT NULL,
    fecha_requerida    TEXT DEFAULT '',
    ticket_relacionado TEXT DEFAULT '',
    observaciones      TEXT DEFAULT '',
    prioridad          TEXT NOT NULL DEFAULT 'NORMAL',
    estado             TEXT NOT NULL DEFAULT 'Recibido',
    fotos              TEXT DEFAULT '[]',
    created_at         TEXT DEFAULT (datetime('now','localtime')),
    updated_at         TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `ALTER TABLE sedes ADD COLUMN despacho_id INTEGER REFERENCES despachos(id)`,
  `ALTER TABLE sedes ADD COLUMN tracking_token TEXT`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* columna ya existe */ }
}

// Limpiar sesiones expiradas al arrancar
try {
  db.exec("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')");
} catch {}

// Poblar tabla sedes desde datos estáticos si está vacía
const sedesCount = db.prepare('SELECT COUNT(*) as n FROM sedes').get().n;
if (sedesCount === 0) {
  const { CIUDADES } = await import('../whatsapp/sedes.js');
  const ins = db.prepare('INSERT INTO sedes (ciudad, nombre_punto) VALUES (?, ?)');
  for (const [ciudad, puntos] of Object.entries(CIUDADES)) {
    for (const punto of puntos) ins.run(ciudad, punto);
  }
  console.log(`[DB] Red de puntos inicializada: ${db.prepare('SELECT COUNT(*) as n FROM sedes').get().n} puntos.`);
}

export default db;
