/* =====================================================================
   MÓDULO LÍDER (NIVEL 5)
   Panel móvil con 4 botones principales:
   1) RECAUDAR DATOS  2) SOLICITUDES Y QUEJAS
   3) BANDEJA DE MENSAJES  4) MIS REGISTROS
   ===================================================================== */
(function () {

  /* ==================================================================
     VISTA 1 — RECAUDAR DATOS
     ================================================================== */
  function vistaRecaudar() {
    return {
      etiqueta: "1 · RECAUDAR DATOS", icono: "📝",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("RECAUDAR DATOS", "REGISTRE NOMBRES, CÉDULA, TELÉFONO, DIRECCIÓN Y SOLICITUD.") +
          '<div id="zona-meta"></div>' +
          '<div class="tarjeta"><h3>NUEVO REGISTRO CIUDADANO</h3><div id="zona-form"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaMeta = cont.querySelector("#zona-meta");
        Comun.pintarBannerMeta(zonaMeta, App.perfil.id);

        function acciones() {
          return '<div class="acciones-form">' +
                 '<button class="btn btn-exito" id="rc-guardar">GUARDAR REGISTRO</button>' +
                 '<button class="btn btn-suave" id="rc-nuevo">LIMPIAR</button></div>';
        }

        function pintarFormulario(valores) {
          zonaForm.innerHTML = Comun.formRecaudacion(valores) + acciones();
          zonaForm.querySelector("#rc-nuevo").addEventListener("click", function () {
            pintarFormulario(null);
          });
          zonaForm.querySelector("#rc-guardar").addEventListener("click", guardar);
        }

        async function guardar() {
          const errBox = zonaForm.querySelector("#rc-error");
          errBox.innerHTML = "";
          const datos = Comun.leerRecaudacion(zonaForm);
          const error = Comun.validarRecaudacion(datos);
          if (error) { errBox.innerHTML = UI.alerta("error", error); return; }

          UI.cargando(true);
          try {
            await Comun.guardarRecaudacion(datos, null, App.perfil);
            UI.toast("REGISTRO GUARDADO EXITOSAMENTE");
            await Comun.pintarBannerMeta(zonaMeta, App.perfil.id);
            pintarFormulario(null);
          } catch (e) {
            errBox.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        pintarFormulario(null);
      }
    };
  }

  /* ==================================================================
     VISTA 2 — SOLICITUDES Y QUEJAS
     ================================================================== */
  function vistaQuejas() {
    return {
      etiqueta: "2 · SOLICITUDES Y QUEJAS", icono: "⚠️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("SOLICITUDES Y QUEJAS", "REPORTES OPERATIVOS A SU SUB-COORDINADOR Y COORDINADOR (NUNCA AL ZONAL).") +
          '<div class="tarjeta"><h3>NUEVO REPORTE</h3><div id="zona-form">' +
            Comun.formQueja() +
            '<div class="acciones-form"><button class="btn btn-naranja" id="qj-enviar">ENVIAR REPORTE</button></div>' +
          "</div></div>" +
          '<div class="tarjeta"><h3>MIS REPORTES</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR..."></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const buscador = cont.querySelector(".entrada-buscar");
        let todos = [];

        async function cargar() {
          UI.cargando(true);
          try { todos = await FS.quejasDelLider(App.perfil.id); pintarLista(); }
          catch (e) { zonaLista.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        }

        function pintarLista() {
          const q = U.UP(buscador.value);
          const lista = todos.filter(function (x) {
            return !q || U.contiene(U.unir([x.tipo, x.mensaje]), q);
          });
          zonaLista.innerHTML = UI.tabla(
            ["FECHA", "TIPO", "MENSAJE"],
            lista.map(function (x) {
              return [
                U.esc(U.fecha(x.fecha)),
                UI.sello(x.tipo, { QUEJA: "rojo", SOLICITUD: "naranja", "REPORTE OPERATIVO": "azul", "OBSERVACIÓN": "gris" }),
                U.esc(U.UP(x.mensaje))
              ];
            })
          );
        }

        zonaForm.querySelector("#qj-enviar").addEventListener("click", async function () {
          const errBox = zonaForm.querySelector("#qj-error");
          errBox.innerHTML = "";
          const d = Comun.leerQueja(zonaForm);
          if (!U.requerido(d.mensaje)) { errBox.innerHTML = UI.alerta("error", "EL MENSAJE ES OBLIGATORIO"); return; }
          UI.cargando(true);
          try {
            await FS.crear("quejas", {
              tipo: d.tipo, mensaje: d.mensaje,
              creadoPorId: App.perfil.id, creadoPorNombre: App.perfil.nombre,
              rolCreador: App.perfil.rol,
              subcoordinadorId: App.perfil.subcoordinadorId || null,
              coordinadorId: App.perfil.coordinadorId || null,
              barrio: U.UP(App.perfil.barrio),
              fecha: U.ahora(), fechaMs: U.ahoraMs()
            });
            UI.toast("REPORTE ENVIADO A SU SUB-COORDINADOR Y COORDINADOR");
            zonaForm.querySelector("#qj-mensaje").value = "";
            await cargar();
          } catch (e) { errBox.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        });

        buscador.oninput = pintarLista;
        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 3 — BANDEJA DE MENSAJES
     ================================================================== */
  function vistaMensajes() {
    return {
      etiqueta: "3 · BANDEJA DE MENSAJES", icono: "📬",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("BANDEJA DE MENSAJES", "INSTRUCCIONES DE SU SUB-COORDINADOR Y AVISOS GENERALES DEL ZONAL.") +
          UI.barra('<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>') +
          '<div id="zona"></div>';
        const zona = cont.querySelector("#zona");

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            const msgs = await FS.bandejaMensajes(App.perfil);
            if (!msgs.length) { zona.innerHTML = UI.alerta("info", "NO TIENE MENSAJES NUEVOS."); return; }
            zona.innerHTML = msgs.map(function (m) {
              const al = m.alcance === "grupo_lideres" ? "DE SU SUB-COORDINADOR" : "AVISO GENERAL DEL ZONAL";
              return '<div class="mensaje"><div class="cab">' +
                '<span><span class="alcance">' + al + "</span> · " + U.esc(U.UP(m.deNombre)) + "</span>" +
                "<span>" + U.esc(U.fecha(m.fecha)) + "</span></div>" +
                '<div class="cuerpo">' + U.esc(U.UP(m.texto)) + "</div></div>";
            }).join("");
          } catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        cont.querySelector('[data-t="ref"]').addEventListener("click", cargar);
        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 4 — MIS REGISTROS
     ================================================================== */
  function vistaRegistros() {
    return {
      etiqueta: "4 · MIS REGISTROS", icono: "🗂️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("MIS REGISTROS", "VEA Y EDITE LOS DATOS CIUDADANOS QUE HA RECAUDADO.") +
          '<div id="zona-meta-reg"></div>' +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR NOMBRE, CÉDULA, SOLICITUD...">'
          ) +
          '<div class="tarjeta"><h3>MIS DATOS REGISTRADOS</h3><div id="zona-reg"></div></div>';

        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        const zonaReg = cont.querySelector("#zona-reg");
        const zonaMetaReg = cont.querySelector("#zona-meta-reg");

        let registros = [], editando = null;

        async function cargar() {
          zonaReg.innerHTML = UI.cargandoTabla();
          try {
            registros = await FS.recaudacionesPropias(App.perfil.id);
            pintar();
          } catch (e) {
            zonaReg.innerHTML = UI.alerta("error", e.message);
          }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          return registros.filter(function (r) {
            return !q || U.contiene(U.unir([r.nombres, r.cedula, r.telefono, r.direccion, r.solicitud]), q);
          });
        }

        function pintar() {
          const regs = filtrados();

          Comun.pintarBannerMeta(zonaMetaReg, App.perfil.id, registros);

          zonaReg.innerHTML = UI.tabla(Comun.obtenerColumnasRecaudacion(false),
            regs.map(function (r) { return Comun.filaRecaudacion(r, true, false); })) +
            '<p class="nota-tabla no-imprimir">TOTAL REGISTROS: ' + regs.length + "</p>";

          zonaReg.querySelectorAll("[data-edit]").forEach(function (b) {
            b.addEventListener("click", function () {
              const r = registros.find(function (x) { return x.id === b.dataset.edit; });
              if (!r) return;
              editar(r);
            });
          });
          zonaReg.querySelectorAll("[data-del]").forEach(function (b) {
            b.addEventListener("click", async function () {
              const ok = await UI.confirmar("¿DESEA BORRAR ESTE REGISTRO?");
              if (!ok) return;
              UI.cargando(true);
              try { await FS.borrar("recaudaciones", b.dataset.del); UI.toast("REGISTRO BORRADO"); await cargar(); }
              catch (e) { UI.toast("ERROR: " + e.message, "error"); }
              UI.cargando(false);
            });
          });
        }

        function editar(r) {
          editando = r.id;
          UI.abrirModal("EDITAR REGISTRO", Comun.formRecaudacion(r), [
            { texto: "CANCELAR", clase: "btn-suave" },
            {
              texto: "GUARDAR", clase: "btn-exito",
              onClick: async function () {
                const cuerpo = document.getElementById("modal-cuerpo");
                const datos = Comun.leerRecaudacion(cuerpo);
                const error = Comun.validarRecaudacion(datos);
                if (error) {
                  let box = cuerpo.querySelector("#rc-error");
                  if (!box) return false;
                  box.innerHTML = UI.alerta("error", error);
                  return false;
                }
                UI.cargando(true);
                try {
                  await Comun.guardarRecaudacion(datos, editando, App.perfil);
                  UI.toast("REGISTRO ACTUALIZADO");
                  await cargar();
                } catch (e) { UI.toast(e.message, "error"); }
                UI.cargando(false);
              }
            }
          ]);
        }

        buscador.oninput = pintar;
        await cargar();
      }
    };
  }

  /* ==================================================================
     REGISTRO DEL MÓDULO
     ================================================================== */
  App.registrarRol("LIDER", {
    orden: ["recaudar", "quejas", "mensajes", "registros"],
    vistas: {
      recaudar: vistaRecaudar(),
      quejas: vistaQuejas(),
      mensajes: vistaMensajes(),
      registros: vistaRegistros()
    }
  });
})();