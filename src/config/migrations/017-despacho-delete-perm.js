export const migrations = [
  // Grant despacho:delete to almacen (role 4) and admin (role 1 has 'full', already covered)
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r, permissions p
   WHERE r.name IN ('almacen')
     AND p.name = 'despacho:delete'`,
];
