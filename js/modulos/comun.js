/* =====================================================================
   UTILIDADES COMPARTIDAS ENTRE MÓDULOS (Coordinador, Sub y Líder)
   ===================================================================== */
window.Comun = {};

/* ------------------------- CAMPOS DE FORMULARIO ------------------------- */
function _campo(etiqueta, id, valor, tipo) {
  return '<div class="campo"><label for="' + id + '">' + U.esc(etiqueta) + "</label>" +
         '<input id="' + id + '" type="' + (tipo || "text") + '" value="' +
         U.esc(U.UP(valor)) + '"></div>';
}
function _area(etiqueta, id, valor, filas) {
  return '<div class="campo"><label for="' + id + '">' + U.esc(etiqueta) + "</label>" +
         '<textarea id="' + id + '" rows="' + (filas || 3) + '" placeholder="ESCRIBA AQUÍ...">' +
         U.esc(U.UP(valor)) + "</textarea></div>";
}

/* ==================================================================
   RECAUDACIÓN DE DATOS
   ================================================================== */
Comun.formRecaudacion = function (valores) {
  const v = valores || {};
  return '<div class="formulario">' +
    '<div class="dos-col">' +
      _campo("NOMBRES COMPLETOS", "rc-nombres", v.nombres) +
      _campo("CÉDULA", "rc-cedula", v.cedula, "tel") +
    "</div>" +
    '<div class="dos-col">' +
      _campo("TELÉFONO", "rc-telefono", v.telefono, "tel") +
      _campo("DIRECCIÓN", "rc-direccion", v.direccion) +
    "</div>" +
    _area("SOLICITUD (OPCIONAL)", "rc-solicitud", v.solicitud, 3) +
    '<div id="rc-error"></div>' +
  "</div>";
};

Comun.leerRecaudacion = function (raiz) {
  return {
    nombres: U.UP(raiz.querySelector("#rc-nombres").value),
    cedula: U.UP(raiz.querySelector("#rc-cedula").value),
    telefono: U.UP(raiz.querySelector("#rc-telefono").value),
    direccion: U.UP(raiz.querySelector("#rc-direccion").value),
    solicitud: U.UP(raiz.querySelector("#rc-solicitud").value)
  };
};

Comun.validarRecaudacion = function (d) {
  if (!U.requerido(d.nombres)) return "LOS NOMBRES SON OBLIGATORIOS";
  if (!U.validarCedula(d.cedula)) return "LA CÉDULA NO ES VÁLIDA (MÍNIMO 5 DÍGITOS)";
  if (!U.validarTelefono(d.telefono)) return "EL TELÉFONO NO ES VÁLIDO (MÍNIMO 6 DÍGITOS)";
  if (!U.requerido(d.direccion)) return "LA DIRECCIÓN ES OBLIGATORIA";
  return null;
};

Comun.guardarRecaudacion = async function (d, id, perfil) {
  const error = Comun.validarRecaudacion(d);
  if (error) throw new Error(error);

  const base = {
    nombres: d.nombres,
    cedula: d.cedula,
    telefono: d.telefono,
    direccion: d.direccion,
    solicitud: d.solicitud,
    ultimaEdicion: U.ahora(),
    editadoPorId: perfil.id,
    editadoPorNombre: perfil.nombre
  };

  if (id) {
    await FS.actualizar("recaudaciones", id, base);
    return id;
  }

  const registro = Object.assign({}, base, {
    creadoPorId: perfil.id,
    creadoPorNombre: perfil.nombre,
    rolCreador: perfil.rol,
    subcoordinadorId: perfil.rol === "LIDER" ? perfil.subcoordinadorId : (perfil.subcoordinadorId || null),
    coordinadorId: perfil.coordinadorId || null,
    barrio: U.UP(perfil.barrio),
    fecha: U.ahora(),
    fechaMs: U.ahoraMs()
  });
  return await FS.crear("recaudaciones", registro);
};

/* ==================================================================
   ENVIAR PETICIÓN (COMPRAS / PUBLICIDAD)
   ================================================================== */
Comun.formPeticion = function () {
  return '<div class="formulario">' +
    '<fieldset class="fieldset"><legend>CATEGORÍA DE LA PETICIÓN</legend>' +
      '<div class="tipo-radio">' +
        '<label class="sel" data-cat="COMPRAS">🛒 COMPRAS</label>' +
        '<label data-cat="PUBLICIDAD">📢 PUBLICIDAD</label>' +
      "</div>" +
    "</fieldset>" +
    _campo("TÍTULO DE LA PETICIÓN", "pt-titulo", "") +
    _area("DETALLE / DESCRIPCIÓN", "pt-detalle", "", 4) +
    '<div class="nota">LA PETICIÓN PASA A REVISIÓN DE SU SUB-COORDINADOR Y REQUIERE APROBACIÓN EXCLUSIVA DEL COORDINADOR.</div>' +
    '<div id="pt-error"></div>' +
  "</div>";
};

