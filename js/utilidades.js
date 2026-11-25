/* =====================================================================
   UTILIDADES — Mayúsculas, validaciones, fechas, CSV e impresión
   ===================================================================== */
const U = {};

/* ---------------------------------------------------------------------
   REGLA GLOBAL: TODO TEXTO EN MAYÚSCULAS (tiempo real + al guardar)
   --------------------------------------------------------------------- */
U.UP = function (valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).toUpperCase();
};

/* Tipos de entrada que deben ir en mayúsculas */
const TIPOS_MAYUSCULAS = ["text", "password", "search", "tel", "url"];

/**
 * Detecta si un elemento debe ir en MAYÚSCULAS.
 */
U.esCampoMayusculas = function (t) {
  if (!t) return false;
  if (t.tagName === "TEXTAREA") return true;
  return t.tagName === "INPUT" && TIPOS_MAYUSCULAS.indexOf(t.type) !== -1;
};

/**
 * Convierte el contenido de un campo a MAYÚSCULAS conservando el cursor.
 * La longitud no cambia, por lo que los offsets siguen siendo válidos.
 */
U.normalizarCampo = function (t) {
  const nuevo = U.UP(t.value);
  if (nuevo === t.value) return;
  const inicio = t.selectionStart;
  const fin = t.selectionEnd;
  t.value = nuevo;
  try { t.setSelectionRange(inicio, fin); } catch (err) { /* campo no seleccionable */ }
};

/**
 * Instala el detector global que convierte en MAYÚSCULAS mientras se
 * escribe. La normalización se difiere al siguiente ciclo para no
 * interferir con la transacción de edición que el navegador tiene en
 * curso (pegado, autocompletado, reemplazo total), y se respeta la
 * composición IME (caracteres acentuados introducidos por teclado).
 */
U.instalarMayusculas = function () {
  const pendientes = new WeakSet();

  function programar(t) {
    if (pendientes.has(t)) return;
    pendientes.add(t);
    setTimeout(function () {
      pendientes.delete(t);
      U.normalizarCampo(t);
    }, 0);
  }

  document.addEventListener("input", function (e) {
    const t = e.target;
    if (!U.esCampoMayusculas(t)) return;
    if (e.isComposing || t.isComposing) return; // se normaliza en compositionend
    programar(t);
  }, true);

  document.addEventListener("compositionend", function (e) {
    if (U.esCampoMayusculas(e.target)) programar(e.target);
  }, true);
};

