/* =====================================================================
   MÓDULO ZONAL — "LA CABEZA" (NIVEL 1)
   Administrador supremo: cuentas, ubicación de líderes, mensajes,
   escalamientos recibidos y consolidado global.
   ===================================================================== */
(function () {

  const ROL_NOMBRE = {
    ZONAL: "ZONAL", PUBLICIDAD: "PUBLICIDAD", COMPRAS: "COMPRAS",
    COORDINADOR: "COORDINADOR", SUBCOORDINADOR: "SUB-COORDINADOR", LIDER: "LÍDER"
  };

  /* ==================================================================
     VISTA 1 — CONSOLIDADO GLOBAL (ACORDEÓN JERÁRQUICO + METAS + VER DATOS)
     ================================================================== */
  function vistaConsolidado() {
    return {
      etiqueta: "CONSOLIDADO GLOBAL", icono: "🌐",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("CONSOLIDADO GLOBAL DE BARRIOS", "TOQUE UN COORDINADOR PARA DESPLEGAR SUS SUB-COORDINADORES, Y UN SUB-COORDINADOR PARA VER SUS LÍDERES.") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR BARRIO, COORDINADOR, SUB O LÍDER...">' +
            '<button class="btn btn-suave" data-t="csv">CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>' +
            '<button class="btn btn-suave" data-t="pdf">PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) +
          '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");

        let usuarios = [], peticiones = [], quejas = [], recaudaciones = [], escalamientos = [];
        const abiertosCoord = {};
        const abiertosSub = {};

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            const res = await Promise.all([
              FS.usuarios(), FS.lista("peticiones"), FS.lista("quejas"),
              FS.lista("recaudaciones"), FS.escalamientos()
            ]);
            usuarios = res[0]; peticiones = res[1]; quejas = res[2];
            recaudaciones = res[3]; escalamientos = res[4];
            pintar();
          } catch (e) {
            zona.innerHTML = UI.alerta("error", "ERROR AL CARGAR: " + e.message);
          }
        }

        function coincideBusqueda(c, subs, lideresCoord, q) {
          if (!q) return true;
          if (U.contiene(U.unir([c.barrio, c.nombre, c.usuario]), q)) return true;
          if (subs.some(function (s) { return U.contiene(U.unir([s.nombre, s.usuario]), q); })) return true;
          if (lideresCoord.some(function (l) { return U.contiene(U.unir([l.nombre, l.usuario]), q); })) return true;
          return false;
        }

        function filasCSVJerarquia() {
          const q = U.UP(buscador.value);
          const filas = [];
          const coordinadores = usuarios.filter(function (u) { return u.rol === "COORDINADOR"; })
            .sort(function (a, b) { return U.UP(a.barrio).localeCompare(U.UP(b.barrio)); });

          coordinadores.forEach(function (c) {
            const subs = usuarios.filter(function (u) { return u.rol === "SUBCOORDINADOR" && u.coordinadorId === c.id; });
            const lidsC = usuarios.filter(function (u) { return u.rol === "LIDER" && u.coordinadorId === c.id; });
            if (!coincideBusqueda(c, subs, lidsC, q)) return;

            filas.push([
              U.UP(c.barrio), "COORDINADOR: " + U.UP(c.nombre), c.estado,
              subs.length, lidsC.length,
              recaudaciones.filter(function (r) { return r.creadoPorId === c.id; }).length,
              peticiones.filter(function (p) { return p.coordinadorId === c.id; }).length,
              quejas.filter(function (q2) { return q2.coordinadorId === c.id; }).length
            ]);

            subs.forEach(function (s) {
              const lidsS = usuarios.filter(function (u) { return u.rol === "LIDER" && u.subcoordinadorId === s.id; });
              filas.push([
                U.UP(c.barrio), "  SUB-COORD: " + U.UP(s.nombre), s.estado,
                "—", lidsS.length,
                recaudaciones.filter(function (r) { return r.creadoPorId === s.id; }).length,
                peticiones.filter(function (p) { return p.subcoordinadorId === s.id; }).length,
                quejas.filter(function (q2) { return q2.subcoordinadorId === s.id; }).length
              ]);
              lidsS.forEach(function (l) {
                filas.push([
                  U.UP(c.barrio), "    LÍDER: " + U.UP(l.nombre), l.estado,
                  "—", "—",
                  recaudaciones.filter(function (r) { return r.creadoPorId === l.id; }).length,
                  peticiones.filter(function (p) { return p.creadoPorId === l.id; }).length,
                  quejas.filter(function (q2) { return q2.creadoPorId === l.id; }).length
                ]);
              });
            });
          });
          return filas;
        }

        function construirTablaAcordeon() {
          const q = U.UP(buscador.value);
          const coordinadores = usuarios.filter(function (u) { return u.rol === "COORDINADOR"; })
            .sort(function (a, b) { return U.UP(a.barrio).localeCompare(U.UP(b.barrio)); });

          const visibles = coordinadores.filter(function (c) {
            const subs = usuarios.filter(function (u) { return u.rol === "SUBCOORDINADOR" && u.coordinadorId === c.id; });
            const lidsC = usuarios.filter(function (u) { return u.rol === "LIDER" && u.coordinadorId === c.id; });
            return coincideBusqueda(c, subs, lidsC, q);
          });

          if (!visibles.length) {
            return UI.alerta("info", "NO SE ENCONTRARON COORDINADORES O BARRIOS CON ESE CRITERIO.");
          }

          let html =
            '<div class="tabla-cont"><table><thead><tr>' +
              "<th>BARRIO</th>" +
              "<th>NOMBRE / ROL (TOCAR PARA DESPLEGAR)</th>" +
              "<th>ESTADO</th>" +
              "<th>SUB-COORD.</th>" +
              "<th>LÍDERES</th>" +
              "<th>RECAUDAC.</th>" +
              "<th>PETICIONES</th>" +
              "<th>QUEJAS</th>" +
              "<th>DATOS Y META</th>" +
            "</tr></thead><tbody>";

          visibles.forEach(function (c) {
            const subs = usuarios.filter(function (u) { return u.rol === "SUBCOORDINADOR" && u.coordinadorId === c.id; });
            const lidsCoord = usuarios.filter(function (u) { return u.rol === "LIDER" && u.coordinadorId === c.id; });
            const recPropiosCoord = recaudaciones.filter(function (r) { return r.creadoPorId === c.id; }).length;
            const recGrupoCoord = recaudaciones.filter(function (r) { return r.coordinadorId === c.id || r.creadoPorId === c.id; }).length;
            const petCoord = peticiones.filter(function (p) { return p.coordinadorId === c.id; }).length;
            const quejCoord = quejas.filter(function (q2) { return q2.coordinadorId === c.id; }).length;

            const coordAbierto = !!abiertosCoord[c.id] || !!q;
            const flechaCoord = coordAbierto ? "▼" : "▶";

            const recMostrarCoord = coordAbierto ? recPropiosCoord : recGrupoCoord;
            html +=
              '<tr class="fila-coord-acordeon" style="background:#eef4ff;font-weight:700">' +
                "<td><strong>" + U.esc(U.UP(c.barrio || "—")) + "</strong></td>" +
                '<td><button type="button" class="btn-acordeon" data-toggle-coord="' + c.id + '" style="background:none;border:0;padding:0;text-align:left;color:var(--azul);font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:6px">' +
                  '<span style="font-size:11px">' + flechaCoord + '</span> ' +
                  '<span>' + U.esc(U.UP(c.nombre)) + '</span>' +
                '</button><br><span class=\"menor\">COORDINADOR · ' + U.esc(c.usuario) + "</span></td>" +
                "<td>" + UI.selloEstado(c.estado) + "</td>" +
                "<td>" + subs.length + "</td>" +
                "<td>" + lidsCoord.length + "</td>" +
                "<td><strong>" + recMostrarCoord + "</strong></td>" +
                "<td>" + petCoord + "</td>" +
                "<td>" + quejCoord + "</td>" +
                '<td><button type="button" class="btn btn-mini btn-azul2" data-verdatos="' + c.id +
                  '" data-nombre="' + U.esc(U.UP(c.nombre)) +
                  '" data-rol="COORDINADOR">VER DATOS (' + recPropiosCoord + ")</button></td>" +
              "</tr>";

            if (coordAbierto) {
              if (!subs.length) {
                html +=
                  '<tr style="background:#f9fbff"><td colspan="9" class="menor" style="padding-left:24px">' +
                    "ESTE COORDINADOR AÚN NO TIENE SUB-COORDINADORES ASIGNADOS." +
                  "</td></tr>";
              } else {
                subs.forEach(function (s) {
                  const lidsSub = usuarios.filter(function (u) { return u.rol === "LIDER" && u.subcoordinadorId === s.id; });
                  const recPropiosSub = recaudaciones.filter(function (r) { return r.creadoPorId === s.id; }).length;
                  const recGrupoSub = recaudaciones.filter(function (r) { return r.subcoordinadorId === s.id || r.creadoPorId === s.id; }).length;
                  const petSub = peticiones.filter(function (p) { return p.subcoordinadorId === s.id; }).length;
                  const quejSub = quejas.filter(function (q2) { return q2.subcoordinadorId === s.id; }).length;

                  const subAbierto = !!abiertosSub[s.id] || !!q;
                  const flechaSub = subAbierto ? "▼" : "▶";

                  const recMostrarSub = subAbierto ? recPropiosSub : recGrupoSub;
                  html +=
                    '<tr class="fila-sub-acordeon" style="background:#ffffff">' +
                      '<td style="padding-left:18px;color:var(--texto2)">↳ ' + U.esc(U.UP(c.barrio || "—")) + "</td>" +
                      '<td style="padding-left:18px"><button type="button" class="btn-acordeon" data-toggle-sub="' + s.id + '" style="background:none;border:0;padding:0;text-align:left;color:#0e5c68;font-weight:800;font-size:12.5px;display:inline-flex;align-items:center;gap:6px">' +
                        '<span style="font-size:10px">' + flechaSub + '</span> ' +
                        '<span>SUB: ' + U.esc(U.UP(s.nombre)) + '</span>' +
                      '</button><br><span class="menor" style="padding-left:16px">SUB-COORDINADOR · ' + U.esc(s.usuario) + "</span></td>" +
                      "<td>" + UI.selloEstado(s.estado) + "</td>" +
                      "<td>—</td>" +
                      "<td>" + lidsSub.length + "</td>" +
                      "<td><strong>" + recMostrarSub + "</strong></td>" +
                      "<td>" + petSub + "</td>" +
                      "<td>" + quejSub + "</td>" +
                      '<td><button type="button" class="btn btn-mini btn-azul2" data-verdatos="' + s.id +
                        '" data-nombre="' + U.esc(U.UP(s.nombre)) +
                        '" data-rol="SUB-COORDINADOR">VER DATOS (' + recPropiosSub + ")</button></td>" +
                    "</tr>";

                  if (subAbierto) {
                    if (!lidsSub.length) {
                      html +=
                        '<tr style="background:#fbfcfe"><td colspan="9" class="menor" style="padding-left:42px">' +
                          "ESTE SUB-COORDINADOR AÚN NO TIENE LÍDERES ASIGNADOS." +
                        "</td></tr>";
                    } else {
                      lidsSub.forEach(function (l) {
                        const recLider = recaudaciones.filter(function (r) { return r.creadoPorId === l.id; }).length;
                        const petLider = peticiones.filter(function (p) { return p.creadoPorId === l.id; }).length;
                        const quejLider = quejas.filter(function (q2) { return q2.creadoPorId === l.id; }).length;

                        html +=
                          '<tr style="background:#f5f8fc">' +
                            '<td style="padding-left:34px;color:var(--texto2)">↳ ' + U.esc(U.UP(c.barrio || "—")) + "</td>" +
                            '<td style="padding-left:34px"><strong>LÍDER:</strong> ' + U.esc(U.UP(l.nombre)) +
                              '<br><span class=\"menor\">' + U.esc(l.usuario) + "</span></td>" +
                            "<td>" + UI.selloEstado(l.estado) + "</td>" +
                            "<td>—</td>" +
                            "<td>—</td>" +
                            "<td><strong>" + recLider + "</strong></td>" +
                            "<td>" + petLider + "</td>" +
                            "<td>" + quejLider + "</td>" +
                            '<td><button type="button" class="btn btn-mini btn-exito" data-verdatos="' + l.id +
                              '" data-nombre="' + U.esc(U.UP(l.nombre)) +
                              '" data-rol="LÍDER">VER DATOS (' + recLider + ")</button></td>" +
                          "</tr>";
                      });
                    }
                  }
                });
              }
            }
          });

          html += "</tbody></table></div>";
          return html;
        }

        function pintar() {
          const barrios = {};
          usuarios.forEach(function (u) {
            if (u.rol === "ZONAL" || u.rol === "PUBLICIDAD" || u.rol === "COMPRAS") return;
            const b = String(u.barrio || "").trim().toUpperCase();
            if (b) barrios[b] = true;
          });

          const stats = [
            { valor: Object.keys(barrios).length, etiqueta: "BARRIOS" },
            { valor: usuarios.filter(function (u) { return u.rol === "COORDINADOR"; }).length, etiqueta: "COORDINAD." },
            { valor: usuarios.filter(function (u) { return u.rol === "SUBCOORDINADOR"; }).length, etiqueta: "SUB-COORD." },
            { valor: usuarios.filter(function (u) { return u.rol === "LIDER"; }).length, etiqueta: "LÍDERES" },
            { valor: recaudaciones.length, etiqueta: "RECAUDAC.", color: "verde" },
            { valor: peticiones.filter(function (p) { return p.estado === "PENDIENTE"; }).length, etiqueta: "PENDIENT.", color: "naranja" },
            { valor: peticiones.filter(function (p) { return p.estadoArea === "ENTREGADO"; }).length, etiqueta: "ENTREGAD.", color: "verde" },
            { valor: quejas.length, etiqueta: "QUEJAS", color: "rojo" },
            { valor: escalamientos.length, etiqueta: "ESCALAM." }
          ];

          barra.classList.add("barra-4-col");

          zona.innerHTML =
            '<div class="resumen-zonal">' +
              stats.map(function (s) {
                return '<div class="stat ' + (s.color || "") + '"><b>' + U.esc(String(s.valor)) + '</b><span>' + U.esc(s.etiqueta) + '</span></div>';
              }).join("") +
            '</div>' +
            UI.tarjeta(
              "ESTRUCTURA JERÁRQUICA POR BARRIO",
              construirTablaAcordeon()
            ) +
            UI.tarjeta(
              "CUENTAS ESPECIALIZADAS (2A / 2B)",
              UI.tabla(
                ["ROL", "NOMBRE", "USUARIO", "ESTADO", "CREADO POR"],
                usuarios.filter(function (u) { return u.rol === "PUBLICIDAD" || u.rol === "COMPRAS"; })
                  .map(function (u) {
                    return [
                      UI.sello(u.rol, { PUBLICIDAD: "azul", COMPRAS: "naranja" }),
                      U.esc(U.UP(u.nombre)),
                      U.esc(u.usuario),
                      UI.selloEstado(u.estado),
                      U.esc(U.UP(u.creadoPorNombre || "—"))
                    ];
                  })
              )
            );

          zona.querySelectorAll("[data-toggle-coord]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              const id = btn.dataset.toggleCoord;
              abiertosCoord[id] = !abiertosCoord[id];
              pintar();
            });
          });

          zona.querySelectorAll("[data-toggle-sub]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              const id = btn.dataset.toggleSub;
              abiertosSub[id] = !abiertosSub[id];
              pintar();
            });
          });

          zona.querySelectorAll("[data-verdatos]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              Comun.verDatosUsuario(btn.dataset.verdatos, btn.dataset.nombre, btn.dataset.rol);
            });
          });
        }

        barra.querySelector('[data-t="ref"]').addEventListener("click", cargar);
        barra.querySelector('[data-t="print"]').addEventListener("click", function () {
          U.imprimir("#zona");
        });
        const _pdf0 = barra.querySelector('[data-t="pdf"]');
        if (_pdf0) _pdf0.addEventListener("click", function () { U.descargarPDF("#zona", "Consolidado_Global"); });
        barra.querySelector('[data-t="csv"]').addEventListener("click", function () {
          U.exportarCSV(
            "Consolidado_Global_Puerto_Gaitan",
            ["BARRIO", "USUARIO", "ESTADO", "SUB_COORDINADORES", "LIDERES", "RECAUDACIONES_PROPIAS", "PETICIONES", "QUEJAS"],
            filasCSVJerarquia()
          );
        });
        buscador.oninput = pintar;

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 2 — CREAR CUENTAS
     ================================================================== */
  function vistaCrearCuentas() {
    return {
      etiqueta: "CREAR CUENTAS", icono: "➕",
      async pintar(cont) {
        let coordinadores = [];

        cont.innerHTML =
          UI.encabezado("CREAR CUENTAS Y CONTRASEÑAS", "EL ZONAL CREA CUENTAS DE PUBLICIDAD, COMPRAS, COORDINADORES, SUB-COORDINADORES Y LÍDERES.") +
          '<div class="tarjeta"><h3>NUEVA CUENTA</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>CUENTAS CREADAS</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR NOMBRE, USUARIO, ROL, BARRIO..."></div>' +
            '<div id="zona-lista"></div>' +
          "</div>";

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const buscador = cont.querySelector(".entrada-buscar");
        let todos = [];

        /* ------------------------- FORMULARIO ------------------------- */
        function opcionesCoordinador() {
          return '<option value="">— SELECCIONE COORDINADOR —</option>' +
            coordinadores.map(function (c) {
              return '<option value="' + c.id + '">' + U.esc(U.UP(c.nombre)) +
                     " (" + U.esc(U.UP(c.barrio)) + ")</option>";
            }).join("");
        }

        function pintarFormulario() {
          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<div class="dos-col">' +
                '<div class="campo"><label>ROL DE LA CUENTA</label>' +
                  '<select id="f-rol">' +
                    '<option value="PUBLICIDAD">2A · RESPONSABLE DE PUBLICIDAD</option>' +
                    '<option value="COMPRAS">2B · RESPONSABLE DE COMPRAS</option>' +
                    '<option value="COORDINADOR">3 · COORDINADOR DE BARRIO</option>' +
                    '<option value="SUBCOORDINADOR">4 · SUB-COORDINADOR</option>' +
                    '<option value="LIDER">5 · LÍDER</option>' +
                  "</select></div>" +
                '<div class="campo"><label>NOMBRE COMPLETO</label><input id="f-nombre" type="text"></div>' +
              "</div>" +
              '<div class="dos-col">' +
                '<div class="campo"><label>USUARIO / CÉDULA</label><input id="f-usuario" type="text"></div>' +
                '<div class="campo"><label>TELÉFONO</label><input id="f-telefono" type="tel"></div>' +
              "</div>" +
              '<div class="campo"><label>DIRECCIÓN</label><input id="f-direccion" type="text"></div>' +
              '<div class="campo" id="c-barr" style="display:none"><label>BARRIO / ZONA</label><input id="f-barrio" type="text" placeholder="EJ: CENTRO, LA ESPERANZA..."></div>' +
              '<div class="campo" id="c-coord" style="display:none"><label>COORDINADOR AL QUE PERTENECE</label><select id="f-coordinador">' + opcionesCoordinador() + "</select></div>" +
              '<div class="campo" id="c-sub" style="display:none"><label>SUB-COORDINADOR DEL GRUPO</label><select id="f-sub"><option value="">— SELECCIONE —</option></select></div>' +
              '<div class="dos-col">' +
                '<div class="campo"><label>CONTRASEÑA</label><input id="f-pass" type="password"></div>' +
                '<div class="campo"><label>CONFIRMAR CONTRASEÑA</label><input id="f-pass2" type="password"></div>' +
              "</div>" +
              '<div id="f-error"></div>' +
              '<div class="acciones-form"><button class="btn btn-exito" id="btn-guardar">CREAR CUENTA</button>' +
              '<button class="btn btn-suave" id="btn-limpiar">LIMPIAR</button></div>' +
            "</div>";

          const selRol = zonaForm.querySelector("#f-rol");
          const cBarr = zonaForm.querySelector("#c-barr");
          const cCoord = zonaForm.querySelector("#c-coord");
          const cSub = zonaForm.querySelector("#c-sub");
          const selCoord = zonaForm.querySelector("#f-coordinador");
          const selSub = zonaForm.querySelector("#f-sub");

          function aplicarRol() {
            const rol = selRol.value;
            const necesitaBarrio = ["COORDINADOR", "SUBCOORDINADOR", "LIDER"].indexOf(rol) !== -1;
            cBarr.style.display = necesitaBarrio ? "" : "none";
            cCoord.style.display = (rol === "SUBCOORDINADOR" || rol === "LIDER") ? "" : "none";
            cSub.style.display = rol === "LIDER" ? "" : "none";
          }

          selRol.addEventListener("change", aplicarRol);

          selCoord.addEventListener("change", async function () {
            const id = selCoord.value;
            const coord = coordinadores.find(function (c) { return c.id === id; });
            if (coord) zonaForm.querySelector("#f-barrio").value = U.UP(coord.barrio);
            selSub.innerHTML = '<option value="">— SELECCIONE —</option>';
            if (!id) return;
            UI.cargando(true);
            try {
              const equipo = await FS.equipoDelCoordinador(id);
              equipo.subcoordinadores.forEach(function (s) {
                const o = document.createElement("option");
                o.value = s.id;
                o.textContent = U.UP(s.nombre);
                selSub.appendChild(o);
              });
            } catch (e) { /* nada */ }
            UI.cargando(false);
          });

          zonaForm.querySelector("#btn-limpiar").addEventListener("click", pintarFormulario);

          zonaForm.querySelector("#btn-guardar").addEventListener("click", async function () {
            const errBox = zonaForm.querySelector("#f-error");
            errBox.innerHTML = "";
            UI.cargando(true);
            try {
              await Auth.crearUsuario({
                rol: selRol.value,
                nombre: zonaForm.querySelector("#f-nombre").value,
                usuario: zonaForm.querySelector("#f-usuario").value,
                telefono: zonaForm.querySelector("#f-telefono").value,
                direccion: zonaForm.querySelector("#f-direccion").value,
                barrio: zonaForm.querySelector("#f-barrio").value,
                coordinadorId: selCoord.value || null,
                subcoordinadorId: selSub.value || null,
                password: zonaForm.querySelector("#f-pass").value,
                confirmar: zonaForm.querySelector("#f-pass2").value
              });
              UI.toast("CUENTA CREADA EXITOSAMENTE");
              coordinadores = await FS.usuariosPorRol("COORDINADOR");
              pintarFormulario();
              await cargarLista();
            } catch (e) {
              errBox.innerHTML = UI.alerta("error", e.message);
            }
            UI.cargando(false);
          });

          aplicarRol();
        }

        /* ------------------------- LISTA ------------------------- */
        async function cargarLista() {
          try {
            todos = await FS.usuarios();
            pintarLista();
          } catch (e) {
            zonaLista.innerHTML = UI.alerta("error", e.message);
          }
        }

        function pintarLista() {
          const q = U.UP(buscador.value);
          const lista = todos.filter(function (u) {
            return !q || U.contiene(U.unir([u.nombre, u.usuario, u.rol, u.barrio]), q);
          });
          zonaLista.innerHTML = UI.tabla(
            ["NOMBRE", "ROL", "USUARIO / CÉDULA", "CONTRASEÑA", "BARRIO", "ESTADO", "CREADO POR"],
            lista.map(function (u) {
              return [
                U.esc(U.UP(u.nombre)),
                UI.sello(ROL_NOMBRE[u.rol] || u.rol, {
                  ZONAL: "dorado", PUBLICIDAD: "azul", COMPRAS: "naranja",
                  COORDINADOR: "verde", SUBCOORDINADOR: "azul", LIDER: "gris"
                }),
                U.esc(u.usuario),
                U.esc(u.password || "—"),
                U.esc(U.UP(u.barrio || "—")),
                UI.selloEstado(u.estado),
                U.esc(U.UP(u.creadoPorNombre || "—"))
              ];
            })
          );
        }

        buscador.oninput = pintarLista;

        UI.cargando(true);
        coordinadores = await FS.usuariosPorRol("COORDINADOR");
        UI.cargando(false);
        pintarFormulario();
        await cargarLista();
      }
    };
  }

  /* ==================================================================
     VISTA 3 — GESTIONAR USUARIOS (ACTIVAR / PAUSAR / SUSPENDER)
     ================================================================== */
  function vistaGestionarUsuarios() {
    return {
      etiqueta: "GESTIONAR USUARIOS", icono: "🛡️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("GESTIÓN DE CUENTAS", "EL ZONAL PUEDE ACTIVAR O ELIMINAR CUALQUIER CUENTA. NO SE PUEDE ELIMINAR UN COORDINADOR O SUB-COORDINADOR CON SUBORDINADOS ASIGNADOS.") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR NOMBRE, USUARIO, ROL, BARRIO...">' +
            '<select id="f-filtro-rol" class="entrada-buscar" style="max-width:230px">' +
              '<option value="">TODOS LOS ROLES</option>' +
              '<option value="ZONAL">ZONAL</option><option value="PUBLICIDAD">PUBLICIDAD</option>' +
              '<option value="COMPRAS">COMPRAS</option><option value="COORDINADOR">COORDINADOR</option>' +
              '<option value="SUBCOORDINADOR">SUB-COORDINADOR</option><option value="LIDER">LÍDER</option>' +
            "</select>" +
            '<button class="btn btn-suave" data-t="csv">EXPORTAR CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>              <button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        const filtroRol = barra.querySelector("#f-filtro-rol");
        let todos = [];

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try { todos = await FS.usuarios(); pintar(); }
          catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          const rol = filtroRol.value;
          return todos.filter(function (u) {
            if (rol && u.rol !== rol) return false;
            return !q || U.contiene(U.unir([u.nombre, u.usuario, u.rol, u.barrio]), q);
          });
        }

        function pintar() {
          const lista = filtrados();
          zona.innerHTML = UI.tabla(
            ["NOMBRE", "ROL", "USUARIO / CÉDULA", "CONTRASEÑA", "BARRIO", "ESTADO", "ACCIONES"],
            lista.map(function (u) {
              const acciones = u.id === App.perfil.id
                ? '<span class="menor">SU PROPIA CUENTA</span>'
                : '<div class="grp-acciones">' +
                    (u.estado !== "ACTIVO" ? '<button class="btn btn-mini btn-exito" data-est="ACTIVO" data-id="' + u.id + '">ACTIVAR</button>' : "") +
                    '<button class="btn btn-mini btn-peligro" data-del="' + u.id + '" data-rol="' + u.rol + '" data-usuario="' + U.esc(u.usuario) + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '">ELIMINAR</button>' +
                    
                     '<button class="btn btn-mini btn-suave" data-clave="1" data-id="' + u.id + '" data-usuario="' + U.esc(u.usuario) + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '">CLAVE</button>' +
                  "</div>";
              return [
                U.esc(U.UP(u.nombre)),
                UI.sello(ROL_NOMBRE[u.rol] || u.rol, {
                  ZONAL: "dorado", PUBLICIDAD: "azul", COMPRAS: "naranja",
                  COORDINADOR: "verde", SUBCOORDINADOR: "azul", LIDER: "gris"
                }),
                U.esc(u.usuario),
                U.esc(u.password || "—"),
                U.esc(U.UP(u.barrio || "—")),
                UI.selloEstado(u.estado),
                acciones
              ];
            })
          );

          zona.querySelectorAll("[data-est]").forEach(function (b) {
            b.addEventListener("click", async function () {
              const nuevo = b.dataset.est;
              const etiqueta = nuevo === "ACTIVO" ? "ACTIVAR" : (nuevo === "PAUSADO" ? "PAUSAR" : "SUSPENDER");
              const ok = await UI.confirmar("¿DESEA " + etiqueta + " ESTA CUENTA?");
              if (!ok) return;
              UI.cargando(true);
              try {
                await FS.actualizar("usuarios", b.dataset.id, { estado: nuevo, actualizadoEn: U.ahora() });
                UI.toast("CUENTA " + etiqueta + "DA EXITOSAMENTE");
                await cargar();
              } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
              UI.cargando(false);
            });
          });

          zona.querySelectorAll("[data-clave]").forEach(function (b) {
            b.addEventListener("click", function () {
              const id = b.dataset.id;
              const usuario = b.dataset.usuario;
              const nombre = b.dataset.nombre;
              UI.abrirModal("RESTABLECER CONTRASEÑA — " + nombre,
                '<div class="formulario">' +
                  '<p class="menor">USUARIO: ' + U.esc(usuario) + '</p>' +
                  '<div class="campo"><label>NUEVA CONTRASEÑA</label><input id="rc-nueva" type="password"></div>' +
                  '<div class="campo"><label>CONFIRMAR CONTRASEÑA</label><input id="rc-conf" type="password"></div>' +
                  '<div id="rc-error"></div>' +
                '</div>',
                [
                  { texto: "CANCELAR", clase: "btn-suave" },
                  { texto: "GUARDAR", clase: "btn-primario", onClick: async function () {
                      const errBox = document.getElementById("rc-error");
                      errBox.innerHTML = "";
                      UI.cargando(true);
                      try {
                        await Auth.restablecerPassword(
                          id, usuario,
                          document.getElementById("rc-nueva").value,
                          document.getElementById("rc-conf").value
                        );
                        UI.toast("CONTRASEÑA RESTABLECIDA EXITOSAMENTE", "ok");
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

          zona.querySelectorAll("[data-del]").forEach(function (b) {
            b.addEventListener("click", async function () {
              const id = b.dataset.del;
              const rol = b.dataset.rol;
              const nombre = b.dataset.nombre;
              const usuario = b.dataset.usuario;

              let dependientes = 0, detalle = "";
              if (rol === "COORDINADOR") {
                const subs = (await FS.usuariosPorRol("SUBCOORDINADOR")).filter(function (u) { return u.coordinadorId === id; });
                const lids = (await FS.usuariosPorRol("LIDER")).filter(function (u) { return u.coordinadorId === id; });
                dependientes = subs.length + lids.length;
                detalle = subs.length + " SUB-COORDINADOR(ES) Y " + lids.length + " LÍDER(ES)";
              } else if (rol === "SUBCOORDINADOR") {
                const lids = (await FS.usuariosPorRol("LIDER")).filter(function (u) { return u.subcoordinadorId === id; });
                dependientes = lids.length;
                detalle = lids.length + " LÍDER(ES)";
              }

              if (dependientes > 0) {
                UI.toast("NO SE PUEDE ELIMINAR: TIENE " + detalle + " ASIGNADOS. MUÉVALOS PRIMERO (UBICAR / MOVER LÍDER).", "error");
                return;
              }

              const ok = await UI.confirmar("¿ELIMINAR LA CUENTA DE " + nombre + " (" + usuario + ")? ESTA ACCIÓN NO SE PUEDE DESHACER.");
              if (!ok) return;
              UI.cargando(true);
              try {
                await FS.borrar("usuarios", id);
                UI.toast("CUENTA ELIMINADA EXITOSAMENTE", "ok");
                await cargar();
              } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
              UI.cargando(false);
            });
          });

        }

        barra.querySelector('[data-t="ref"]').addEventListener("click", cargar);
        barra.querySelector('[data-t="print"]').addEventListener("click", function () { U.imprimir("#zona"); });
        (function () { const b = barra.querySelector('[data-t="pdf"]'); if (b) b.addEventListener("click", function () { U.descargarPDF("#zona", "Gestion_Usuarios"); }); })();
        barra.querySelector('[data-t="csv"]').addEventListener("click", function () {
          U.exportarCSV("Gestion_Usuarios",
            ["NOMBRE", "ROL", "USUARIO", "BARRIO", "ESTADO"],
            filtrados().map(function (u) { return [u.nombre, ROL_NOMBRE[u.rol], u.usuario, u.barrio, u.estado]; }));
        });
        buscador.oninput = pintar;
        filtroRol.onchange = pintar;

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 4 — UBICAR / MOVER LÍDERES
     ================================================================== */
  function vistaMoverLider() {
    return {
      etiqueta: "UBICAR / MOVER LÍDER", icono: "🔁",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("UBICAR O MOVER UN LÍDER", "EL ZONAL PUEDE COLOCAR CUALQUIER LÍDER CON EL SUB-COORDINADOR CON EL QUE VA A TRABAJAR.") +
          '<div class="tarjeta"><h3>MOVER LÍDER DE GRUPO</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>ESTADO DE CUENTA (CUALQUIER NIVEL)</h3><div id="zona-estado"></div></div>' +
          '<!-- Sección Mover Coordinador -->' +
          '<div class="tarjeta"><h3>MOVER COORDINADOR</h3>' +
          '<div class="formulario">' +
          '<div class="campo"><label>COORDINADOR A MOVER</label><select id="mv-coord">' +
          '<option value="">— SELECCIONE COORDINADOR —</option>' +
          '</select></div>' +
          '<div class="campo"><label>COORDINADOR DESTINO</label><select id="mv-coord-dest">' +
          '<option value="">— SELECCIONE DESTINO —</option>' +
          '</select></div>' +
          '<div id="mv-alerta" style="margin-top:8px; font-size:12px; color:#c62828"></div>' +
          '<button class="btn btn-suave" id="mv-check">VER DEPENDENCIAS</button>' +
          '</div>' +
          '</div>' +
          '</div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaEstado = cont.querySelector("#zona-estado");

        let lideres = [], subs = [];

        async function cargar() {
          UI.cargando(true);
          try {
            const res = await Promise.all([
              FS.usuariosPorRol("LIDER"), FS.usuariosPorRol("SUBCOORDINADOR"), FS.usuarios()
            ]);
            lideres = res[0]; subs = res[1];
            pintarFormulario();
            pintarEstado(res[2]);
          } catch (e) {
            zonaForm.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        function pintarFormulario() {
          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<div class="campo"><label>LÍDER A UBICAR</label><select id="m-lider">' +
                '<option value="">— SELECCIONE LÍDER —</option>' +
                lideres.map(function (l) {
                  return '<option value="' + l.id + '">' + U.esc(U.UP(l.nombre)) +
                         " · " + U.esc(U.UP(l.barrio || "SIN BARRIO")) + "</option>";
                }).join("") +
              "</select></div>" +
              '<div class="campo"><label>SUB-COORDINADOR DE DESTINO</label><select id="m-sub" disabled>' +
                '<option value="">— SELECCIONE PRIMERO EL LÍDER —</option>' +
              "</select></div>" +
              '<div id="m-info"></div>' +
              '<div class="acciones-form"><button class="btn btn-primario" id="m-guardar">GUARDAR UBICACIÓN</button></div>' +
            "</div>";

          const selLider = zonaForm.querySelector("#m-lider");
          const selSub = zonaForm.querySelector("#m-sub");
          const info = zonaForm.querySelector("#m-info");

          selLider.addEventListener("change", function () {
            const l = lideres.find(function (x) { return x.id === selLider.value; });
            if (!l) {
              selSub.innerHTML = '<option value="">— SELECCIONE PRIMERO EL LÍDER —</option>';
              selSub.disabled = true; info.innerHTML = ""; return;
            }
            const subsDelBarrio = subs.filter(function (s) { return U.UP(s.barrio) === U.UP(l.barrio); });
            const todos = subsDelBarrio.length ? subsDelBarrio : subs;
            selSub.innerHTML = '<option value="">— SELECCIONE SUB-COORDINADOR —</option>' +
              todos.map(function (s) {
                return '<option value="' + s.id + '">' + U.esc(U.UP(s.nombre)) +
                       " (" + U.esc(U.UP(s.barrio)) + ")</option>";
              }).join("");
            selSub.disabled = false;
            const actual = subs.find(function (s) { return s.id === l.subcoordinadorId; });
            info.innerHTML = UI.alerta("info",
              "LÍDER ACTUALMENTE EN: " + (actual ? U.UP(actual.nombre) : "NINGÚN GRUPO") +
              " · BARRIO: " + U.UP(l.barrio || "—") +
              " · ESTADO: " + U.UP(l.estado));
          });

          zonaForm.querySelector("#m-guardar").addEventListener("click", async function () {
            if (!selLider.value) { UI.toast("SELECCIONE EL LÍDER", "error"); return; }
            if (!selSub.value) { UI.toast("SELECCIONE EL SUB-COORDINADOR", "error"); return; }
            const sub = subs.find(function (s) { return s.id === selSub.value; });
            UI.cargando(true);
            try {
              await FS.actualizar("usuarios", selLider.value, {
                subcoordinadorId: selSub.value,
                coordinadorId: sub.coordinadorId || null,
                barrio: sub.barrio || null,
                actualizadoEn: U.ahora()
              });
              UI.toast("LÍDER UBICADO EN EL NUEVO GRUPO");
              await cargar();
            } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
            UI.cargando(false);
          });
        }

        function pintarEstado(todos) {
          zonaEstado.innerHTML =
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR USUARIO..."></div>' +
            '<div id="zona-est"></div>';
          const busc = zonaEstado.querySelector(".entrada-buscar");
          const z = zonaEstado.querySelector("#zona-est");

          function pintarLista() {
            const q = U.UP(busc.value);
            const lista = todos.filter(function (u) {
              return u.id !== App.perfil.id &&
                (!q || U.contiene(U.unir([u.nombre, u.usuario, u.rol, u.barrio]), q));
            });
            z.innerHTML = UI.tabla(["NOMBRE", "ROL", "BARRIO", "ESTADO", "CAMBIAR ESTADO"],
              lista.map(function (u) {
                return [
                  U.esc(U.UP(u.nombre)),
                  UI.sello(ROL_NOMBRE[u.rol] || u.rol, { COORDINADOR: "verde", SUBCOORDINADOR: "azul", LIDER: "gris" }),
                  U.esc(U.UP(u.barrio || "—")),
                  UI.selloEstado(u.estado),
                  '<div class="grp-acciones">' +
                    '<button class="btn btn-mini btn-exito" data-est="ACTIVO" data-id="' + u.id + '">ACTIVAR</button>' +
                    '<button class="btn btn-mini btn-peligro" data-del="' + u.id + '" data-rol="' + u.rol + '" data-usuario="' + U.esc(u.usuario) + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '">ELIMINAR</button>' +
                    
                  "</div>"
                ];
              })
            );
            z.querySelectorAll("[data-est]").forEach(function (b) {
              b.addEventListener("click", async function () {
                const ok = await UI.confirmar("¿DESEA CAMBIAR EL ESTADO DE ESTA CUENTA?");
                if (!ok) return;
                UI.cargando(true);
                try {
                  await FS.actualizar("usuarios", b.dataset.id, { estado: b.dataset.est, actualizadoEn: U.ahora() });
                  UI.toast("ESTADO ACTUALIZADO");
                  await cargar();
                } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
                UI.cargando(false);
              });
            });
          }
          z.querySelectorAll("[data-del]").forEach(function (b) {
            b.addEventListener("click", async function () {
              const id = b.dataset.del;
              const rol = b.dataset.rol;
              const nombre = b.dataset.nombre;
              const usuario = b.dataset.usuario;

              let dependientes = 0, detalle = "";
              if (rol === "COORDINADOR") {
                const subs = (await FS.usuariosPorRol("SUBCOORDINADOR")).filter(function (u) { return u.coordinadorId === id; });
                const lids = (await FS.usuariosPorRol("LIDER")).filter(function (u) { return u.coordinadorId === id; });
                dependientes = subs.length + lids.length;
                detalle = subs.length + " SUB-COORDINADOR(ES) Y " + lids.length + " LÍDER(ES)";
              } else if (rol === "SUBCOORDINADOR") {
                const lids = (await FS.usuariosPorRol("LIDER")).filter(function (u) { return u.subcoordinadorId === id; });
                dependientes = lids.length;
                detalle = lids.length + " LÍDER(ES)";
              }

              if (dependientes > 0) {
                UI.toast("NO SE PUEDE ELIMINAR: TIENE " + detalle + " ASIGNADOS. MUÉVALOS PRIMERO (UBICAR / MOVER LÍDER).", "error");
                return;
              }

              const ok = await UI.confirmar("¿ELIMINAR LA CUENTA DE " + nombre + " (" + usuario + ")? ESTA ACCIÓN NO SE PUEDE DESHACER.");
              if (!ok) return;
              UI.cargando(true);
              try {
                await FS.borrar("usuarios", id);
                UI.toast("CUENTA ELIMINADA EXITOSAMENTE", "ok");
                await cargar();
              } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
              UI.cargando(false);
            });
          });

          busc.oninput = pintarLista;
          pintarLista();
        }

        // Lógica para Mover Coordinador (llenado seguro de selectores)
        const mvCoordSel = zonaForm.querySelector("#mv-coord");
        const mvCoordDestSel = zonaForm.querySelector("#mv-coord-dest");
        if (mvCoordSel && mvCoordDestSel) {
          FS.usuariosPorRol("COORDINADOR").then(function (coords) {
            const opts = '<option value="">— SELECCIONE COORDINADOR —</option>' +
              coords.map(function (c) {
                return '<option value="' + c.id + '">' + U.esc(U.UP(c.nombre)) +
                       ' (' + U.esc(U.UP(c.barrio || "—")) + ')</option>';
              }).join("");
            mvCoordSel.innerHTML = opts;
            mvCoordDestSel.innerHTML = opts;
            mvCoordDestSel.disabled = true;
          }).catch(function () {});
        }

        const mvCoord = zonaForm.querySelector("#mv-coord");
        const mvCoordDest = zonaForm.querySelector("#mv-coord-dest");
        const mvAlerta = zonaForm.querySelector("#mv-alerta");

        if (mvCoord && mvCoordDest) {
          mvCoord.addEventListener("change", async function () {
            const coordId = this.value;
            if (!coordId) {
              mvCoordDest.disabled = true;
              mvAlerta.innerHTML = "";
              return;
            }
            mvCoordDest.disabled = false;
            const subs = (await FS.usuariosPorRol("SUBCOORDINADOR")).filter(function (u) { return u.coordinadorId === coordId; });
            const lideresCoord = (await FS.usuariosPorRol("LIDER")).filter(function (u) { return u.coordinadorId === coordId; });
            let alerta = "";
            if (lideresCoord.length > 0 || subs.length > 0) {
              alerta = "ADVERTENCIA: Este coordinador tiene " + lideresCoord.length + " líder(s) y " + subs.length + " sub-coordinador(es) dependientes.";
            } else {
              alerta = "No tiene subordinados. Seguro que desea mover este coordinador?";
            }
            mvAlerta.innerHTML = '<span style="color:#c62828"><strong>' + alerta + '</strong></span>';
          });

          mvCoordDest.addEventListener("change", function () {
            mvAlerta.innerHTML = "";
          });
        }

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 5 — ENVIAR MENSAJES (DIRECTO O GENERAL AL BARRIO)
     ================================================================== */
  function vistaMensajes() {
    return {
      etiqueta: "ENVIAR MENSAJES", icono: "✉️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("ENVÍO DE MENSAJES DESCENDENTES", "DOS ALCANCES: (1) DIRECTO AL COORDINADOR DE UN BARRIO O (2) GENERAL A TODO EL GRUPO DEL BARRIO.") +
          '<div class="tarjeta"><h3>NUEVO MENSAJE</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>MENSAJES ENVIADOS</h3>' +
            '<p class="menor">LOS MENSAJES ENVIADOS NO SE MUESTRAN POR DEFECTO.</p>' +
            '<div class="acciones-form"><button class="btn btn-primario" id="btn-ver-enviados">VER MENSAJES ENVIADOS</button></div>' +
            '<div id="zona-lista" style="display:none"></div></div>' +
          '<div class="tarjeta"><h3>ESCALAMIENTOS RECIBIDOS</h3><div id="zona-esc"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const zonaEsc = cont.querySelector("#zona-esc");
        let coordinadores = [];

        // Abrir modal de mensajes enviados
        setTimeout(function () {
          const btn = cont.querySelector("#btn-ver-enviados");
          if (btn) btn.addEventListener("click", function () {
            App.abrirMensajesEnviadosZonal();
          });
        }, 0);

        async function cargar() {
          UI.cargando(true);
          try {
            coordinadores = await FS.usuariosPorRol("COORDINADOR");
            pintarFormulario();
            await pintarLista();
            // Escalamientos recibidos
            if (zonaEsc) {
              try {
                const escs = await FS.escalamientos();
                zonaEsc.innerHTML = escs.length
                  ? escs.map(function (e) {
                      const adj = (e.adjuntos || []).length
                        ? '<div class="lista-adjuntos">' + e.adjuntos.map(function (a) {
                            return '<a class="adjunto" href="' + U.esc(a.url) + '" target="_blank" rel="noopener">📎 ' + U.esc(U.UP(a.nombre)) + "</a>";
                          }).join("") + "</div>"
                        : '<p class="menor">SIN ARCHIVOS ADJUNTOS.</p>';
                      return '<div class="mensaje"><div class="cab"><span><strong>BARRIO:</strong> ' + U.esc(U.UP(e.barrio)) +
                        " · <strong>COORDINADOR:</strong> " + U.esc(U.UP(e.coordinadorNombre || "—")) + "</span>" +
                        "<span>" + U.esc(U.fecha(e.fecha)) + "</span></div>" +
                        '<div class="cuerpo"><strong>' + U.esc(U.UP(e.asunto)) + "</strong><br>" + U.esc(U.UP(e.mensaje)) + "</div>" + adj + "</div>";
                    }).join("")
                  : UI.alerta("info", "NO HAY ESCALAMIENTOS REGISTRADOS.");
              } catch (ex) { zonaEsc.innerHTML = UI.alerta("error", ex.message); }
            }
          } catch (e) {
            zonaForm.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        function pintarFormulario() {
          const barrios = coordinadores.map(function (c) { return c.barrio; })
            .filter(function (b, i, a) { return b && a.indexOf(b) === i; });

          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<fieldset class="fieldset"><legend>ALCANCE DEL MENSAJE</legend>' +
                '<div class="tipo-radio">' +
                  '<label class="sel" data-alc="directo_coordinador">① DIRECTO AL COORDINADOR</label>' +
                  '<label data-alc="general_barrio">② GENERAL AL BARRIO</label>' +
                "</div>" +
              "</fieldset>" +
              '<div class="campo" id="c-coord"><label>COORDINADOR DESTINO</label><select id="f-coord">' +
                '<option value="">— SELECCIONE —</option>' +
                coordinadores.map(function (c) {
                  return '<option value="' + c.id + '">' + U.esc(U.UP(c.nombre)) +
                         " · " + U.esc(U.UP(c.barrio)) + "</option>";
                }).join("") + "</select></div>" +
              '<div class="campo" id="c-barr" style="display:none"><label>BARRIO DESTINO</label><select id="f-barr">' +
                '<option value="">— SELECCIONE —</option>' +
                barrios.map(function (b) { return '<option>' + U.esc(U.UP(b)) + "</option>"; }).join("") +
              "</select></div>" +
              '<div class="campo"><label>TEXTO DEL MENSAJE</label><textarea id="f-texto" rows="4" placeholder="ESCRIBA LA INSTRUCCIÓN O AVISO..."></textarea></div>' +
              '<div id="f-error"></div>' +
              '<div class="acciones-form"><button class="btn btn-primario" id="btn-enviar">ENVIAR MENSAJE</button></div>' +
            "</div>";

          let alcance = "directo_coordinador";
          zonaForm.querySelectorAll("[data-alc]").forEach(function (lab) {
            lab.addEventListener("click", function () {
              alcance = lab.dataset.alc;
              zonaForm.querySelectorAll("[data-alc]").forEach(function (x) { x.classList.remove("sel"); });
              lab.classList.add("sel");
              zonaForm.querySelector("#c-coord").style.display = alcance === "directo_coordinador" ? "" : "none";
              zonaForm.querySelector("#c-barr").style.display = alcance === "general_barrio" ? "" : "none";
            });
          });

          zonaForm.querySelector("#btn-enviar").addEventListener("click", async function () {
            const errBox = zonaForm.querySelector("#f-error");
            errBox.innerHTML = "";
            const texto = U.UP(zonaForm.querySelector("#f-texto").value);
            if (!U.requerido(texto)) { errBox.innerHTML = UI.alerta("error", "EL MENSAJE ES OBLIGATORIO"); return; }

            let paraCoordinadorId = null, barrio = null;

            if (alcance === "directo_coordinador") {
              const id = zonaForm.querySelector("#f-coord").value;
              if (!id) { errBox.innerHTML = UI.alerta("error", "SELECCIONE EL COORDINADOR DESTINO"); return; }
              const c = coordinadores.find(function (x) { return x.id === id; });
              paraCoordinadorId = id;
              barrio = c.barrio;
            } else {
              const b = zonaForm.querySelector("#f-barr").value;
              if (!b) { errBox.innerHTML = UI.alerta("error", "SELECCIONE EL BARRIO DESTINO"); return; }
              barrio = b;
            }

            UI.cargando(true);
            try {
              await FS.crear("mensajes", {
                alcance: alcance,
                deId: App.perfil.id,
                deNombre: App.perfil.nombre,
                paraCoordinadorId: paraCoordinadorId,
                paraSubId: null,
                barrio: U.UP(barrio),
                texto: texto,
                fecha: U.ahora(),
                fechaMs: U.ahoraMs()
              });
              UI.toast("MENSAJE ENVIADO");
              zonaForm.querySelector("#f-texto").value = "";
              await pintarLista();
            } catch (e) { errBox.innerHTML = UI.alerta("error", e.message); }
            UI.cargando(false);
          });
        }

        let mostrarArchivados = false;
        async function pintarLista() {
          try {
            const todos = await FS.mensajesEnviados(App.perfil.id);
            const enviados = todos.filter(function (m) { return !!m.archivado === mostrarArchivados; });
            if (!todos.length) {
              zonaLista.innerHTML = '<div class="mensaje vacio-m">AÚN NO HA ENVIADO MENSAJES</div>';
              return;
            }
            if (!enviados.length) {
              zonaLista.innerHTML = '<div class="mensaje vacio-m">' + (mostrarArchivados ? "NO HAY MENSAJES ARCHIVADOS" : "NO HAY MENSAJES ACTIVOS") + '</div>';
              return;
            }
            zonaLista.innerHTML = enviados.map(function (m) {
              const etiqueta = m.alcance === "directo_coordinador"
                ? "DIRECTO AL COORDINADOR" : "GENERAL AL BARRIO";
              const archivado = !!m.archivado;
              return '<div class="mensaje">' +
                '<div class="cab">' +
                  '<span><span class="alcance">' + etiqueta + "</span> · " +
                  U.esc(U.UP(m.barrio || "")) + "</span>" +
                  "<span>" + U.esc(U.fecha(m.fecha)) + (m.editadoEn ? " (EDITADO)" : "") + "</span>" +
                "</div>" +
                '<div class="cuerpo">' + U.esc(U.UP(m.texto)) + "</div>" +
                '<div class="grp-acciones no-imprimir" style="margin-top:6px">' +
                  '<button class="btn btn-mini btn-suave" data-arch="' + m.id + '">' + (archivado ? "DESHACER ARCHIVO" : "ARCHIVAR") + '</button>' +
                  '<button class="btn btn-mini btn-azul2" data-edit-msg="' + m.id + '">EDITAR</button>' +
                  '<button class="btn btn-mini btn-peligro" data-del-msg="' + m.id + '">ELIMINAR</button>' +
                '</div>' +
              '</div>';
            }).join("");

            zonaLista.querySelectorAll("[data-arch]").forEach(function (b) {
              b.addEventListener("click", async function () {
                UI.cargando(true);
                try {
                  const m = todos.find(function (x) { return x.id === b.dataset.arch; });
                  await FS.actualizar("mensajes", b.dataset.arch, { archivado: !m.archivado, actualizadoEn: U.ahora() });
                  UI.toast(m.archivado ? "MENSAJE RESTAURADO" : "MENSAJE ARCHIVADO");
                  await pintarLista();
                } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
                UI.cargando(false);
              });
            });

            zonaLista.querySelectorAll("[data-edit-msg]").forEach(function (b) {
              b.addEventListener("click", function () {
                const m = todos.find(function (x) { return x.id === b.dataset.editMsg; });
                if (!m) return;
                UI.abrirModal("EDITAR MENSAJE",
                  '<div class="formulario">' +
                    '<div class="campo"><label>TEXTO DEL MENSAJE</label><textarea id="em-texto" rows="4">' + U.esc(U.UP(m.texto)) + '</textarea></div>' +
                    '<div id="em-error"></div>' +
                  '</div>',
                  [
                    { texto: "CANCELAR", clase: "btn-suave" },
                    { texto: "GUARDAR", clase: "btn-primario", onClick: async function () {
                        const errBox = document.getElementById("em-error");
                        errBox.innerHTML = "";
                        const nuevo = U.UP(document.getElementById("em-texto").value);
                        if (!U.requerido(nuevo)) { errBox.innerHTML = UI.alerta("error", "EL MENSAJE ES OBLIGATORIO"); return false; }
                        UI.cargando(true);
                        try {
                          await FS.actualizar("mensajes", m.id, { texto: nuevo, editadoEn: U.ahora(), actualizadoEn: U.ahora() });
                          UI.toast("MENSAJE ACTUALIZADO");
                          await pintarLista();
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

            zonaLista.querySelectorAll("[data-del-msg]").forEach(function (b) {
              b.addEventListener("click", async function () {
                const ok = await UI.confirmar("¿ELIMINAR ESTE MENSAJE? SE BORRARÁ PARA TODOS LOS DESTINATARIOS.");
                if (!ok) return;
                UI.cargando(true);
                try {
                  await FS.borrar("mensajes", b.dataset.delMsg);
                  UI.toast("MENSAJE ELIMINADO");
                  await pintarLista();
                } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
                UI.cargando(false);
              });
            });
          } catch (e) {
            zonaLista.innerHTML = UI.alerta("error", e.message);
          }
        }

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 6 — ESCALAMIENTOS RECIBIDOS
     ================================================================== */
  function vistaEscalamientos() {
    return {
      etiqueta: "ESCALAMIENTOS RECIBIDOS", icono: "📥",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("REPORTES, QUEJAS Y SOLICITUDES ESCALADAS", "RECIBIDOS ÚNICAMENTE DESDE LOS COORDINADORES, CON ARCHIVOS ADJUNTOS EN FIREBASE STORAGE.") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR ASUNTO, BARRIO, COORDINADOR...">' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>              <button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        let todos = [];

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try { todos = await FS.escalamientos(); pintar(); }
          catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function pintar() {
          const q = U.UP(buscador.value);
          const lista = todos.filter(function (e) {
            return !q || U.contiene(U.unir([e.asunto, e.mensaje, e.barrio, e.coordinadorNombre]), q);
          });

          if (!lista.length) {
            zona.innerHTML = UI.alerta("info", "NO HAY ESCALAMIENTOS REGISTRADOS.");
            return;
          }

          zona.innerHTML = lista.map(function (e) {
            const adj = (e.adjuntos || []).length
              ? '<div class="lista-adjuntos">' + e.adjuntos.map(function (a) {
                  return '<a class="adjunto" href="' + U.esc(a.url) + '" target="_blank" rel="noopener">📎 ' +
                         U.esc(U.UP(a.nombre)) + "</a>";
                }).join("") + "</div>"
              : '<p class="menor">SIN ARCHIVOS ADJUNTOS.</p>';

            return '<div class="mensaje">' +
              '<div class="cab">' +
                "<span><strong>BARRIO:</strong> " + U.esc(U.UP(e.barrio)) +
                " · <strong>COORDINADOR:</strong> " + U.esc(U.UP(e.coordinadorNombre || "—")) + "</span>" +
                "<span>" + U.esc(U.fecha(e.fecha)) + "</span>" +
              "</div>" +
              '<div class="cuerpo"><strong>' + U.esc(U.UP(e.asunto)) + "</strong><br>" +
                U.esc(U.UP(e.mensaje)) + "</div>" + adj +
            "</div>";
          }).join("");
        }

        barra.querySelector('[data-t="ref"]').addEventListener("click", cargar);
        barra.querySelector('[data-t="print"]').addEventListener("click", function () { U.imprimir("#zona"); });
        (function () { const b = barra.querySelector('[data-t="pdf"]'); if (b) b.addEventListener("click", function () { U.descargarPDF("#zona", "Escalamientos"); }); })();
        buscador.oninput = pintar;

        await cargar();
      }
    };
  }

  /* ==================================================================
     REGISTRO DEL MÓDULO
     ================================================================== */
  /* ==================================================================
      MENSAJES ENVIADOS (MODAL)
      ================================================================== */
  App.abrirMensajesEnviadosZonal = async function () {
    let mostrarArchivados = false;
    UI.abrirModal("MENSAJES ENVIADOS", '<div id="zm-enviados">CARGANDO...</div>', [{ texto: "CERRAR", clase: "btn-suave" }]);

    async function render() {
      const zona = document.getElementById("zm-enviados");
      if (!zona) return;
      UI.cargando(true);
      try {
        const todos = await FS.mensajesEnviados(App.perfil.id);
        const enviados = todos.filter(function (m) { return !!m.archivado === mostrarArchivados; });
        if (!todos.length) {
          zona.innerHTML = '<div class="mensaje vacio-m">AÚN NO HA ENVIADO MENSAJES</div>';
          return;
        }
        if (!enviados.length) {
          zona.innerHTML = '<div class="mensaje vacio-m">' + (mostrarArchivados ? "NO HAY MENSAJES ARCHIVADOS" : "NO HAY MENSAJES ACTIVOS") + '</div>';
          return;
        }
        zona.innerHTML =
          '<div class="barra no-imprimir" style="margin-bottom:8px"><button class="btn btn-suave" id="zm-toggle">' + (mostrarArchivados ? "VER ACTIVOS" : "VER ARCHIVADOS") + '</button></div>' +
          enviados.map(function (m) {
            const etiqueta = m.alcance === "directo_coordinador" ? "DIRECTO AL COORDINADOR" : "GENERAL AL BARRIO";
            return '<div class="mensaje">' +
              '<div class="cab"><span><span class="alcance">' + etiqueta + "</span> · " + U.esc(U.UP(m.barrio || "")) + "</span>" +
              "<span>" + U.esc(U.fecha(m.fecha)) + (m.editadoEn ? " (EDITADO)" : "") + "</span></div>" +
              '<div class="cuerpo">' + U.esc(U.UP(m.texto)) + "</div>" +
              '<div class="grp-acciones no-imprimir" style="margin-top:6px">' +
                '<button class="btn btn-mini btn-suave" data-arch="' + m.id + '">' + (m.archivado ? "DESHACER ARCHIVO" : "ARCHIVAR") + '</button>' +
                '<button class="btn btn-mini btn-azul2" data-edit-msg="' + m.id + '">EDITAR</button>' +
                '<button class="btn btn-mini btn-peligro" data-del-msg="' + m.id + '">ELIMINAR</button>' +
              '</div></div>';
          }).join("");

        const btnToggle = zona.querySelector("#zm-toggle");
        if (btnToggle) btnToggle.addEventListener("click", function () {
          mostrarArchivados = !mostrarArchivados;
          render();
        });

        zona.querySelectorAll("[data-arch]").forEach(function (b) {
          b.addEventListener("click", async function () {
            UI.cargando(true);
            try {
              const m = todos.find(function (x) { return x.id === b.dataset.arch; });
              await FS.actualizar("mensajes", b.dataset.arch, { archivado: !m.archivado, actualizadoEn: U.ahora() });
              UI.toast(m.archivado ? "MENSAJE RESTAURADO" : "MENSAJE ARCHIVADO");
              await render();
            } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
            UI.cargando(false);
          });
        });

        zona.querySelectorAll("[data-edit-msg]").forEach(function (b) {
          b.addEventListener("click", function () {
            const m = todos.find(function (x) { return x.id === b.dataset.editMsg; });
            if (!m) return;
            UI.abrirModal("EDITAR MENSAJE",
              '<div class="formulario">' +
                '<div class="campo"><label>TEXTO DEL MENSAJE</label><textarea id="em-texto" rows="4">' + U.esc(U.UP(m.texto)) + '</textarea></div>' +
                '<div id="em-error"></div>' +
              '</div>',
              [
                { texto: "CANCELAR", clase: "btn-suave" },
                { texto: "GUARDAR", clase: "btn-primario", onClick: async function () {
                    const errBox = document.getElementById("em-error");
                    errBox.innerHTML = "";
                    const nuevo = U.UP(document.getElementById("em-texto").value);
                    if (!U.requerido(nuevo)) { errBox.innerHTML = UI.alerta("error", "EL MENSAJE ES OBLIGATORIO"); return false; }
                    UI.cargando(true);
                    try {
                      await FS.actualizar("mensajes", m.id, { texto: nuevo, editadoEn: U.ahora(), actualizadoEn: U.ahora() });
                      UI.toast("MENSAJE ACTUALIZADO");
                      await render();
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

        zona.querySelectorAll("[data-del-msg]").forEach(function (b) {
          b.addEventListener("click", async function () {
            const ok = await UI.confirmar("¿ELIMINAR ESTE MENSAJE? SE BORRARÁ PARA TODOS LOS DESTINATARIOS.");
            if (!ok) return;
            UI.cargando(true);
            try {
              await FS.borrar("mensajes", b.dataset.delMsg);
              UI.toast("MENSAJE ELIMINADO");
              await render();
            } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
            UI.cargando(false);
          });
        });
      } catch (e) {
        zona.innerHTML = UI.alerta("error", e.message);
      }
      UI.cargando(false);
    }

    await render();
  };

  /* ==================================================================
     VISTA 7 — ASIGNAR METAS GLOBALES (COORDINADORES, SUBS Y LÍDERES)
     ================================================================== */
  function vistaMetasZonal() {
    return {
      etiqueta: "METAS", icono: "🎯",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("ASIGNAR METAS DE RECAUDACIÓN", "EL ZONAL PUEDE FIJAR METAS DIARIAS O MENSUALES A COORDINADORES, SUB-COORDINADORES Y LÍDERES.") +
          '<div class="tarjeta"><h3>NUEVA META</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>SEGUIMIENTO DE METAS (TODOS LOS NIVELES)</h3>' +
            '<div class="barra no-imprimir"><button class="btn btn-primario" id="mtz-ref">ACTUALIZAR</button></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        let equipoGlobal = [];

        async function cargar() {
          UI.cargando(true);
          try {
            const todos = await FS.usuarios();
            equipoGlobal = todos.filter(function (u) {
              return u.rol === "COORDINADOR" || u.rol === "SUBCOORDINADOR" || u.rol === "LIDER";
            }).sort(function (a, b) {
              return U.UP(a.barrio || "").localeCompare(U.UP(b.barrio || "")) || U.UP(a.nombre).localeCompare(U.UP(b.nombre));
            });
            pintarFormulario();
            await pintarSeguimiento();
          } catch (e) {
            zonaForm.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        function pintarFormulario() {
          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<div class="campo"><label>COORDINADOR, SUB-COORDINADOR O LÍDER</label><select id="mtz-usuario">' +
                '<option value="">— SELECCIONE INTEGRANTE —</option>' +
                equipoGlobal.map(function (u) {
                  const rolCorto = u.rol === "COORDINADOR" ? "COORD" : (u.rol === "SUBCOORDINADOR" ? "SUB-COORD" : "LÍDER");
                  return '<option value="' + u.id + '" data-rol="' + u.rol + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '" data-barrio="' + U.esc(U.UP(u.barrio || "")) + '">' +
                         U.esc(rolCorto + " · " + U.UP(u.nombre) + (u.barrio ? " (" + U.UP(u.barrio) + ")" : "")) + "</option>";
                }).join("") +
              "</select></div>" +
              '<div class="dos-col">' +
                '<div class="campo"><label>PERIODICIDAD</label><select id="mtz-tipo">' +
                  '<option value="DIARIA">POR DÍA (HOY)</option>' +
                  '<option value="MENSUAL">POR MES (ESTE MES)</option>' +
                "</select></div>" +
                '<div class="campo"><label>CANTIDAD A SUMAR</label><input id="mtz-cant" type="number" min="1" placeholder="EJ: 10"></div>' +
              "</div>" +
              '<div class="campo"><label>MENSAJE / INSTRUCCIÓN DE META</label>' +
                '<textarea id="mtz-msg" rows="3" placeholder="EJ: META DE RECAUDACIÓN ASIGNADA POR EL ZONAL..."></textarea></div>' +
              '<div id="mtz-error"></div>' +
              '<div class="acciones-form"><button class="btn btn-exito" id="mtz-guardar">ASIGNAR META</button></div>' +
            "</div>";

          zonaForm.querySelector("#mtz-guardar").addEventListener("click", async function () {
            const errBox = zonaForm.querySelector("#mtz-error");
            errBox.innerHTML = "";

            const sel = zonaForm.querySelector("#mtz-usuario");
            const usuarioId = sel.value;
            const tipo = zonaForm.querySelector("#mtz-tipo").value;
            const cantidad = parseInt(zonaForm.querySelector("#mtz-cant").value, 10);
            const mensaje = U.UP(zonaForm.querySelector("#mtz-msg").value);

            if (!usuarioId) { errBox.innerHTML = UI.alerta("error", "SELECCIONE EL INTEGRANTE"); return; }
            if (!cantidad || cantidad < 1) { errBox.innerHTML = UI.alerta("error", "DIGITE UNA CANTIDAD VÁLIDA (MÍNIMO 1)"); return; }

            const opt = sel.options[sel.selectedIndex];
            const usuarioNombre = opt.dataset.nombre;
            const usuarioRol = opt.dataset.rol;
            const usuarioBarrio = opt.dataset.barrio;
            const userObj = equipoGlobal.find(function (x) { return x.id === usuarioId; }) || {};
            const clavePeriodo = FS.clavePeriodoMeta(tipo);
            const textoFinal = mensaje || ("META " + (tipo === "DIARIA" ? "DIARIA" : "MENSUAL") + " DE " + cantidad + " USUARIOS RECAUDADOS");

            UI.cargando(true);
            try {
              await FS.crear("metas", {
                coordinadorId: usuarioRol === "COORDINADOR" ? usuarioId : (userObj.coordinadorId || App.perfil.id),
                coordinadorNombre: App.perfil.nombre,
                barrio: usuarioBarrio,
                usuarioId: usuarioId,
                usuarioNombre: usuarioNombre,
                usuarioRol: usuarioRol,
                tipo: tipo,
                clavePeriodo: clavePeriodo,
                cantidad: cantidad,
                mensaje: textoFinal,
                fecha: U.ahora(),
                fechaMs: U.ahoraMs()
              });

              let alcanceMsg = "general_barrio";
              if (usuarioRol === "COORDINADOR") alcanceMsg = "directo_coordinador";
              else if (usuarioRol === "SUBCOORDINADOR") alcanceMsg = "trabajo_sub";
              else if (usuarioRol === "LIDER") alcanceMsg = "grupo_lideres";

              await FS.crear("mensajes", {
                alcance: alcanceMsg,
                deId: App.perfil.id,
                deNombre: App.perfil.nombre,
                paraCoordinadorId: usuarioRol === "COORDINADOR" ? usuarioId : (userObj.coordinadorId || null),
                paraSubId: usuarioRol === "LIDER" ? (userObj.subcoordinadorId || null) : null,
                barrio: usuarioBarrio,
                texto: "🎯 META ASIGNADA POR ZONAL PARA " + usuarioNombre + " (+" + cantidad + " USUARIOS " +
                       (tipo === "DIARIA" ? "HOY" : "ESTE MES") + "): " + textoFinal,
                fecha: U.ahora(),
                fechaMs: U.ahoraMs()
              });

              UI.toast("META ASIGNADA EXITOSAMENTE");
              zonaForm.querySelector("#mtz-cant").value = "";
              zonaForm.querySelector("#mtz-msg").value = "";
              await pintarSeguimiento();
            } catch (e) {
              errBox.innerHTML = UI.alerta("error", e.message);
            }
            UI.cargando(false);
          });
        }

        async function pintarSeguimiento() {
          zonaLista.innerHTML = UI.cargandoTabla();
          try {
            const filas = [];
            for (let i = 0; i < equipoGlobal.length; i++) {
              const u = equipoGlobal[i];
              const resumen = await FS.resumenMetaUsuario(u.id);
              if (!resumen) continue;

              const rolTexto = u.rol === "COORDINADOR" ? "COORDINADOR" : (u.rol === "SUBCOORDINADOR" ? "SUB-COORDINADOR" : "LÍDER");
              const estadoHTML = resumen.cumplida
                ? '<span class="sello sello-verde">✅ META CUMPLIDA</span>'
                : '<span class="sello sello-rojo">FALTAN ' + resumen.faltantes + "</span>";

              const btnDatos =
                '<button class="btn btn-mini btn-azul2" data-verdatos="' + u.id +
                '" data-nombre="' + U.esc(U.UP(u.nombre)) +
                '" data-rol="' + U.esc(rolTexto) + '">VER DATOS (' + resumen.recaudados + ")</button>";

              filas.push([
                "<strong>" + U.esc(U.UP(u.nombre)) + "</strong>",
                U.esc(rolTexto),
                U.esc(U.UP(u.barrio || "—")),
                U.esc(resumen.tipo),
                String(resumen.objetivo),
                String(resumen.recaudados),
                estadoHTML,
                btnDatos
              ]);
            }

            zonaLista.innerHTML = UI.tabla(
              ["USUARIO", "ROL", "BARRIO", "PERIODO", "META TOTAL", "RECAUDADOS", "ESTADO", "DATOS"],
              filas
            );

            zonaLista.querySelectorAll("[data-verdatos]").forEach(function (b) {
              b.addEventListener("click", function () {
                Comun.verDatosUsuario(b.dataset.verdatos, b.dataset.nombre, b.dataset.rol);
              });
            });
          } catch (e) {
            zonaLista.innerHTML = UI.alerta("error", e.message);
          }
        }

        cont.querySelector("#mtz-ref").addEventListener("click", pintarSeguimiento);
        await cargar();
      }
    };
  }

  App.registrarRol("ZONAL", {
    orden: ["consolidado", "metas", "cuentas", "gestion", "mover", "mensajes"],
    vistas: {
      consolidado: vistaConsolidado(),
      metas: vistaMetasZonal(),
      cuentas: vistaCrearCuentas(),
      gestion: vistaGestionarUsuarios(),
      mover: vistaMoverLider(),
      mensajes: vistaMensajes()
    }
  });
})();