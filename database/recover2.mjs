import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';

const src = new DatabaseSync('/app/database/tickets.db');

// Try to recover inventario_equipos row by row
const recovered = [];
let maxId = 0;
try { maxId = src.prepare('SELECT MAX(rowid) as m FROM inventario_equipos').get().m || 0; } catch {}
console.log('Max rowid inventario_equipos:', maxId);

for (let i = 1; i <= maxId; i++) {
  try {
    const row = src.prepare('SELECT * FROM inventario_equipos WHERE rowid = ?').get(i);
    if (row) recovered.push(row);
  } catch {}
}
console.log(`Recovered ${recovered.length} / ${maxId} rows from inventario_equipos`);

// Same for puntos
const puntos = [];
let maxPuntos = 0;
try { maxPuntos = src.prepare('SELECT MAX(rowid) as m FROM puntos').get().m || 0; } catch {}
for (let i = 1; i <= maxPuntos; i++) {
  try {
    const row = src.prepare('SELECT * FROM puntos WHERE rowid = ?').get(i);
    if (row) puntos.push(row);
  } catch {}
}
console.log(`Recovered ${puntos.length} / ${maxPuntos} rows from puntos`);

// paquete_tracking
const tracking = [];
let maxT = 0;
try { maxT = src.prepare('SELECT MAX(rowid) as m FROM paquete_tracking').get().m || 0; } catch {}
for (let i = 1; i <= maxT; i++) {
  try {
    const row = src.prepare('SELECT * FROM paquete_tracking WHERE rowid = ?').get(i);
    if (row) tracking.push(row);
  } catch {}
}
console.log(`Recovered ${tracking.length} / ${maxT} rows from paquete_tracking`);

writeFileSync('/app/database/recovered_tables.json', JSON.stringify({ inventario_equipos: recovered, puntos, paquete_tracking: tracking }));
console.log('Saved to /app/database/recovered_tables.json');
