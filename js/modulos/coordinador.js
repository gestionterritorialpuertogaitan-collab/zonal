/* =====================================================================
   MÓDULO COORDINADOR — Administrador de barrio (NIVEL 3)
   ===================================================================== */
(function () {

  /* ==================================================================
     VISTA 1 — BANDEJA DE APROBACIONES
     ================================================================== */
  function vistaAprobaciones() {
    return {
      etiqueta: "BANDEJA DE APROBACIONES", icono: "✅",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("BANDEJA DE APROBACIONES", "ÚNICO AUTORIZADO PARA DECIDIR «APRUEBO» O «NIEGO». AL APROBAR, LA PETICIÓN PASA AUTOMÁTICAMENTE A PUBLICIDAD O COMPRAS.") +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR SOLICITANTE, TÍTULO, CATEGORÍA...">' +
            '<select id="f-est" class="entrada-buscar" style="max-width:220px">' +
              '<option value="">TODOS LOS ESTADOS</option>' +
              '<option value="PENDIENTE">PENDIENTES</option>' +
              '<option value="APROBADA">APROBADAS</option>' +
              '<option value="NEGADA">NEGADAS</option>' +
            "</select>" +
            '<button class="btn btn-suave" data-t="csv">EXPORTAR CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>' +
            '<button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        const filtro = barra.querySelector("#f-est");
        let datos = [];

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try { datos = await FS.peticionesDelCoordinador(App.perfil.id); pintar(); }
          catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          const est = filtro.value;
          return datos.filter(function (p) {
            if (est && p.estado !== est) return false;
            return !q || U.contiene(U.unir([p.creadoPorNombre, p.titulo, p.detalle, p.categoria]), q);
          });
        }

        function pintar() {
          const lista = filtrados();
          const pendientes = datos.filter(function (p) { return p.estado === "PENDIENTE"; }).length;

          const filas = lista.map(function (p) {
            const acciones = p.estado === "PENDIENTE"
              ? '<div class="grp-acciones">' +
                  '<button class="btn btn-mini btn-exito" data-apr="' + p.id + '">APRUEBO</button>' +
                  '<button class="btn btn-mini btn-peligro" data-nie="' + p.id + '">NIEGO</button>' +
                "</div>"
              : '<span class="menor">RESUELTA</span>';

            return [
              U.esc(U.fecha(p.fecha)),
              U.esc(U.UP(p.creadoPorNombre || "—")) + "<br><span class=\"menor\">" +
                U.esc(U.UP(p.rolCreador || "")) + "</span>",
              UI.sello(p.categoria, { COMPRAS: "naranja", PUBLICIDAD: "azul" }),
              "<strong>" + U.esc(U.UP(p.titulo)) + "</strong><br><span class=\"menor\">" +
                U.esc(U.UP(p.detalle)) + "</span>",
              UI.selloEstado(p.estado),
              UI.selloEstadoArea(p.estadoArea),
              acciones
            ];
          });

          zona.innerHTML =
            UI.resumen([
              { valor: pendientes, etiqueta: "PENDIENTES DE DECISIÓN", color: "naranja" },
              { valor: datos.filter(function (p) { return p.estado === "APROBADA"; }).length, etiqueta: "APROBADAS", color: "verde" },
              { valor: datos.filter(function (p) { return p.estado === "NEGADA"; }).length, etiqueta: "NEGADAS", color: "rojo" },
              { valor: datos.filter(function (p) { return p.estadoArea === "ENTREGADO"; }).length, etiqueta: "ENTREGADAS", color: "verde" }
            ]) +
            UI.tabla(
              ["FECHA", "SOLICITANTE", "CATEGORÍA", "TÍTULO / DETALLE", "DECISIÓN", "ESTADO ÁREA", "ACCIONES"],
              filas
            );

          zona.querySelectorAll("[data-apr]").forEach(function (b) {
            b.addEventListener("click", function () { decidir(b.dataset.apr, "APROBADA"); });
          });
          zona.querySelectorAll("[data-nie]").forEach(function (b) {
            b.addEventListener("click", function () { decidir(b.dataset.nie, "NEGADA"); });
          });
        }

        async function decidir(id, estado) {
          const etiqueta = estado === "APROBADA" ? "APROBAR" : "NEGAR";
          const ok = await UI.confirmar("¿DESEA " + etiqueta + " ESTA PETICIÓN?");
          if (!ok) return;
          UI.cargando(true);
          try {
            await FS.actualizar("peticiones", id, {
              estado: estado,
              estadoArea: estado === "APROBADA" ? "EN ESPERA" : null,
              decididoPorId: App.perfil.id,
              decididoPorNombre: App.perfil.nombre,
              fechaDecision: U.ahora()
            });
            UI.toast("PETICIÓN " + etiqueta + "DA · TRASLADO AUTOMÁTICO REALIZADO");
            await cargar();
          } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
          UI.cargando(false);
        }

        Comun.herramientas(barra, zona, {
          recargar: cargar, pintar: pintar, filtrados: filtrados,
          tituloCSV: "Bandeja_Aprobaciones",
          encabezadosCSV: ["FECHA", "SOLICITANTE", "ROL", "CATEGORIA", "TITULO", "DETALLE", "DECISION", "ESTADO AREA"],
          filaCSV: function (p) {
            return [p.fecha, p.creadoPorNombre, p.rolCreador, p.categoria, p.titulo, p.detalle, p.estado, p.estadoArea];
          }
        });

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 2 — ESTRUCTURA DE EQUIPO (ACORDEÓN + CONTEO REAL + VER DATOS)
     ================================================================== */
  function vistaEquipo() {
    return {
      etiqueta: "ESTRUCTURA DE EQUIPO", icono: "👥",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("ESTRUCTURA DE EQUIPO", "TOQUE UN SUB-COORDINADOR PARA DESPLEGAR SUS LÍDERES. CERRADO MUESTRA EL TOTAL DEL GRUPO; DESPLEGADO MUESTRA LOS PROPIOS DE CADA UNO.") +
          UI.barra(
            '<select id="f-modo" class="entrada-buscar" style="max-width:420px">' +
              '<option value="1">MODO 1 · ACORDEÓN (SUB-COORDINADORES → LÍDERES)</option>' +
              '<option value="2">MODO 2 · SOLO LÍDERES DEL BARRIO</option>' +
              '<option value="3">MODO 3 · ORDEN JERÁRQUICO COMPLETO</option>' +
            "</select>" +
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR NOMBRE O CÉDULA...">' +
            '<button class="btn btn-suave" data-t="csv">CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>' +
            '<button class="btn btn-suave" data-t="pdf">PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        const selModo = barra.querySelector("#f-modo");

        let subs = [], lideres = [], recaudaciones = [], coordinador = null;
        const abiertosSub = {};

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            coordinador = App.perfil;
            const res = await Promise.all([
              FS.equipoDelCoordinador(App.perfil.id),
              FS.recaudacionesDelCoordinador(App.perfil.id)
            ]);
            subs = res[0].subcoordinadores;
            lideres = res[0].lideres;
            recaudaciones = res[1];
            pintar();
          } catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function propiosDe(usuarioId) {
          return recaudaciones.filter(function (r) { return r.creadoPorId === usuarioId; }).length;
        }

        function grupoDeSub(subId) {
          const idsLideres = lideres.filter(function (l) { return l.subcoordinadorId === subId; })
            .map(function (l) { return l.id; });
          return recaudaciones.filter(function (r) {
            return r.creadoPorId === subId || r.subcoordinadorId === subId || idsLideres.indexOf(r.creadoPorId) !== -1;
          }).length;
        }

        function botonDatos(u, rolEtiqueta) {
          const total = propiosDe(u.id);
          return '<button type="button" class="btn btn-mini btn-exito" data-verdatos="' + u.id +
                 '" data-nombre="' + U.esc(U.UP(u.nombre)) +
                 '" data-rol="' + U.esc(rolEtiqueta) + '">VER DATOS (' + total + ")</button>";
        }

        function filtrar(lista) {
          const q = U.UP(buscador.value);
          if (!q) return lista;
          return lista.filter(function (u) {
            return U.contiene(U.unir([u.nombre, u.usuario, u.telefono, u.estado]), q);
          });
        }

        function htmlModo1() {
          const q = U.UP(buscador.value);
          const visibles = subs.filter(function (s) {
            if (!q) return true;
            if (U.contiene(U.unir([s.nombre, s.usuario, s.telefono, s.estado]), q)) return true;
            const sus = lideres.filter(function (l) { return l.subcoordinadorId === s.id; });
            return sus.some(function (l) { return U.contiene(U.unir([l.nombre, l.usuario, l.telefono]), q); });
          });

          if (!visibles.length) {
            return UI.alerta("info", "NO HAY SUB-COORDINADORES REGISTRADOS CON ESE CRITERIO.");
          }

          let h =
            '<div class="tabla-cont"><table><thead><tr>' +
              "<th>NOMBRE / ROL (TOCAR PARA DESPLEGAR)</th>" +
              "<th>CÉDULA</th>" +
              "<th>TELÉFONO</th>" +
              "<th>ESTADO</th>" +
              "<th>N.º LÍDERES</th>" +
              "<th>RECAUDAC.</th>" +
              "<th>DATOS Y META</th>" +
            "</tr></thead><tbody>";

          visibles.forEach(function (s) {
            const sus = lideres.filter(function (l) { return l.subcoordinadorId === s.id; });
            const propSub = propiosDe(s.id);
            const grpSub = grupoDeSub(s.id);
            const abierto = !!abiertosSub[s.id] || !!q;
            const flecha = abierto ? "▼" : "▶";
            const recMostrar = abierto ? propSub : grpSub;

            h +=
              '<tr style="background:#eef4ff;font-weight:700">' +
                '<td><button type="button" class="btn-acordeon" data-toggle-sub="' + s.id + '" style="background:none;border:0;padding:0;text-align:left;color:var(--azul);font-weight:900;font-size:12.5px;display:inline-flex;align-items:center;gap:6px">' +
                  '<span style="font-size:11px">' + flecha + '</span> ' +
                  '<span>' + U.esc(U.UP(s.nombre)) + '</span>' +
                '</button><br><span class=\"menor\">SUB-COORDINADOR</span></td>' +
                "<td>" + U.esc(s.usuario) + "</td>" +
                "<td>" + U.esc(s.telefono || "—") + "</td>" +
                "<td>" + UI.selloEstado(s.estado) + "</td>" +
                "<td>" + sus.length + "</td>" +
                "<td><strong>" + recMostrar + "</strong></td>" +
                "<td>" + botonDatos(s, "SUB-COORDINADOR") + "</td>" +
              "</tr>";

            if (abierto) {
              if (!sus.length) {
                h +=
                  '<tr style="background:#f9fbff"><td colspan="7" class="menor" style="padding-left:24px">' +
                    "ESTE SUB-COORDINADOR AÚN NO TIENE LÍDERES ASIGNADOS." +
                  "</td></tr>";
              } else {
                sus.forEach(function (l) {
                  if (q && !U.contiene(U.unir([l.nombre, l.usuario, l.telefono, s.nombre]), q)) return;
                  const recLid = propiosDe(l.id);
                  h +=
                    '<tr style="background:#ffffff">' +
                      '<td style="padding-left:22px">↳ <strong>LÍDER:</strong> ' + U.esc(U.UP(l.nombre)) + "</td>" +
                      "<td>" + U.esc(l.usuario) + "</td>" +
                      "<td>" + U.esc(l.telefono || "—") + "</td>" +
                      "<td>" + UI.selloEstado(l.estado) + "</td>" +
                      "<td>—</td>" +
                      "<td><strong>" + recLid + "</strong></td>" +
                      "<td>" + botonDatos(l, "LÍDER") + "</td>" +
                    "</tr>";
                });
              }
            }
          });

          const sinAsignar = lideres.filter(function (l) { return !l.subcoordinadorId; });
          if (sinAsignar.length) {
            sinAsignar.forEach(function (l) {
              if (q && !U.contiene(U.unir([l.nombre, l.usuario, l.telefono]), q)) return;
              const recLid = propiosDe(l.id);
              h +=
                '<tr style="background:#fffaf0">' +
                  '<td><strong>LÍDER (SIN SUB):</strong> ' + U.esc(U.UP(l.nombre)) + "</td>" +
                  "<td>" + U.esc(l.usuario) + "</td>" +
                  "<td>" + U.esc(l.telefono || "—") + "</td>" +
                  "<td>" + UI.selloEstado(l.estado) + "</td>" +
                  "<td>—</td>" +
                  "<td><strong>" + recLid + "</strong></td>" +
                  "<td>" + botonDatos(l, "LÍDER") + "</td>" +
                "</tr>";
            });
          }

          h += "</tbody></table></div>";
          h += '<p class="nota-tabla no-imprimir">TOTAL SUB-COORDINADORES: ' + visibles.length + " · TOTAL LÍDERES: " + lideres.length + "</p>";
          return h;
        }

        function htmlModo2() {
          const lista = filtrar(lideres);
          return UI.tabla(
            ["LÍDER", "CÉDULA", "TELÉFONO", "GRUPO (SUB-COORDINADOR)", "ESTADO", "RECAUDAC.", "DATOS Y META"],
            lista.map(function (l) {
              const sub = subs.find(function (s) { return s.id === l.subcoordinadorId; });
              return [
                U.esc(U.UP(l.nombre)),
                U.esc(l.usuario),
                U.esc(l.telefono || "—"),
                U.esc(U.UP(sub ? sub.nombre : "SIN ASIGNAR")),
                UI.selloEstado(l.estado),
                "<strong>" + propiosDe(l.id) + "</strong>",
                botonDatos(l, "LÍDER")
              ];
            })
          ) + '<p class="nota-tabla no-imprimir">TOTAL LÍDERES: ' + lista.length + "</p>";
        }

        function htmlModo3() {
          const q = U.UP(buscador.value);
          const filas = [];
          filas.push([
            "① COORDINADOR", U.esc(U.UP(coordinador.nombre)), U.esc(coordinador.usuario),
            U.esc(coordinador.telefono || "—"), U.esc(U.UP(coordinador.barrio)),
            UI.selloEstado(coordinador.estado),
            "<strong>" + propiosDe(coordinador.id) + "</strong>",
            botonDatos(coordinador, "COORDINADOR")
          ]);
          subs.forEach(function (s) {
            if (q && !U.contiene(U.unir([s.nombre, s.usuario]), q)) return;
            filas.push([
              "&nbsp;&nbsp;② SUB-COORDINADOR", U.esc(U.UP(s.nombre)), U.esc(s.usuario),
              U.esc(s.telefono || "—"), U.esc(U.UP(s.barrio)), UI.selloEstado(s.estado),
              "<strong>" + propiosDe(s.id) + "</strong>",
              botonDatos(s, "SUB-COORDINADOR")
            ]);
            lideres.filter(function (l) { return l.subcoordinadorId === s.id; }).forEach(function (l) {
              if (q && !U.contiene(U.unir([l.nombre, l.usuario]), q)) return;
              filas.push([
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;③ LÍDER", U.esc(U.UP(l.nombre)), U.esc(l.usuario),
                U.esc(l.telefono || "—"), U.esc(U.UP(l.barrio)), UI.selloEstado(l.estado),
                "<strong>" + propiosDe(l.id) + "</strong>",
                botonDatos(l, "LÍDER")
              ]);
            });
          });
          return UI.tabla(["NIVEL", "NOMBRE", "CÉDULA", "TELÉFONO", "BARRIO", "ESTADO", "RECAUDAC.", "DATOS Y META"], filas);
        }

        function pintar() {
          barra.classList.add("barra-4-col");
          const modo = selModo.value;
          if (modo === "1") zona.innerHTML = htmlModo1();
          else if (modo === "2") zona.innerHTML = htmlModo2();
          else zona.innerHTML = htmlModo3();

          zona.querySelectorAll("[data-toggle-sub]").forEach(function (b) {
            b.addEventListener("click", function () {
              const id = b.dataset.toggleSub;
              abiertosSub[id] = !abiertosSub[id];
              pintar();
            });
          });

          zona.querySelectorAll("[data-verdatos]").forEach(function (b) {
            b.addEventListener("click", function () {
              Comun.verDatosUsuario(b.dataset.verdatos, b.dataset.nombre, b.dataset.rol);
            });
          });
        }

        selModo.addEventListener("change", pintar);
        Comun.herramientas(barra, zona, {
          recargar: cargar, pintar: pintar, filtrados: function () { return filtrar(lideres); },
          tituloCSV: "Estructura_Equipo",
          encabezadosCSV: ["NIVEL", "NOMBRE", "CEDULA", "TELEFONO", "BARRIO", "ESTADO", "DATOS_RECAUDADOS"],
          filaCSV: function (l) {
            return ["LIDER", l.nombre, l.usuario, l.telefono, l.barrio, l.estado, propiosDe(l.id)];
          }
        });

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 3 — CREAR USUARIOS (SUB-COORDINADORES Y LÍDERES)
     ================================================================== */
  function vistaCrearUsuarios() {
    return {
      etiqueta: "CREAR USUARIOS", icono: "➕",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("CREAR CUENTAS DE SUB-COORDINADORES Y LÍDERES", "USUARIOS Y CONTRASEÑAS EN MAYÚSCULAS PARA SU BARRIO.") +
          '<div class="tarjeta"><h3>NUEVA CUENTA</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>CUENTAS DE MI BARRIO</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR..."></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const buscador = cont.querySelector(".entrada-buscar");
        let subs = [], todos = [];

        function opcionesSub() {
          return '<option value="">— SIN GRUPO —</option>' + subs.map(function (s) {
            return '<option value="' + s.id + '">' + U.esc(U.UP(s.nombre)) + "</option>";
          }).join("");
        }

        function pintarFormulario() {
          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<div class="dos-col">' +
                '<div class="campo"><label>ROL</label><select id="f-rol">' +
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
              '<div class="campo" id="c-sub"><label>GRUPO DEL SUB-COORDINADOR</label><select id="f-sub">' + opcionesSub() + "</select></div>" +
              '<div class="dos-col">' +
                '<div class="campo"><label>CONTRASEÑA</label><input id="f-pass" type="password"></div>' +
                '<div class="campo"><label>CONFIRMAR CONTRASEÑA</label><input id="f-pass2" type="password"></div>' +
              "</div>" +
              '<div id="f-error"></div>' +
              '<div class="acciones-form"><button class="btn btn-exito" id="btn-guardar">CREAR CUENTA</button>' +
              '<button class="btn btn-suave" id="btn-limpiar">LIMPIAR</button></div>' +
            "</div>";

          const selRol = zonaForm.querySelector("#f-rol");
          const cSub = zonaForm.querySelector("#c-sub");
          selRol.addEventListener("change", function () {
            cSub.style.display = selRol.value === "LIDER" ? "" : "none";
          });
          cSub.style.display = "none";

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
                barrio: App.perfil.barrio,
                coordinadorId: App.perfil.id,
                subcoordinadorId: selRol.value === "LIDER" ? (zonaForm.querySelector("#f-sub").value || null) : null,
                password: zonaForm.querySelector("#f-pass").value,
                confirmar: zonaForm.querySelector("#f-pass2").value
              });
              UI.toast("CUENTA CREADA EXITOSAMENTE");
              const equipo = await FS.equipoDelCoordinador(App.perfil.id);
              subs = equipo.subcoordinadores;
              pintarFormulario();
              await cargarLista();
            } catch (e) {
              errBox.innerHTML = UI.alerta("error", e.message);
            }
            UI.cargando(false);
          });
        }

        async function cargarLista() {
          try {
            const equipo = await FS.equipoDelCoordinador(App.perfil.id);
            subs = equipo.subcoordinadores;
            todos = subs.concat(equipo.lideres);
            pintarLista();
          } catch (e) { zonaLista.innerHTML = UI.alerta("error", e.message); }
        }

        function pintarLista() {
          const q = U.UP(buscador.value);
          const lista = todos.filter(function (u) {
            return !q || U.contiene(U.unir([u.nombre, u.usuario, u.rol]), q);
          });
          zonaLista.innerHTML = UI.tabla(
            ["NOMBRE", "ROL", "USUARIO / CÉDULA", "TELÉFONO", "GRUPO", "ESTADO"],
            lista.map(function (u) {
              const sub = u.rol === "LIDER" ? subs.find(function (s) { return s.id === u.subcoordinadorId; }) : null;
              return [
                U.esc(U.UP(u.nombre)),
                UI.sello(u.rol === "LIDER" ? "LÍDER" : "SUB-COORDINADOR", { "LÍDER": "gris", "SUB-COORDINADOR": "azul" }),
                U.esc(u.usuario),
                U.esc(u.telefono || "—"),
                U.esc(U.UP(sub ? sub.nombre : (u.rol === "LIDER" ? "SIN ASIGNAR" : "—"))),
                UI.selloEstado(u.estado)
              ];
            })
          );
        }

        buscador.oninput = pintarLista;

        UI.cargando(true);
        await cargarLista();
        UI.cargando(false);
        pintarFormulario();
      }
    };
  }

  /* ==================================================================
     VISTA 4 — UBICAR / MOVER LÍDERES
     ================================================================== */
  function vistaUbicar() {
    return {
      etiqueta: "UBICAR / MOVER LÍDER", icono: "🔁",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("UBICAR LÍDERES Y CAMBIAR ESTADOS", "COLOQUE CADA LÍDER EN EL GRUPO DE UN SUB-COORDINADOR O CAMBIE SU ESTADO.") +
          '<div class="tarjeta"><h3>MOVER LÍDER DE GRUPO</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>ESTADOS DEL EQUIPO</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR..."></div>' +
            '<div id="zona-est"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaEst = cont.querySelector("#zona-est");
        const buscador = cont.querySelector(".entrada-buscar");
        let subs = [], lideres = [];

        async function cargar() {
          UI.cargando(true);
          try {
            const equipo = await FS.equipoDelCoordinador(App.perfil.id);
            subs = equipo.subcoordinadores;
            lideres = equipo.lideres;
            pintarFormulario();
            pintarEstados();
          } catch (e) { zonaForm.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        }

        function pintarFormulario() {
          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<div class="dos-col">' +
                '<div class="campo"><label>LÍDER</label><select id="u-lider">' +
                  '<option value="">— SELECCIONE —</option>' +
                  lideres.map(function (l) {
                    return '<option value="' + l.id + '">' + U.esc(U.UP(l.nombre)) + "</option>";
                  }).join("") + "</select></div>" +
                '<div class="campo"><label>SUB-COORDINADOR DESTINO</label><select id="u-sub">' +
                  '<option value="">— SELECCIONE —</option>' +
                  subs.map(function (s) {
                    return '<option value="' + s.id + '">' + U.esc(U.UP(s.nombre)) + "</option>";
                  }).join("") + "</select></div>" +
              "</div>" +
              '<div id="u-info"></div>' +
              '<div class="acciones-form"><button class="btn btn-primario" id="u-guardar">GUARDAR UBICACIÓN</button></div>' +
            "</div>";

          const selL = zonaForm.querySelector("#u-lider");
          const info = zonaForm.querySelector("#u-info");

          selL.addEventListener("change", function () {
            const l = lideres.find(function (x) { return x.id === selL.value; });
            if (!l) { info.innerHTML = ""; return; }
            const sub = subs.find(function (s) { return s.id === l.subcoordinadorId; });
            info.innerHTML = UI.alerta("info",
              "GRUPO ACTUAL: " + (sub ? U.UP(sub.nombre) : "SIN ASIGNAR") +
              " · ESTADO: " + U.UP(l.estado));
            zonaForm.querySelector("#u-sub").value = l.subcoordinadorId || "";
          });

          zonaForm.querySelector("#u-guardar").addEventListener("click", async function () {
            if (!selL.value || !zonaForm.querySelector("#u-sub").value) {
              UI.toast("SELECCIONE EL LÍDER Y EL SUB-COORDINADOR", "error"); return;
            }
            const sub = subs.find(function (s) { return s.id === zonaForm.querySelector("#u-sub").value; });
            UI.cargando(true);
            try {
              await FS.actualizar("usuarios", selL.value, {
                subcoordinadorId: sub.id, coordinadorId: App.perfil.id,
                barrio: U.UP(sub.barrio || App.perfil.barrio), actualizadoEn: U.ahora()
              });
              UI.toast("LÍDER MOVIDO DE GRUPO");
              await cargar();
            } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
            UI.cargando(false);
          });
        }

        function pintarEstados() {
          function pintarLista() {
            const q = U.UP(buscador.value);
            const lista = subs.concat(lideres).filter(function (u) {
              return !q || U.contiene(U.unir([u.nombre, u.usuario, u.rol]), q);
            });
            zonaEst.innerHTML = UI.tabla(["NOMBRE", "ROL", "USUARIO", "ESTADO", "CAMBIAR ESTADO"],
              lista.map(function (u) {
                return [
                  U.esc(U.UP(u.nombre)),
                  UI.sello(u.rol === "LIDER" ? "LÍDER" : "SUB-COORDINADOR", { "LÍDER": "gris", "SUB-COORDINADOR": "azul" }),
                  U.esc(u.usuario),
                  UI.selloEstado(u.estado),
                  '<div class="grp-acciones">' +
                    '<button class="btn btn-mini btn-exito" data-est="ACTIVO" data-id="' + u.id + '">ACTIVAR</button>' +
                    '<button class="btn btn-mini btn-peligro" data-del="' + u.id + '" data-rol="' + u.rol + '" data-usuario="' + U.esc(u.usuario) + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '">ELIMINAR</button>' +
                  "</div>"
                ];
              })
            );
            zonaEst.querySelectorAll("[data-est]").forEach(function (b) {
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
            zonaEst.querySelectorAll("[data-del]").forEach(function (b) {
              b.addEventListener("click", async function () {
                const id = b.dataset.del;
                const rol = b.dataset.rol;
                const nombre = b.dataset.nombre;
                const usuario = b.dataset.usuario;

                let dependientes = 0, detalle = "";
                if (rol === "SUBCOORDINADOR") {
                  const lids = (await FS.usuarios()).filter(function (u) { return u.subcoordinadorId === id; });
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

          buscador.oninput = pintarLista;
          pintarLista();
        }

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 5 — MENSAJERÍA
     ================================================================== */
  function vistaMensajeria() {
    return {
      etiqueta: "MENSAJERÍA", icono: "💬",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("MENSAJERÍA DEL COORDINADOR", "RECIBA INSTRUCCIONES DEL ZONAL Y ENVÍE MENSAJES A SUS SUB-COORDINADORES.") +
          '<div class="tarjeta"><h3>ENVIAR MENSAJE</h3>' +
            '<div class="campo"><label>DESTINATARIO</label><select id="m-dest">' +
              '<option value="zonal">ZONAL (ESCALAMIENTO CON ADJUNTOS)</option>' +
              '<option value="publicidad">PUBLICIDAD (2A)</option>' +
              '<option value="compras">COMPRAS (2B)</option>' +
              '<option value="subs">SUB-COORDINADORES (DIRECTRIZ)</option>' +
              '<option value="lideres">LÍDERES DEL BARRIO</option>' +
              '<option value="barrio">BARRIO GENERAL</option>' +
              '<option value="persona">ENVIAR A PERSONA ESPECÍFICA</option>' +
            '</select></div>' +
            '<div id="persona-busqueda" style="display:none; margin-top:8px">' +
              '<div class="campo"><label>BUSCAR USUARIO / CÉDULA / NOMBRE</label>' +
                '<input id="m-buscar-usuario" type="text" placeholder="CÉDULA, NOMBRE O USUARIO...">' +
                '<div id="m-resultados-busqueda"></div>' +
              '</div>' +
              '<input type="hidden" id="m-persona-id" value="">' +
            '</div>' +
            '<div class="campo"><label>ASUNTO (SOLO ESCALAMIENTO)</label><input id="m-asunto" type="text" placeholder="ASUNTO DEL REPORTE..."></div>' +
            '<div class="campo"><label>TEXTO</label><textarea id="m-texto" rows="4" placeholder="ESCRIBA EL MENSAJE..."></textarea></div>' +
            '<div class="campo" id="m-archivos-campo"><label>ARCHIVOS ADJUNTOS (SOLO ESCALAMIENTO)</label>' +
              '<input id="m-archivos" type="file" multiple accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"></div>' +
            '<div id="m-error"></div>' +
            '<div class="acciones-form"><button class="btn btn-primario" id="m-enviar">ENVIAR</button></div></div>' +
          '<div class="tarjeta"><h3>MENSAJES RECIBIDOS</h3><div id="zona-rec"></div></div>' +
          '<div class="tarjeta"><h3>MENSAJES ENVIADOS</h3>' +
            '<p class="menor">LOS MENSAJES ENVIADOS NO SE MUESTRAN POR DEFECTO.</p>' +
            '<div class="acciones-form"><button class="btn btn-primario" id="btn-ver-enviados-coord">VER MENSAJES ENVIADOS</button></div></div>';

        const zonaRec = cont.querySelector("#zona-rec");
        const mDest = cont.querySelector("#m-dest");
        const personaBusqueda = cont.querySelector("#persona-busqueda");
        const mBuscarUsuario = cont.querySelector("#m-buscar-usuario");
        const mResultados = cont.querySelector("#m-resultados-busqueda");
        const mPersonaId = cont.querySelector("#m-persona-id");

        cont.querySelector("#btn-ver-enviados-coord").addEventListener("click", function () {
          App.abrirMensajesEnviadosCoord();
        });

        async function pintar() {
          UI.cargando(true);
          try {
            const res = await FS.bandejaMensajes(App.perfil);
            const recibidos = res.filter(function (m) { return !m.archivado; });

            zonaRec.innerHTML = recibidos.length
              ? recibidos.map(function (m) {
                  const al = m.alcance === "directo_coordinador" ? "DIRECTO" : "GENERAL DEL BARRIO";
                  return '<div class="mensaje"><div class="cab"><span><span class="alcance">' + al +
                    "</span> DE: " + U.esc(U.UP(m.deNombre)) + "</span><span>" +
                    U.esc(U.fecha(m.fecha)) + (m.editadoEn ? " (EDITADO)" : "") + "</span></div><div class=\"cuerpo\">" +
                    U.esc(U.UP(m.texto)) + "</div>" +
                    '<div class="grp-acciones no-imprimir" style="margin-top:6px">' +
                      '<button class="btn btn-mini btn-suave" data-arch="' + m.id + '">ARCHIVAR</button>' +
                    '</div></div>';
                }).join("")
              : '<div class="mensaje vacio-m">NO TIENE MENSAJES NUEVOS</div>';

            zonaRec.querySelectorAll("[data-arch]").forEach(function (b) {
              b.addEventListener("click", async function () {
                UI.cargando(true);
                try {
                  const todos = await FS.bandejaMensajes(App.perfil);
                  const m = todos.find(function (x) { return x.id === b.dataset.arch; });
                  await FS.actualizar("mensajes", b.dataset.arch, { archivado: !m.archivado, actualizadoEn: U.ahora() });
                  UI.toast(m.archivado ? "MENSAJE RESTAURADO" : "MENSAJE ARCHIVADO");
                  await pintar();
                } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
                UI.cargando(false);
              });
            });
          } catch (e) {
            zonaRec.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        mDest.addEventListener("change", function () {
          if (this.value === "persona") {
            personaBusqueda.style.display = "block";
            mPersonaId.value = "";
            mResultados.innerHTML = "";
          } else {
            personaBusqueda.style.display = "none";
            mPersonaId.value = "";
          }
        });

        mBuscarUsuario.addEventListener("input", async function () {
          const termino = this.value.trim();
          if (termino.length < 2) {
            mResultados.innerHTML = "";
            return;
          }
          try {
            const todos = await FS.usuarios();
            const resultados = todos.filter(function (u) {
              return U.contiene(U.unir([u.usuario, u.nombre, u.cedula || u.id]), termino);
            }).slice(0, 10);

            if (!resultados.length) {
              mResultados.innerHTML = '<div class="alerta info">NO SE ENCONTRARON USUARIOS</div>';
            } else {
              mResultados.innerHTML = resultados.map(function (u) {
                return '<div class="mensaje" style="padding:8px;cursor:pointer" data-id="' + u.id + '" data-usuario="' + U.esc(u.usuario) + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '">' +
                  '<strong>' + U.esc(U.UP(u.nombre)) + ' (' + U.esc(U.UP(u.usuario)) + ')</strong><br>' +
                  '<span class="menor">ROL: ' + U.esc(u.rol || "—") + " · BARRIO: " + U.esc(u.barrio || "—") + "</span>" +
                "</div>";
              }).join("");

              mResultados.querySelectorAll("[data-id]").forEach(function (el) {
                el.addEventListener("click", function () {
                  mPersonaId.value = this.dataset.id;
                  mBuscarUsuario.value = this.dataset.usuario + " (" + this.dataset.nombre + ")";
                  mResultados.innerHTML = "";
                });
              });
            }
          } catch (e) {
            mResultados.innerHTML = '<div class="alerta error">' + U.esc(e.message) + "</div>";
          }
        });

        cont.querySelector("#m-enviar").addEventListener("click", async function () {
          const errBox = cont.querySelector("#m-error");
          errBox.innerHTML = "";

          const dest = mDest.value;
          const personaId = mPersonaId.value;
          const asunto = U.UP(cont.querySelector("#m-asunto").value);
          const texto = U.UP(cont.querySelector("#m-texto").value);

          if (!U.requerido(texto)) { errBox.innerHTML = UI.alerta("error", "EL MENSAJE ES OBLIGATORIO"); return; }

          UI.cargando(true);
          try {
            if (dest === "persona") {
              if (!personaId) { errBox.innerHTML = UI.alerta("error", "SELECCIONE UNA PERSONA DE LA LISTA"); UI.cargando(false); return; }
              const todos = await FS.usuarios();
              const personaEncontrada = todos.find(function (u) { return u.id === personaId; });
              if (!personaEncontrada) { errBox.innerHTML = UI.alerta("error", "PERSONA NO ENCONTRADA"); UI.cargando(false); return; }

              let alcance = "directo_rol";
              let paraRol = personaEncontrada.rol || "COORDINADOR";
              let paraCoordinadorId = null;
              let barrio = U.UP(App.perfil.barrio);

              if (paraRol === "COORDINADOR") {
                paraCoordinadorId = personaEncontrada.id;
                alcance = "directo_coordinador";
                barrio = U.UP(personaEncontrada.barrio || App.perfil.barrio);
              }

              await FS.crear("mensajes", {
                alcance: alcance, deId: App.perfil.id, deNombre: App.perfil.nombre,
                paraRol: paraRol, paraCoordinadorId: paraCoordinadorId,
                barrio: barrio, texto: texto,
                fecha: U.ahora(), fechaMs: U.ahoraMs()
              });
              UI.toast("MENSAJE ENVIADO A " + U.UP(personaEncontrada.nombre));
            } else if (dest === "zonal") {
              if (!U.requerido(asunto)) { errBox.innerHTML = UI.alerta("error", "EL ASUNTO ES OBLIGATORIO PARA ESCALAMIENTO"); UI.cargando(false); return; }
              const archivos = cont.querySelector("#m-archivos").files;
              if (!archivos.length) { errBox.innerHTML = UI.alerta("error", "DEBE ADJUNTAR AL MENOS UN ARCHIVO PARA ESCALAMIENTO"); UI.cargando(false); return; }
              const id = await FS.crear("escalamientosZonal", {
                asunto: asunto, mensaje: texto, adjuntos: [],
                coordinadorId: App.perfil.id, coordinadorNombre: App.perfil.nombre,
                barrio: U.UP(App.perfil.barrio), fecha: U.ahora(), fechaMs: U.ahoraMs()
              });
              const adjuntos = await FS.subirAdjuntos(U.UP(App.perfil.barrio), App.perfil.id, id, archivos);
              await FS.actualizar("escalamientosZonal", id, { adjuntos: adjuntos });
              UI.toast("ESCALAMIENTO ENVIADO CON " + adjuntos.length + " ADJUNTO(S)");
            } else if (dest === "publicidad" || dest === "compras") {
              const rolDest = dest === "publicidad" ? "PUBLICIDAD" : "COMPRAS";
              await FS.crear("mensajes", {
                alcance: "directo_rol", deId: App.perfil.id, deNombre: App.perfil.nombre,
                paraRol: rolDest, barrio: U.UP(App.perfil.barrio), texto: texto,
                fecha: U.ahora(), fechaMs: U.ahoraMs()
              });
              UI.toast("MENSAJE ENVIADO A " + rolDest);
            } else {
              let alcance = "trabajo_sub";
              if (dest === "lideres" || dest === "barrio") alcance = "general_barrio";
              await FS.crear("mensajes", {
                alcance: alcance, deId: App.perfil.id, deNombre: App.perfil.nombre,
                paraCoordinadorId: App.perfil.id, paraSubId: null,
                barrio: U.UP(App.perfil.barrio), texto: texto,
                fecha: U.ahora(), fechaMs: U.ahoraMs()
              });
              UI.toast("MENSAJE ENVIADO");
            }
            cont.querySelector("#m-texto").value = "";
            cont.querySelector("#m-asunto").value = "";
            cont.querySelector("#m-archivos").value = "";
            mBuscarUsuario.value = "";
            mPersonaId.value = "";
            await pintar();
          } catch (e) { errBox.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        });

        await pintar();
      }
    };
  }

  /* ==================================================================
     VISTA 6 — RECAUDACIÓN DE DATOS (CRUD PROPIO)
     ================================================================== */
  function vistaRecaudacion() {
    return {
      etiqueta: "RECAUDAR DATOS", icono: "📝",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("MÓDULO DE RECAUDACIÓN DE DATOS", "CREE Y EDITE SUS PROPIOS REGISTROS CIUDADANOS.") +
          '<div id="zona-meta"></div>' +
          '<div class="tarjeta"><h3 id="tit-form">NUEVO REGISTRO</h3><div id="zona-form">' +
            Comun.formRecaudacion() +
            '<div class="acciones-form"><button class="btn btn-exito" id="rc-guardar">GUARDAR REGISTRO</button>' +
            '<button class="btn btn-suave" id="rc-nuevo">NUEVO</button></div></div></div>' +
          '<div class="tarjeta"><h3>MIS REGISTROS</h3>' +
            '<div class="barra no-imprimir"><input class="entrada-buscar" type="search" placeholder="BUSCAR..."></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        const zonaMeta = cont.querySelector("#zona-meta");
        const buscador = cont.querySelector(".entrada-buscar");
        const titForm = cont.querySelector("#tit-form");
        let editando = null;
        let propios = [];

        Comun.pintarBannerMeta(zonaMeta, App.perfil.id);

        function limpiar() {
          editando = null;
          titForm.textContent = "NUEVO REGISTRO";
          zonaForm.innerHTML = Comun.formRecaudacion() + accionForm();
          bindForm();
        }
        function accionForm() {
          return '<div class="acciones-form"><button class="btn btn-exito" id="rc-guardar">GUARDAR REGISTRO</button>' +
                 '<button class="btn btn-suave" id="rc-nuevo">NUEVO</button></div>';
        }
        function bindForm() {
          zonaForm.querySelector("#rc-guardar").addEventListener("click", guardar);
          zonaForm.querySelector("#rc-nuevo").addEventListener("click", limpiar);
        }

        async function cargar() {
          UI.cargando(true);
          try { propios = await FS.recaudacionesPropias(App.perfil.id); await Comun.pintarBannerMeta(zonaMeta, App.perfil.id, propios); pintarLista(); }
          catch (e) { zonaLista.innerHTML = UI.alerta("error", e.message); }
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
              zonaForm.innerHTML = Comun.formRecaudacion(r) + accionForm();
              bindForm();
              zonaForm.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          });
          zonaLista.querySelectorAll("[data-del]").forEach(function (b) {
            b.addEventListener("click", async function () {
              const ok = await UI.confirmar("¿DESEA BORRAR ESTE REGISTRO? ESTA ACCIÓN NO SE PUEDE DESHACER.");
              if (!ok) return;
              UI.cargando(true);
              try {
                await FS.borrar("recaudaciones", b.dataset.del);
                UI.toast("REGISTRO BORRADO");
                await cargar();
              } catch (e) { UI.toast("ERROR: " + e.message, "error"); }
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
            limpiar();
            await cargar();
          } catch (e) { errBox.innerHTML = UI.alerta("error", e.message); }
          UI.cargando(false);
        }

        buscador.oninput = pintarLista;
        bindForm();
        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 7 — TABLA CONSOLIDADA DE RECAUDACIÓN (FILTRO POR SUB Y LÍDER)
     ================================================================== */
  function vistaConsolidadoRecaudacion() {
    return {
      etiqueta: "RECAUDACIÓN CONSOLIDADA", icono: "📊",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("TABLA CONSOLIDADA DE RECAUDACIÓN", "SELECCIONE UN SUB-COORDINADOR O LÍDER PARA VER SUS REGISTROS SIN DESORDEN.") +
          '<div class="tarjeta" style="margin-bottom:12px">' +
            '<div class="dos-col">' +
              '<div class="campo"><label>1 · SUB-COORDINADOR</label>' +
                '<select id="fc-sub"><option value="">— SELECCIONE SUB-COORDINADOR —</option></select>' +
              '</div>' +
              '<div class="campo"><label>2 · LÍDER DEL GRUPO</label>' +
                '<select id="fc-lider" disabled><option value="">— TODOS LOS DEL SUB —</option></select>' +
              '</div>' +
            '</div>' +
          '</div>' +
          UI.barra(
            '<input class="entrada-buscar" type="search" placeholder="BUSCAR NOMBRE, CÉDULA, DIRECCIÓN, SOLICITUD...">' +
            '<button class="btn btn-suave" data-t="csv">EXPORTAR CSV</button>' +
            '<button class="btn btn-suave" data-t="print">IMPRIMIR</button>' +
            '<button class="btn btn-suave" data-t="pdf">DESCARGAR PDF</button>' +
            '<button class="btn btn-primario" data-t="ref">ACTUALIZAR</button>'
          ) + '<div id="zona"></div>';

        const zona = cont.querySelector("#zona");
        const barra = cont.querySelector(".barra");
        const buscador = barra.querySelector(".entrada-buscar");
        const selSub = cont.querySelector("#fc-sub");
        const selLider = cont.querySelector("#fc-lider");

        let todos = [], subs = [], lideres = [];

        async function cargar() {
          zona.innerHTML = UI.cargandoTabla();
          try {
            const res = await Promise.all([
              FS.recaudacionesDelCoordinador(App.perfil.id),
              FS.equipoDelCoordinador(App.perfil.id)
            ]);
            todos = res[0];
            subs = res[1].subcoordinadores;
            lideres = res[1].lideres;

            const subPrevio = selSub.value;
            selSub.innerHTML =
              '<option value="">— SELECCIONE SUB-COORDINADOR —</option>' +
              '<option value="__TODOS__">📋 VER TODOS LOS REGISTROS (' + todos.length + ")</option>" +
              '<option value="__PROPIOS__">👤 SOLO MIS REGISTROS (COORDINADOR)</option>' +
              subs.map(function (s) {
                return '<option value="' + s.id + '">' + U.esc(U.UP(s.nombre)) + "</option>";
              }).join("");
            if (subPrevio) selSub.value = subPrevio;
            actualizarSelectLideres();
            pintar();
          } catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function actualizarSelectLideres() {
          const subId = selSub.value;
          const liderPrevio = selLider.value;

          if (!subId || subId === "__PROPIOS__") {
            selLider.innerHTML = '<option value="">— NO APLICA —</option>';
            selLider.disabled = true;
            return;
          }

          if (subId === "__TODOS__") {
            selLider.disabled = false;
            selLider.innerHTML =
              '<option value="">— TODOS LOS LÍDERES —</option>' +
              lideres.map(function (l) {
                return '<option value="' + l.id + '">' + U.esc(U.UP(l.nombre)) + "</option>";
              }).join("");
          } else {
            const sub = subs.find(function (s) { return s.id === subId; });
            const lideresDelSub = lideres.filter(function (l) { return l.subcoordinadorId === subId; });
            selLider.disabled = false;
            selLider.innerHTML =
              '<option value="">— TODO EL GRUPO DE ' + U.esc(U.UP(sub ? sub.nombre : "SUB")) + " —</option>" +
              '<option value="__SOLO_SUB__">👤 SOLO DEL SUB-COORDINADOR</option>' +
              lideresDelSub.map(function (l) {
                return '<option value="' + l.id + '">' + U.esc(U.UP(l.nombre)) + "</option>";
              }).join("");
          }

          if (liderPrevio && Array.from(selLider.options).some(function (o) { return o.value === liderPrevio; })) {
            selLider.value = liderPrevio;
          }
        }

        function filtrados() {
          const subId = selSub.value;
          const liderId = selLider.value;
          const q = U.UP(buscador.value);

          // Si no se ha elegido nada y tampoco hay búsqueda de texto, no mostrar tabla desordenada
          if (!subId && !q) return [];

          return todos.filter(function (r) {
            if (subId === "__PROPIOS__") {
              if (r.creadoPorId !== App.perfil.id) return false;
            } else if (subId === "__TODOS__") {
              if (liderId && r.creadoPorId !== liderId) return false;
            } else if (subId) {
              if (liderId === "__SOLO_SUB__") {
                if (r.creadoPorId !== subId) return false;
              } else if (liderId) {
                if (r.creadoPorId !== liderId) return false;
              } else {
                // Todo el grupo de ese sub-coordinador (él mismo + sus líderes)
                const perteneceAlGrupo = (r.subcoordinadorId === subId) || (r.creadoPorId === subId);
                if (!perteneceAlGrupo) return false;
              }
            }

            if (!q) return true;
            return U.contiene(U.unir([r.nombres, r.cedula, r.telefono, r.direccion, r.solicitud, r.creadoPorNombre]), q);
          });
        }

        function pintar() {
          barra.classList.add("barra-4-col");
          const subId = selSub.value;
          const q = U.UP(buscador.value);

          if (!subId && !q) {
            zona.innerHTML = UI.alerta("info", "SELECCIONE UN SUB-COORDINADOR ARRIBA PARA VER LOS LÍDERES Y SUS REGISTROS RECAUDADOS.");
            return;
          }

          const lista = filtrados();
          const porRol = {};
          lista.forEach(function (r) { porRol[r.rolCreador || "—"] = (porRol[r.rolCreador || "—"] || 0) + 1; });

          zona.innerHTML =
            UI.resumen(Object.keys(porRol).map(function (k) {
              return { valor: porRol[k], etiqueta: "POR " + k };
            }).concat([{ valor: lista.length, etiqueta: "REGISTROS FILTRADOS", color: "verde" }])) +
            UI.tabla(Comun.columnasRecaudacion,
              lista.map(function (r) { return Comun.filaRecaudacion(r, r.creadoPorId === App.perfil.id); }));
        }

        selSub.addEventListener("change", function () {
          actualizarSelectLideres();
          pintar();
        });
        selLider.addEventListener("change", pintar);

        Comun.herramientas(barra, zona, {
          recargar: cargar, pintar: pintar, filtrados: filtrados,
          tituloCSV: "Recaudacion_Consolidada",
          encabezadosCSV: ["NOMBRES", "CEDULA", "TELEFONO", "DIRECCION", "SOLICITUD", "REGISTRO", "ROL", "FECHA"],
          filaCSV: function (r) {
            return [r.nombres, r.cedula, r.telefono, r.direccion, r.solicitud, r.creadoPorNombre, r.rolCreador, r.fecha];
          }
        });

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 8 — QUEJAS Y SOLICITUDES RECIBIDAS
     ================================================================== */
  function vistaQuejas() {
    return {
      etiqueta: "QUEJAS RECIBIDAS", icono: "⚠️",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("QUEJAS Y SOLICITUDES RECIBIDAS", "REPORTES DE SUS SUB-COORDINADORES Y LÍDERES.") +
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
          try { todos = await FS.quejasDelCoordinador(App.perfil.id); pintar(); }
          catch (e) { zona.innerHTML = UI.alerta("error", e.message); }
        }

        function filtrados() {
          const q = U.UP(buscador.value);
          if (!q) return todos;
          return todos.filter(function (x) {
            return U.contiene(U.unir([x.tipo, x.mensaje, x.creadoPorNombre, x.rolCreador]), q);
          });
        }

        function pintar() {
          zona.innerHTML = UI.tabla(
            ["FECHA", "TIPO", "MENSAJE", "DE (NOMBRE)", "ROL"],
            filtrados().map(function (x) {
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

        Comun.herramientas(barra, zona, {
          recargar: cargar, pintar: pintar, filtrados: filtrados,
          tituloCSV: "Quejas_Coordinador",
          encabezadosCSV: ["FECHA", "TIPO", "MENSAJE", "DE", "ROL"],
          filaCSV: function (x) { return [x.fecha, x.tipo, x.mensaje, x.creadoPorNombre, x.rolCreador]; }
        });

        await cargar();
      }
    };
  }

  /* ==================================================================
     VISTA 9 — ASIGNAR METAS DE RECAUDACIÓN (DÍA / MES, ACUMULATIVAS)
     ================================================================== */
  function vistaMetas() {
    return {
      etiqueta: "METAS", icono: "🎯",
      async pintar(cont) {
        cont.innerHTML =
          UI.encabezado("ASIGNAR METAS DE RECAUDACIÓN", "DEFINA METAS POR DÍA O POR MES PARA SUS SUB-COORDINADORES Y LÍDERES. SI ASIGNA VARIAS METAS EN EL MISMO PERIODO, SE SUMAN AUTOMÁTICAMENTE.") +
          '<div class="tarjeta"><h3>NUEVA META</h3><div id="zona-form"></div></div>' +
          '<div class="tarjeta"><h3>SEGUIMIENTO DE METAS DEL EQUIPO</h3>' +
            '<div class="barra no-imprimir"><button class="btn btn-primario" id="mt-ref">ACTUALIZAR</button></div>' +
            '<div id="zona-lista"></div></div>';

        const zonaForm = cont.querySelector("#zona-form");
        const zonaLista = cont.querySelector("#zona-lista");
        let subs = [], lideres = [];

        async function cargar() {
          UI.cargando(true);
          try {
            const equipo = await FS.equipoDelCoordinador(App.perfil.id);
            subs = equipo.subcoordinadores;
            lideres = equipo.lideres;
            pintarFormulario();
            await pintarSeguimiento();
          } catch (e) {
            zonaForm.innerHTML = UI.alerta("error", e.message);
          }
          UI.cargando(false);
        }

        function pintarFormulario() {
          const todosEquipo = subs.map(function (s) {
            return { id: s.id, nombre: s.nombre, rol: "SUBCOORDINADOR", etiqueta: "SUB-COORD · " + s.nombre };
          }).concat(lideres.map(function (l) {
            return { id: l.id, nombre: l.nombre, rol: "LIDER", etiqueta: "LÍDER · " + l.nombre };
          }));

          zonaForm.innerHTML =
            '<div class="formulario">' +
              '<div class="campo"><label>SUB-COORDINADOR O LÍDER</label><select id="mt-usuario">' +
                '<option value="">— SELECCIONE INTEGRANTE —</option>' +
                todosEquipo.map(function (u) {
                  return '<option value="' + u.id + '" data-rol="' + u.rol + '" data-nombre="' + U.esc(U.UP(u.nombre)) + '">' +
                         U.esc(U.UP(u.etiqueta)) + "</option>";
                }).join("") +
              "</select></div>" +
              '<div class="dos-col">' +
                '<div class="campo"><label>PERIODICIDAD</label><select id="mt-tipo">' +
                  '<option value="DIARIA">POR DÍA (HOY)</option>' +
                  '<option value="MENSUAL">POR MES (ESTE MES)</option>' +
                "</select></div>" +
                '<div class="campo"><label>CANTIDAD A SUMAR</label><input id="mt-cant" type="number" min="1" placeholder="EJ: 10"></div>' +
              "</div>" +
              '<div class="campo"><label>MENSAJE / INSTRUCCIÓN DE META</label>' +
                '<textarea id="mt-msg" rows="3" placeholder="EJ: META DE RECAUDACIÓN DEL DÍA..."></textarea></div>' +
              '<div id="mt-error"></div>' +
              '<div class="acciones-form"><button class="btn btn-exito" id="mt-guardar">ASIGNAR META</button></div>' +
            "</div>";

          zonaForm.querySelector("#mt-guardar").addEventListener("click", async function () {
            const errBox = zonaForm.querySelector("#mt-error");
            errBox.innerHTML = "";

            const sel = zonaForm.querySelector("#mt-usuario");
            const usuarioId = sel.value;
            const tipo = zonaForm.querySelector("#mt-tipo").value;
            const cantidad = parseInt(zonaForm.querySelector("#mt-cant").value, 10);
            const mensaje = U.UP(zonaForm.querySelector("#mt-msg").value);

            if (!usuarioId) { errBox.innerHTML = UI.alerta("error", "SELECCIONE EL SUB-COORDINADOR O LÍDER"); return; }
            if (!cantidad || cantidad < 1) { errBox.innerHTML = UI.alerta("error", "DIGITE UNA CANTIDAD VÁLIDA (MÍNIMO 1)"); return; }

            const opt = sel.options[sel.selectedIndex];
            const usuarioNombre = opt.dataset.nombre;
            const usuarioRol = opt.dataset.rol;
            const clavePeriodo = FS.clavePeriodoMeta(tipo);
            const textoFinal = mensaje || ("META " + (tipo === "DIARIA" ? "DIARIA" : "MENSUAL") + " DE " + cantidad + " USUARIOS RECAUDADOS");

            UI.cargando(true);
            try {
              await FS.crear("metas", {
                coordinadorId: App.perfil.id,
                coordinadorNombre: App.perfil.nombre,
                barrio: U.UP(App.perfil.barrio),
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

              const subTarget = usuarioRol === "LIDER"
                ? (lideres.find(function (l) { return l.id === usuarioId; }) || {}).subcoordinadorId || null
                : null;

              await FS.crear("mensajes", {
                alcance: usuarioRol === "SUBCOORDINADOR" ? "trabajo_sub" : "grupo_lideres",
                deId: App.perfil.id,
                deNombre: App.perfil.nombre,
                paraCoordinadorId: App.perfil.id,
                paraSubId: subTarget,
                barrio: U.UP(App.perfil.barrio),
                texto: "🎯 NUEVA META ASIGNADA PARA " + usuarioNombre + " (+" + cantidad + " USUARIOS " +
                       (tipo === "DIARIA" ? "HOY" : "ESTE MES") + "): " + textoFinal,
                fecha: U.ahora(),
                fechaMs: U.ahoraMs()
              });

              UI.toast("META ASIGNADA Y SUMADA EXITOSAMENTE");
              zonaForm.querySelector("#mt-cant").value = "";
              zonaForm.querySelector("#mt-msg").value = "";
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
            const todosEquipo = subs.concat(lideres);
            const filas = [];

            for (let i = 0; i < todosEquipo.length; i++) {
              const u = todosEquipo[i];
              const resumen = await FS.resumenMetaUsuario(u.id);
              if (!resumen) continue;

              const rolTexto = u.rol === "SUBCOORDINADOR" ? "SUB-COORDINADOR" : "LÍDER";
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
                U.esc(resumen.tipo),
                String(resumen.objetivo),
                String(resumen.recaudados),
                estadoHTML,
                btnDatos
              ]);
            }

            zonaLista.innerHTML = UI.tabla(
              ["USUARIO", "ROL", "PERIODO", "META TOTAL", "RECAUDADOS", "ESTADO", "DATOS"],
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

        cont.querySelector("#mt-ref").addEventListener("click", pintarSeguimiento);
        await cargar();
      }
    };
  }

  /* ==================================================================
     MENSAJES ENVIADOS (MODAL)
     ================================================================== */
  App.abrirMensajesEnviadosCoord = async function () {
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
            return '<div class="mensaje"><div class="cab"><span>BARRIO: ' +
              U.esc(U.UP(m.barrio || "")) + "</span><span>" + U.esc(U.fecha(m.fecha)) + (m.editadoEn ? " (EDITADO)" : "") + "</span></div>" +
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
     REGISTRO DEL MÓDULO
     ================================================================== */
  App.registrarRol("COORDINADOR", {
    orden: ["aprobaciones", "metas", "equipo", "crear", "ubicar", "mensajeria",
            "recaudacion", "consolidado", "quejas"],
    vistas: {
      aprobaciones: vistaAprobaciones(),
      metas: vistaMetas(),
      equipo: vistaEquipo(),
      crear: vistaCrearUsuarios(),
      ubicar: vistaUbicar(),
      mensajeria: vistaMensajeria(),
      recaudacion: vistaRecaudacion(),
      consolidado: vistaConsolidadoRecaudacion(),
      quejas: vistaQuejas()
    }
  });
})();