# Employees Module

Gestiona el registro de empleados con flujo de dos áreas (Gestión Humana e IT).

## Purpose

Módulo de administración de empleados con soporte para:
- Registro inicial por Gestión Humana
- Complementación de datos por equipo IT
- Auto-generación automática de credenciales de acceso
- Auditoría completa de cambios

## Workflow

1. **GH ingresa empleado**: Gestión Humana crea registro con cédula, nombre, cargo y área
2. **Auto-generación de credenciales**:
   - `usuario`: Iniciales de nombres + apellido (ej: Kelly Johana Raigoza → `KJRAIGOZA`)
   - `contraseña`: Últimos 4 dígitos de cédula (ej: 1130658563 → `8563`)
3. **IT completa datos**: Soporte técnico actualiza `fecha_respuesta_soporte` y datos faltantes
4. **Auditoría registrada**: Cada acción se registra en tabla `employee_logs`

## API Endpoints

### GET /api/employees
Obtener lista de empleados con filtros opcionales.

**Query Parameters**:
- `search`: Buscar por nombre, cédula o usuario
- `area`: Filtrar por área
- `cargo`: Filtrar por cargo
- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 10)

**Response**: `{ total, page, limit, data: [...] }`

### GET /api/employees/:id
Obtener detalles de empleado específico con historial de cambios.

**Response**: Incluye `logs` con auditoría de cambios.

### POST /api/employees
Crear nuevo empleado (requiere permiso `rh`).

**Body**:
```json
{
  "cedula": "1130658563",
  "nombre_completo": "Kelly Johana Raigoza",
  "cargo": "Técnico",
  "area": "IT"
}
```

**Validaciones**:
- Cédula: 8-12 dígitos, única
- Nombre: ≥3 caracteres
- Cargo y área: Requeridos

**Response**: Incluye `usuario` y `contraseña` auto-generados.

### PUT /api/employees/:id
Actualizar empleado (GH e IT).

**Body**: Campos actualizables: `nombre_completo`, `cedula`, `area`, `cargo`, `fecha_respuesta_soporte`

### DELETE /api/employees/:id
Eliminación lógica (soft delete). Requiere permiso `rh`.

### GET /api/employees-data/cargos
Obtener lista de cargos disponibles para dropdowns.

### GET /api/employees-data/areas
Obtener lista de áreas disponibles para dropdowns.

## Credential Auto-Generation

### Username Generation
- Extrae iniciales de todos los nombres excepto el último
- Combina con apellido en mayúsculas
- Si existe duplicado, agrega contador: `KJRAIGOZA2`, `KJRAIGOZA3`, etc.

### Password Generation
- Toma últimos 4 dígitos de la cédula
- Si cédula < 4 dígitos, completa con ceros a la izquierda
- Si existe duplicado, genera contraseña aleatoria de 4-6 dígitos

## Auditing

Tabla `employee_logs` registra:
- `employee_id`: ID del empleado
- `accion`: CREATE, UPDATE, COMPLETE, DELETE
- `campo_cambio`: Detalles del cambio (JSON)
- `logged_at`: Timestamp de la acción

**Queries de auditoría**:
```sql
-- Historial de cambios de un empleado
SELECT * FROM employee_logs WHERE employee_id = ? ORDER BY logged_at DESC;
```

## Permissions

- **rh**: Crear y eliminar empleados
- **auth**: Actualizar, consultar empleados (todos los usuarios autenticados)
