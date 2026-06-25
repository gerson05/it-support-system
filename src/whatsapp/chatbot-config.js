export const AREA_MAP_FULL = {
  '1': 'cartera',
  '2': 'compra',
  '3': 'gestion_humana',
  '4': 'pqrs',
  '5': 'contabilidad',
  '6': 'farmacia',
  '7': 'cuentas_medicas',
};

export const AREA_MAP_SIMPLE = {
  '1': 'administrativo',
  '2': 'farmacia',
};

export const AREA_NAMES = {
  cartera:         'Cartera',
  compra:          'Compra',
  gestion_humana:  'Gestión Humana',
  pqrs:            'PQRS',
  contabilidad:    'Contabilidad',
  farmacia:        'Farmacia',
  cuentas_medicas: 'Cuentas Médicas',
  administrativo:  'Administrativo',
};

export const STATUS_LABELS_WA = {
  abierto:     '🔵 Abierto',
  en_progreso: '🟡 En progreso',
  en_espera:   '🟠 En espera',
  resuelto:    '✅ Resuelto',
  cerrado:     '⬜ Cerrado',
};

export const AREA_EXAMPLES = {
  cartera:
    '• _"El software no abre o da error"_\n' +
    '• _"No puedo generar reportes de cobros"_\n' +
    '• _"Olvidé mi contraseña del sistema"_',
  compra:
    '• _"Error 500 al guardar una orden de compra"_\n' +
    '• _"No puedo entrar al portal de proveedores"_\n' +
    '• _"El flujo de aprobación está bloqueado"_',
  gestion_humana:
    '• _"Error al liquidar o procesar la nómina"_\n' +
    '• _"El biométrico no registra mi huella"_\n' +
    '• _"No puedo subir archivos al portal de empleados"_',
  pqrs:
    '• _"El sistema no guarda los nuevos registros"_\n' +
    '• _"La asignación automática de casos falla"_',
  contabilidad:
    '• _"Siigo está muy lento o se congela"_\n' +
    '• _"Error al firmar la factura electrónica"_\n' +
    '• _"Los balances no cuadran en el módulo fiscal"_',
  farmacia:
    '• _"El lector de barras no funciona o escribe caracteres raros"_\n' +
    '• _"Las etiquetas Zebra no imprimen"_\n' +
    '• _"Error de stock al despachar un medicamento"_\n' +
    '• _"La impresora Epson L1536 / L400 / L364 se quedó sin tinta"_',
  cuentas_medicas:
    '• _"Error al generar los archivos RIPS"_\n' +
    '• _"La plataforma de la EPS no reconoce la firma digital"_\n' +
    '• _"Error de conexión en el software de facturación"_',
  administrativo:
    '• _"No puedo entrar a algún sistema o aplicativo"_\n' +
    '• _"Problemas con el equipo, impresora o red"_\n' +
    '• _"Error en un programa o software de oficina"_',
};