Comun.leerPeticion = function (raiz) {
  const sel = raiz.querySelector("[data-cat].sel");
  return {
    categoria: sel ? sel.dataset.cat : "COMPRAS",
    titulo: U.UP(raiz.querySelector("#pt-titulo").value),
    detalle: U.UP(raiz.querySelector("#pt-detalle").value)
  };
};

Comun.activarCategoria = function (raiz) {
  raiz.querySelectorAll("[data-cat]").forEach(function (lab) {
    lab.addEventListener("click", function () {
      raiz.querySelectorAll("[data-cat]").forEach(function (x) { x.classList.remove("sel"); });
      lab.classList.add("sel");
    });
  });
};

/* ==================================================================
   SOLICITUDES Y QUEJAS
   ================================================================== */
Comun.formQueja = function () {
  return '<div class="formulario">' +
    '<div class="campo"><label>TIPO DE REPORTES</label><select id="qj-tipo">' +
      '<option value="QUEJA">QUEJA</option>' +
      '<option value="SOLICITUD">SOLICITUD</option>' +
      '<option value="REPORTE OPERATIVO">REPORTE OPERATIVO</option>' +
      '<option value="OBSERVACIÓN">OBSERVACIÓN</option>' +
    "</select></div>" +
    _area("MENSAJE", "qj-mensaje", "", 4) +
    '<div class="nota">ESTE REPORTES SE ENVÍA A SU COORDINADOR (NUNCA DIRECTO AL ZONAL) Y REQUIERE SU APROBACIÓN PARA ESCALAR.</div>' +
    '<div id="qj-error"></div>' +
  "</div>";
};

Comun.leerQueja = function (raiz) {
  return {
    tipo: U.UP(raiz.querySelector("#qj-tipo").value),
    mensaje: U.UP(raiz.querySelector("#qj-mensaje").value)
  };
};

/* ==================================================================
   RENDER DE UNA RECAUDACIÓN (tabla)
   ================================================================== */
Comun.obtenerColumnasRecaudacion = function (incluirAutor) {
  const cols = ["NOMBRES", "CÉDULA", "TELÉFONO", "DIRECCIÓN", "SOLICITUD"];
  if (incluirAutor) {
    cols.push("REGISTRÓ", "ROL");
  }
  cols.push("FECHA", "ACCIONES");
  return cols;
};

Comun.columnasRecaudacion = Comun.obtenerColumnasRecaudacion(true);

Comun.filaRecaudacion = function (r, puedeEditar, incluirAutor) {
  if (incluirAutor === undefined) incluirAutor = true;

  const fila = [
    U.esc(U.UP(r.nombres)),
    U.esc(r.cedula),
    U.esc(r.telefono),
    U.esc(U.UP(r.direccion)),
    U.esc(U.UP(r.solicitud))
  ];

  if (incluirAutor) {
    fila.push(
      U.esc(U.UP(r.creadoPorNombre || "—")),
      U.esc(U.UP(r.rolCreador || "—"))
    );
  }

  fila.push(
    U.esc(U.fecha(r.fecha)),
    puedeEditar
      ? '<div class="grp-acciones">' +
          '<button class="btn btn-mini btn-azul2" data-edit="' + r.id + '">EDITAR</button>' +
          '<button class="btn btn-mini btn-peligro" data-del="' + r.id + '">BORRAR</button>' +
        "</div>"
      : '<span class="menor">SOLO LECTURA</span>'
  );

  return fila;
};

/* ==================================================================
   BUSCADOR + CSV + IMPRESIÓN REUTILIZABLES
   ================================================================== */
Comun.herramientas = function (barra, zona, opciones) {
  barra.querySelector('[data-t="ref"]').addEventListener("click", opciones.recargar);
  barra.querySelector('[data-t="print"]').addEventListener("click", function () {
    U.imprimir(zona.id ? "#" + zona.id : null);
  });
  const btnPdf = barra.querySelector('[data-t="pdf"]');
  if (btnPdf) btnPdf.addEventListener("click", function () {
    U.descargarPDF(zona.id ? "#" + zona.id : null, opciones.tituloCSV || "Tabla");
  });
  barra.querySelector('[data-t="csv"]').addEventListener("click", function () {
    const lista = opciones.filtrados();
    U.exportarCSV(opciones.tituloCSV, opciones.encabezadosCSV, lista.map(opciones.filaCSV));
  });
  barra.querySelector(".entrada-buscar").oninput = opciones.pintar;
};

