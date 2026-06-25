export const migrations = [
  `INSERT OR IGNORE INTO permissions (name) VALUES
    ('employees:read'), ('employees:create'), ('employees:edit'), ('employees:delete')`,

  `INSERT OR IGNORE INTO roles (name, description) VALUES
    ('gestion_humana', 'Gestión Humana — creación de usuarios del sistema')`,

  // employees:read + employees:create para gestion_humana
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r, permissions p
   WHERE r.name = 'gestion_humana'
     AND p.name IN ('employees:read', 'employees:create')`,
];
