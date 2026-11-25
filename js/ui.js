/* =====================================================================
   INTERFAZ — Toast, cargando, modales, sellos, tablas y utilidades UI
   ===================================================================== */
const UI = {};

/* -------------------------- CARGANDO -------------------------- */
UI.cargando = function (activo) {
  const el = document.getElementById("cargando-global");
  if (el) el.classList.toggle("oculto", !activo);
};

UI.cargandoTabla = function () {
  return '<div class="cargando-vista">CARGANDO INFORMACIÓN...</div>';
};

/* -------------------------- TOAST -------------------------- */
UI._toastTimer = null;
UI.toast = function (mensaje, tipo) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = U.UP(mensaje);
  el.className = "toast " + (tipo || "ok");
  clearTimeout(UI._toastTimer);
  UI._toastTimer = setTimeout(function () { el.className = "toast oculto"; }, 3300);
};

/* -------------------------- ALERTAS EN VISTA -------------------------- */
UI.alerta = function (tipo, texto) {
  return '<div class="alerta ' + (tipo || "info") + '">' + U.esc(texto) + "</div>";
};

/* -------------------------- SELLOS DE ESTADO -------------------------- */
UI.sello = function (valor, mapa) {
  const clase = mapa[U.UP(valor)] || "gris";
  return '<span class="sello sello-' + clase + '">' + U.esc(U.UP(valor || "—")) + "</span>";
};

UI.selloEstado = function (valor) {
  return UI.sello(valor, {
    "PENDIENTE": "naranja",
    "APROBADA": "verde",
    "NEGADA": "rojo",
    "ACTIVO": "verde",
    "PAUSADO": "naranja",
    "SUSPENDIDO": "rojo"
  });
};

UI.selloEstadoArea = function (valor) {
  return UI.sello(valor, {
    "EN ESPERA": "gris",
    "EN GESTIÓN": "azul",
    "ENTREGADO": "verde"
  });
};

/* -------------------------- TABLA RESPONSIVE -------------------------- */
/**
 * @param {Array<string>} columnas - títulos de columna
 * @param {Array<Array<string>>} filas - celdas (se escapan aquí salvo que ya vengan como HTML)
 */
UI.tabla = function (columnas, filas) {
  let h = '<div class="tabla-cont"><table class="responsive"><thead><tr>';
  columnas.forEach(function (c) { h += "<th>" + U.esc(c) + "</th>"; });
  h += "</tr></thead><tbody>";
  if (!filas || !filas.length) {
    h += '<tr><td class="vacio" colspan="' + columnas.length + '">SIN REGISTROS PARA MOSTRAR</td></tr>';
  } else {
    filas.forEach(function (f) {
      h += "<tr>";
      f.forEach(function (celda, i) {
        h += '<td data-label="' + U.esc(columnas[i] || "") + '">' + celda + "</td>";
      });
      h += "</tr>";
    });
  }
  h += "</tbody></table></div>";
  return h;
};

/* -------------------------- BARRA DE HERRAMIENTAS -------------------------- */
UI.barra = function (htmlInterno) {
  return '<div class="barra no-imprimir">' + htmlInterno + "</div>";
};

/* -------------------------- ENCABEZADO DE VISTA -------------------------- */
UI.encabezado = function (titulo, subtitulo) {
  return '<div class="encabezado-vista"><h2>' + U.esc(titulo) + "</h2>" +
         (subtitulo ? "<p>" + U.esc(subtitulo) + "</p>" : "") + "</div>";
};

/* -------------------------- TARJETA -------------------------- */
UI.tarjeta = function (titulo, cuerpoHTML) {
  return '<div class="tarjeta"><h3>' + U.esc(titulo) + "</h3>" + cuerpoHTML + "</div>";
};

/* -------------------------- ESTADÍSTICAS -------------------------- */
UI.resumen = function (items) {
  let h = '<div class="resumen">';
  items.forEach(function (it) {
    h += '<div class="stat ' + (it.color || "") + '"><b>' + U.esc(String(it.valor)) +
         "</b><span>" + U.esc(it.etiqueta) + "</span></div>";
  });
  h += "</div>";
  return h;
};

/* -------------------------- MODAL -------------------------- */
UI.abrirModal = function (titulo, cuerpoHTML, botones) {
  const modal = document.getElementById("modal");
  document.getElementById("modal-titulo").textContent = U.UP(titulo);
  document.getElementById("modal-cuerpo").innerHTML = cuerpoHTML;
  const pie = document.getElementById("modal-pie");
  pie.innerHTML = "";
  const lista = botones && botones.length ? botones : [{ texto: "CERRAR", clase: "btn-suave" }];
  lista.forEach(function (b) {
    const btn = document.createElement("button");
    btn.className = "btn " + (b.clase || "btn-suave");
    btn.textContent = U.UP(b.texto);
    btn.type = "button";
    btn.addEventListener("click", async function () {
      try {
        if (b.onClick) {
          const r = await b.onClick();
          if (r === false) return;
        }
        UI.cerrarModal();
      } catch (e) {
        UI.toast(e.message || "ERROR", "error");
      }
    });
    pie.appendChild(btn);
  });
  modal.classList.remove("oculto");
};

UI.cerrarModal = function () {
  document.getElementById("modal").classList.add("oculto");
};

UI.confirmar = function (mensaje) {
  return new Promise(function (resolve) {
    UI.abrirModal("CONFIRMAR", "<p>" + U.esc(mensaje) + "</p>", [
      { texto: "CANCELAR", clase: "btn-suave", onClick: function () { resolve(false); } },
      { texto: "ACEPTAR", clase: "btn-peligro", onClick: function () { resolve(true); } }
    ]);
  });
};

/* -------------------------- TABLA CON BUSCADOR REUTILIZABLE -------------------------- */
/**
 * Pinta una tabla filtrable con exportación CSV e impresión.
 * @param {Object} op
 *  op.columnas   : Array<string>
 *  op.datos      : Array<object>
 *  op.render     : (obj) => Array<string>   celdas HTML
 *  op.buscar     : (obj, q) => boolean
 *  op.exportar   : (obj) => Array           fila CSV
 *  op.tituloCSV  : string
 *  op.zona       : HTMLElement contenedor
 *  op.barra      : HTMLElement contenedor de la barra (opcional)
 */
UI.pintarTablaFiltrable = function (op) {
  const zona = op.zona;
  const buscador = op.barra ? op.barra.querySelector(".entrada-buscar") : null;

  function pintar() {
    const q = buscador ? U.UP(buscador.value) : "";
    const filtrados = (op.datos || []).filter(function (d) {
      return !q || op.buscar(d, q);
    });
    zona.innerHTML = UI.tabla(op.columnas, filtrados.map(op.render)) +
      '<p class="nota-tabla no-imprimir">TOTAL DE REGISTROS: ' + filtrados.length + "</p>";
    if (op.alPintar) op.alPintar(zona, filtrados);
    return filtrados;
  }

  if (buscador) buscador.oninput = pintar;
  return pintar();
};

/* -------------------------- INICIALIZACIÓN DE MODAL -------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  const cerrar = document.getElementById("modal-cerrar");
  if (cerrar) cerrar.addEventListener("click", UI.cerrarModal);
  const modal = document.getElementById("modal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) UI.cerrarModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") UI.cerrarModal();
  });
});
