export const migrations = [
  // Remove duplicate rows keeping the lowest id per name
  `DELETE FROM tipos_articulo WHERE id NOT IN (
    SELECT MIN(id) FROM tipos_articulo GROUP BY nombre
  )`,
];
