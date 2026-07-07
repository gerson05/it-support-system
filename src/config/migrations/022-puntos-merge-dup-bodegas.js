export const migrations = [
  // Si una bodega tiene mismo nombre+ciudad que un punto, la bodega es redundante — eliminar
  `DELETE FROM puntos WHERE tipo='bodega' AND (nombre || '|' || ciudad) IN (
    SELECT nombre || '|' || ciudad FROM puntos WHERE tipo='punto'
  )`,
];
