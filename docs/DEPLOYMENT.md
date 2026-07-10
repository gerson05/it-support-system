# Guía de Despliegue

Instrucciones para desplegar el sistema en un VPS con Docker.

---

## Requisitos del Servidor

- Ubuntu 22.04 LTS (o similar)
- Docker 24+ y Docker Compose v2
- Puerto 80 y 443 abiertos en el firewall
- Dominio apuntando a la IP del servidor

---

## 1. Preparar el servidor

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose version
```

---

## 2. Clonar el repositorio

```bash
git clone https://github.com/gerson05/it-support-system.git
cd it-support-system
```

O usar la imagen ya construida en GHCR:

```bash
docker pull ghcr.io/gerson05/it-support-system:latest
```

---

## 3. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Variables obligatorias para producción:

```env
NODE_ENV=production
DOMAIN=soporte.tuempresa.com          # Tu dominio real
INIT_ADMIN_PASS=contraseña-segura-aqui

IT_WHATSAPP_NUMBER=573001234567
WHATSAPP_VERIFY_TOKEN=token-secreto-largo

LLM_PROVIDER=gemini                    # Opcional
GEMINI_API_KEY=AIza...                 # Opcional
```

---

## 4. Configurar Caddyfile

Edita `Caddyfile` y reemplaza el dominio:

```caddyfile
soporte.tuempresa.com {
    reverse_proxy it-support:3000
}
```

Caddy obtiene y renueva el certificado TLS automáticamente via Let's Encrypt.

---

## 5. Iniciar el sistema

```bash
docker compose up -d
```

Verificar que arrancó correctamente:

```bash
docker compose logs -f it-support
```

Deberías ver:

```
[Auth] Usuario admin creado
  Usuario:    admin
  Contraseña: (la que configuraste en INIT_ADMIN_PASS)
🚀 Sistema de Tickets IT corriendo exitosamente.
```

---

## 6. Conectar WhatsApp

1. Abre el panel: `https://soporte.tuempresa.com`
2. Inicia sesión con `admin` y la contraseña de `INIT_ADMIN_PASS`
3. Ve a **Configuración → WhatsApp**
4. Escanea el QR con el celular del número de IT

El estado cambia a "Conectado" cuando el QR es escaneado.

---

## Actualizar a nueva versión

```bash
# Desde el directorio del proyecto
git pull

# Reconstruir imagen
docker compose build

# Reiniciar sin downtime (recrear solo el servicio app)
docker compose up -d --no-deps it-support
```

O usar la imagen de GHCR directamente:

```bash
docker compose pull
docker compose up -d
```

---

## Backups

La base de datos es un archivo SQLite en el volumen `db_data`.

```bash
# Backup manual
docker run --rm \
  -v it-tickets_db_data:/data \
  -v $(pwd)/backups:/backup \
  alpine cp /data/tickets.db /backup/tickets-$(date +%Y%m%d).db

# Ver tamaño actual
docker run --rm -v it-tickets_db_data:/data alpine du -sh /data/
```

Recomendado: cron de backup diario + rotación de 30 días.

---

## Monitoreo

```bash
# Estado de los contenedores
docker compose ps

# Logs en tiempo real
docker compose logs -f

# Uso de recursos
docker stats
```

El endpoint `/api/health` devuelve `HTTP 200` cuando el sistema está operativo. Úsalo con herramientas como UptimeRobot o Better Stack.

---

## Solución de Problemas

### WhatsApp no se conecta

```bash
# Ver logs de WhatsApp específicamente
docker compose logs it-support | grep -i whatsapp

# Forzar reconexión limpiando sesión
docker compose exec it-support rm -rf /home/appuser/.wwebjs_auth
docker compose restart it-support
```

### Base de datos bloqueada (WAL)

```bash
docker compose exec it-support \
  node -e "
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync('/app/database/tickets.db');
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    db.close();
    console.log('Checkpoint OK');
  "
```

### Puerto 80/443 bloqueado

Verifica que el firewall permite tráfico:

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw status
```
