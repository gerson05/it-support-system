# Módulo Creación de Usuarios - Design Spec

**Fecha:** 2026-06-25  
**Scope:** Nuevo módulo para gestión de registro de empleados con flujo de dos áreas (Gestión Humana + IT)

---

## 1. PROPÓSITO

Optimizar flujo manual de creación de usuarios:
- **Gestión Humana** ingresa datos iniciales (Cedula, Nombre, Cargo, Area)
- **IT** completa registro con credenciales (Usuario, Contraseña, Fecha Respuesta)
- Ambas áreas ven histórico completo con indicadores de estado (Pendiente/Completado)

---

## 2. REQUERIMIENTOS

### Datos de Entrada
- Cedula (8-12 dígitos, único)
- Nombre Completo
- Cargo (dropdown desde tabla `employee_cargos`)
- Area/Farmacia (dropdown desde tabla `employee_areas`)
- Usuario (auto-generado, validado único)
- Contraseña (auto-generada, validada única)
- Fecha Respuesta Soporte (datepicker)

### Lógica de Estado
- **Pendiente**: campo fecha está vacío
- **Completado**: todos los campos IT (usuario, contraseña, fecha) están llenos
- Usuario y Contraseña se generan automáticamente cuando IT guarda
- Auditoría: registra `created_by`, `updated_by`, timestamps

### Auto-Generación de Credenciales

**Usuario:**
1. Extraer iniciales de cada nombre (antes del apellido)
2. Tomar primer apellido
3. Combinar sin espacios + mayúsculas
   - Ej: Kelly Johana Raigoza Herrera → KJRaigoza → KJRAIGOZA
4. Validar no existe en BD, si existe agregar número (KJRAIGOZA2)

**Contraseña:**
1. Tomar últimos 4 dígitos de cédula (fórmula Excel: `=RIGHT(TEXT(cedula,"0"),4)`)
   - Ej: 1130658563 → 8563
2. Validar no existe en BD (raro pero posible), si existe generar aleatoria de 4-6 dígitos

### Permisos
- **Gestión Humana**: crear empleados, editar sección GH, ver todo
- **IT**: ver todo, editar sección IT, completar registros
- **Admin IT**: CRUD completo

### Vistas
1. **Pendientes**: tabla filtrada, solo registros incompletos
2. **Completados**: tabla filtrada, registros con todos campos IT
3. **Modal Formulario**: crear/editar con ambas secciones siempre visibles

---

## 3. ARQUITECTURA

### Base de Datos

**Tabla: `employees`**
```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cedula TEXT UNIQUE NOT NULL,
  nombre_completo TEXT NOT NULL,
  cargo TEXT NOT NULL,
  area TEXT NOT NULL,
  usuario TEXT UNIQUE,
  contraseña TEXT,
  fecha_respuesta_soporte TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at DATETIME,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);
```

**Tabla: `employee_cargos`**
```sql
CREATE TABLE employee_cargos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL
);
```

**Tabla: `employee_areas`**
```sql
CREATE TABLE employee_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL
);
```

**Tabla: `employee_logs`** (auditoría)
```sql
CREATE TABLE employee_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  accion TEXT NOT NULL, -- 'create', 'update', 'delete'
  campo_cambio TEXT, -- campo editado
  valor_anterior TEXT,
  valor_nuevo TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (usuario_id) REFERENCES users(id)
);
```

### API Routes

**`src/employees/employees-routes.js`**

- `GET /api/employees` - listado (query params: filter=pendiente|completado)
- `GET /api/employees/:id` - detalle
- `POST /api/employees` - crear (Gestión Humana inicia)
- `PUT /api/employees/:id` - editar (ambos)
- `DELETE /api/employees/:id` - eliminar (admin)
- `GET /api/employees/cargos/list` - dropdown cargos
- `GET /api/employees/areas/list` - dropdown áreas

### Frontend

**`public/js/employees.js`** - lógica principal
- Cargar listado (filtrado por estado)
- Abrir modal crear/editar
- Guardar cambios
- Validar campos

**`public/js/employees-form.js`** - modal formulario
- Renderizar secciones GH + IT
- Detectar cambios
- Submit

**`public/registrar-empleado.html`** (nueva página)
- Navegación (pestañas Pendientes/Completados)
- Tabla dual
- Modal formulario

---

## 4. FLUJO DE DATOS

1. **Gestión Humana crea:**
   - Abre "Registrar Empleado"
   - Clickea "+ Nuevo"
   - Completa: Cedula, Nombre, Cargo, Area
   - Sección IT vacía (placeholder "Por completar")
   - Guarda → BD (`created_by=GH_user_id`)

