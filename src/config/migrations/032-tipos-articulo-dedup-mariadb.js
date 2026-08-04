export const migrations = [
  // MariaDB-compatible dedup (m031 used subquery on same table, which MySQL/MariaDB rejects)
  `DELETE FROM tipos_articulo WHERE id NOT IN (
    SELECT id FROM (SELECT MIN(id) AS id FROM tipos_articulo GROUP BY nombre) AS t
  )`,
];
