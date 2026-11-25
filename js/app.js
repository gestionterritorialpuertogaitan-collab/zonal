/* =====================================================================
   APLICACIÓN MÓVIL — Enrutador, barra inferior, sesión y arranque
   ===================================================================== */

App.ir = function (idVista) {
  const perfil = App.perfil;
  if (!perfil) return;
  const def = App.roles[perfil.rol];
  if (!def) return;

  let vista = idVista;
  if (!vista || !def.vistas[vista]) vista = def.orden[0];
  App.vistaActual = vista;

  document.querySelectorAll("#menu-lateral .menu-btn").forEach(function (b) {
    b.classList.toggle("activo", b.dataset.vista === vista);
  });
  document.querySelectorAll("#nav-inferior .nav-inf-btn[data-vista]").forEach(function (b) {
    b.classList.toggle("activo", b.dataset.vista === vista);
  });

  const cont = document.getElementById("contenido");
  cont.innerHTML = UI.cargandoTabla();

  try {
    def.vistas[vista].pintar(cont, perfil);
  } catch (e) {
    console.error(e);
    cont.innerHTML = UI.alerta("error", "ERROR AL CARGAR LA VISTA: " + e.message);
  }

  document.body.classList.remove("menu-abierto");
  document.getElementById("capa-menu").classList.add("oculto");
  window.scrollTo(0, 0);
};

App.pintarMenu = function () {
  const perfil = App.perfil;
  const def = App.roles[perfil.rol];
  const nav = document.getElementById("menu-lateral");
  const navInf = document.getElementById("nav-inferior");

  if (!def) {
    nav.innerHTML = '<div class="menu-titulo">MÓDULO NO DISPONIBLE</div>';
    if (navInf) navInf.innerHTML = "";
    return;
  }

  // 1. Cajón desplegable ("MÁS")
  let h = '<div class="menu-titulo">' + U.esc(perfil.rol) +
          (perfil.barrio ? " · " + U.esc(U.UP(perfil.barrio)) : "") + "</div>";
  def.orden.forEach(function (id) {
    const v = def.vistas[id];
    h += '<button class="menu-btn" data-vista="' + id + '">' +
         '<span class="ico">' + (v.icono || "▸") + "</span>" +
         "<span>" + U.esc(v.etiqueta) + "</span></button>";
  });
  nav.innerHTML = h;
  nav.querySelectorAll(".menu-btn").forEach(function (b) {
    b.addEventListener("click", function () { App.ir(b.dataset.vista); });
  });

  // 2. Barra inferior fija
  if (navInf) {
    const maxDirectos = def.orden.length > 5 ? 4 : def.orden.length;
    const directos = def.orden.slice(0, maxDirectos);
    let hInf = "";

    directos.forEach(function (id) {
      const v = def.vistas[id];
      const corto = U.UP(v.etiqueta).replace(/^\d+\s*·\s*/, "").split(" ")[0];
      hInf += '<button class="nav-inf-btn" data-vista="' + id + '">' +
              '<span class="ico">' + (v.icono || "▸") + "</span>" +
              "<span>" + U.esc(corto) + "</span></button>";
    });

    if (def.orden.length > 5) {
      hInf += '<button class="nav-inf-btn" id="btn-nav-mas">' +
              '<span class="ico">☰</span><span>MÁS</span></button>';
    }

    navInf.innerHTML = hInf;
    navInf.querySelectorAll("[data-vista]").forEach(function (b) {
      b.addEventListener("click", function () { App.ir(b.dataset.vista); });
    });

    const btnMas = document.getElementById("btn-nav-mas");
    if (btnMas) {
      btnMas.addEventListener("click", function () {
        const abierto = document.body.classList.toggle("menu-abierto");
        document.getElementById("capa-menu").classList.toggle("oculto", !abierto);
      });
    }
  }
};

