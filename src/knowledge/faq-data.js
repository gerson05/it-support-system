// Base de conocimiento con preguntas y respuestas frecuentes (FAQs) por área

export const faqs = [
  // GENERAL
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
    title: 'La impresora no imprime, está atascada o tiene la cola bloqueada',
    keywords: ['impresora', 'imprimir', 'papel', 'atasco', 'no imprime', 'cola', 'bloqueada', 'trabajos'],
    category: 'hardware',
    solution: '1. Ve a la impresora y revisa la pantalla para ver el mensaje de error.\n2. *Si hay atasco de papel:* abre la compuerta indicada, saca el papel suavemente en la dirección de avance y cierra la tapa.\n3. *Si la cola de impresión está bloqueada:* en tu PC ve a Inicio > Dispositivos e Impresoras, clic derecho sobre la impresora y selecciona "Ver trabajos de impresión". Cancela todos los trabajos pendientes y luego reinicia la impresora.\n4. *Si no responde:* apágala del botón lateral, espera 10 segundos y enciéndela.\n✅ La impresora debe mostrar "Lista" o "En reposo" en su pantalla.'
  },
  {
    id: 'gen-009',
    area: 'general',
    title: 'Cómo cambiar el cartucho de tóner de la impresora láser (HP, Kyocera)',
    keywords: ['toner', 'tóner', 'cartucho', 'cambiar', 'vacio', 'agotado', 'reemplazar', 'consumible', 'recarga', 'hp', 'kyocera', 'laser', 'láser'],
    category: 'hardware',
    solution: '⚠️ Esta guía es para impresoras LÁSER (HP, Kyocera) que usan cartuchos de tóner en polvo. Si tienes una impresora Epson EcoTank (L1536, L11002, L1006, L400, L364, L3220, L2110), usa la guía de relleno de tinta líquida.\n\n1. Apaga la impresora y espera 5 minutos para que el fusor (parte caliente) se enfríe antes de tocarla.\n2. Abre la tapa delantera o superior (busca el símbolo de cartucho o la palanca de apertura).\n3. Toma el cartucho actual por sus agarraderas laterales y deslízalo hacia fuera siguiendo los rieles internos.\n4. Saca el cartucho nuevo de su caja y retira *toda* la cinta o cubierta protectora (generalmente naranja o roja).\n5. Agítalo suavemente de lado a lado unas 5 veces para distribuir el tóner de forma uniforme — esto evita impresiones manchadas.\n6. Inserta el nuevo cartucho en los rieles hasta escuchar un clic firme. Cierra la tapa y enciende la impresora.\n✅ La pantalla debe mostrar "Lista" y el nivel de tóner debe aparecer lleno. Si sigue con alerta, avisa a IT para reiniciar el contador del cartucho.'
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

  {
    id: 'gen-010',
    area: 'general',
    title: 'No tengo conexión a internet o el WiFi no funciona',
    keywords: ['internet', 'wifi', 'red', 'conexion', 'sin internet', 'no carga', 'pagina', 'navegar', 'cable', 'ethernet', 'lento internet'],
    category: 'red',
    solution: '1. Verifica si el problema es solo en tu equipo o en todos los de la sede.\n2. En tu PC haz clic en el ícono de red (esquina inferior derecha de la barra de tareas) y confirma si aparece "Conectado" o un símbolo de advertencia.\n3. *Si es por cable:* desconecta el cable de red de tu PC, espera 5 segundos y vuélvelo a conectar. El led del puerto de red debe parpadear en verde/amarillo.\n4. *Si es por WiFi:* apaga el WiFi desde el ícono de red y vuelve a activarlo. Si sigue sin conectar, selecciona tu red y haz clic en "Olvidar" para reconectarla ingresando la clave.\n5. Reinicia el equipo. Si no hay internet en toda la sede, repórtalo a IT de inmediato.\n✅ Abre una página web como google.com para confirmar que la conexión funciona.'
  },
  {
    id: 'gen-011',
    area: 'general',
    title: 'Microsoft Excel o Word no responde o el archivo no abre',
    keywords: ['excel', 'word', 'office', 'archivo', 'no abre', 'corrupto', 'cerro', 'perdio', 'guardar', 'no responde', 'bloqueado', 'planilla'],
    category: 'software',
    solution: '1. Si el programa muestra "No responde", ábrelo desde el Administrador de Tareas (Ctrl+Shift+Esc), busca el proceso de Excel/Word y haz clic en "Finalizar tarea".\n2. Vuelve a abrir el archivo. Si Office detectó que se cerró de forma inesperada, mostrará un panel de "Recuperación de documentos" a la izquierda — selecciona la versión más reciente y guárdala de inmediato con otro nombre.\n3. Si el archivo dice estar "En uso por otro usuario" en la red, espera que ese usuario lo cierre o ábrelo en modo Solo lectura.\n4. *Si el archivo está dañado:* abre Excel/Word, ve a Archivo > Abrir, busca el archivo, haz clic en la flecha junto a "Abrir" y selecciona "Abrir y reparar".\n5. Si nada funciona, comunícalo a IT — podemos intentar recuperar la última versión del servidor.\n✅ El archivo debe abrir correctamente y mostrar su contenido.'
  },
  {
    id: 'gen-012',
    area: 'general',
    title: 'El computador no enciende o se apaga solo de repente',
    keywords: ['no enciende', 'apaga', 'reinicia', 'pantalla azul', 'bsod', 'no prende', 'solo', 'freezeado', 'congelado', 'reinicia solo'],
    category: 'hardware',
    solution: '1. *Si no enciende:* verifica que el cable de corriente esté bien conectado a la regleta y a la torre. Prueba conectándolo directamente al toma si estaba en una regleta.\n2. Presiona el botón de encendido durante 10 segundos para forzar el apagado completo, luego vuelve a encender.\n3. *Si aparece pantalla azul (BSOD):* toma una foto del código de error que aparece antes de que el equipo reinicie y envíala a IT por este chat.\n4. *Si se apaga solo con frecuencia:* probablemente hay sobrecalentamiento. Asegúrate de que las rejillas de ventilación de la torre no estén tapadas y que el ventilador trasero gire al encender.\n5. No intentes abrir la torre — crea un ticket para que IT lo revise con seguridad.\n✅ El equipo debe iniciar Windows normalmente y mostrar el escritorio.'
  },
  {
    id: 'gen-013',
    area: 'general',
    title: 'La impresora de red no aparece en mi PC o no puedo imprimirle',
    keywords: ['impresora', 'red', 'no aparece', 'no encuentro', 'agregar', 'instalar', 'driver', 'no la veo', 'compartida'],
    category: 'hardware',
    solution: '1. Verifica que la impresora esté encendida y con el led de red en azul (conectada a la red).\n2. En tu PC ve a Configuración > Bluetooth y dispositivos > Impresoras y escáneres > "Agregar dispositivo". Windows buscará impresoras automáticamente en la red.\n3. Si no aparece, pregunta a un compañero la IP de la impresora (también se puede consultar desde el menú de la propia impresora en Red/Configuración de red). Luego en "La impresora que deseo no está en la lista" > "Agregar por dirección TCP/IP".\n4. *Si antes funcionaba y dejó de aparecer:* presiona Windows + R, escribe services.msc, busca "Cola de impresión", clic derecho > Reiniciar.\n5. Si ningún paso funciona, crea un ticket y IT instalará el driver correcto remotamente.\n✅ La impresora debe aparecer en la lista y una prueba de impresión debe completarse.'
  },
  {
    id: 'gen-014',
    area: 'general',
    title: 'La cámara, el micrófono o el audio no funcionan en Teams o Zoom',
    keywords: ['teams', 'zoom', 'camara', 'microfono', 'audio', 'videollamada', 'reunion', 'no escucha', 'no ve', 'meet', 'llamada', 'video'],
    category: 'software',
    solution: '1. *Durante la reunión:* haz clic en los tres puntos "..." o en el ícono de Configuración del dispositivo y verifica que el micrófono y cámara correctos estén seleccionados (especialmente si tienes auriculares USB o un headset).\n2. Confirma que el micrófono no esté silenciado en la barra de la llamada (ícono con tachado rojo).\n3. Si la cámara no funciona, cierra otras apps que puedan estar usándola (Skype, grabadora, Zoom si estás en Teams).\n4. En Windows, ve a Configuración > Privacidad y seguridad > Cámara / Micrófono y confirma que Teams/Zoom tenga permiso de acceso activado.\n5. Si el dispositivo físico no funciona, desconéctalo del USB y conéctalo en otro puerto. Espera 15 segundos a que Windows lo reinstale.\n✅ En Teams/Zoom, haz una llamada de prueba — deben mostrar tu imagen y escucharse el audio.'
  },

  {
    id: 'gen-015',
    area: 'general',
    title: 'Cómo rellenar la tinta de impresoras Epson EcoTank (L1536, L11002, L1006, L400, L364, L3220, L2110)',
    keywords: [
      'epson', 'ecotank', 'tinta', 'tanque', 'rellenar', 'llenar', 'nivel tinta',
      'sin tinta', 'tóner epson', 'toner epson', 'recarga', 'botella', 'tinta baja',
      'l1536', '1536', 'l11002', '11002', 'l1006', '1006',
      'l400', '400', 'l364', '364', 'l3220', '3220', 'l2110', '2110',
      'impresora epson', 'epson no imprime', 'color desvanecido', 'cian', 'magenta', 'amarillo',
    ],
    category: 'hardware',
    solution: '⚠️ Las impresoras Epson EcoTank (L-series) usan TINTA LÍQUIDA en tanques — NO cartuchos de tóner. El proceso es rellenar el tanque, no reemplazar nada.\n\n1. Observa cuál indicador de tinta parpadea en la impresora (o en pantalla): negro (K), cian/azul (C), magenta/rojo (M) o amarillo (Y).\n2. Abre la cubierta de los tanques de tinta — en los modelos L1536/L11002 está al frente izquierdo; en L400/L364/L3220/L2110/L1006, es el panel lateral derecho.\n3. Verifica visualmente el tanque: cada tanque tiene línea de MÍNIMO y MÁXIMO impresas en el plástico.\n4. Toma la botella de tinta del color correspondiente (el tapón de la botella coincide con el color del tanque).\n5. Retira el tapón del tanque (pequeño tapón de goma), acopla la punta de la botella y aprieta suavemente — llena solo hasta la línea MÁXIMO, sin pasarte.\n6. Vuelve a tapar el tanque, cierra la cubierta y haz una impresión de prueba desde Inicio > Dispositivos e Impresoras > Imprimir página de prueba.\n✅ La impresión debe salir con colores uniformes y sin líneas blancas. Si las líneas blancas persisten, avisa a IT para ejecutar un ciclo de limpieza de cabezales.'
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
  // Retorna primero las FAQs específicas del área, luego las generales
  return [
    ...faqs.filter(faq => faq.area === area),
    ...faqs.filter(faq => faq.area === 'general')
  ];
};

/** Normaliza texto: minúsculas, sin tildes, sin signos de puntuación */
const _norm = str =>
  str.toLowerCase()
     .normalize('NFD').replace(/[̀-ͯ]/g, '')
     .replace(/[¿?¡!.,;:()]/g, ' ')
     .trim();

export const searchFaqs = (area, query) => {
  if (!query) return getFaqsByArea(area);

  const cleanQuery = _norm(query);
  // Palabras significativas (> 3 chars) para matching parcial
  const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 3);
  const areaFaqs   = getFaqsByArea(area);

  return areaFaqs.map(faq => {
    let score = 0;
    const titleClean = _norm(faq.title);

    // Título contiene la frase exacta (máxima confianza)
    if (titleClean.includes(cleanQuery)) score += 15;

    faq.keywords.forEach(kw => {
      const kwClean = _norm(kw);
      // Keyword exacta incluida en la consulta o viceversa
      if (cleanQuery.includes(kwClean) || kwClean.includes(cleanQuery)) {
        score += 5;
        return;
      }
      // Matching parcial palabra-a-palabra
      queryWords.forEach(word => {
        if (kwClean.includes(word) || word.includes(kwClean)) score += 2;
      });
    });

    // Bonus si el título contiene alguna palabra significativa de la consulta
    queryWords.forEach(word => {
      if (titleClean.includes(word)) score += 3;
    });

    return { ...faq, score };
  })
  .filter(faq => faq.score > 0)
  .sort((a, b) => b.score - a.score);
};
