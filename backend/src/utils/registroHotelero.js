// src/utils/registroHotelero.js
// Genera el PDF del Registro Hotelero usando pdfkit (Node.js puro)
// Instalar: npm install pdfkit
// Uso: import { generarRegistroHotelero } from "../utils/registroHotelero.js"
//       const buffer = await generarRegistroHotelero(datos)

import PDFDocument from "pdfkit";

// ── Colores ──────────────────────────────────────────────────────────────────
const C_AZUL       = "#1a3a5c";
const C_AZUL_CLARO = "#e8f0fe";
const C_GRIS       = "#6b7280";
const C_GRIS_FONDO = "#f3f4f6";
const C_BORDE      = "#d1d5db";
const C_BLANCO     = "#ffffff";

// ── Helpers ──────────────────────────────────────────────────────────────────
const val = (v) => (v && String(v).trim() !== "" ? String(v).trim() : "—");

const fuenteLabel = (f) =>
  ({ recepcion:"Recepción", telefono:"Teléfono", walkin:"Walk-in",
     booking:"Booking.com", airbnb:"Airbnb", web:"Web propia", otro:"Otro" }[f] || f || "—");

const planLabel = (p) =>
  ({ C1:"Clásico 1 (C1)", GK:"Gold King (GK)" }[(p||"").toUpperCase()] || p || "—");

const formatFecha = (f) => {
  if (!f || f === "—") return "—";
  // Si ya viene formateada DD/MM/YYYY la dejamos
  if (/^\d{2}\/\d{2}\/\d{4}/.test(String(f))) return String(f);
  // Si viene ISO YYYY-MM-DD
  const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(f);
};

// Convierte hex a rgb array [r,g,b] para pdfkit
const hex2rgb = (hex) => {
  const h = hex.replace("#","");
  return [
    parseInt(h.substring(0,2),16),
    parseInt(h.substring(2,4),16),
    parseInt(h.substring(4,6),16),
  ];
};