/* Escapado de HTML (seguridad básica) */
U.esc = function (valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/* ---------------------------------------------------------------------
   FECHAS
   --------------------------------------------------------------------- */
U.ahora = function () {
  return new Date().toISOString();
};
U.ahoraMs = function () {
  return Date.now();
};
U.fecha = function (valor) {
  if (!valor) return "—";
  const d = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  const p = function (n) { return String(n).padStart(2, "0"); };
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
};
U.fechaCorta = function (valor) {
  if (!valor) return "—";
  const d = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  const p = function (n) { return String(n).padStart(2, "0"); };
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
};

/* ---------------------------------------------------------------------
   VALIDACIONES
   --------------------------------------------------------------------- */
U.soloDigitos = function (v) { return String(v == null ? "" : v).replace(/\D/g, ""); };

U.validarCedula = function (v) {
  const d = U.soloDigitos(v);
  return d.length >= 5 && d.length <= 12;
};
U.validarTelefono = function (v) {
  const d = U.soloDigitos(v);
  return d.length >= 6 && d.length <= 15;
};
U.requerido = function (v) { return String(v == null ? "" : v).trim().length > 0; };

/**
 * Valida el campo USUARIO / CÉDULA.
 * Acepta dos formatos:
 *   - Cédula: solo dígitos (5 a 12).
 *   - Usuario: 4 a 30 caracteres alfanuméricos con @ . _ -
 * Ejemplos válidos: "1023456789", "AMBAR@2027", "COORD1".
 */
U.usuarioValido = function (v) {
  const s = String(v == null ? "" : v).trim();
  if (s.length < 4 || s.length > 30) return false;
  if (/^\d+$/.test(s)) return s.length >= 5 && s.length <= 12;
  return /^[A-Za-z0-9@._\-]+$/.test(s);
};

/* ---------------------------------------------------------------------
   EXPORTAR A EXCEL (CSV) — separador ";" + BOM para Excel en español
   --------------------------------------------------------------------- */
U.celdaCSV = function (v) {
  let s = U.UP(v);
  if (s === null || s === undefined) s = "";
  return '"' + String(s).replace(/"/g, '""') + '"';
};

U.exportarCSV = function (nombreArchivo, encabezados, filas) {
  const lineas = [];
  lineas.push(encabezados.map(U.celdaCSV).join(";"));
  (filas || []).forEach(function (f) {
    lineas.push(f.map(U.celdaCSV).join(";"));
  });
  const contenido = "\uFEFF" + lineas.join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = U.UP(nombreArchivo || "exportacion").replace(/[^\w\-]+/g, "_") + ".csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
};

/* ---------------------------------------------------------------------
   IMPRESIÓN — marca el bloque a imprimir y lanza el diálogo
   --------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   DESCARGA PDF — genera un archivo PDF real a partir de una tabla del DOM
   --------------------------------------------------------------------- */
U.descargarPDF = function (selector, titulo) {
  try {
    if (typeof jspdf === "undefined" || !jspdf.jsPDF) {
      UI.toast("NO SE PUDO CARGAR LA LIBRERÍA DE PDF", "error");
      return;
    }
    const nodo = selector ? document.querySelector(selector) : null;
    const tabla = nodo ? nodo.querySelector("table") : document.querySelector("table");
    const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const tituloFinal = U.UP(titulo || "TABLA");
    doc.setFontSize(14);
    doc.text(tituloFinal, 40, 30);
    doc.setFontSize(9);
    doc.text("GENERADO: " + U.fecha(U.ahora()), 40, 46);

    if (tabla) {
      const thead = tabla.querySelector("thead");
      const tbody = tabla.querySelector("tbody");
      let headers = [];
      if (thead) {
        headers = Array.from(thead.querySelectorAll("th")).map(function (th) { return U.UP(th.textContent.trim()); });
      } else if (tabla.rows.length) {
        headers = Array.from(tabla.rows[0].cells).map(function (c) { return U.UP(c.textContent.trim()); });
      }
      let bodyRows = [];
      if (tbody) {
        bodyRows = Array.from(tbody.querySelectorAll("tr"));
      } else {
        bodyRows = Array.from(tabla.rows).slice(headers.length ? 1 : 0);
      }
      let body = bodyRows.map(function (tr) {
        return Array.from(tr.querySelectorAll("td, th")).map(function (c) { return U.UP(c.textContent.trim()); });
      }).filter(function (r) { return r.length && r.some(function (c) { return c !== ""; }); });

      // Eliminar la columna "ACCIONES" del PDF.
      let idxAcciones = -1;
      headers.forEach(function (h, i) { if (h === "ACCIONES") idxAcciones = i; });
      if (idxAcciones >= 0) {
        headers.splice(idxAcciones, 1);
        body = body.map(function (r) { const c = r.slice(); c.splice(idxAcciones, 1); return c; });
      }

      if (headers.length && body.length) {
        doc.autoTable({
          head: [headers],
          body: body,
          startY: 58,
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [11, 61, 145], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 40, right: 40 }
        });
      } else if (body.length) {
        let y = 58;
        body.forEach(function (r) {
          doc.text(r.join("  |  "), 40, y);
          y += 12;
        });
      }
    }

    const nombre = (titulo || "Tabla") + ".pdf";
    doc.save(nombre);
    UI.toast("PDF DESCARGADO: " + nombre, "ok");
  } catch (e) {
    console.error("PDF:", e);
    UI.toast("ERROR AL GENERAR PDF: " + (e.message || e), "error");
  }
};

U.imprimir = function (selector, titulo) {
  const nodo = selector ? document.querySelector(selector) : null;
  const tituloAnterior = document.title;
  if (titulo) document.title = U.UP(titulo);
  const limpiar = function () {
    document.body.classList.remove("imprimiendo");
    if (nodo) nodo.classList.remove("area-imprimir");
    if (titulo) document.title = tituloAnterior;
    window.removeEventListener("afterprint", limpiar);
  };
  document.body.classList.add("imprimiendo");
  if (nodo) nodo.classList.add("area-imprimir");
  window.addEventListener("afterprint", limpiar);
  setTimeout(function () {
    window.print();
    setTimeout(limpiar, 900);
  }, 80);
};

/* ---------------------------------------------------------------------
   VARIOS
   --------------------------------------------------------------------- */
U.clave = function () {
  return "gt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};
U.ordenarPorFechaDesc = function (lista) {
  return (lista || []).slice().sort(function (a, b) {
    return (b.fechaMs || 0) - (a.fechaMs || 0);
  });
};
U.contiene = function (texto, busqueda) {
  if (!busqueda) return true;
  return U.UP(texto).indexOf(U.UP(busqueda)) !== -1;
};
U.unir = function (partes) {
  return U.UP(partes.filter(Boolean).join(" "));
};
