/* =====================================================================
   MÓDULO DE ÁREA — Responsable de PUBLICIDAD (2A) y Compras (2B)
   ---------------------------------------------------------------------
   Tabla de peticiones APROBADAS por el Coordinador.
   REGLA CRÍTICA: al marcar ENTREGADO los botones de gestión
   DESAPARECEN automáticamente de la fila y queda solo el sello.
   ===================================================================== */
(function () {

  const COLUMNAS = [
    "BARRIO", "FECHA", "SOLICITANTE", "TÍTULO / DETALLE",
    "ESTADO ACTUAL", "OBSERVACIONES", "ACCIONES"
  ];

  function crearModuloArea(categoria) {
    const titulo = "PETICIONES APROBADAS — " + categoria;
    const subtitulo =
      "SOLO PETICIONES CON VISTO BUENO (APRUEBO) DEL COORDINADOR DEL BARRIO. CATEGORÍA " + categoria + ".";

    function pintar(cont) {
      cont.innerHTML =
        UI.encabezado(titulo, subtitulo) +
        UI.barra(
          '<input class="entrada-buscar" type="search" placeholder="BUSCARR BARRIO, TÍTULO, SOLICITANTE...">' +
          '<button class="btn btn-suave" data-t="csv">EXPORTAR CSV</button>' +
          '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>              <button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
          '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
        ) +
        '<div id="zona-tabla"></div>';

      const zona = cont.querySelector("#zona-tabla");
      const barra = cont.querySelector(".barra");
      const buscador = barra.querySelector(".entrada-buscar");
      let datos = [];

      /* ------------------------- CARGA ------------------------- */
      async function cargar() {
        zona.innerHTML = UI.cargandoTabla();
        try {
          datos = await FS.peticionesAprobadas(categoria);
          pintar();
        } catch (e) {
          console.error(e);
          zona.innerHTML = UI.alerta("error", "NO SE PUDO CARGAR LA INFORMACIÓN: " + e.message);
        }
      }

      /* ------------------------- PINTAR ------------------------- */
      function filtrados() {
        const q = U.UP(buscador.value);
        if (!q) return datos;
        return datos.filter(function (p) {
          return U.contiene(U.unir([p.barrio, p.titulo, p.detalle, p.creadoPorNombre, p.rolCreador]), q);
        });
      }

      function pintar() {
        const lista = filtrados();

        const filas = lista.map(function (p) {
          const entregado = p.estadoArea === "ENTREGADO";
          const enGestion = p.estadoArea === "EN GESTIÓN";

          /* --- Campo de observaciones --- */
          const obs = entregado
            ? '<span class="obs-fija">' + U.esc(U.UP(p.observacionArea || "SIN OBSERVACIONES")) + "</span>"
            : '<textarea class="obs-input" rows="2" data-obs="' + p.id + '" ' +
              'placeholder="ESCRIBA SU OBSERVACIÓN...">' + U.esc(U.UP(p.observacionArea || "")) + "</textarea>";

          /* --- Acciones: desaparecen al ENTREGADO --- */
          let acciones;
          if (entregado) {
            acciones = '<span class="sello sello-grande sello-verde">ENTREGADO</span>';
          } else {
            acciones = '<div class="grp-acciones">' +
              '<button class="btn btn-mini btn-suave" data-acc="guardar" data-id="' + p.id + '">GUARDAR OBS.</button>' +
              (enGestion ? "" :
                '<button class="btn btn-mini btn-naranja" data-acc="gestion" data-id="' + p.id + '">MARCAR EN GESTIÓN</button>') +
              '<button class="btn btn-mini btn-exito" data-acc="entregar" data-id="' + p.id + '">MARCAR ENTREGADO</button>' +
              "</div>";
          }

          return [
            U.esc(U.UP(p.barrio || "—")),
            U.esc(U.fecha(p.fecha)),
            U.esc(U.unir([p.creadoPorNombre, "(" + (p.rolCreador || "") + ")"])),
            "<strong>" + U.esc(U.UP(p.titulo || "")) + "</strong><br><span class=\"menor\">" +
              U.esc(U.UP(p.detalle || "")) + "</span>",
            UI.selloEstadoArea(p.estadoArea),
            obs,
            acciones
          ];
        });

        zona.innerHTML = UI.tabla(COLUMNAS, filas) +
          '<p class="nota-tabla no-imprimir">TOTAL DE PETICIONES APROBADAS: ' + lista.length +
          " · ENTREGADAS: " + lista.filter(function (p) { return p.estadoArea === "ENTREGADO"; }).length +
          "</p>";

        zona.querySelectorAll("[data-acc]").forEach(function (b) {
          b.addEventListener("click", function () { gestionar(b.dataset.acc, b.dataset.id); });
        });
      }

      /* ------------------------- ACCIONES ------------------------- */
      async function gestionar(accion, id) {
        const p = datos.find(function (x) { return x.id === id; });
        if (!p) return;
        if (p.estadoArea === "ENTREGADO") {
          UI.toast("LA SOLICITUD YA ESTÁ ENTREGADA Y QUEDÓ BLOQUEADA", "aviso");
          return;
        }

        const ta = zona.querySelector('[data-obs="' + id + '"]');
        const observacion = U.UP(ta ? ta.value : (p.observacionArea || ""));

        if ((accion === "gestion" || accion === "entregar") && !U.requerido(observacion)) {
          UI.toast("DEBE ESCRIBIR UNA OBSERVACIÓN ANTES DE CAMBIAR EL ESTADO", "error");
          if (ta) ta.focus();
          return;
        }

        const cambios = {
          observacionArea: observacion,
          ultimaEdicion: U.ahora(),
          editadoPorId: App.perfil.id,
          editadoPorNombre: App.perfil.nombre
        };
        if (accion === "gestion") cambios.estadoArea = "EN GESTIÓN";
        if (accion === "entregar") cambios.estadoArea = "ENTREGADO";

        UI.cargando(true);
        try {
          await FS.actualizar("peticiones", id, cambios);
          if (accion === "entregar") {
            UI.toast("SOLICITUD MARCADA COMO ENTREGADO · FILA CERRADA");
          } else if (accion === "gestion") {
            UI.toast("ESTADO ACTUALIZADO A EN GESTIÓN");
          } else {
            UI.toast("OBSERVACIÓN GUARDADA");
          }
          await cargar();
        } catch (e) {
          UI.toast("NO SE PUDO ACTUALIZAR: " + e.message, "error");
        }
        UI.cargando(false);
      }

      /* ------------------------- HERRAMIENTAS ------------------------- */
      barra.querySelector('[data-t="ref"]').addEventListener("click", cargar);
      barra.querySelector('[data-t="print"]').addEventListener("click", function () {
        U.imprimir("#zona-tabla");
      });
      (function () { const b = barra.querySelector('[data-t="pdf"]'); if (b) b.addEventListener("click", function () { U.descargarPDF("#zona-tabla", "Peticiones_Aprobadas"); }); })();
      barra.querySelector('[data-t="csv"]').addEventListener("click", function () {
        const lista = filtrados();
        U.exportarCSV(
          "Peticiones_Aprobadas_" + categoria,
          ["BARRIO", "FECHA", "SOLICITANTE", "ROL", "TITULO", "DETALLE", "ESTADO", "ESTADO AREA", "OBSERVACIONES"],
          lista.map(function (p) {
            return [p.barrio, U.fecha(p.fecha), p.creadoPorNombre, p.rolCreador,
                    p.titulo, p.detalle, p.estado, p.estadoArea, p.observacionArea];
          })
        );
      });

      cargar();
    }

    function vistaMensajes() {
      return {
        etiqueta: "MENSAJES RECIBIDOS", icono: "💬",
        async pintar(cont) {
          cont.innerHTML =
            UI.encabezado("MENSAJES RECIBIDOS", "MENSAJES ENVIADOS POR LOS COORDINADORES DE BARRIO.") +
            '<div id="zona"></div>';
          const zona = cont.querySelector("#zona");
          async function cargar() {
            zona.innerHTML = UI.cargandoTabla();
            try {
              const lista = await FS.bandejaMensajes(App.perfil);
              if (!lista.length) { zona.innerHTML = UI.alerta("info", "NO TIENE MENSAJES NUEVOS."); return; }
              zona.innerHTML = lista.map(function (m) {
                return '<div class="mensaje"><div class="cab"><span><span class="alcance">DE: ' +
                  U.esc(U.UP(m.deNombre)) + "</span> · " + U.esc(U.UP(m.barrio || "")) + "</span>" +
                  "<span>" + U.esc(U.fecha(m.fecha)) + "</span></div>" +
                  '<div class="cuerpo">' + U.esc(U.UP(m.texto)) + "</div>" +
                  '<div class="grp-acciones no-imprimir" style="margin-top:6px">' +
                    '<button class="btn btn-mini btn-suave" data-arch="' + m.id + '">ARCHIVAR</button>' +
                    '<button class="btn btn-mini btn-azul2" data-resp="' + m.id + '">RESPONDER</button>' +
                  '</div></div>';
              }).join("");

              zona.querySelectorAll("[data-arch]").forEach(function (b) {
                b.addEventListener("click", async function () {
                  UI.cargando(true);
                  try {
                    const todos = await FS.bandejaMensajes(App.perfil);
                    const m = todos.find(function (x) { return x.id === b.dataset.arch; });
                    await FS.actualizar("mensajes", b.dataset.arch, { archivado: !m.archivado, actualizadoEn: U.ahora() });
                    UI.toast(m.archivado ? "MENSAJE RESTAURADO" : "MENSAJE ARCHIVADO");
                    await cargar();
                  } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
                  UI.cargando(false);
                });
              });

              zona.querySelectorAll("[data-resp]").forEach(function (b) {
                b.addEventListener("click", async function () {
                  UI.cargando(true);
                  let todos = [];
                  try { todos = await FS.bandejaMensajes(App.perfil); } catch (e) { todos = []; }
                  UI.cargando(false);
                  const m = todos.find(function (x) { return x.id === b.dataset.resp; });
                  if (!m) return;
                  UI.abrirModal("RESPONDER MENSAJE",
                    '<div class="formulario">' +
                      '<p class="menor">PARA: ' + U.esc(U.UP(m.deNombre)) + '</p>' +
                      '<p class="menor">MENSAJE ORIGINAL: ' + U.esc(U.UP(m.texto).slice(0, 120)) + '</p>' +
                      '<div class="campo"><label>SU RESPUESTA</label><textarea id="rp-texto" rows="4" placeholder="ESCRIBA SU RESPUESTA..."></textarea></div>' +
                      '<div id="rp-error"></div>' +
                    '</div>',
                    [
                      { texto: "CANCELAR", clase: "btn-suave" },
                      { texto: "ENVIAR", clase: "btn-primario", onClick: async function () {
                          const errBox = document.getElementById("rp-error");
                          errBox.innerHTML = "";
                          const texto = U.UP(document.getElementById("rp-texto").value);
                          if (!U.requerido(texto)) { errBox.innerHTML = UI.alerta("error", "LA RESPUESTA ES OBLIGATORIA"); return false; }
                          UI.cargando(true);
                          try {
                            await FS.crear("mensajes", {
                              alcance: "directo_coordinador",
                              deId: App.perfil.id,
                              deNombre: App.perfil.nombre,
                              paraCoordinadorId: m.deId,
                              paraSubId: null,
                              barrio: U.UP(App.perfil.barrio || m.barrio || ""),
                              texto: texto,
                              fecha: U.ahora(),
                              fechaMs: U.ahoraMs()
                            });
                            UI.toast("RESPUESTA ENVIADA");
                            await cargar();
                            return true;
                          } catch (e) {
                            errBox.innerHTML = UI.alerta("error", e.message);
                            return false;
                          } finally {
                            UI.cargando(false);
                          }
                        }
                      }
                    ]
                  );
                });
              });
            } catch (e) {
              zona.innerHTML = UI.alerta("error", e.message);
            }
          }
          await cargar();
        }
      };
    }

    return {
      orden: ["area", "mensajes"],
      vistas: {
        area: { etiqueta: "PETICIONES APROBADAS", icono: "📋", pintar: pintar },
        mensajes: vistaMensajes()
      }
    };
  }

  window.CrearModuloArea = crearModuloArea;
})();