// ── Función principal ─────────────────────────────────────────────────────────
export const generarRegistroHotelero = (datos) => {
  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ size:"LETTER", margins:{ top:40,bottom:40,left:45,right:45 } });
      const chunks = [];
      doc.on("data",  (c) => chunks.push(c));
      doc.on("end",   ()  => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W    = doc.page.width  - 90; // ancho útil (sin márgenes)
      const LEFT = 45;
      let   y    = 40;

      // ── Helpers de dibujo ─────────────────────────────────────────────────

      const lineH = (yPos, color = C_BORDE, thickness = 0.5) => {
        doc.save()
          .moveTo(LEFT, yPos).lineTo(LEFT + W, yPos)
          .strokeColor(color).lineWidth(thickness).stroke()
          .restore();
      };

      const rectFill = (x, yPos, w, h, color) => {
        doc.save().rect(x, yPos, w, h).fillColor(color).fill().restore();
      };

      const rectBorder = (x, yPos, w, h, color = C_BORDE) => {
        doc.save().rect(x, yPos, w, h).strokeColor(color).lineWidth(0.5).stroke().restore();
      };

      // Texto centrado en un rect
      const textCentrado = (texto, x, yPos, w, opts = {}) => {
        doc.text(texto, x, yPos, { width: w, align:"center", ...opts });
      };

      // Celda con label pequeño arriba y valor en negrita abajo
      const celda = (label, valor, x, yPos, w, fondo = C_BLANCO) => {
        const H = 38;
        rectFill(x, yPos, w, H, fondo);
        rectBorder(x, yPos, w, H);
        doc.fillColor(C_GRIS).fontSize(7).font("Helvetica")
           .text(label, x + 6, yPos + 5, { width: w - 10 });
        doc.fillColor("#111111").fontSize(9.5).font("Helvetica-Bold")
           .text(val(valor), x + 6, yPos + 16, { width: w - 10 });
        return H;
      };

      // Encabezado de sección con fondo azul
      const seccionHeader = (texto, yPos, alto = 22) => {
        rectFill(LEFT, yPos, W, alto, C_AZUL);
        doc.fillColor(C_BLANCO).fontSize(10).font("Helvetica-Bold")
           .text(texto, LEFT + 8, yPos + 6, { width: W - 16 });
        return alto;
      };

      // ── 1. ENCABEZADO ──────────────────────────────────────────────────────
      doc.fillColor(C_AZUL).fontSize(22).font("Helvetica-Bold");
      textCentrado("REGISTRO HOTELERO", LEFT, y, W);
      y += 28;

      doc.fillColor(C_GRIS).fontSize(12).font("Helvetica");
      textCentrado(val(datos.hotel_nombre), LEFT, y, W);
      y += 16;

      if (datos.hotel_direccion) {
        doc.fillColor(C_GRIS).fontSize(10).font("Helvetica");
        textCentrado(datos.hotel_direccion, LEFT, y, W);
        y += 14;
      }

      y += 6;
      lineH(y, C_AZUL, 2);
      y += 12;

      // ── 2. INFORMACIÓN DE LA ESTADÍA ───────────────────────────────────────
      y += seccionHeader("INFORMACIÓN DE LA ESTADÍA", y);
      y += 2;

      const col4 = W / 4;
      const noches  = val(datos.noches);
      const estado  = (datos.estado || "").toUpperCase();

      // Fila 1
      celda("N° Reserva",   `#${datos.reserva_id}`,         LEFT,            y, col4, C_GRIS_FONDO);
      celda("Habitación",   `Hab. ${datos.habitacion_numero} — ${datos.habitacion_tipo}`,
                                                              LEFT + col4,     y, col4, C_GRIS_FONDO);
      celda("Plan",         planLabel(datos.plan),            LEFT + col4*2,   y, col4, C_GRIS_FONDO);
      celda("Estado",       estado,                           LEFT + col4*3,   y, col4, C_GRIS_FONDO);
      y += 40;

      // Fila 2
      celda("Fecha Ingreso", formatFecha(datos.fecha_inicio), LEFT,            y, col4, C_GRIS_FONDO);
      celda("Fecha Salida",  formatFecha(datos.fecha_fin),    LEFT + col4,     y, col4, C_GRIS_FONDO);
      celda("N° Noches",     noches,                          LEFT + col4*2,   y, col4, C_GRIS_FONDO);
      celda("Fuente",        fuenteLabel(datos.fuente),       LEFT + col4*3,   y, col4, C_GRIS_FONDO);
      y += 44;

      // ── 3. DATOS DEL TITULAR ───────────────────────────────────────────────
      y += seccionHeader("DATOS DEL TITULAR", y);
      y += 2;

      const t = datos.titular || {};
      const nombreCompleto = [t.nombres, t.primer_apellido, t.segundo_apellido]
        .map(x => (x||"").trim()).filter(Boolean).join(" ") || t.nombre || "—";
      const docStr = [t.tipo_documento, t.documento].filter(Boolean).join(" ") || "—";

      // Fila 1
      celda("Nombre completo",  nombreCompleto,              LEFT,          y, col4 * 1.5);
      celda("Tipo y N° Doc.",   docStr,                      LEFT+col4*1.5, y, col4);
      celda("Teléfono",         val(t.telefono),             LEFT+col4*2.5, y, col4 * 0.75);
      celda("Email",            val(t.email),                LEFT+col4*3.25,y, col4 * 0.75);
      y += 40;

      // Fila 2
      celda("Nacionalidad",     val(t.nacionalidad),         LEFT,          y, col4);
      celda("Ciudad",           val(t.ciudad),               LEFT+col4,     y, col4);
      celda("Dirección",        val(t.direccion),            LEFT+col4*2,   y, col4);
      celda("Fecha nacimiento", formatFecha(t.fecha_nacimiento), LEFT+col4*3, y, col4);
      y += 44;

      // ── 4. ACOMPAÑANTES ────────────────────────────────────────────────────
      const acompanantes = datos.acompanantes || [];
      if (acompanantes.length > 0) {
        y += seccionHeader(`ACOMPAÑANTES (${acompanantes.length})`, y);
        y += 2;

        // Cabecera de tabla
        const colsAcomp = [W * 0.32, W * 0.24, W * 0.20, W * 0.24];
        const xsAcomp   = [
          LEFT,
          LEFT + colsAcomp[0],
          LEFT + colsAcomp[0] + colsAcomp[1],
          LEFT + colsAcomp[0] + colsAcomp[1] + colsAcomp[2],
        ];
        const thAlto = 20;
        rectFill(LEFT, y, W, thAlto, C_AZUL_CLARO);
        rectBorder(LEFT, y, W, thAlto);
        const thLabels = ["Nombre completo","Documento","Teléfono","Email"];
        thLabels.forEach((l, i) => {
          doc.fillColor("#1a3a5c").fontSize(8.5).font("Helvetica-Bold")
             .text(l, xsAcomp[i] + 5, y + 5, { width: colsAcomp[i] - 8 });
        });
        y += thAlto;

        acompanantes.forEach((a, idx) => {
          const nombre_a = [a.nombres, a.primer_apellido, a.segundo_apellido]
            .map(x=>(x||"").trim()).filter(Boolean).join(" ") || "—";
          const doc_a = [a.tipo_documento, a.documento].filter(Boolean).join(" ") || "—";
          const rowH  = 22;
          const fondo = idx % 2 === 0 ? C_BLANCO : C_GRIS_FONDO;

          rectFill(LEFT, y, W, rowH, fondo);
          rectBorder(LEFT, y, W, rowH);

          const vals = [nombre_a, doc_a, val(a.telefono), val(a.email)];
          vals.forEach((v, i) => {
            doc.fillColor("#111111").fontSize(9).font("Helvetica")
               .text(v, xsAcomp[i] + 5, y + 6, { width: colsAcomp[i] - 8, lineBreak: false });
          });
          y += rowH;
        });
        y += 12;
      }

      // ── 5. NOTAS INTERNAS ──────────────────────────────────────────────────
      const notas = (datos.notas || "").trim();
      if (notas) {
        y += seccionHeader("NOTAS INTERNAS", y);
        y += 2;
        const notasAlto = 40;
        rectFill(LEFT, y, W, notasAlto, C_BLANCO);
        rectBorder(LEFT, y, W, notasAlto);
        doc.fillColor("#333333").fontSize(9).font("Helvetica")
           .text(notas, LEFT + 8, y + 8, { width: W - 16 });
        y += notasAlto + 12;
      }

      // ── 6. FIRMAS ──────────────────────────────────────────────────────────
      y = Math.max(y, doc.page.height - 150); // empujar hacia el fondo si hay espacio
      lineH(y, C_BORDE);
      y += 30;

      const mitad = W / 2;
      lineH(y + 25, C_BORDE, 0.5); // línea firma izquierda parcial
      doc.save()
        .moveTo(LEFT, y + 25).lineTo(LEFT + mitad - 20, y + 25)
        .strokeColor(C_GRIS).lineWidth(0.5).stroke()
        .restore();
      doc.save()
        .moveTo(LEFT + mitad + 20, y + 25).lineTo(LEFT + W, y + 25)
        .strokeColor(C_GRIS).lineWidth(0.5).stroke()
        .restore();

      doc.fillColor(C_GRIS).fontSize(8.5).font("Helvetica");
      textCentrado("Firma del huésped",          LEFT,       y + 30, mitad);
      textCentrado("Recepcionista / Firma y sello", LEFT + mitad, y + 30, mitad);

      // ── 7. PIE DE PÁGINA ───────────────────────────────────────────────────
      y += 55;
      lineH(y, C_GRIS, 0.5);
      y += 6;
      const ahora = new Date();
      const fechaImp = ahora.toLocaleDateString("es-CO", {
        day:"2-digit", month:"2-digit", year:"numeric" }) +
        " " + ahora.toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit" });
      doc.fillColor(C_GRIS).fontSize(7.5).font("Helvetica");
      textCentrado(
        `Documento generado el ${fechaImp} — ${val(datos.hotel_nombre)}`,
        LEFT, y, W
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};