/**
 * Ciudades / puntos que generan la placa AF-{CÓDIGO}{NNN}.
 * Lista base agrupada por departamento o ciudad. Las que se crean desde Inventario
 * se guardan en la tabla placa_ciudades y se agregan al grupo elegido.
 * La usan el formulario (navegador) y el servidor (para no repetir códigos).
 */
export const PLACA_GRUPOS = [
  { label: '— Administrativo —', opts: [
    ['BODEGA',           'Bodega'],
    ['BOGOTA',           'Bogotá'],
    ['CARSON',           'Carson  · CRS'],
    ['OFICINA',          'Oficina'],
    ['SEDE PRINCIPAL',   'Sede Principal (Medivalle)'],
  ]},
  { label: '— Caldas —', opts: [
    ['AGUADAS','Aguadas'],['ANSERMA','Anserma'],['ARANZAZU','Aranzazu'],
    ['CHINCHINA','Chinchiná'],['LA DORADA','La Dorada'],['MANIZALES','Manizales'],
    ['MARQUETALIA','Marquetalia'],['PENSILVANIA','Pensilvania'],['RIOSUCIO','Riosucio'],
    ['SALAMINA','Salamina'],['SAMANA','Samaná'],['SUPIA','Supía'],
  ]},
  { label: '— Cauca —', opts: [
    ['ARGELIA','Argelia'],['CORINTO','Corinto'],['GUAPI','Guapi'],
    ['JAMBALO','Jambaló'],['MIRANDA','Miranda'],['MORALES','Morales'],
    ['PIENDAMO','Piendamó'],['POPAYAN','Popayán'],['SANTANDER DE QUILICHAO','Santander de Quilichao'],
    ['SILVIA','Silvia'],['TORIBIO','Toribio'],['TOTORO','Tótoró'],
  ]},
  { label: '— Nariño / Putumayo —', opts: [
    ['LA UNION NARINO','La Unión Nariño'],['MOCOA','Mocoa'],['PASTO','Pasto'],['TUMACO','Tumaco'],
  ]},
  { label: '— Quindío —', opts: [['QUIMBAYA','Quimbaya']] },
  { label: '— Risaralda —', opts: [
    ['APIA','Apía'],['DOSQUEBRADAS','Dosquebradas'],['GUATICA','Guática'],
    ['LA VIRGINIA','La Virginia'],['PEREIRA','Pereira'],['SANTA ROSA','Santa Rosa'],
  ]},
  { label: '— Cali (sub-sedes) —', opts: [
    ['CALI SUR',              'Cali Sur  · CSR'],
    ['CALI NORTE',            'Cali Norte  · CNR'],
    ['CALI AIC',              'Cali AIC  · CAI'],
    ['PASOANCHO',             'Pasoancho  · PAS'],
    ['SEDE HOSPITALARIA 24H', 'Hospitalaria 24H Fomag  · SHF'],
    ['LA FAVORITA',           'La Favorita  · CFV'],
    ['CALI',                  'Cali (genérico)  · CAL'],
  ]},
  { label: '— Buenaventura —', opts: [
    ['BUENAVENTURA',   'Buenaventura (principal)  · BNV'],
    ['BUENAVENTURA 2', 'Buenaventura 2  · BN2'],
    ['LA VERDAD 2',    'La Verdad 2 (horario extendido)  · BVD'],
  ]},
  { label: '— Buga —', opts: [
    ['BUGA',           'Buga (principal)  · BGA'],
    ['SAN JOSE BUGA',  'San José – Buga  · BGJ'],
  ]},
  { label: '— Candelaria —', opts: [
    ['VILLAGORGONA',   'Villagorgona  · VLG'],
    ['EL MANANTIAL',   'El Manantial  · ELM'],
  ]},
  { label: '— Cartago —', opts: [
    ['CARTAGO FOMAG',  'Cartago Fomag  · CTF'],
    ['ZARAGOZA',       'Zaragoza (Cartago)  · ZRG'],
    ['CIPRES',         'Ciprés (Cartago)  · CIP'],
    ['CARTAGO',        'Cartago (genérico)  · CTG'],
  ]},
  { label: '— El Cerrito —', opts: [
    ['EL CERRITO VALLEJO',   'Vallejo  · ECV'],
    ['EL CERRITO EXITO 1',   'Éxito 1  · CE1'],
    ['EL CERRITO EXITO 2',   'Éxito 2  · CE2'],
    ['EL CERRITO EXITO 3',   'Éxito 3  · CE3'],
    ['EL CERRITO',           'El Cerrito (genérico)  · ECE'],
  ]},
  { label: '— Ginebra —', opts: [
    ['GINEBRA EXITO 4', 'Éxito 4  · GN4'],
    ['GINEBRA EXITO 5', 'Éxito 5  · GN5'],
  ]},
  { label: '— Jamundí —', opts: [
    ['JAMUNDI',           'Jamundí (principal)  · JMD'],
    ['ALPHAHEALTH JAMUNDI','Alphahealth  · JMA'],
  ]},
  { label: '— Palmira —', opts: [
    ['PALMIRA',              'Palmira (principal)  · PLM'],
    ['PALMIRA A SU SALUD',   'A Su Salud  · PLS'],
  ]},
  { label: '— Roldanillo —', opts: [
    ['ROLDANILLO FOMAG', 'Roldanillo Fomag  · RLF'],
    ['ROLDANILLO JM',    'J&M Urgencias  · RJM'],
  ]},
  { label: '— Tuluá —', opts: [
    ['TULUA',              'Tuluá (principal)  · TLU'],
    ['TULUA SAMARITANA',   'Samaritana  · TLS'],
    ['TULUA FARMAPRECIOS', 'Farmaprecios  · TLF'],
  ]},
  { label: '— Yumbo —', opts: [
    ['YUMBO',            'Yumbo (principal)  · YMB'],
    ['YUMBO RAPI DROGAS','Rapi Drogas  · YRD'],
    ['BODEGA YUMBO',     'Bodega Yumbo  · BOD'],
  ]},
  { label: '— Otros Valle del Cauca —', opts: [
    ['ALCALA','Alcalá'],['ANDALUCIA','Andalucía'],['ANSERMANUEVO','Ansermanuevo'],
    ['BUGALAGRANDE','Bugalagrande'],['CAICEDONIA','Caicedonia'],['CALIMA','Calima'],
    ['DAGUA','Dagua'],['EL AGUILA','El Águila'],['EL DOVIO','El Dovio'],
    ['FLORIDA','Florida'],['GUACARI','Guacarí'],['LA CUMBRE','La Cumbre'],
    ['LA UNION VALLE','La Unión Valle'],['LA VICTORIA','La Victoria'],['OBANDO','Obando'],
    ['PRADERA','Pradera'],['RESTREPO','Restrepo'],['RIOFRIO','Riofrío'],
    ['SAN PEDRO','San Pedro'],['SELIA','Selia'],['SEVILLA','Sevilla'],
    ['TORO','Toro'],['TRUJILLO','Trujillo'],['ULLOA','Ulloa'],
    ['VERSALLES','Versalles'],['VIJES','Vijes'],['YOTOCO','Yotoco'],['ZARZAL','Zarzal'],
  ]},
];

/** "— Caldas —" → "Caldas" */
export const nombreGrupo = (label) => String(label || '').replace(/^[\s—-]+|[\s—-]+$/g, '').trim();
