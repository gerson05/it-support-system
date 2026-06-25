/**
 * inventario-routes.js — Index router
 *
 * Composes all inventory sub-routers into a single Express router.
 * Business logic lives in the individual module files:
 *   - equipos-routes.js    → CRUD for computers/laptops
 *   - celulares-routes.js  → CRUD for mobile phones
 *   - ups-routes.js        → CRUD for UPS units
 *   - import-routes.js     → Excel .xlsx import (parse + confirm)
 *   - registro-routes.js   → Shareable registration tokens + mobile self-registration
 */

import express         from 'express';
import equiposRouter   from './equipos-routes.js';
import celularesRouter from './celulares-routes.js';
import upsRouter       from './ups-routes.js';
import importRouter    from './import-routes.js';
import registroRouter  from './registro-routes.js';

const router = express.Router();

router.use(equiposRouter);
router.use(celularesRouter);
router.use(upsRouter);
router.use(importRouter);
router.use(registroRouter);

export default router;
