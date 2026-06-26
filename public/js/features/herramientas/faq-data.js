export const faqs = [
  {
    id: 'gen-001',
    area: 'general',
    title: '¿Cómo restauro mi contraseña de Windows/Active Directory?',
    keywords: ['contraseña', 'clave', 'bloqueado', 'usuario', 'restablecer', 'cambiar'],
    category: 'accesos',
    solution: '1. Llama a la extensión 101 de IT o acércate a la oficina con tu documento de identidad.\n2. Te daremos una contraseña temporal que deberás cambiar en el primer inicio de sesión.\n3. Al cambiarla, asegúrate de que tenga al menos 8 caracteres, una mayúscula y un número.'
  },
  {
    id: 'gen-002',
    area: 'general',
    title: 'La VPN no me conecta en el computador de casa',
    keywords: ['vpn', 'remoto', 'casa', 'fuera', 'forticlient', 'conexion'],
    category: 'red',
    solution: '1. Verifica que tengas conexión a internet en tu casa abriendo cualquier página web.\n2. Abre FortiClient y comprueba que la dirección del servidor sea vpn.empresa.com.\n3. Asegúrate de ingresar tu usuario sin "@empresa.com".\n4. Si el error persiste, apaga el router de tu casa por 10 segundos, enciéndelo y reintenta.'
  },
  {
    id: 'gen-003',
    area: 'general',
    title: 'La impresora del pasillo no imprime o está atascada',
    keywords: ['impresora', 'imprimir', 'papel', 'atasco', 'tinta', 'toner'],
    category: 'hardware',
    solution: '1. Ve a la impresora y revisa la pantalla táctil para ver el mensaje de error.\n2. Si hay atasco de papel, abre la compuerta indicada en la pantalla y saca el papel suavemente.\n3. Si está sin tóner, el software enviará una alerta automática a IT, pero puedes avisarnos para agilizar el cambio.\n4. Si no responde, apágala del botón lateral, espera 5 segundos y enciéndela.'
  },
  {
    id: 'gen-004',
    area: 'general',
    title: 'Mi computador está extremadamente lento',
    keywords: ['lento', 'demora', 'traba', 'tilda', 'congelado'],
    category: 'software',
    solution: '1. Guarda tus trabajos y reinicia el computador. Esto libera memoria RAM acumulada.\n2. Cierra pestañas del navegador que no estés utilizando (Chrome/Edge consumen mucho recurso).\n3. Revisa si hay actualizaciones de Windows pendientes e instálalas.\n4. Si continúa lento, crearemos un ticket para hacer una limpieza física e interna del equipo.'
  },
  {
    id: 'gen-005',
    area: 'general',
    title: 'No carga mi correo electrónico institucional (Outlook)',
    keywords: ['correo', 'outlook', 'email', 'mensajes', 'recibir', 'enviar'],
    category: 'software',
    solution: '1. Verifica si puedes acceder al correo vía web ingresando a outlook.office.com.\n2. Si por la web funciona, cierra la aplicación de escritorio de Outlook y vuelve a abrirla.\n3. Si pide contraseña, escríbela correctamente. Si la cambiaste recientemente, es posible que debas actualizarla en la app.'
  },
  {
    id: 'gen-006',
    area: 'general',
    title: 'No puedo acceder a la carpeta compartida en la red',
    keywords: ['carpeta', 'compartida', 'red', 'servidor', 'disco', 'acceso', 'permiso'],
    category: 'red',
    solution: '1. Verifica que estés conectado a la red de la oficina por cable o Wifi corporativo (o VPN desde casa).\n2. Presiona Windows + R, escribe "\\\\servidor\\compartido" y presiona Enter.\n3. Si te pide credenciales, ingresa tu usuario de red.\n4. Si dice "Acceso denegado", tu jefe directo debe enviar un ticket autorizando tu acceso a esa carpeta específica.'
  },
  {
    id: 'gen-007',
    area: 'general',
    title: 'Mi pantalla está en negro o no enciende',
    keywords: ['pantalla', 'monitor', 'negro', 'prende', 'video', 'imagen'],
    category: 'hardware',
    solution: '1. Verifica que el cable de energía del monitor esté bien conectado al enchufe.\n2. Asegúrate de que el cable de video (HDMI o DisplayPort) esté bien ajustado tanto en el monitor como en la torre del computador.\n3. Presiona el botón de encendido del monitor y verifica si enciende el led (azul/verde/amarillo).\n4. Presiona Windows + Ctrl + Shift + B para reiniciar los drivers de video.'
  },
  {
    id: 'gen-008',
    area: 'general',
    title: 'El mouse o el teclado no responden',
    keywords: ['mouse', 'teclado', 'raton', 'escribir', 'funciona', 'usb'],
    category: 'hardware',
    solution: '1. Si son inalámbricos, cambia las pilas por unas nuevas.\n2. Si son con cable, desconéctalos del puerto USB e insértalos en otro puerto diferente de la torre.\n3. Espera 10 segundos para que Windows reinstale los controladores automáticamente.'
  },

  // CARTERA
  {
    id: 'car-001',
    area: 'cartera',
    title: 'El software de gestión de cartera no abre o da error de base de datos',
    keywords: ['software', 'cartera', 'programa', 'error', 'abre', 'conexion'],
    category: 'software',
    solution: '1. Cierra el programa por completo desde el Administrador de Tareas (Ctrl+Shift+Esc).\n2. Asegúrate de tener conexión al servidor principal de cartera.\n3. Haz clic derecho sobre el acceso directo del programa y selecciona "Ejecutar como administrador".\n4. Si el error persiste, realizaremos una reinstalación del motor de base de datos local.'
  },
  {
    id: 'car-002',
    area: 'cartera',
    title: 'No se generan los reportes de cobros en PDF/Excel',
    keywords: ['reporte', 'pdf', 'excel', 'cobros', 'descargar', 'generar'],
    category: 'software',
    solution: '1. Asegúrate de que no tengas bloqueadas las ventanas emergentes en tu navegador o sistema.\n2. Verifica que la carpeta temporal de descargas tenga permisos de escritura.\n3. Intenta generar un rango de fechas más pequeño para evitar que el sistema se quede sin memoria.'
  },
  {
    id: 'car-003',
    area: 'cartera',
    title: 'Restablecer contraseña del sistema de Cartera',
    keywords: ['contraseña', 'usuario', 'clave', 'cartera', 'acceder'],
    category: 'accesos',
    solution: '1. El administrador del sistema de cartera de tu área puede restablecer tu contraseña directamente.\n2. Si él no está disponible, escálanos la solicitud y con tu número de cédula restableceremos tu contraseña en la base de datos al valor por defecto.'
  },

  // COMPRA
  {
    id: 'com-001',
    area: 'compra',
    title: 'El sistema de órdenes de compra arroja "Error 500" al guardar',
    keywords: ['orden', 'compra', 'sistema', 'guardar', 'error', '500'],
    category: 'software',
    solution: '1. Este error usualmente indica que falta un campo obligatorio o un formato de archivo adjunto no es válido.\n2. Verifica que los archivos adjuntos no pesen más de 5MB y estén en formato PDF.\n3. Intenta borrar el caché del navegador (Ctrl+F5) e ingresa nuevamente.'
  },
  {
    id: 'com-002',
    area: 'compra',
    title: 'No puedo acceder al Portal de Proveedores Externo',
    keywords: ['portal', 'proveedores', 'externo', 'acceso', 'pagina', 'web'],
    category: 'accesos',
    solution: '1. Confirma si la página web abre correctamente. Si no abre, es un problema del servidor externo.\n2. Si el problema es de credenciales corporativas, asegúrate de estar usando el usuario compras@empresa.com y el token de seguridad activo.\n3. Si el token expiró, solicítanos un nuevo código por ticket.'
  },
  {
    id: 'com-003',
    area: 'compra',
    title: 'Problemas con el flujo de aprobación de compras',
    keywords: ['aprobacion', 'flujo', 'firma', 'jefe', 'aprobar', 'pendiente'],
    category: 'software',
    solution: '1. Si la orden no le aparece a tu jefe para aprobación, verifica que la orden esté en estado "Pendiente de firma".\n2. Confirma si el organigrama del sistema tiene asignado a tu jefe inmediato de forma correcta.\n3. Si necesitas cambiar el aprobador temporalmente por vacaciones, IT debe realizar el cambio en la base de datos.'
  },

  // GESTION HUMANA
  {
    id: 'gh-001',
    area: 'gestion_humana',
    title: 'El software de nómina da error al procesar la planilla mensual',
    keywords: ['nomina', 'planilla', 'procesar', 'liquidar', 'error', 'calculo'],
    category: 'software',
    solution: '1. Verifica que no haya otro usuario procesando la nómina simultáneamente (el sistema bloquea la tabla).\n2. Confirma que la fecha del servidor sea correcta.\n3. Si sale un error de base de datos específico, toma captura de pantalla para nuestro equipo de soporte técnico.'
  },
  {
    id: 'gh-002',
    area: 'gestion_humana',
    title: 'El reloj biométrico no registra la huella de un empleado',
    keywords: ['biometrico', 'reloj', 'huella', 'marcar', 'registro', 'asistencia'],
    category: 'hardware',
    solution: '1. Limpia el lector óptico del biométrico con un paño seco de microfibra.\n2. Si es un nuevo empleado, asegúrate de haber registrado su huella al menos 3 veces en el enrolamiento.\n3. Si persiste, intenta registrar un dedo alternativo (índice de la otra mano).\n4. Si el biométrico no enciende o no tiene red, crearemos un ticket prioritario.'
  },
  {
    id: 'gh-003',
    area: 'gestion_humana',
    title: 'No puedo subir archivos al portal de autogestión de empleados',
    keywords: ['portal', 'empleados', 'subir', 'archivo', 'certificado', 'documento'],
    category: 'software',
    solution: '1. Asegúrate de que el archivo esté en formato PDF o JPG.\n2. El nombre del archivo no debe contener caracteres especiales como tildes, eñes o comas (ej. cambiar "certificación-nómina.pdf" por "certificacion_nomina.pdf").\n3. Reduce el tamaño del archivo si es mayor a 2MB.'
  },

  // PQRS
  {
    id: 'pqrs-001',
    area: 'pqrs',
    title: 'El sistema de PQRS no está guardando los nuevos registros',
    keywords: ['pqrs', 'queja', 'reclamo', 'guardar', 'registro', 'no funciona'],
    category: 'software',
    solution: '1. Comprueba que todos los campos requeridos estén llenos.\n2. Revisa que el campo de texto de descripción no contenga emojis o caracteres especiales no soportados.\n3. Si aparece una pantalla blanca al guardar, refresca el navegador e intenta con otro navegador (Chrome o Firefox).'
  },
  {
    id: 'pqrs-002',
    area: 'pqrs',
    title: 'Fallo en la asignación automática de PQRS por área',
    keywords: ['asignacion', 'automatica', 'derivar', 'pqrs', 'error'],
    category: 'software',
    solution: '1. La asignación automática depende de las palabras clave del asunto de la PQRS.\n2. Si el sistema no lo derivó al área correcta, realiza la asignación de forma manual desde el panel de PQRS.\n3. Avísanos por ticket si hay que actualizar la matriz de asignación por palabras clave en el sistema.'
  },

  // CONTABILIDAD
  {
    id: 'cont-001',
    area: 'contabilidad',
    title: 'El software contable está extremadamente lento o bloqueado',
    keywords: ['contabilidad', 'software', 'siigo', 'lento', 'bloqueado', 'cierra'],
    category: 'software',
    solution: '1. Cierra la aplicación, espera 1 minuto y vuelve a entrar.\n2. Si trabajas sobre el servidor, asegúrate de que no haya procesos pesados corriendo al mismo tiempo.\n3. Si usas versión web, borra la caché del navegador con Ctrl+F5.\n4. Si continúa bloqueado, el equipo de IT reiniciará los servicios del servidor de base de datos.'
  },
  {
    id: 'cont-002',
    area: 'contabilidad',
    title: 'No cuadran los balances en el módulo fiscal o da error de cálculo',
    keywords: ['balance', 'fiscal', 'modulo', 'error', 'calculo', 'diferencia'],
    category: 'software',
    solution: '1. Ejecuta el proceso de "Reconstrucción de saldos" en el sistema contable para refrescar los valores indexados.\n2. Comprueba que no existan comprobantes descuadrados o sin asentar en el mes consultado.\n3. Si persiste el error de software, escalaremos con el soporte directo del proveedor del programa.'
  },
  {
    id: 'cont-003',
    area: 'contabilidad',
    title: 'Fallo al firmar digitalmente la facturación electrónica',
    keywords: ['firma', 'digital', 'certificado', 'factura', 'electronica', 'token'],
    category: 'accesos',
    solution: '1. Asegúrate de que el token físico (USB) esté conectado al computador y con el led encendido.\n2. Revisa que el certificado de firma digital no esté vencido (puedes verlo en las propiedades de internet en tu PC).\n3. Si es un certificado en la nube, comprueba que las credenciales del API de firma sean las correctas.'
  },

  // FARMACIA
  {
    id: 'farm-001',
    area: 'farmacia',
    title: 'El lector de códigos de barras no lee o escribe caracteres extraños',
    keywords: ['lector', 'barras', 'codigo', 'escaner', 'pistola', 'no lee'],
    category: 'hardware',
    solution: '1. Desconecta el lector del puerto USB, espera 5 segundos y conéctalo en otro puerto.\n2. Si escribe caracteres extraños (ej. números cambiados), es probable que el teclado esté en inglés. Configura el idioma de Windows a Español.\n3. Limpia el vidrio del lector con un paño limpio y seco.\n4. Si el láser no se enciende al presionar el gatillo, el hardware está defectuoso y debemos reemplazarlo.'
  },
  {
    id: 'farm-002',
    area: 'farmacia',
    title: 'Error de stock en el sistema de inventario al despachar',
    keywords: ['inventario', 'stock', 'sistema', 'despacho', 'error', 'medicamento'],
    category: 'software',
    solution: '1. Verifica si el lote del medicamento que intentas despachar coincide con el físico.\n2. Revisa si hay traslados pendientes por aceptar que afecten el stock virtual.\n3. Si el stock físico existe pero el sistema no te deja facturar, el regente de farmacia debe autorizar un ajuste temporal de inventario.'
  },
  {
    id: 'farm-003',
    area: 'farmacia',
    title: 'No se imprimen las etiquetas de medicamentos (Zebra/Térmica)',
    keywords: ['zebra', 'termica', 'etiquetas', 'impresora', 'pequeña', 'no imprime'],
    category: 'hardware',
    solution: '1. Verifica que la luz de la impresora térmica esté en verde fijo. Si parpadea en rojo, está descalibrada o sin papel/cinta.\n2. Abre la impresora y asegúrate de que el rollo de etiquetas esté bien colocado debajo de los sensores.\n3. Ve a Dispositivos e Impresoras en Windows, haz clic derecho sobre la impresora Zebra y selecciona "Reiniciar cola de impresión".'
  },

  // CUENTAS MEDICAS
  {
    id: 'cm-001',
    area: 'cuentas_medicas',
    title: 'Error en la generación de archivos RIPS corporativos',
    keywords: ['rips', 'generar', 'archivo', 'error', 'plataforma', 'validar'],
    category: 'software',
    solution: '1. Valida que las fechas de las facturas no crucen meses diferentes en un mismo RIPS.\n2. Pasa los archivos (.AM, .AP, .US, etc.) por el validador local de RIPS para identificar la línea y columna del error.\n3. Los errores comunes suelen ser diagnósticos inválidos o números de identificación con caracteres especiales.'
  },
  {
    id: 'cm-002',
    area: 'cuentas_medicas',
    title: 'La plataforma de la EPS no reconoce nuestra firma digital',
    keywords: ['eps', 'plataforma', 'firma', 'digital', 'reconoce', 'ingreso'],
    category: 'accesos',
    solution: '1. Asegúrate de estar ingresando desde Internet Explorer (modo compatibilidad en Edge) ya que muchas EPS solo funcionan con esta tecnología antigua.\n2. Actualiza la máquina virtual de Java a la última versión compatible.\n3. Agrega la dirección web de la EPS a la lista de sitios de confianza en la configuración de seguridad de Windows.'
  },
  {
    id: 'cm-003',
    area: 'cuentas_medicas',
    title: 'El software de facturación médica muestra error de conexión al servidor',
    keywords: ['facturacion', 'medica', 'servidor', 'conexion', 'error', 'programa'],
    category: 'software',
    solution: '1. Verifica que tengas conexión de red estable (abre cualquier web externa).\n2. El servidor de facturación médica se reinicia automáticamente todos los días a las 12:00 PM por 5 minutos. Asegúrate de no estar en ese lapso.\n3. Si persiste la desconexión, avísanos de inmediato para revisar el servicio en el rack de servidores.'
  }
];

export const getFaqsByArea = (area) => {
  return [
    ...faqs.filter(faq => faq.area === area),
    ...faqs.filter(faq => faq.area === 'general')
  ];
};
