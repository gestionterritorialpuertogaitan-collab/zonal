/* =====================================================================
   ALERTA SONORA Y VIBRACIÓN AL RECIBIR MENSAJES EN CUALQUIER CUENTA
   ===================================================================== */
(function () {
  const VISTOS_PREFIX = "rz_msgs_vistos_";
  let audioCtx = null;
  let intervaloVigilancia = null;
  let verificando = false;

  function obtenerAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function reproducirSonidoMensaje() {
    try {
      const ctx = obtenerAudioContext();
      if (!ctx) return;

      const ahora = ctx.currentTime;
      const notas = [783.99, 1046.5]; // Sol5 -> Do6 (campanilla corta y clara)

      notas.forEach(function (frec, idx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frec, ahora + idx * 0.13);

        gain.gain.setValueAtTime(0.0001, ahora + idx * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.18, ahora + idx * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ahora + idx * 0.13 + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ahora + idx * 0.13);
        osc.stop(ahora + idx * 0.13 + 0.26);
      });
    } catch (e) {
      // Ignorar si el navegador bloquea el audio antes de interactuar
    }
  }

  function vibrarDispositivo() {
    try {
      if (navigator && typeof navigator.vibrate === "function") {
        navigator.vibrate([180, 90, 180]);
      }
    } catch (e) {
      // Ignorar en equipos sin vibración
    }
  }

  function leerVistos(usuarioId) {
    try {
      const raw = localStorage.getItem(VISTOS_PREFIX + usuarioId);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function guardarVistos(usuarioId, ids) {
    try {
      localStorage.setItem(VISTOS_PREFIX + usuarioId, JSON.stringify(ids.slice(-300)));
    } catch (e) {}
  }

  async function revisarMensajesNuevos() {
    if (verificando) return;
    if (!window.App || !App.perfil || !App.perfil.id) return;
    if (!window.FS || typeof FS.bandejaMensajes !== "function") return;

    verificando = true;
    try {
      const perfil = App.perfil;
      const mensajes = await FS.bandejaMensajes(perfil);
      if (!Array.isArray(mensajes)) return;

      const activos = mensajes.filter(function (m) { return m && m.id && !m.archivado; });
      const idsActuales = activos.map(function (m) { return String(m.id); });
      const claveVistos = VISTOS_PREFIX + perfil.id;
      const yaInicializado = localStorage.getItem(claveVistos) !== null;
      const vistosSet = new Set(leerVistos(perfil.id));

      if (!yaInicializado) {
        // Primera carga de la sesión en este navegador: registrar estado actual sin alarmar
        guardarVistos(perfil.id, idsActuales);
        return;
      }

      const nuevos = activos.filter(function (m) {
        return !vistosSet.has(String(m.id)) && String(m.deId || "") !== String(perfil.id);
      });

      if (nuevos.length > 0) {
        reproducirSonidoMensaje();
        vibrarDispositivo();

        if (window.UI && typeof UI.toast === "function") {
          const remitente = nuevos[0].deNombre ? String(nuevos[0].deNombre).toUpperCase() : "SISTEMA";
          const textoAviso = nuevos.length === 1
            ? "NUEVO MENSAJE DE " + remitente
            : nuevos.length + " MENSAJES NUEVOS RECIBIDOS";
          UI.toast("📩 " + textoAviso, "info");
        }

        const badge = document.getElementById("badge-mensajes") || document.querySelector(".badge-rojo");
        if (badge) {
          const actualNum = parseInt(badge.textContent || "0", 10) || 0;
          badge.textContent = String(Math.max(actualNum, nuevos.length));
          badge.classList.remove("oculto");
        }
      }

      // Actualizar lista de vistos incluyendo los que el usuario ya tiene en bandeja
      const fusionados = Array.from(new Set(leerVistos(perfil.id).concat(idsActuales)));
      guardarVistos(perfil.id, fusionados);
    } catch (e) {
      // Silencioso para no interrumpir la navegación
    } finally {
      verificando = false;
    }
  }

  // Desbloquear AudioContext en el primer toque o clic del usuario
  ["pointerdown", "keydown", "touchstart"].forEach(function (evt) {
    document.addEventListener(evt, function () {
      obtenerAudioContext();
    }, { passive: true });
  });

  // Vigilar cada 12 segundos cuando haya sesión activa
  if (intervaloVigilancia) clearInterval(intervaloVigilancia);
  intervaloVigilancia = setInterval(revisarMensajesNuevos, 12000);

  // Revisar también al volver a la pestaña/app o al pulsar la campanita
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) revisarMensajesNuevos();
  });

  document.addEventListener("click", function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest(".btn-campana")) {
      reproducirSonidoMensaje();
      vibrarDispositivo();
      setTimeout(revisarMensajesNuevos, 600);
    }
  });

  // Exponer función manual por si deseas dispararla desde algún módulo
  window.NotifMensajes = {
    sonar: reproducirSonidoMensaje,
    vibrar: vibrarDispositivo,
    alertaNueva: function (mensajeToast) {
      reproducirSonidoMensaje();
      vibrarDispositivo();
      if (window.UI && typeof UI.toast === "function" && mensajeToast) {
        UI.toast("📩 " + String(mensajeToast).toUpperCase(), "info");
      }
    },
    revisarAhora: revisarMensajesNuevos
  };
})();