2. **IT completa:**
   - Ve registro en tab "Pendientes"
   - Abre registro
   - Ingresa: Fecha Respuesta Soporte (Usuario y Contraseña se generan automáticamente)
   - Guarda → BD: sistema genera usuario (iniciales+apellido) y contraseña (últimos 4 de cédula)
   - Valida no haya duplicados, si existe agrega número/random
   - Guarda → BD (`updated_by=IT_user_id`, estado → "Completado")
   - Registro se mueve visualmente a "Completados"

3. **Edición posterior:**
   - Cualquiera puede editar cualquier campo
   - Log registra cambio: usuario, campo, valores antes/después

---

## 5. VALIDACIONES

| Campo | Validación |
|-------|-----------|
| Cedula | 8-12 dígitos, único en BD |
| Nombre | No vacío, min 3 caracteres, extraer initiales para usuario |
| Cargo | Debe estar en tabla `employee_cargos` |
| Area | Debe estar en tabla `employee_areas` |
| Usuario | Auto-generado, validar no exista en BD (sufijo contador si existe) |
| Contraseña | Auto-generada (últimos 4 de cédula), validar no exista (random si existe) |
| Fecha | Válida, no futura, requerida para completar |

**Regla especial:** Usuario y Contraseña se generan automáticamente en el servidor cuando IT guarda. No se pueden editar manualmente.

---

## 6. INTEGRACIÓN CON EXCEL

**Carga inicial:**
- Script Node.js: leer Excel "CREACION DE USUARIOS PERSONAL NUEVO (1).xlsx"
- Importar hoja "Datos" → tablas `employee_cargos`, `employee_areas`
- Importar hoja "Base" (filas 2-1000) → tabla `employees` si no existe cedula

**No hay sincronización continua:** cambios en plataforma no afectan Excel (solo visual).

---

## 7. CASOS DE ERROR

| Escenario | Respuesta |
|-----------|----------|
| Cedula duplicada | 409 Conflict: "Cedula ya registrada" |
| Usuario duplicado | 409 Conflict: "Usuario ya existe" |
| Contraseña < 4 caracteres | 400 Bad Request |
| Usuario sin Contraseña | 400 Bad Request: "Completa ambos o ninguno" |
| Permiso insuficiente | 403 Forbidden |
| Registro no encontrado | 404 Not Found |

---

## 8. PERMISOS & AUDITORÍA

**Middleware:**
- Todas rutas: `requireAuth`
- Edición IT: `requirePermission('employees:edit')` (Gestión Humana + IT)
- Eliminación: `requirePermission('employees:delete')` (Admin IT)

**Auditoría:**
- Cada cambio crea log en `employee_logs`
- UI muestra: "Completado por [nombre IT] el [fecha]"
- Admin puede revisar historial de cambios

---

## 9. INTERFAZ

### Layout

**Página: `/registrar-empleado.html`**
- Header: "Creación de Usuarios - Personal Nuevo"
- Tabs: [Pendientes] [Completados] [Histórico]
- Tabla:
  - Cedula | Nombre | Cargo | Area | Estado | Usuario | Contraseña | Fecha | Acciones
- Botón "+ Nuevo Empleado"

### Modal Crear/Editar

**Sección Gestión Humana (Azul):**
- ✓ Cedula (readonly en edit)
- ✓ Nombre Completo
- ✓ Cargo (dropdown)
- ✓ Area (dropdown)

**Sección IT (Rojo):**
- Usuario (readonly, auto-generado al guardar: iniciales + apellido)
- Contraseña (readonly, auto-generada al guardar: últimos 4 de cédula)
- Fecha Respuesta Soporte (datepicker, requerido para completar)
- Nota: Usuario/Contraseña se generan automáticamente cuando IT guarda por 1ª vez

**Indicadores:**
- Estado badge: "PENDIENTE" (rojo) | "COMPLETADO" (verde)
- Metadata: "Creado por [usuario] el [fecha]" | "Completado por [usuario] el [fecha]"

---

## 10. TESTING MANUAL

1. **Crear empleado (GH):** cedula válida → estado pendiente, usuario/contraseña vacíos ✓
2. **Completar (IT):** ingresa fecha → sistema genera usuario (iniciales+apellido) + contraseña (últimos 4) → estado completado ✓
3. **Usuario duplicado:** si existe KJRAIGOZA, genera KJRAIGOZA2 ✓
4. **Contraseña duplicada:** si existen últimos 4, genera aleatoria ✓
5. **Filtros:** pendientes/completados aislados ✓
6. **Auditoría:** logs registran quién generó credenciales ✓
7. **Permisos:** GH no puede editar IT, IT no puede crear ✓

---

## 11. NOTAS

- No hay descarga/exporta a Excel
- Contraseña se almacena en texto plano (auditoría/admin solo)
- Cargos y Areas se importan del Excel y se mantienen en BD
- Futuro: cifrar contraseñas, integración con Active Directory, notificaciones por correo
