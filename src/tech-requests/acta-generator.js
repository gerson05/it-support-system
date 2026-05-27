/**
 * Generador de Acta de Entrega de Equipos (.docx)
 * Formato limpio sin tablas — igual al documento de referencia.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, BorderStyle, LevelFormat, TabStopType,
  Header, Footer, PageNumber,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIRMA_PATH = path.join(__dirname, 'firma-jefe.png');

/* ── Colores y constantes ──────────────────────────────────── */
const AZUL        = '1F3864';   // Azul oscuro para títulos de sección
const NEGRO       = '000000';
const FONT        = 'Arial';
const SZ_NORMAL   = 22;         // 11 pt
const SZ_TITULO   = 24;         // 12 pt bold
const TAB_VALOR   = 3200;       // DXA — punto donde arranca el valor (~2.2 inch)

/* ── Helpers ───────────────────────────────────────────────── */

/** Título de sección: MAYÚSCULAS, azul oscuro, negrita */
function seccion(texto) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [new TextRun({
      text: texto.toUpperCase(),
      bold: true,
      color: AZUL,
      size: SZ_TITULO,
      font: FONT,
    })],
  });
}

/** Línea de campo: "Label:    Valor" con tabulación para alinear */
function campo(label, valor = '') {
  return new Paragraph({
    spacing: { after: 60 },
    tabStops: [{ type: TabStopType.LEFT, position: TAB_VALOR }],
    children: [
      new TextRun({ text: label, bold: true, size: SZ_NORMAL, font: FONT, color: NEGRO }),
      new TextRun({ text: '\t' + (valor || ''), size: SZ_NORMAL, font: FONT }),
    ],
  });
}

/** Párrafo en blanco */
function esp() {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '', size: SZ_NORMAL })] });
}

/** Línea de firma con nombre debajo */
function firma(nombre) {
  return [
    new Paragraph({
      spacing: { before: 800, after: 60 },
      children: [new TextRun({ text: '', size: SZ_NORMAL })],
    }),
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: '444444', space: 4 } },
      spacing: { after: 40 },
      children: [new TextRun({ text: nombre.toUpperCase(), bold: true, size: SZ_NORMAL, font: FONT })],
    }),
  ];
}

/* ── Función principal ─────────────────────────────────────── */

