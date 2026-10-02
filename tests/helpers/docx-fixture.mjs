/**
 * .docx mínimo para pruebas, con los casos difíciles de las plantillas reales:
 * párrafos vacíos auto-cerrados, bookmarks, marcadores partidos en varios runs
 * (uno en negrita) y un marcador en el encabezado.
 */
import AdmZip from 'adm-zip';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const run = (t, bold = false) =>
  `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;

export function docxFixture({ cuerpo, encabezado = 'Ref: {{cedula}}' } = {}) {
  const body = cuerpo ?? [
    '<w:p w14:paraId="1"/>',
    `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:bookmarkStart w:id="0" w:name="_x"/>${run('Santiago de Cali, {{fecha_expedicion}}.')}</w:p>`,
    `<w:p>${run('hace constar que {{tratamiento}} ')}${run('{{nom', true)}${run('bre}}', true)}${run(', {{identificado}} con cédula {{cedula}}, {{verbo_contrato}} un contrato {{tipo_contrato}} {{periodo}}.')}<w:bookmarkEnd w:id="0"/></w:p>`,
    `<w:p>${run('{{parrafo_cargo}}')}</w:p>`,
    `<w:p>${run('Desconocido: {{otro_campo}} & listo')}</w:p>`,
  ].join('');

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types/>'));
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${W} xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>${body}<w:sectPr/></w:body></w:document>`));
  zip.addFile('word/header1.xml', Buffer.from(`<?xml version="1.0"?><w:hdr ${W}><w:p>${run(encabezado)}</w:p></w:hdr>`));
  zip.addFile('word/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return zip.toBuffer();
}

/** Texto plano de cada párrafo de una parte del .docx. */
export function textoDocx(buffer, parte = 'word/document.xml') {
  const xml = new AdmZip(buffer).readAsText(parte);
  return (xml.match(/<w:p(?:\s[^>]*[^/])?>[\s\S]*?<\/w:p>/g) || [])
    .map(p => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join(''));
}
