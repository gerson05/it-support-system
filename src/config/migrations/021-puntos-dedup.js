export const migrations = [
  // Eliminar duplicados — conservar el registro con id más bajo por (nombre, ciudad, tipo)
  `DELETE FROM puntos WHERE id NOT IN (
    SELECT MIN(id) FROM puntos GROUP BY nombre, ciudad, tipo
  )`,
  // Índice único para evitar futuros duplicados en restarts
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_puntos_unique ON puntos(nombre, ciudad, tipo)`,
];
