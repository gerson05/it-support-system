import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';
import { logAudit } from '../audit/audit-logger.js';
import { readSheetRows } from '../mantis/catalog-parser.js';
import {
  CAMPOS, detectarEncabezado, sugerirMapeo, firmaEncabezados, validarMapeo, construirRegistros,
} from './personal-import.js';
import {
  importarRegistros, buscarEmpleados, getEmpleado, actualizarEmpleado, resumenPersonal,
  getMapeo, guardarMapeo, getConfig, setConfig, getPlantilla, guardarPlantilla,
  registrarCertificado, ultimosCertificados,
} from './personal-model.js';
import { camposFaltantes, valoresCertificado, generarDocx, marcadoresEnPlantilla, MARCADORES } from './certificado.js';
import {
  normTexto, normGenero, normEstado, normSalario, normFecha, normTipoContrato,
} from './formato.js';

const router = express.Router();

const canRead = [requireAuth, requirePermission('hr:read')];
const canEdit = [requireAuth, requirePermission('hr:edit')];
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const actor   = (req) => req.user?.username || 'IT';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Lee el Excel subido y ubica sus encabezados. */
function leerExcel(file) {
  if (!file) throw Object.assign(new Error('No se recibió archivo.'), { status: 400 });
  let rows;
  try { rows = readSheetRows(file.buffer); } catch {
    throw Object.assign(new Error('No se pudo leer el archivo. Verifica que sea un Excel (.xls o .xlsx).'), { status: 400 });
  }
  const headerIndex = detectarEncabezado(rows);
  if (headerIndex < 0) {
    throw Object.assign(new Error('No se encontró una fila de encabezados con la columna de cédula (Cédula, Nit, Identificación, Documento…).'), { status: 400 });
  }
  return { rows, headerIndex, headers: rows[headerIndex].map(h => String(h ?? '').trim()) };
}

const sendError = (res, err) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  throw err;
};

// ── Consulta y certificado ─────────────────────────────────────────────────

router.get('/api/hr/resumen', ...canRead, wrap(async (req, res) => {
  const plantilla = await getPlantilla(db);
  res.json({
    ...(await resumenPersonal(db)),
    config: await getConfig(db),
    plantilla: plantilla ? { archivo: plantilla.archivo, usuario: plantilla.usuario, updated_at: plantilla.updated_at } : null,
    certificados: await ultimosCertificados(db),
    campos: Object.fromEntries(Object.entries(CAMPOS).map(([k, v]) => [k, v.label])),
    marcadores: MARCADORES,
  });
}));

router.get('/api/hr/empleados', ...canRead, wrap(async (req, res) => {
  res.json(await buscarEmpleados(db, req.query.q));
}));

router.get('/api/hr/empleados/:cedula', ...canRead, wrap(async (req, res) => {
  const emp = await getEmpleado(db, req.params.cedula);
  if (!emp) return res.status(404).json({ error: 'No hay un empleado con esa cédula en los datos cargados.' });
  const valores = valoresCertificado(emp, await getConfig(db));
  res.json({ empleado: emp, faltantes: camposFaltantes(emp), tipo: valores.tipo, vista_previa: valores });
}));

/** Corrección manual de datos (queda guardada para próximos certificados). */
router.put('/api/hr/empleados/:cedula', ...canEdit, wrap(async (req, res) => {
  const b = req.body || {};
  const datos = {};
  if (b.nombre !== undefined)        datos.nombre = normTexto(b.nombre);
  if (b.genero !== undefined)        datos.genero = normGenero(b.genero);
  if (b.cargo !== undefined)         datos.cargo = normTexto(b.cargo);
  if (b.tipo_contrato !== undefined) datos.tipo_contrato = normTipoContrato(b.tipo_contrato);
  if (b.fecha_ingreso !== undefined) datos.fecha_ingreso = normFecha(b.fecha_ingreso);
  if (b.fecha_retiro !== undefined)  datos.fecha_retiro = normFecha(b.fecha_retiro);
  if (b.estado !== undefined)        datos.estado = normEstado(b.estado);
  if (b.salario !== undefined)       datos.salario = normSalario(b.salario);

  if (!(await actualizarEmpleado(db, req.params.cedula, datos))) {
    return res.status(404).json({ error: 'Empleado no encontrado.' });
  }
  await logAudit(actor(req), 'Datos de empleado corregidos', 'hr_empleado', null, req.params.cedula, { campos: Object.keys(datos) });
  const emp = await getEmpleado(db, req.params.cedula);
  res.json({ empleado: emp, faltantes: camposFaltantes(emp) });
}));