App.pintarBloqueo = function (perfil) {
  const motivo = perfil.estado === "PAUSADO" ? "PAUSADA" : "SUSPENDIDA";
  document.getElementById("menu-lateral").innerHTML = "";
  const navInf = document.getElementById("nav-inferior");
  if (navInf) navInf.innerHTML = "";
  document.getElementById("contenido").innerHTML =
    '<div class="aviso-bloqueo">' +
      '<div class="simbolo">⛔</div>' +
      '<h2>CUENTA ' + motivo + '</h2>' +
      '<div class="estado-glyph"><span class="sello sello-grande sello-' +
        (perfil.estado === "PAUSADO" ? "naranja" : "rojo") + '">' + U.esc(perfil.estado) + "</span></div>" +
      "<p>SU CUENTA <strong>" + U.esc(perfil.nombre) + "</strong> (ROL " + U.esc(perfil.rol) +
        ") ESTÁ " + motivo + " POR EL COORDINADOR O EL ZONAL.</p>" +
      "<p>LOS MÓDULOS DE LA APLICACIÓN QUEDAN BLOQUEADOS HASTA QUE SU CUENTA SEA REACTIVADA.</p>" +
      '<p class="menor">CONTACTE A SU COORDINADOR DE BARRIO O AL ZONAL PARA RESOLVER LA SITUACIÓN.</p>' +
      '<div class="acciones-form" style="margin-top:16px">' +
        '<button class="btn btn-peligro" id="btn-salir-bloqueo">CERRAR SESIÓN</button>' +
      "</div>" +
    "</div>";
  const b = document.getElementById("btn-salir-bloqueo");
  if (b) b.addEventListener("click", function () { Auth.salir(); });
};

App._timerInactividad = null;
App._ultimaActividad = Date.now();
App.TIEMPO_INACTIVIDAD = 30 * 60 * 1000; // 30 minutos de inactividad real

App.reiniciarInactividad = function () {
  if (!App.perfil) return;
  App._ultimaActividad = Date.now();
  if (App._timerInactividad) clearTimeout(App._timerInactividad);
  App._timerInactividad = setTimeout(function () {
    if (App.perfil && (Date.now() - App._ultimaActividad >= App.TIEMPO_INACTIVIDAD)) {
      UI.toast("SESIÓN CERRADA POR INACTIVIDAD", "error");
      Auth.salir();
    }
  }, App.TIEMPO_INACTIVIDAD);
};
App.detenerInactividad = function () {
  if (App._timerInactividad) { clearTimeout(App._timerInactividad); App._timerInactividad = null; }
};

App._timerRefresh = null;
App.iniciarAutoRefresh = function () {
  App.detenerAutoRefresh();
  App._timerRefresh = setInterval(function () {
    if (!App.perfil) return;
    try { App.ir(App.vistaActual); } catch (e) { /* nada */ }
    App.verificarMensajesNoLeidos();
  }, 15 * 60 * 1000);
};

App.detenerAutoRefresh = function () {
  if (App._timerRefresh) { clearInterval(App._timerRefresh); App._timerRefresh = null; }
};

App.CLAVE_ULTIMO_VISTO = "gt_ultimo_visto_";

App.ultimoVistoMs = function () {
  if (!App.perfil) return 0;
  try {
    const v = localStorage.getItem(App.CLAVE_ULTIMO_VISTO + App.perfil.id);
    return v ? parseInt(v, 10) : 0;
  } catch (e) { return 0; }
};

App.marcarMensajesVistos = function () {
  if (!App.perfil) return;
  try { localStorage.setItem(App.CLAVE_ULTIMO_VISTO + App.perfil.id, String(Date.now())); } catch (e) { /* nada */ }
  App.actualizarCampana(0);
};

App.actualizarCampana = function (cantidad) {
  const badge = document.getElementById("badge-campana");
  if (!badge) return;
  if (cantidad > 0) {
    badge.textContent = cantidad > 99 ? "99+" : String(cantidad);
    badge.classList.remove("oculto");
  } else {
    badge.classList.add("oculto");
    badge.textContent = "0";
  }
};

