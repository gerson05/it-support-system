import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateActa } from '../tech-requests/acta-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTAS_DIR = path.resolve(__dirname, '../../uploads/tracking-actas');

if (!fs.existsSync(ACTAS_DIR)) fs.mkdirSync(ACTAS_DIR, { recursive: true });

export async function generateActaReceptor(despacho, evento, items) {
  const requestObj = {
    request_number: despacho.numero,
    requester_name: evento.recibido_por,
    cedula: '',
    cargo: evento.cargo_receptor || '',
    sede: evento.ubicacion,
    items: items.map((item, idx) => ({
      equipment_name: item.equipment_name,
      quantity: item.cantidad || 1,
      serial: '',
    })),
  };

  const eqItems = items.map(item => ({
    marca: item.recibido_conforme ? '✓ Conforme' : '✗ No conforme',
    modelo: '',
    serial: '',
    accesorios: '',
    observaciones: item.observacion_item || '',
  }));

  const buffer = await generateActa(requestObj, eqItems, evento.recibido_por);

  const safeName = (despacho.numero || 'DES').replace(/[^a-zA-Z0-9\-_]/g, '_');
  const filename = `Acta_Recepcion_${safeName}.docx`;
  const filepath = path.join(ACTAS_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  return { filepath, filename };
}