router.post('/api/hr/certificados', ...canRead, wrap(async (req, res) => {
  const cedula = String(req.body?.cedula || '').trim();
  const emp = await getEmpleado(db, cedula);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });

  const faltantes = camposFaltantes(emp);
  if (faltantes.length) {
    const nombres = faltantes.map(f => CAMPOS[f]?.label || f).join(', ');
    return res.status(400).json({ error: `Faltan datos para el certificado: ${nombres}.`, faltantes });
  }
  const plantilla = await getPlantilla(db);
  if (!plantilla) return res.status(409).json({ error: 'Aún no se ha cargado la plantilla del certificado.' });

  const valores = valoresCertificado(emp, await getConfig(db));
  const docx = generarDocx(plantilla.buffer, valores);

  await registrarCertificado(db, { cedula, nombre: emp.nombre, tipo: valores.tipo, usuario: actor(req) });
  await logAudit(actor(req), 'Certificado laboral generado', 'hr_empleado', null, cedula, { tipo: valores.tipo });

  const nombreArchivo = `Certificado laboral ${emp.nombre || cedula}.docx`.replace(/[\\/:*?"<>|]/g, '');
  res.setHeader('Content-Type', DOCX);
  res.setHeader('Content-Disposition', `attachment; filename="certificado.docx"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`);
  res.send(docx);
}));

// ── Carga de Excel de personal ─────────────────────────────────────────────

/** Paso 1: muestra qué columnas se reconocieron (o el mapeo recordado para ese formato). */
router.post('/api/hr/personal/preview', ...canEdit, upload.single('file'), wrap(async (req, res) => {
  let excel;
  try { excel = leerExcel(req.file); } catch (err) { return sendError(res, err); }
  const { rows, headerIndex, headers } = excel;
  const firma = firmaEncabezados(headers);
  const recordado = await getMapeo(db, firma);
  const mapeo = recordado || sugerirMapeo(headers);
  const { registros, filas, sinCedula } = construirRegistros(rows, headerIndex, mapeo);
  res.json({
    archivo: req.file.originalname,
    columnas: headers,
    mapeo,
    recordado: Boolean(recordado),
    campos: Object.fromEntries(Object.entries(CAMPOS).map(([k, v]) => [k, v.label])),
    filas,
    personas: registros.size,
    empleados: [...registros.values()].filter(r => r.es_empleado).length,
    sin_cedula: sinCedula,
  });
}));

/** Paso 2: carga con el mapeo confirmado y lo recuerda para la próxima vez. */
router.post('/api/hr/personal/importar', ...canEdit, upload.single('file'), wrap(async (req, res) => {
  let excel;
  try { excel = leerExcel(req.file); } catch (err) { return sendError(res, err); }
  const { rows, headerIndex, headers } = excel;

  let mapeo;
  try { mapeo = JSON.parse(req.body?.mapeo || 'null'); } catch { mapeo = null; }
  if (!mapeo || typeof mapeo !== 'object') return res.status(400).json({ error: 'Falta la correspondencia de columnas.' });
  mapeo = Object.fromEntries(Object.entries(mapeo).filter(([col, campo]) => campo && Number(col) < headers.length));
  const invalido = validarMapeo(mapeo);
  if (invalido) return res.status(400).json({ error: invalido });

  const { registros, filas, sinCedula } = construirRegistros(rows, headerIndex, mapeo);
  if (!registros.size) return res.status(400).json({ error: 'No se encontraron filas con cédula.' });

  await guardarMapeo(db, firmaEncabezados(headers), mapeo);
  const campos = [...new Set(Object.values(mapeo))];
  const result = await importarRegistros(db, registros, { archivo: req.file.originalname, usuario: actor(req), campos });
  await logAudit(actor(req), 'Excel de personal cargado', 'hr_carga', null, req.file.originalname,
    { filas, personas: registros.size, ...result, campos });

  res.json({ ok: true, filas, personas: registros.size, sin_cedula: sinCedula, ...result, resumen: await resumenPersonal(db) });
}));

// ── Configuración y plantilla ──────────────────────────────────────────────

router.put('/api/hr/config', ...canEdit, wrap(async (req, res) => {
  const config = await setConfig(db, req.body || {});
  await logAudit(actor(req), 'Configuración de certificados actualizada', 'hr_config', null, null, config);
  res.json(config);
}));

router.get('/api/hr/plantilla', ...canRead, wrap(async (req, res) => {
  const p = await getPlantilla(db);
  if (!p) return res.status(404).json({ error: 'Aún no se ha cargado la plantilla.' });
  res.setHeader('Content-Type', DOCX);
  res.setHeader('Content-Disposition', `attachment; filename="plantilla.docx"; filename*=UTF-8''${encodeURIComponent(p.archivo || 'plantilla.docx')}`);
  res.send(p.buffer);
}));

router.post('/api/hr/plantilla', ...canEdit, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });
  let marcadores;
  try {
    new AdmZip(req.file.buffer).readAsText('word/document.xml');
    marcadores = marcadoresEnPlantilla(req.file.buffer);
  } catch {
    return res.status(400).json({ error: 'El archivo no es un Word (.docx) válido.' });
  }
  if (!marcadores.includes('nombre') || !marcadores.includes('cedula')) {
    return res.status(400).json({ error: 'La plantilla debe tener al menos los campos {{nombre}} y {{cedula}}.' });
  }
  const desconocidos = marcadores.filter(m => !MARCADORES[m]);
  await guardarPlantilla(db, req.file.buffer, { archivo: req.file.originalname, usuario: actor(req) });
  await logAudit(actor(req), 'Plantilla de certificado cargada', 'hr_plantilla', null, req.file.originalname, { marcadores });
  res.json({ ok: true, marcadores, desconocidos });
}));

export default router;