App.verificarMensajesNoLeidos = async function () {
  if (!App.perfil) return;
  if (App.perfil.rol === "ZONAL") { App.actualizarCampana(0); return; }
  try {
    const lista = await FS.bandejaMensajes(App.perfil);
    const ultimo = App.ultimoVistoMs();
    const noLeidos = lista.filter(function (m) { return (m.fechaMs || 0) > ultimo; });
    App.actualizarCampana(noLeidos.length);
    App._mensajesNoLeidos = noLeidos;
  } catch (e) { /* silencioso */ }
};

App.abrirCampana = async function () {
  if (!App.perfil) return;
  if (App.perfil.rol === "ZONAL") {
    UI.toast("EL ZONAL NO RECIBE MENSAJES", "info");
    return;
  }
  UI.cargando(true);
  try {
    const lista = await FS.bandejaMensajes(App.perfil);
    const ultimo = App.ultimoVistoMs();
    const noLeidos = lista.filter(function (m) { return (m.fechaMs || 0) > ultimo; });
    const aMostrar = noLeidos.length ? noLeidos : lista.slice(0, 20);

    const html = aMostrar.length
      ? aMostrar.map(function (m) {
          const al = m.alcance === "directo_coordinador" ? "DIRECTO" : "GENERAL DEL BARRIO";
          return '<div class="mensaje"><div class="cab"><span><span class="alcance">' + al +
            "</span> DE: " + U.esc(U.UP(m.deNombre)) + "</span><span>" + U.esc(U.fecha(m.fecha)) + "</span></div>" +
            '<div class="cuerpo">' + U.esc(U.UP(m.texto)) + "</div></div>";
        }).join("")
      : '<div class="mensaje vacio-m">NO TIENE MENSAJES NUEVOS</div>';

    UI.abrirModal("MENSAJES NUEVOS", html, [{ texto: "CERRAR", clase: "btn-primario" }]);
    App.marcarMensajesVistos();
  } catch (e) {
    UI.toast("ERROR: " + e.message, "error");
  }
  UI.cargando(false);
};

App.entrarApp = function () {
  const perfil = App.perfil;
  document.getElementById("pantalla-login").classList.add("oculto");
  document.getElementById("pantalla-app").classList.remove("oculto");

  const usuLinea = document.getElementById("topbar-usuario-linea");
  if (usuLinea) {
    usuLinea.textContent = U.UP(perfil.nombre || perfil.usuario) + " · " +
      U.UP(perfil.rol) + (perfil.barrio ? " (" + U.UP(perfil.barrio) + ")" : "");
  }

  if (perfil.rol !== "ZONAL" && perfil.estado !== "ACTIVO") {
    App.pintarBloqueo(perfil);
    return;
  }
  const elNom = document.getElementById("topbar-primer-nombre");
  const elRol = document.getElementById("topbar-rol-corto");
  if (elNom && elRol) {
    const partesNombre = String(perfil.nombre || perfil.usuario || "").trim().split(/\s+/);
    elNom.textContent = U.UP(partesNombre[0] || "USUARIO");
    elRol.textContent = perfil.rol === "SUBCOORDINADOR" ? "SUB-COORD" : U.UP(perfil.rol || "");
  }

  App.pintarMenu();
  App.ir(App.vistaActual);
  App.reiniciarInactividad();
  App.verificarMensajesNoLeidos();
  App.iniciarAutoRefresh();
};

App.mostrarLogin = function () {
  App.detenerInactividad();
  App.detenerAutoRefresh();
  document.getElementById("pantalla-app").classList.add("oculto");
  document.getElementById("pantalla-login").classList.remove("oculto");
  const err = document.getElementById("login-error");
  if (err) err.classList.add("oculto");
  const form = document.getElementById("form-login");
  if (form) form.reset();
  const inputPass = document.getElementById("login-password");
  if (inputPass) inputPass.type = "password";
  const btnOjo = document.getElementById("btn-ojo");
  if (btnOjo) {
    btnOjo.classList.remove("visible");
    btnOjo.setAttribute("aria-pressed", "false");
  }
};

