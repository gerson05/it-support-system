# ════════════════════════════════════════════════════════
#  Imagen de producción — Frontend vanilla JS (public/)
# ════════════════════════════════════════════════════════
FROM node:22-slim AS production

# ── Dependencias del sistema ──────────────────────────
# Chromium para whatsapp-web.js / puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libxrandr2 \
    libxss1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libcups2 \
    libpango-1.0-0 \
    libcairo2 \
    # Herramientas de compilación nativas (bcrypt, sqlite addons)
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# ── Variables de entorno para Puppeteer / Chromium ────
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium \
    NODE_ENV=production

# ── Crear usuario no-root para seguridad ──────────────
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

WORKDIR /app

# ── Instalar dependencias del servidor ────────────────
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Copiar código fuente del servidor ─────────────────
COPY server.js ./
COPY src/ ./src/
COPY public/ ./public/
COPY database/ ./database/
COPY credentials/ ./credentials/

# ── Crear directorios persistentes y asignar permisos ─
RUN mkdir -p database uploads exports .wwebjs_auth .wwebjs_cache \
    && chown -R appuser:appuser /app

# ── Cambiar a usuario sin privilegios ─────────────────
USER appuser

# ── Puerto expuesto ────────────────────────────────────
EXPOSE 3000

# ── Health check ──────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ── Arrancar la aplicación ────────────────────────────
CMD ["node", "server.js"]