export async function generateActa(request, equipment, agentName = 'Jefe de Soporte') {
  const firmaBuffer = fs.existsSync(FIRMA_PATH) ? fs.readFileSync(FIRMA_PATH) : null;

  const fechaEntrega = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 560, hanging: 360 } },
          },
        }],
      }],
    },

    styles: {
      default: { document: { run: { font: FONT, size: SZ_NORMAL, color: NEGRO } } },
    },

    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },   // Carta
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
        },
      },

      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `Ref: ${request.request_number}`, size: 18, color: '888888', font: FONT })],
          })],
        }),
      },

      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 4 } },
            children: [
              new TextRun({ text: 'Página ', size: 16, color: '888888', font: FONT }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT }),
              new TextRun({ text: ' de ', size: 16, color: '888888', font: FONT }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT }),
            ],
          })],
        }),
      },

      children: [

        /* ══ DATOS DEL USUARIO RESPONSABLE ══ */
        seccion('Datos del usuario responsable'),

        campo('Fecha de entrega:',       fechaEntrega),
        campo('Nombres y apellidos:',    request.requester_name),
        campo('ID:',                     request.cedula),
        campo('Área:',                   `${request.cargo}  ${request.sede}`),

        esp(),

        /* ══ EQUIPOS SOLICITADOS (si hay ítems registrados) ══ */
        ...(request.items?.length > 0 ? [
          seccion('Equipos solicitados'),
          // Cabecera de columnas
          new Paragraph({
            spacing: { after: 60 },
            tabStops: [
              { type: TabStopType.LEFT, position: 560  },
              { type: TabStopType.LEFT, position: 6200 },
              { type: TabStopType.LEFT, position: 7600 },
            ],
            children: [
              new TextRun({ text: 'N°', bold: true, size: SZ_NORMAL - 2, font: FONT, color: '888888' }),
              new TextRun({ text: '\tDescripción del equipo', bold: true, size: SZ_NORMAL - 2, font: FONT, color: '888888' }),
              new TextRun({ text: '\tCant.', bold: true, size: SZ_NORMAL - 2, font: FONT, color: '888888' }),
              new TextRun({ text: '\tSerial / Inv.', bold: true, size: SZ_NORMAL - 2, font: FONT, color: '888888' }),
            ],
          }),
          // Separador
          new Paragraph({
            spacing: { after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 1 } },
            children: [new TextRun({ text: '', size: 2 })],
          }),
          // Filas de ítems
          ...request.items.map((item, idx) => new Paragraph({
            spacing: { after: 80 },
            tabStops: [
              { type: TabStopType.LEFT, position: 560  },
              { type: TabStopType.LEFT, position: 6200 },
              { type: TabStopType.LEFT, position: 7600 },
            ],
            children: [
              new TextRun({ text: `${idx + 1}.`, bold: true, size: SZ_NORMAL, font: FONT }),
              new TextRun({ text: `\t${item.equipment_name}`, size: SZ_NORMAL, font: FONT }),
              new TextRun({ text: `\t${item.quantity}`, size: SZ_NORMAL, font: FONT }),
              new TextRun({ text: `\t${item.serial || '—'}`, size: SZ_NORMAL, font: FONT, color: '666666' }),
            ],
          })),
          esp(),
          seccion('Detalle del equipo entregado'),
        ] : [
          seccion('Descripción del equipo'),
        ]),

        campo('Marca:',                    equipment.marca       || ''),
        campo('Modelo:',                   equipment.modelo      || ''),
        campo('Número de Serie:',          equipment.serial      || ''),
        campo('IMEI:',                     equipment.imei        || ''),
        campo('Accesorios que se asignan.', equipment.accesorios || ''),
        ...(equipment.observaciones
          ? [campo('Observaciones:',       equipment.observaciones)]
          : []),

        esp(),

        /* ══ CLÁUSULA DE COMPROMISO ══ */
        seccion('Cláusula de compromiso'),

        new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'Responsabilidad por el equipo: ', bold: true, size: SZ_NORMAL, font: FONT }),
            new TextRun({ text: 'Es responsable por cualquier pérdida, daño, robo o deterioro del equipo y deberá cubrir el costo total de su reparación o reemplazo.', size: SZ_NORMAL, font: FONT }),
          ],
        }),

        new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'Reporte de incidentes: ', bold: true, size: SZ_NORMAL, font: FONT }),
            new TextRun({ text: 'En caso de robo o fallas técnicas, se debe comunicar lo más pronto posible a la Subgerencia de Logística y Control Patrimonial.', size: SZ_NORMAL, font: FONT }),
          ],
        }),

        new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'Devolución completa: ', bold: true, size: SZ_NORMAL, font: FONT }),
            new TextRun({ text: 'El equipo debe devolverse con todos los accesorios originales con los que fue entregado (cargador, manual, memoria auxiliar, manos libres, batería, cable USB, etc.), con los cuál fue asignado.', size: SZ_NORMAL, font: FONT }),
          ],
        }),

        esp(),

        /* ══ FIRMAN EN CONFORMIDAD ══ */
        new Paragraph({
          spacing: { before: 200, after: 60 },
          children: [new TextRun({ text: 'Firman en conformidad.', size: SZ_NORMAL, font: FONT })],
        }),

        /* Dos firmas lado a lado usando tab stops */
        ...(() => {
          const col = 4400;  // posición columna derecha

          // Fila de imagen de firma (izquierda) + línea en blanco (derecha)
          const firmaRow = firmaBuffer
            ? new Paragraph({
                spacing: { before: 400, after: 0 },
                tabStops: [{ type: TabStopType.LEFT, position: col }],
                children: [
                  new ImageRun({
                    type: 'png',
                    data: firmaBuffer,
                    transformation: { width: 140, height: 55 },
                    altText: { title: 'Firma Jefe de Soporte', description: 'Firma', name: 'firma-jefe' },
                  }),
                  new TextRun({ text: '\t', size: SZ_NORMAL, font: FONT }),
                ],
              })
            : new Paragraph({ spacing: { before: 900, after: 0 }, children: [new TextRun({ text: '' })] });

          return [
            firmaRow,
            // Líneas de firma: izquierda con borde superior, derecha con borde superior
            new Paragraph({
              spacing: { after: 80 },
              tabStops: [{ type: TabStopType.LEFT, position: col }],
              children: [
                new TextRun({ text: '________________________________', size: SZ_NORMAL, font: FONT }),
                new TextRun({ text: '\t________________________________', size: SZ_NORMAL, font: FONT }),
              ],
            }),
            // Nombres bajo la línea
            new Paragraph({
              tabStops: [{ type: TabStopType.LEFT, position: col }],
              children: [
                new TextRun({ text: agentName, bold: true, size: SZ_NORMAL, font: FONT }),
                new TextRun({ text: '\t' + request.requester_name, bold: true, size: SZ_NORMAL, font: FONT }),
              ],
            }),
            // Roles
            new Paragraph({
              tabStops: [{ type: TabStopType.LEFT, position: col }],
              children: [
                new TextRun({ text: 'Jefe de Soporte', size: 18, color: '555555', font: FONT }),
                new TextRun({ text: '\tQuien recibe', size: 18, color: '555555', font: FONT }),
              ],
            }),
          ];
        })(),

      ],
    }],
  });

  return Packer.toBuffer(doc);
}
