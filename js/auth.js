/* =====================================================================
   AUTENTICACIÓN — Usuario/Cédula + Contraseña (en MAYÚSCULAS)
   ---------------------------------------------------------------------
   * La validación de credenciales se hace contra la colección `usuarios`.
   * Se crea/se usa una cuenta de Firebase Authentication asociada
     (email sintético: usuario@puertogaitan-meta.local) para mantener
     viva la sesión de Firebase y permitir el uso de Storage.
   * Si el proyecto no tiene Email/Password habilitado, se degrada a
     sesión anónima o local sin bloquear al usuario.
   ===================================================================== */
const Auth = {};

Auth.CLAVE_SESION = "gt_perfil_sesion";

/**
 * Deriva un email sintético VÁLIDO a partir del usuario/cédula.
 * Firebase Authentication exige un email bien formado, por lo que se
 * reemplazan los caracteres no válidos (@, espacios, tildes...) y se
 * agrega un sufijo determinista para conservar la unicidad.
 */
function _hashCorta(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = ((h * 31) + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

Auth.emailDe = function (usuario) {
  const crudo = U.UP(usuario).trim();
  const base = crudo.replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "usuario";
  return base.toLowerCase() + "_" + _hashCorta(crudo) + "@puertogaitan-meta.local";
};

Auth.guardarSesion = function (perfil) {
  try { localStorage.setItem(Auth.CLAVE_SESION, JSON.stringify(perfil)); } catch (e) { /* modo privado */ }
};
Auth.leerSesion = function () {
  try {
    const raw = localStorage.getItem(Auth.CLAVE_SESION);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
};
Auth.borrarSesion = function () {
  try { localStorage.removeItem(Auth.CLAVE_SESION); } catch (e) { /* nada */ }
};

/** Intenta crear la cuenta de Firebase Authentication (mejor esfuerzo). */
Auth.crearAuth = async function (usuario, password) {
  try {
    await firebase.auth().createUserWithEmailAndPassword(Auth.emailDe(usuario), U.UP(password));
    return true;
  } catch (e) {
    console.warn("AUTH CREATE:", e.code, e.message);
    return false;
  }
};

/** Establece la sesión de Firebase lo mejor posible. */
Auth.conectarFirebase = async function (usuario, password) {
  try {
    await firebase.auth().signInWithEmailAndPassword(Auth.emailDe(usuario), U.UP(password));
    return;
  } catch (e) { /* seguimos */ }
  try {
    await firebase.auth().createUserWithEmailAndPassword(Auth.emailDe(usuario), U.UP(password));
    return;
  } catch (e) { /* seguimos */ }
  try {
    await firebase.auth().signInAnonymously();
    return;
  } catch (e) {
    console.warn("AUTH SESSION:", e.code, e.message);
  }
};

/* ---------------------------------------------------------------------
   INGRESO
   --------------------------------------------------------------------- */
Auth.entrar = async function (usuario, password) {
  const usu = U.UP(usuario).trim();
  const pass = U.UP(password);

  if (!usu) throw new Error("DEBE DIGITAR EL USUARIO O LA CÉDULA");
  if (!pass) throw new Error("DEBE DIGITAR LA CONTRASEÑA");
  if (!App.configOk) throw new Error("FALTA CONFIGURAR js/firebase-config.js");

  const encontrados = await FS.lista("usuarios", [["usuario", "==", usu]]);
  if (!encontrados.length) throw new Error("USUARIO O CONTRASEÑA INCORRECTOS");

  const perfil = encontrados[0];
  if (U.UP(perfil.password) !== pass) throw new Error("USUARIO O CONTRASEÑA INCORRECTOS");

  // La sesión local se guarda ANTES de tocar Auth para evitar carreras.
  Auth.guardarSesion(perfil);
  await Auth.conectarFirebase(usu, pass);
  return perfil;
};

/* ---------------------------------------------------------------------
   PRIMER ACCESO — Crear la cuenta ZONAL cuando la base está vacía
   --------------------------------------------------------------------- */
Auth.puedeCrearZonal = async function () {
  const zonales = await FS.lista("usuarios", [["rol", "==", "ZONAL"]]);
  return zonales.length === 0;
};

Auth.crearZonal = async function (datos, conectar) {
  const nombre = U.UP(datos.nombre);
  const usuario = U.UP(datos.usuario);
  const telefono = U.UP(datos.telefono);
  const barrio = U.UP(datos.barrio || "TODO EL MUNICIPIO");
  const direccion = U.UP(datos.direccion);
  const password = U.UP(datos.password);
  const confirmar = U.UP(datos.confirmar);

  if (!U.requerido(nombre)) throw new Error("EL NOMBRE ES OBLIGATORIO");
  if (!U.requerido(usuario)) throw new Error("EL USUARIO O CÉDULA ES OBLIGATORIO");
  if (!U.usuarioValido(usuario)) throw new Error("EL USUARIO O CÉDULA NO ES VÁLIDO (MÍNIMO 4 CARACTERES)");
  if (!U.requerido(telefono)) throw new Error("EL TELÉFONO ES OBLIGATORIO");
  if (!U.requerido(direccion)) throw new Error("LA DIRECCIÓN ES OBLIGATORIA");
  if (password.length < 4) throw new Error("LA CONTRASEÑA DEBE TENER AL MENOS 4 CARACTERES");
  if (password !== confirmar) throw new Error("LAS CONTRASEÑAS NO COINCIDEN");

  if (!(await Auth.puedeCrearZonal())) {
    throw new Error("YA EXISTE UNA CUENTA ZONAL. USE EL INGRESO NORMAL");
  }
  if (await FS.usuarioExiste(usuario)) {
    throw new Error("YA EXISTE UN USUARIO CON ESE USUARIO O CÉDULA");
  }

  const uid = U.clave();
  const perfil = {
    uid: uid,
    usuario: usuario,
    password: password,
    nivel: 1,
    rol: "ZONAL",
    nombre: nombre,
    cedula: usuario,
    telefono: telefono,
    direccion: direccion,
    barrio: barrio,
    coordinadorId: null,
    subcoordinadorId: null,
    estado: "ACTIVO",
    creadoEn: U.ahora()
  };

  await FS.crearConId("usuarios", uid, perfil);
  await Auth.crearAuth(usuario, password);
  // conectar === false => solo se crea el registro, sin iniciar sesión
  if (conectar !== false) {
    await Auth.conectarFirebase(usuario, password);
    Auth.guardarSesion(perfil);
  }
  return perfil;
};

/* ---------------------------------------------------------------------
   CREAR CUENTAS (ZonAL y Coordinador)
   --------------------------------------------------------------------- */
Auth.crearUsuario = async function (datos) {
  const rol = datos.rol;
  const usuario = U.UP(datos.usuario);
  const password = U.UP(datos.password);

  if (!U.requerido(datos.nombre)) throw new Error("EL NOMBRE ES OBLIGATORIO");
  if (!U.requerido(usuario)) throw new Error("EL USUARIO O CÉDULA ES OBLIGATORIO");
  if (!U.usuarioValido(usuario)) throw new Error("EL USUARIO O CÉDULA NO ES VÁLIDO (MÍNIMO 4 CARACTERES)");
  if (password.length < 4) throw new Error("LA CONTRASEÑA DEBE TENER AL MENOS 4 CARACTERES");
  if (password !== U.UP(datos.confirmar)) throw new Error("LAS CONTRASEÑAS NO COINCIDEN");
  if (!U.requerido(datos.telefono)) throw new Error("EL TELÉFONO ES OBLIGATORIO");
  if (!U.requerido(datos.direccion)) throw new Error("LA DIRECCIÓN ES OBLIGATORIA");
  if (["COORDINADOR", "SUBCOORDINADOR", "LIDER"].indexOf(rol) !== -1 && !U.requerido(datos.barrio)) {
    throw new Error("EL BARRIO ES OBLIGATORIO PARA ESTE ROL");
  }
  if (rol === "LIDER" && !datos.subcoordinadorId) {
    throw new Error("DEBE ASIGNAR EL LÍDER A UN SUB-COORDINADOR");
  }
  if (rol === "SUBCOORDINADOR" && !datos.coordinadorId) {
    throw new Error("DEBE ASIGNAR EL SUB-COORDINADOR A UN COORDINADOR");
  }

  if (await FS.usuarioExiste(usuario)) {
    throw new Error("YA EXISTE UN USUARIO CON ESE USUARIO O CÉDULA");
  }

  const niveles = { ZONAL: 1, PUBLICIDAD: 2, COMPRAS: 2, COORDINADOR: 3, SUBCOORDINADOR: 4, LIDER: 5 };
  const uid = U.clave();

  const perfil = {
    uid: uid,
    usuario: usuario,
    password: password,
    nivel: niveles[rol] || 0,
    rol: rol,
    nombre: U.UP(datos.nombre),
    cedula: usuario,
    telefono: U.UP(datos.telefono),
    direccion: U.UP(datos.direccion),
    barrio: U.UP(datos.barrio || ""),
    coordinadorId: datos.coordinadorId || null,
    subcoordinadorId: datos.subcoordinadorId || null,
    estado: "ACTIVO",
    creadoEn: U.ahora(),
    creadoPorId: App.perfil ? App.perfil.id : null,
    creadoPorNombre: App.perfil ? App.perfil.nombre : "SISTEMA"
  };

  await FS.crearConId("usuarios", uid, perfil);
  await Auth.crearAuth(usuario, password);
  return perfil;
};

/* ---------------------------------------------------------------------
   CERRAR SESIÓN
   --------------------------------------------------------------------- */
Auth.salir = async function () {
  App.detenerInactividad();
  App.detenerAutoRefresh();
  Auth.borrarSesion();
  App.perfil = null;
  App.authUser = null;
  App.vistaActual = null;
  try { await firebase.auth().signOut(); } catch (e) { /* nada */ }
  App.mostrarLogin();
};

/* ---------------------------------------------------------------------
   CAMBIAR MI CONTRASEÑA (usuario autenticado)
   --------------------------------------------------------------------- */
Auth.cambiarMiPassword = async function (actual, nueva, confirmar) {
  const perfil = App.perfil;
  if (!perfil) throw new Error("NO HAY SESIÓN ACTIVA");
  const passActual = U.UP(actual);
  const passNueva = U.UP(nueva);
  const passConf = U.UP(confirmar);
  if (!U.requerido(passActual)) throw new Error("DIGITE LA CONTRASEÑA ACTUAL");
  if (U.UP(perfil.password) !== passActual) throw new Error("LA CONTRASEÑA ACTUAL ES INCORRECTA");
  if (passNueva.length < 4) throw new Error("LA NUEVA CONTRASEÑA DEBE TENER AL MENOS 4 CARACTERES");
  if (passNueva !== passConf) throw new Error("LAS CONTRASEÑAS NO COINCIDEN");
  if (passNueva === passActual) throw new Error("LA NUEVA CONTRASEÑA DEBE SER DIFERENTE A LA ACTUAL");

  await FS.actualizar("usuarios", perfil.id, { password: passNueva, actualizadoEn: U.ahora() });
  // Mejor esfuerzo sobre Firebase Authentication (puede fallar si no hay sesión activa).
  try {
    const user = firebase.auth().currentUser;
    if (user) await user.updatePassword(passNueva);
  } catch (e) { console.warn("AUTH UPDATE PASSWORD:", e.code, e.message); }

  perfil.password = passNueva;
  Auth.guardarSesion(perfil);
  App.perfil = perfil;
  return true;
};

/* ---------------------------------------------------------------------
   RESTABLECER CONTRASEÑA DE OTRO USUARIO (ZONAL)
   --------------------------------------------------------------------- */
Auth.restablecerPassword = async function (usuarioId, usuario, nueva, confirmar) {
  const passNueva = U.UP(nueva);
  const passConf = U.UP(confirmar);
  if (passNueva.length < 4) throw new Error("LA CONTRASEÑA DEBE TENER AL MENOS 4 CARACTERES");
  if (passNueva !== passConf) throw new Error("LAS CONTRASEÑAS NO COINCIDEN");

  await FS.actualizar("usuarios", usuarioId, { password: passNueva, actualizadoEn: U.ahora() });
  // Nota: Firebase Authentication mantiene la clave anterior para esta cuenta
  // (no es posible actualizarla sin la clave previa desde el cliente). El
  // ingreso a la aplicación se valida contra Firestore, por lo que la nueva
  // clave funciona de inmediato. Si se requiere Storage para este usuario,
  // deberá volver a crearse la cuenta de Auth con la nueva clave.
  return true;
};

/* ---------------------------------------------------------------------
   EVENTOS DE LOGIN
   --------------------------------------------------------------------- */
Auth.init = function () {
  const form = document.getElementById("form-login");
  const err = document.getElementById("login-error");
  const inputPass = document.getElementById("login-password");
  const btnOjo = document.getElementById("btn-ojo");
  const btnOlvide = document.getElementById("btn-olvide");

  function mostrarError(el, msg) {
    el.textContent = U.UP(msg);
    el.classList.remove("oculto");
  }

  /* -------- Mostrar / ocultar contraseña -------- */
  if (btnOjo) {
    btnOjo.addEventListener("click", function () {
      const visible = inputPass.type === "text";
      inputPass.type = visible ? "password" : "text";
      btnOjo.classList.toggle("visible", !visible);
      btnOjo.setAttribute("aria-pressed", String(!visible));
    });
  }

  /* -------- ¿Olvidaste tu contraseña? -------- */
  if (btnOlvide) {
    btnOlvide.addEventListener("click", function () {
      UI.abrirModal(
        "RECUPERAR CONTRASEÑA",
        "<p><strong>SU CONTRASEÑA SE GESTIONA DENTRO DE LA PLATAFORMA.</strong></p>" +
        "<p>SOLICITE EL RESTABLECIMIENTO A SU <strong>COORDINADOR DE BARRIO</strong> " +
        "O DIRECTAMENTE AL <strong>ZONAL</strong>, QUIEN PODRÁ GENERARLE UNA NUEVA CLAVE.</p>",
        [{ texto: "ENTENDIDO", clase: "btn-primario" }]
      );
    });
  }



  /* -------- Ingreso a la plataforma -------- */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    err.classList.add("oculto");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    UI.cargando(true);
    try {
      const perfil = await Auth.entrar(
        document.getElementById("login-usuario").value,
        document.getElementById("login-password").value
      );
      App.perfil = perfil;
      App.entrarApp();
    } catch (ex) {
      mostrarError(err, ex.message || "ERROR AL INICIAR SESIÓN");
    }
    UI.cargando(false);
    btn.disabled = false;
  });
};