/* ==================================================================
   PANTALLA COMPLETA: MOSTRAR DATOS RECAUDADOS POR UN USUARIO
   ================================================================== */
Comun.cerrarVisorDatos = function () {
  const visor = document.getElementById("visor-datos-full");
  if (visor) visor.classList.add("oculto");
};

Comun.verDatosUsuario = async function (usuarioId, nombreUsuario, rolUsuario) {
  const visor = document.getElementById("visor-datos-full");
  const titEl = document.getElementById("visor-full-titulo");
  const cuerpoEl = document.getElementById("visor-full-cuerpo");
  const pieEl = document.getElementById("visor-full-pie");
  const btnX = document.getElementById("visor-full-cerrar");

  const nombreLimpio = U.UP(nombreUsuario || "USUARIO");
  const rolLimpio = U.UP(rolUsuario || "");
  const titulo = "DATOS RECAUDADOS — " + nombreLimpio + (rolLimpio ? " (" + rolLimpio + ")" : "");

  function construirBannerMeta(info) {
    if (!info) return "";
    const clase = info.cumplida ? "meta-ok" : "meta-pendiente";
    const titMeta = info.cumplida
      ? "✅ META CUMPLIDA (" + U.esc(info.tipo) + ")"
      : "⚠️ LE FALTAN " + info.faltantes + " USUARIOS POR RECAUDAR";
    const detMeta = info.cumplida
      ? "HA RECAUDADO <strong>" + info.recaudados + " DE " + info.objetivo + "</strong> USUARIOS."
      : U.esc(info.tipo) + ": LLEVA <strong>" + info.recaudados + "</strong> DE <strong>" + info.objetivo + "</strong> ASIGNADOS.";

    return (
      '<div id="vf-banner-meta">' +
        '<div class="meta-box ' + clase + '">' +
          '<button type="button" class="meta-cerrar" id="vf-meta-cerrar" aria-label="CERRAR AVISO" title="OCULTAR">✕</button>' +
          '<div class="meta-tit">' + titMeta + "</div>" +
          '<div class="meta-detalle">' + detMeta + "</div>" +
          (info.mensaje ? '<div class="meta-msg">📌 ' + U.esc(U.UP(info.mensaje)) + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  if (!visor || !titEl || !cuerpoEl || !pieEl) {
    UI.cargando(true);
    try {
      const lista = await FS.recaudacionesPropias(usuarioId);
      let infoMeta = null;
      if (FS && typeof FS.resumenMetaUsuario === "function") {
        infoMeta = await FS.resumenMetaUsuario(usuarioId, lista);
      }
      const cols = ["NOMBRES", "CÉDULA", "TELÉFONO", "DIRECCIÓN", "SOLICITUD", "FECHA"];
      const filas = lista.map(function (r) {
        return [
          U.esc(U.UP(r.nombres)),
          U.esc(r.cedula),
          U.esc(r.telefono),
          U.esc(U.UP(r.direccion)),
          U.esc(U.UP(r.solicitud)),
          U.esc(U.fecha(r.fecha))
        ];
      });
      const cuerpo =
        '<div id="modal-datos-usuario">' +
          construirBannerMeta(infoMeta) +
          '<p class="menor" style="margin-bottom:10px"><strong>TOTAL PERSONAS RECAUDADAS:</strong> ' + lista.length + "</p>" +
          UI.tabla(cols, filas) +
        "</div>";
      UI.abrirModal(titulo, cuerpo, [{ texto: "CERRAR", clase: "btn-peligro" }]);
      const btnM = document.getElementById("vf-meta-cerrar");
      const boxM = document.getElementById("vf-banner-meta");
      if (btnM && boxM) btnM.onclick = function () { boxM.innerHTML = ""; };
    } catch (e) {
      UI.toast("ERROR AL CARGAR DATOS: " + e.message, "error");
    }
    UI.cargando(false);
    return;
  }

  if (btnX) {
    btnX.onclick = function () { Comun.cerrarVisorDatos(); };
  }

  titEl.textContent = titulo;
  cuerpoEl.innerHTML = UI.cargandoTabla();
  pieEl.innerHTML = '<button type="button" class="btn btn-peligro" id="vf-cerrar-btn">CERRAR</button>';
  visor.classList.remove("oculto");
  document.getElementById("vf-cerrar-btn").onclick = function () { Comun.cerrarVisorDatos(); };

  try {
    const lista = await FS.recaudacionesPropias(usuarioId);
    let infoMeta = null;
    if (FS && typeof FS.resumenMetaUsuario === "function") {
      infoMeta = await FS.resumenMetaUsuario(usuarioId, lista);
    }

    const cols = ["NOMBRES", "CÉDULA", "TELÉFONO", "DIRECCIÓN", "SOLICITUD", "FECHA"];
    const filas = (lista || []).map(function (r) {
      return [
        U.esc(U.UP(r.nombres || "")),
        U.esc(r.cedula || ""),
        U.esc(r.telefono || ""),
        U.esc(U.UP(r.direccion || "")),
        U.esc(U.UP(r.solicitud || "")),
        U.esc(U.fecha(r.fecha))
      ];
    });

    cuerpoEl.innerHTML =
      construirBannerMeta(infoMeta) +
      '<div class="tarjeta" id="visor-datos-cuerpo-tabla">' +
        '<p class="menor" style="margin-bottom:10px"><strong>TOTAL PERSONAS RECAUDADAS:</strong> ' + filas.length + "</p>" +
        UI.tabla(cols, filas) +
      "</div>";

    const btnMetaX = document.getElementById("vf-meta-cerrar");
    const boxMeta = document.getElementById("vf-banner-meta");
    if (btnMetaX && boxMeta) {
      btnMetaX.onclick = function () { boxMeta.innerHTML = ""; };
    }

    let pieHtml = "";
    if (filas.length) {
      pieHtml +=
        '<button type="button" class="btn btn-primario" id="vf-imp-btn">IMPRIMIR</button>' +
        '<button type="button" class="btn btn-exito" id="vf-csv-btn">EXPORTAR CSV</button>';
    }
    pieHtml += '<button type="button" class="btn btn-peligro" id="vf-cerrar-btn">CERRAR</button>';
    pieEl.innerHTML = pieHtml;

    document.getElementById("vf-cerrar-btn").onclick = function () { Comun.cerrarVisorDatos(); };

    const btnImp = document.getElementById("vf-imp-btn");
    if (btnImp) {
      btnImp.onclick = function () {
        U.imprimir("#visor-datos-cuerpo-tabla", titulo);
      };
    }

    const btnCsv = document.getElementById("vf-csv-btn");
    if (btnCsv) {
      btnCsv.onclick = function () {
        U.exportarCSV(
          "Datos_" + nombreLimpio,
          ["NOMBRES", "CEDULA", "TELEFONO", "DIRECCION", "SOLICITUD", "FECHA"],
          (lista || []).map(function (r) {
            return [r.nombres, r.cedula, r.telefono, r.direccion, r.solicitud, U.fecha(r.fecha)];
          })
        );
      };
    }
  } catch (e) {
    cuerpoEl.innerHTML = UI.alerta("error", "NO SE PUDIERON CARGAR LOS DATOS: " + (e.message || e));
  }
};

/* ==================================================================
   TARJETA DE META DE RECAUDACIÓN (CENTRADA + BOTÓN X PARA CERRAR)
   ================================================================== */
Comun.pintarBannerMeta = async function (contenedor, usuarioId, registrosOpcionales) {
  if (!contenedor) return;
  try {
    const info = await FS.resumenMetaUsuario(usuarioId, registrosOpcionales);
    if (!info) {
      contenedor.innerHTML = "";
      return;
    }

    const clase = info.cumplida ? "meta-ok" : "meta-pendiente";
    const titulo = info.cumplida
      ? "✅ META CUMPLIDA (" + U.esc(info.tipo) + ")"
      : "⚠️ TE FALTAN " + info.faltantes + " USUARIOS POR RECAUDAR";
    const detalle = info.cumplida
      ? "HAS RECAUDADO <strong>" + info.recaudados + " DE " + info.objetivo + "</strong> USUARIOS."
      : U.esc(info.tipo) + ": LLEVAS <strong>" + info.recaudados + "</strong> DE <strong>" + info.objetivo + "</strong> ASIGNADOS.";

    contenedor.innerHTML =
      '<div class="meta-box ' + clase + '">' +
        '<button type="button" class="meta-cerrar" aria-label="CERRAR AVISO" title="OCULTAR">✕</button>' +
        '<div class="meta-tit">' + titulo + "</div>" +
        '<div class="meta-detalle">' + detalle + "</div>" +
        (info.mensaje ? '<div class="meta-msg">📌 ' + U.esc(U.UP(info.mensaje)) + "</div>" : "") +
      "</div>";

    const btnCerrar = contenedor.querySelector(".meta-cerrar");
    if (btnCerrar) {
      btnCerrar.addEventListener("click", function () {
        contenedor.innerHTML = "";
      });
    }
  } catch (e) {
    console.warn("META:", e);
  }
};