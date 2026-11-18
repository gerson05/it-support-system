// Ciudades / puntos creados desde Inventario para generar la placa AF-{codigo}{NNN}.
// La lista base está en public/js/features/inventario/placa-ciudades.js; aquí solo las nuevas.
export const migrations = [
  `CREATE TABLE IF NOT EXISTS placa_ciudades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo       VARCHAR(80)  NOT NULL,
    nombre      VARCHAR(80)  NOT NULL,
    valor       VARCHAR(80)  NOT NULL UNIQUE,
    codigo      VARCHAR(3)   NOT NULL UNIQUE,
    usuario     VARCHAR(100),
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,
];
