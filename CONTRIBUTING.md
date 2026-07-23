# Guía de Contribución

---

## Requisitos

- Node.js 24+
- npm 10+
- Docker + Docker Compose (para pruebas de integración locales)

---

## Setup local

```bash
git clone https://github.com/gerson05/it-support-system.git
cd it-support-system
npm install
cp .env.example .env
# Editar .env — mínimo: INIT_ADMIN_PASS, DISABLE_WHATSAPP=true
node server.js
```

Panel en `http://localhost:3000`.

Ver [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) para referencia completa de variables.

---

## Ejecutar tests

```bash
# Unit tests (rápido, sin servidor)
npm run test:unit

# Unit tests + cobertura
npm run test:coverage

# Unit tests + cobertura + umbrales CI (falla si bajan de 90/75/85)
npm run test:ci

# Smoke tests E2E (levanta servidor real en puerto 3001)
node test-ci.mjs
```

Los umbrales de cobertura son: **líneas ≥ 90% · ramas ≥ 75% · funciones ≥ 85%**.

---

## Estrategia de branches

```
main          — producción estable, protegida
stage         — pre-producción / QA
develop       — integración de features en progreso
feat/<nombre> — nueva funcionalidad
fix/<nombre>  — corrección de bug
ci/<nombre>   — cambios solo de CI/CD
docs/<nombre> — cambios solo de documentación
```

Los PRs van siempre hacia `main`. La rama `stage` se usa para validar en contenedor antes del merge final.

---

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org):

| Prefijo | Cuándo usarlo | Bump de versión |
|---------|--------------|-----------------|
| `feat:` | Nueva funcionalidad visible para el usuario | Minor (`1.1.0`) |
| `fix:` | Corrección de bug | Patch (`1.0.1`) |
| `ci:` | Cambios en workflows de GitHub Actions | Sin release |
| `docs:` | Solo documentación | Sin release |
| `chore:` | Dependencias, configuración interna | Sin release |
| `refactor:` | Reestructuración sin cambio de comportamiento | Sin release |
| `test:` | Agregar o corregir tests | Sin release |
| `feat!:` / `BREAKING CHANGE:` | Rompe compatibilidad hacia atrás | Major (`2.0.0`) |

Ejemplos:
```
feat: add employee CSV export endpoint
fix: escape HTML in despacho error messages
ci: add Trivy security scan to pipeline
docs: add ERP environment variables
```

---

## Flujo de PR

1. Crear branch desde `main`: `git checkout -b feat/mi-feature main`
2. Hacer commits con prefijos convencionales
3. Abrir PR hacia `main`
4. CI debe pasar los 4 checks: **Unit Tests**, **Smoke Tests**, **Security Audit**, **API Tests**
5. Review y merge

Release Please crea automáticamente el PR de versión después de cada merge a `main`.

---

## Agregar un nuevo test

Los tests usan el **Node.js test runner nativo** (`node:test`) con `--experimental-test-module-mocks`.

Estructura de un test nuevo:

```js
// tests/<modulo>/<modulo>-routes.test.mjs
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock de dependencias antes del import del módulo bajo prueba
mock.module('../../src/config/database.js', {
  namedExports: { default: { prepare: () => ({ all: () => [], get: () => null, run: () => ({}) }) } }
});

const { default: router } = await import('../../src/<modulo>/<modulo>-routes.js');
```

Agregar el nuevo archivo al script `test:unit` en `package.json`.

---

## Estructura del proyecto

Ver [README.md](README.md#estructura-del-proyecto) para el árbol de directorios.

Ver [docs/TECH-DEBT.md](docs/TECH-DEBT.md) para deuda técnica conocida antes de tocar áreas sensibles.

---

## Seguridad

- No commitear `.env`, credenciales, ni archivos de base de datos
- Todo input de usuario que se inserte en el DOM debe pasar por la función `_esc()` (HTML escape)
- Los endpoints públicos deben tener rate limiting (ver `src/utils/` para helpers existentes)
- `npm audit` y Trivy corren en cada PR — los CRITICAL bloquean el merge
