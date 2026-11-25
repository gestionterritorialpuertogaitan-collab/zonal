/* =====================================================================
   MÓDULO SUB-COORDINADOR (NIVEL 4)
   ===================================================================== */
(function () {

  /* ==================================================================
     VISTA 1 — DIRECTRICES Y AVISOS
     ================================================================== */
  function vistaDirectrices() {
    return {
      etiqueta: "DIRECTRICES Y AVISOS", icono: "📌",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("DIRECTRICES DE TRABAJO Y AVISOS", "INSTRUCCIONES DE SU COORDINADOR Y AVISOS GENERALES DEL ZONAL.") +
          UI.barra('<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>') +
          '<div id="zona"></div>';
        const zona = cont.querySelector("#zona");

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            const msgs = await FS.bandejaMensajes(App.perfil);
            zona.innerHTML = msgs.length
              ? msgs.map(function (m) {
                  const al = m.alcance === "trabajo_sub" ? "DIRECTRIZ DE SU COORDINADOR" : "AVISO GENERAL DEL ZONAL";
                  return '<div class="mensaje"><div class="cab">' +
                    '<span><span class="alcance">' + al + "</span> · " + U.esc(U.UP(m.deNombre)) + "</span>" +
                    "<span>" + U.esc(U.fecha(m.fecha)) + "</span></div>" +
                    '<div class="cuerpo">' + U.esc(U.UP(m.texto)) + "</div></div>";
                }).join("")
              : UI.alerta("info", "NO TIENE DIRECTRICES NI AVISOS NUEVOS.");
          } catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        cont.querySelector('[data-t="ref"]').addEventListener("click", cargar);
        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 2 — ENVIAR MENSAJES A MIS LÍDERES
     ================================================================== */
  function vistaMensajes() {
    return {
      etiqueta: "ENVIAR A MIS LÍDERES", icono: "✉️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("MENSAJES DE TRABAJO A SUS LÍDERES", "ENVÍE INSTRUCCIONES AL GRUPO DE LÍDERES UBICADOS BAJO SU CARGO.") +
          '<div class="tarjeta"><h3>NUEVO MENSAJE</h3>' +
            '<div class="campo"><label>TEXTO DEL MENSAJE</label><textarea id="g-texto" rows="4" placeholder="ESCRIBA LA INSTRUCCIÓN..."></textarea></div>' +
            '<div id="g-error"></div>' +
            '<div class="acciones-form"><button class="btn btn-primario" id="g-enviar">ENVIAR AL GRUPO</button></div>' +
          "</div>" +
          '<div class="tarjeta"><h3>MENSAJES ENVIADOS</h3><div id="zona-env"></div></div>' +
          '<div class="tarjeta"><h3>RECIBIDOS</h3><div id="zona-rec"></div></div>';

        const zonaEnv = cont.querySelector("#zona-env");
        const zonaRec = cont.querySelector("#zona-rec");

        async function pintar() {
          UI.cargando(true);
          try {
            const res = await Promise.all([
              FS.mensajesEnviados(App.perfil.id), FS.bandejaMensajes(App.perfil)
            ]);
            const enviados = res[0].filter(function (m) { return m.alcance === "grupo_lideres"; });
            const recibidos = res[1];

            zonaEnv.innerHTML = enviados.length
              ? enviados.map(function (m) {
                  return '<div class="mensaje"><div class="cab"><span>PARA: MIS LÍDERES · ' +
                    U.esc(U.UP(m.barrio)) + "</span><span>" + U.esc(U.fecha(m.fecha)) +
                    "</span></div><div class=\"cuerpo\">" + U.esc(U.UP(m.texto)) + "</div></div>";
                }).join("")
              : '<div class="mensaje vacio-m">AÚN NO HA ENVIADO MENSAJES A SUS LÍDERES</div>';

            zonaRec.innerHTML = recibidos.length
              ? recibidos.map(function (m) {
                  const al = m.alcance === "trabajo_sub" ? "DE SU COORDINADOR" : "AVISO GENERAL DEL ZONAL";
                  return '<div class="mensaje"><div class="cab"><span><span class="alcance">' + al +
                    "</span> · " + U.esc(U.UP(m.deNombre)) + "</span><span>" +
                    U.esc(U.fecha(m.fecha)) + "</span></div><div class=\"cuerpo\">" +
                    U.esc(U.UP(m.texto)) + "</div></div>";
                }).join("")
              : '<div class="mensaje vacio-m">NO TIENE MENSAJES NUEVOS</div>';
          } catch (e) {
            zonaEnv.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        cont.querySelector("#g-enviar").addEventListener("click", async function () {
          const errBox = cont.querySelector("#g-error");
          errBox.innerHTML = "";
          const texto = U.UP(cont.querySelector("#g-texto").value);
          if (!U.requerido(texto)) { errBox.innerHTML = UI.alerta("error", "EL MENSAJE ES OBLIGATORIO"); return; }
          UI.cargando(true);
          try {
            await FS.crear("mensajes", {
              alcance: "grupo_lideres", deId: App.perfil.id, deNombre: App.perfil.nombre,
              paraCoordinadorId: App.perfil.coordinadorId || null, paraSubId: App.perfil.id,
              barrio: U.UP(App.perfil.barrio), texto: texto,
              fecha: U.ahora(), fechaMs: U.ahoraMs()
            });
            UI.toast("MENSAJE ENVIADO A SUS LÍDERES");
            cont.querySelector("#g-texto").value = "";
            await pintar();
          } catch (e) { errBox.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        });

        await pintar();
      }
    };
  }

  /* ==================================================================
     VISTA 3 — PETICIONES (SOLO LECTURA)
     ================================================================== */
  function vistaPeticiones() {
    return {
      etiqueta: "PETICIONES (LECTURA)", icono: "📄",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("PETICIONES DE SUS LÍDERES Y PROPIAS", "SOLO LECTURA: LA APROBACIÓN ES EXCLUSIVA DEL COORDINADOR.") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR...">' +
            '<button class="btn btn-suave" data-t="csv">EXPORTAR CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>' +
            '<button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        let todos = [];

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try { todos = await FS.peticionesDelSub(App.perfil.id); pintar(); }
          catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          if (!q) return todos;
          return todos.filter(function (p) {
            return U.contiene(U.unir([p.creadoPorNombre, p.titulo, p.detalle, p.categoria]), q);
          });
        }

        function pintar() {
          zona.innerHTML = UI.tabla(
            ["FECHA", "SOLICITANTE", "CATEGORÍA", "TÍTULO / DETALLE", "DECISIÓN", "ESTADO ÁREA", "OBSERVACIONES"],
            filtrados().map(function (p) {
              return [
                U.esc(U.fecha(p.fecha)),
                U.esc(U.UP(p.creadoPorNombre || "—")) + "<br><span class=\"menor\">" +
                  U.esc(U.UP(p.rolCreador || "")) + "</span>",
                UI.sello(p.categoria, { COMPRAS: "naranja", PUBLICIDAD: "azul" }),
                "<strong>" + U.esc(U.UP(p.titulo)) + "</strong><br><span class=\"menor\">" +
                  U.esc(U.UP(p.detalle)) + "</span>",
                UI.selloEstado(p.estado),
                UI.selloEstadoArea(p.estadoArea),
                p.observacionArea
                  ? '<span class="obs-fija">' + U.esc(U.UP(p.observacionArea)) + "</span>"
                  : '<span class="menor">SIN OBSERVACIONES</span>'
              ];
            })
          );
        }

        Comun.herramientas(barra, zona, {
          recargar: cargar, pintar: pintar, filtrados: filtrados,
          tituloCSV: "Peticiones_Subcoordinador",
          encabezadosCSV: ["FECHA", "SOLICITANTE", "CATEGORIA", "TITULO", "DETALLE", "DECISION", "ESTADO AREA", "OBSERVACIONES"],
          filaCSV: function (p) {
            return [p.fecha, p.creadoPorNombre, p.categoria, p.titulo, p.detalle, p.estado, p.estadoArea, p.observacionArea];
          }
        });

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 4 — QUEJAS Y SOLICITUDES (CREAR + VER)
     ================================================================== */
  function vistaQuejas() {
    return {
      etiqueta: "QUEJAS Y SOLICITUDES", icono: "⚠️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("SOLICITUDES, QUEJAS Y REPORTES", "SE ENVÍAN ÚNICAMENTE AL 3. COORDINADOR (NUNCA DIRECTO AL ZONAL) Y REQUIEREN SU APROBACIÓN.") +
          '<div class="tarjeta"><h3>NUEVO REPORTE</h3><div id="zona-form">' +
            Comun.formQueja() +
            '<div class="acciones-form"><button class="btn btn-naranja" id="qj-enviar">ENVIAR AL COORDINADOR</button></div>' +
          "</div></div>" +
          '<div class="tarjeta"><h3>REPORTES ENVIADOS</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR..."></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const buscador = cont.querySelector(".entrada-buscar");
        let todos = [];

        async function cargar() {
          UI.cargando(true);
          try { todos = await FS.quejasDelSub(App.perfil.id); pintarLista(); }
          catch (e) { zonaLista.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        }

        function pintarLista() {
          const q = U.UP(buscador.value);
          const lista = todos.filter(function (x) {
            return !q || U.contiene(U.unir([x.tipo, x.mensaje, x.creadoPorNombre]), q);
          });
          zonaLista.innerHTML = UI.tabla(
            ["FECHA", "TIPO", "MENSAJE", "DE", "ROL"],
            lista.map(function (x) {
              return [
                U.esc(U.fecha(x.fecha)),
                UI.sello(x.tipo, { QUEJA: "rojo", SOLICITUD: "naranja", "REPORTE OPERATIVO": "azul", "OBSERVACIÓN": "gris" }),
                U.esc(U.UP(x.mensaje)),
                U.esc(U.UP(x.creadoPorNombre || "—")),
                U.esc(U.UP(x.rolCreador || "—"))
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
              subcoordinadorId: App.perfil.id,
              coordinadorId: App.perfil.coordinadorId || null,
              barrio: U.UP(App.perfil.barrio),
              fecha: U.ahora(), fechaMs: U.ahoraMs()
            });
            UI.toast("REPORTE ENVIADO AL COORDINADOR");
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
     VISTA 5 — RECAUDACIÓN DE DATOS (CRUD PROPIO + META)
     ================================================================== */
  function vistaRecaudacion() {
    return {
      etiqueta: "RECAUDAR DATOS", icono: "📝",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("FORMULARIO DE RECAUDACIÓN DE DATOS", "CREE, VEA Y EDITE SUS PROPIOS REGISTROS.") +
          '<div id="zona-meta"></div>' +
          '<div class="tarjeta"><h3 id="tit-form">NUEVO REGISTRO</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>MIS REGISTROS</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR..."></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const zonaMeta = cont.querySelector("#zona-meta");
        const buscador = cont.querySelector(".entrada-buscar");
        const titForm = cont.querySelector("#tit-form");
        let editando = null, propios = [];

        Comun.pintarBannerMeta(zonaMeta, App.perfil.id);

        function acciones() {
          return '<div class="acciones-form"><button class="btn btn-exito" id="rc-guardar">GUARDAR REGISTRO</button>' +
                 '<button class="btn btn-suave" id="rc-nuevo">NUEVO</button></div>';
        }
        function limpiar() {
          editando = null;
          titForm.textContent = "NUEVO REGISTRO";
          zonaForm.innerHTML = Comun.formRecaudacion() + acciones();
          bind();
        }
        function bind() {
          zonaForm.querySelector("#rc-guardar").addEventListener("click", guardar);
          zonaForm.querySelector("#rc-nuevo").addEventListener("click", limpiar);
        }
        async function cargar() {
          UI.cargando(true);
          try {
            propios = await FS.recaudacionesPropias(App.perfil.id);
            await Comun.pintarBannerMeta(zonaMeta, App.perfil.id, propios);
            pintarLista();
          } catch (e) { zonaLista.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        }
        function pintarLista() {
          const q = U.UP(buscador.value);
          const lista = propios.filter(function (r) {
            return !q || U.contiene(U.unir([r.nombres, r.cedula, r.telefono, r.direccion, r.solicitud]), q);
          });
          zonaLista.innerHTML = UI.tabla(Comun.obtenerColumnasRecaudacion(false),
            lista.map(function (r) { return Comun.filaRecaudacion(r, true, false); }));

          zonaLista.querySelectorAll("[data-edit]").forEach(function (b) {
            b.addEventListener("click", function () {
              const r = propios.find(function (x) { return x.id === b.dataset.edit; });
              if (!r) return;
              editando = r.id;
              titForm.textContent = "EDITAR REGISTRO";
              zonaForm.innerHTML = Comun.formRecaudacion(r) + acciones();
              bind();
              zonaForm.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          });
          zonaLista.querySelectorAll("[data-del]").forEach(function (b) {
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
        async function guardar() {
          const errBox = zonaForm.querySelector("#rc-error");
          errBox.innerHTML = "";
          const datos = Comun.leerRecaudacion(zonaForm);
          const error = Comun.validarRecaudacion(datos);
          if (error) { errBox.innerHTML = UI.alerta("error", error); return; }
          UI.cargando(true);
          try {
            await Comun.guardarRecaudacion(datos, editando, App.perfil);
            UI.toast(editando ? "REGISTRO ACTUALIZADO" : "REGISTRO GUARDADO");
            limpiar(); await cargar();
          } catch (e) { errBox.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        }

        buscador.oninput = pintarLista;
        limpiar();
        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 6 — REVISIÓN DE DATOS DE SUS LÍDERES (LECTURA)
     ================================================================== */
  function vistaRevision() {
    return {
      etiqueta: "REVISAR LÍDERES", icono: "🔍",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("REVISIÓN DE DATOS DE SUS LÍDERES", "INFORMACIÓN RECAUDADA POR SUS LÍDERES (SOLO LECTURA).") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR NOMBRE, CÉDULA, SOLICITUD...">'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        let todos = [];

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            const res = await Promise.all([
              FS.recaudacionesDelSub(App.perfil.id), FS.recaudacionesPropias(App.perfil.id)
            ]);
            todos = U.ordenarPorFechaDesc(res[0].concat(res[1]));
            pintar();
          } catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          if (!q) return todos;
          return todos.filter(function (r) {
            return U.contiene(U.unir([r.nombres, r.cedula, r.telefono, r.direccion, r.solicitud]), q);
          });
        }

        function pintar() {
          zona.innerHTML = UI.tabla(Comun.obtenerColumnasRecaudacion(false),
            filtrados().map(function (r) { return Comun.filaRecaudacion(r, false, false); }));
        }

        buscador.oninput = pintar;
        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 7 — TABLA DE MIS LÍDERES (CON BOTÓN MOSTRAR DATOS)
     ================================================================== */
  function vistaLideres() {
    return {
      etiqueta: "TABLA DE MIS LÍDERES", icono: "👥",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("LÍDERES ASIGNADOS A MI GRUPO", "LISTA DE LÍDERES BAJO SU CARGO.") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR...">' +
            '<button class="btn btn-suave" data-t="csv">EXPORTAR CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>' +
            '<button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        let todos = [], conteoPorLider = {};

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            const res = await Promise.all([
              FS.lideresDelSub(App.perfil.id),
              FS.recaudacionesDelSub(App.perfil.id)
            ]);
            todos = res[0];
            conteoPorLider = {};
            res[1].forEach(function (r) {
              if (r.creadoPorId) {
                conteoPorLider[r.creadoPorId] = (conteoPorLider[r.creadoPorId] || 0) + 1;
              }
            });
            pintar();
          } catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          if (!q) return todos;
          return todos.filter(function (l) { return U.contiene(U.unir([l.nombre, l.usuario, l.telefono, l.estado]), q); });
        }

        function pintar() {
          zona.innerHTML = UI.tabla(
            ["N.º", "NOMBRE", "CÉDULA", "TELÉFONO", "DIRECCIÓN", "ESTADO", "DATOS"],
            filtrados().map(function (l, i) {
              const total = conteoPorLider[l.id] || 0;
              return [
                String(i + 1),
                U.esc(U.UP(l.nombre)),
                U.esc(l.usuario),
                U.esc(l.telefono || "—"),
                U.esc(U.UP(l.direccion || "—")),
                UI.selloEstado(l.estado),
                '<button class="btn btn-mini btn-exito" data-verdatos="' + l.id +
                  '" data-nombre="' + U.esc(U.UP(l.nombre)) + '">MOSTRAR DATOS (' + total + ")</button>"
              ];
            })
          );

          zona.querySelectorAll("[data-verdatos]").forEach(function (b) {
            b.addEventListener("click", function () {
              Comun.verDatosUsuario(b.dataset.verdatos, b.dataset.nombre, "LÍDER");
            });
          });
        }

        Comun.herramientas(barra, zona, {
          recargar: cargar, pintar: pintar, filtrados: filtrados,
          tituloCSV: "Mis_Lideres",
          encabezadosCSV: ["NOMBRE", "CEDULA", "TELEFONO", "DIRECCION", "ESTADO", "DATOS_RECAUDADOS"],
          filaCSV: function (l) { return [l.nombre, l.usuario, l.telefono, l.direccion, l.estado, conteoPorLider[l.id] || 0]; }
        });

        await cargar();
      }
    };
  }

  /* ==================================================================
     REGISTRO DEL MÓDULO
     ================================================================== */
  App.registrarRol("SUBCOORDINADOR", {
    orden: ["directrices", "mensajes", "peticiones", "quejas",
            "recaudacion", "revision", "lideres"],
    vistas: {
      directrices: vistaDirectrices(),
      mensajes: vistaMensajes(),
      peticiones: vistaPeticiones(),
      quejas: vistaQuejas(),
      recaudacion: vistaRecaudacion(),
      revision: vistaRevision(),
      lideres: vistaLideres()
    }
  });
})();