App.abrirCambiarMiPassword = function () {
  UI.abrirModal("CAMBIAR MI CONTRASEÑA",
    '<div class="formulario">' +
      '<div class="campo"><label>CONTRASEÑA ACTUAL</label><input id="mc-actual" type="password"></div>' +
      '<div class="campo"><label>NUEVA CONTRASEÑA</label><input id="mc-nueva" type="password"></div>' +
      '<div class="campo"><label>CONFIRMAR NUEVA CONTRASEÑA</label><input id="mc-conf" type="password"></div>' +
      '<div id="mc-error"></div>' +
    '</div>',
    [
      { texto: "CANCELAR", clase: "btn-suave" },
      { texto: "GUARDAR", clase: "btn-primario", onClick: async function () {
          const errBox = document.getElementById("mc-error");
          errBox.innerHTML = "";
          UI.cargando(true);
          try {
            await Auth.cambiarMiPassword(
              document.getElementById("mc-actual").value,
              document.getElementById("mc-nueva").value,
              document.getElementById("mc-conf").value
            );
            UI.toast("CONTRASEÑA ACTUALIZADA EXITOSAMENTE", "ok");
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
};

App.restaurarSesion = async function (perfilGuardado, authUser) {
  try {
    const actual = await FS.obtener("usuarios", perfilGuardado.id);
    if (!actual) {
      Auth.borrarSesion();
      App.mostrarLogin();
      return;
    }
    App.perfil = actual;
    App.authUser = authUser;
    App.entrarApp();
  } catch (e) {
    console.error("SESIÓN:", e);
    App.perfil = perfilGuardado;
    App.entrarApp();
  }
};

document.addEventListener("DOMContentLoaded", function () {
  U.instalarMayusculas();
  Auth.init();

  const capaMenu = document.getElementById("capa-menu");
  if (capaMenu) {
    capaMenu.addEventListener("click", function () {
      document.body.classList.remove("menu-abierto");
      this.classList.add("oculto");
    });
  }

  document.getElementById("btn-salir").addEventListener("click", function () {
    UI.confirmar("¿DESEA CERRAR LA SESIÓN ACTUAL?").then(function (ok) {
      if (ok) Auth.salir();
    });
  });

  const btnMiClave = document.getElementById("btn-mi-clave");
  if (btnMiClave) btnMiClave.addEventListener("click", function () {
    App.abrirCambiarMiPassword();
  });

  const btnCampana = document.getElementById("btn-campana");
  if (btnCampana) btnCampana.addEventListener("click", function () {
    App.abrirCampana();
  });

  ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll", "click"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (App.perfil) App.reiniciarInactividad();
    }, { passive: true });
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && App.perfil) {
      App.reiniciarInactividad();
    }
  });

  let primerEstado = true;

  firebase.auth().onAuthStateChanged(async function (user) {
    const guardado = Auth.leerSesion();

    if (primerEstado) {
      primerEstado = false;

      if (App.configOk && !user) {
        try {
          await firebase.auth().signInAnonymously();
        } catch (e) {
          console.warn("SESIÓN ANÓNIMA NO DISPONIBLE:", e.code, e.message);
        }
      }

      if (App.configOk) {
        try {
          const r = await Seed.crearZonalInicial();
          if (r.estado === "creado") {
            UI.toast("CUENTA ZONAL CREADA: " + r.usuario, "ok");
          } else if (r.estado === "error") {
            console.warn("SEMBRADO:", r.mensaje);
          }
        } catch (e) {
          console.warn("SEMBRADO:", e);
        }
      }
    }

    if (guardado) {
      await App.restaurarSesion(guardado, user);
    } else {
      App.mostrarLogin();
    }
  });
});