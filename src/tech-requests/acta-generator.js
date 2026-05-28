/**
 * Generador de Acta de Entrega de Equipos (.docx)
 * Usa la plantilla corporativa de Medivalle como base para preservar:
 *   - Logo en encabezado
 *   - Marca de agua de fondo
 *   - Estilos y formato corporativo
 * Solo reemplaza el cuerpo del documento con datos dinámicos.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS     = path.join(__dirname, 'assets');
const TEMPLATE   = path.join(ASSETS, 'template-acta-base.docx');

/* ── Utilidades XML ───────────────────────────────────────────── */

/** Escapa caracteres especiales para XML */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Párrafo con estilo "Textoindependiente" (estilo base de la plantilla) */
function pTxt(runs, extra = '') {
  return `<w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:spacing w:before="11"/>${extra}</w:pPr>${runs}</w:p>`;
}

/** Run de texto */
function run(text, bold = false, color = '') {
  const rPr = (bold || color)
    ? `<w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}</w:rPr>`
    : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/** Línea etiqueta + valor con tabulación */
function campoXml(label, valor) {
  return pTxt(
    run(label) +
    `<w:r><w:tab/></w:r>` +
    run(String(valor || ''), true)
  );
}

/** Párrafo vacío */
function espXml() {
  return `<w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:spacing w:before="11"/></w:pPr></w:p>`;
}

/** Título de sección en MAYÚSCULAS, negrita */
function seccionXml(texto) {
  return pTxt(run(texto.toUpperCase(), true), '<w:spacing w:before="200"/>');
}

/** Fila de tabla XML */
function tablaFila(celdas, cabecera = false) {
  const celdasXml = celdas.map(({ text, w }) => `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${w}" w:type="dxa"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="4" w:color="CCCCCC"/>
          <w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>
          <w:left w:val="single" w:sz="4" w:color="CCCCCC"/>
          <w:right w:val="single" w:sz="4" w:color="CCCCCC"/>
        </w:tcBorders>
        <w:shading w:val="clear" w:color="auto" w:fill="${cabecera ? 'EEF2FF' : 'FFFFFF'}"/>
        <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/></w:pPr>
        ${cabecera
          ? `<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="444444"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
          : `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
        }
      </w:p>
    </w:tc>`).join('');

  return `<w:tr${cabecera ? ' w:rsidTrPr="00000000"' : ''}>${celdasXml}</w:tr>`;
}

/* ── Función principal ─────────────────────────────────────────── */

/**
 * @param {Object}       request        - Requerimiento con .items[]
 * @param {Array|Object} equipment      - Array [{ marca, modelo, serial, accesorios, observaciones }]
 * @param {String}       agentName      - No se usa en la firma (solo para historial)
 */
export async function generateActa(request, equipment, agentName = 'Jefe de Soporte') {

  // Normalizar equipment a array
  const eqItems = Array.isArray(equipment) ? equipment : [equipment];

  const fechaHoy  = new Date();
  const fechaLarga = fechaHoy.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const fechaCorta = fechaHoy.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const accesorios  = eqItems[0]?.accesorios    || '';
  const observaciones = eqItems[0]?.observaciones || '';

  /* ── 1. Construir el cuerpo XML ───────────────────────────── */
  const colWidths = [600, 2400, 1800, 2000, 1800, 700]; // N°, Equipo, Marca, Modelo, Serial, Cant.
  const totalW    = colWidths.reduce((a, b) => a + b, 0); // 9300 DXA

  const filasCabecera = tablaFila([
    { text: 'N°',     w: colWidths[0] },
    { text: 'Equipo', w: colWidths[1] },
    { text: 'Marca',  w: colWidths[2] },
    { text: 'Modelo', w: colWidths[3] },
    { text: 'Serial', w: colWidths[4] },
    { text: 'Cant.',  w: colWidths[5] },
  ], true);

  const filasEquipos = (request.items?.length > 0 ? request.items : []).map((item, idx) => {
    const eq = eqItems[idx] || eqItems[0] || {};
    return tablaFila([
      { text: `${idx + 1}`,              w: colWidths[0] },
      { text: item.equipment_name || '', w: colWidths[1] },
      { text: eq.marca   || '—',         w: colWidths[2] },
      { text: eq.modelo  || '—',         w: colWidths[3] },
      { text: eq.serial  || item.serial || '—', w: colWidths[4] },
      { text: String(item.quantity || 1), w: colWidths[5] },
    ]);
  });

  const tablaEquipos = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${totalW}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="BBBBBB"/>
          <w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/>
          <w:left w:val="single" w:sz="4" w:color="BBBBBB"/>
          <w:right w:val="single" w:sz="4" w:color="BBBBBB"/>
          <w:insideH w:val="single" w:sz="4" w:color="DDDDDD"/>
          <w:insideV w:val="single" w:sz="4" w:color="DDDDDD"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>
          <w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>
        ${colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}
      </w:tblGrid>
      ${filasCabecera}
      ${filasEquipos.join('')}
    </w:tbl>`;

  // Sección de firma: imagen del jefe (rId8 = image1.png de la plantilla) + línea para quien recibe
  // La firma del jefe está embebida en la plantilla como rId8 (image1.png, 312x149)
  const firmaJefeImgXml = `
    <w:r>
      <w:rPr><w:noProof/></w:rPr>
      <w:drawing>
        <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="1244600" cy="594360"/>
          <wp:docPr id="1001" name="firma-jefe"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="1002" name="firma-jefe"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="rId8" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="1244600" cy="594360"/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>`;

  const bodyXml = `
    ${/* Ciudad y fecha */''}
    ${pTxt(run(`Santiago de Cali,  ${fechaLarga}`, true), '<w:jc w:val="center"/>')}

    ${/* Título */''}
    <w:p><w:pPr><w:pStyle w:val="Ttulo"/></w:pPr></w:p>
    <w:p><w:pPr><w:pStyle w:val="Ttulo"/></w:pPr>
      ${run('                 ACTA DE ENTREGA', true)}
    </w:p>

    ${espXml()}

    ${/* Ref */''}
    ${pTxt(run(`Ref: ${esc(request.request_number)}`, false, '888888'))}

    ${/* Datos usuario */''}
    ${seccionXml('Datos del usuario responsable')}
    ${campoXml('Fecha de entrega:', fechaCorta)}
    ${campoXml('Nombres y apellidos:', request.requester_name)}
    ${campoXml('ID:', request.cedula)}
    ${campoXml('Área:', `${request.cargo}  /  ${request.sede}`)}

    ${espXml()}

    ${/* Equipos */''}
    ${seccionXml('Descripción de equipos entregados')}
    ${espXml()}
    ${tablaEquipos}
    ${espXml()}

    ${/* Accesorios */''}
    ${campoXml('Accesorios que se asignan:', accesorios || 'Ninguno')}
    ${observaciones ? campoXml('Observaciones:', observaciones) : ''}

    ${espXml()}

    ${/* Cláusula */''}
    ${seccionXml('Cláusula de compromiso')}

    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">Responsabilidad por el equipo: </w:t></w:r>
      <w:r><w:t>Es responsable por cualquier p&#233;rdida, da&#241;o, robo o deterioro del equipo y deber&#225; cubrir el costo total de su reparaci&#243;n o reemplazo.</w:t></w:r>
    </w:p>

    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">Reporte de incidentes: </w:t></w:r>
      <w:r><w:t>En caso de robo o fallas t&#233;cnicas, se debe comunicar lo m&#225;s pronto posible a la Subgerencia de Log&#237;stica y Control Patrimonial.</w:t></w:r>
    </w:p>

    <w:p><w:pPr><w:pStyle w:val="Textoindependiente"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">Devoluci&#243;n completa: </w:t></w:r>
      <w:r><w:t>El equipo debe devolverse con todos los accesorios originales con los que fue entregado (cargador, manual, memoria auxiliar, manos libres, bater&#237;a, cable USB, etc.), con los cu&#225;l fue asignado.</w:t></w:r>
    </w:p>

    ${espXml()}

    ${/* Firmas */''}
    ${pTxt(run('Firman en conformidad.'))}

    ${/* Imagen firma jefe (izquierda) + espacio para quien recibe (derecha) */''}
    <w:p>
      <w:pPr><w:pStyle w:val="Textoindependiente"/><w:spacing w:before="400"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${firmaJefeImgXml}
    </w:p>

    ${/* Líneas de firma */''}
    <w:p>
      <w:pPr><w:pStyle w:val="Textoindependiente"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${run('____________________')}
      <w:r><w:tab/></w:r>
      ${run('_____________________')}
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Textoindependiente"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${run('Jefe de Soporte', false, '555555')}
      <w:r><w:tab/></w:r>
      ${run(esc(request.requester_name), true)}
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Textoindependiente"/><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>
      ${run('', false, '888888')}
      <w:r><w:tab/></w:r>
      ${run('Quien recibe', false, '555555')}
    </w:p>

    <w:sectPr/>
  `;

  /* ── 2. Inyectar en la plantilla ──────────────────────────── */
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error(`Plantilla no encontrada: ${TEMPLATE}`);
  }

  const templateZip    = new AdmZip(TEMPLATE);
  let   templateDocXml = templateZip.readAsText('word/document.xml');

  // Extraer el <w:sectPr> original para preservar referencias a headers/footers
  // (logo, marca de agua VML en header2.xml, etc.)
  const sectPrMatch = templateDocXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const originalSectPr = sectPrMatch ? sectPrMatch[0] : '<w:sectPr/>';

  // Reemplazar el cuerpo manteniendo namespaces y reutilizando el sectPr original
  const bodyXmlFinal = bodyXml.replace('<w:sectPr/>', originalSectPr);

  templateDocXml = templateDocXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${bodyXmlFinal}</w:body>`
  );

  templateZip.updateFile('word/document.xml', Buffer.from(templateDocXml, 'utf-8'));

  return templateZip.toBuffer();
}
