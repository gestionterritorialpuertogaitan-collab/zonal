/* =====================================================================
   SERVICIO DE DATOS — Cloud Firestore + Firebase Storage
   ---------------------------------------------------------------------
   IMPORTANTE: Todas las consultas usan UN SOLO where() por consulta
   (índice automático) y el filtrado complementario se hace en memoria.
   Así se evita tener que crear índices compuestos en consola.
   ===================================================================== */
const FS = {};

FS.db = function () { return firebase.firestore(); };
FS.st = function () { return firebase.storage(); };
FS.col = function (nombre) { return FS.db().collection(nombre); };

/* -------------------------- CRUD BÁSICO -------------------------- */

FS.crear = async function (coleccion, datos) {
  const ref = await FS.col(coleccion).add(datos);
  return ref.id;
};

FS.crearConId = async function (coleccion, id, datos) {
  await FS.col(coleccion).doc(id).set(datos);
  return id;
};

FS.actualizar = function (coleccion, id, datos) {
  return FS.col(coleccion).doc(id).update(datos);
};

FS.borrar = function (coleccion, id) {
  return FS.col(coleccion).doc(id).delete();
};

FS.obtener = async function (coleccion, id) {
  const snap = await FS.col(coleccion).doc(id).get();
  if (!snap.exists) return null;
  const dato = snap.data();
  dato.id = snap.id;
  return dato;
};

/**
 * Lista documentos con filtros simples.
 * @param {string} coleccion
 * @param {Array<Array>} filtros  ej: [['barrio','==','CENTRO']]
 * @returns {Promise<Array>} documentos con id
 */
FS.lista = async function (coleccion, filtros) {
  let q = FS.col(coleccion);
  (filtros || []).forEach(function (f) { q = q.where(f[0], f[1], f[2]); });
  const snap = await q.get();
  return snap.docs.map(function (d) {
    const dato = d.data();
    dato.id = d.id;
    return dato;
  });
};

/** Existe ya un usuario con ese usuario/cédula? */
FS.usuarioExiste = async function (usuario, ignorarId) {
  const lista = await FS.lista("usuarios", [["usuario", "==", U.UP(usuario)]]);
  return lista.some(function (u) { return u.id !== ignorarId; });
};

/* -------------------------- SELECTORES -------------------------- */

FS.usuarios = function () { return FS.lista("usuarios"); };

FS.usuariosPorRol = async function (rol) {
  const lista = await FS.lista("usuarios", [["rol", "==", rol]]);
  return lista;
};

FS.miBarrio = function (perfil) { return U.UP(perfil && perfil.barrio ? perfil.barrio : ""); };

/**
 * Equipo de un coordinador (sub-coordinadores y líderes).
 * Se consulta por coordinadorId (un solo where).
 */
FS.equipoDelCoordinador = async function (coordinadorId) {
  const lista = await FS.lista("usuarios", [["coordinadorId", "==", coordinadorId]]);
  return {
    subcoordinadores: lista.filter(function (u) { return u.rol === "SUBCOORDINADOR"; }),
    lideres: lista.filter(function (u) { return u.rol === "LIDER"; })
  };
};

/** Líderes de un sub-coordinador específico */
FS.lideresDelSub = async function (subcoordinadorId) {
  const lista = await FS.lista("usuarios", [["subcoordinadorId", "==", subcoordinadorId]]);
  return lista.filter(function (u) { return u.rol === "LIDER"; });
};

/* -------------------------- FLUJO DE PETICIONES -------------------------- */

/**
 * Peticiones que le corresponden a un RESPONSABLE (2A / 2B):
 * las de su categoría que ya fueron APROBADAS por el Coordinador.
 */
FS.peticionesAprobadas = async function (categoria) {
  const lista = await FS.lista("peticiones", [["categoria", "==", categoria]]);
  return U.ordenarPorFechaDesc(lista.filter(function (p) { return p.estado === "APROBADA"; }));
};

/** Peticiones recibidas por un Coordinador (todas las de su barrio) */
FS.peticionesDelCoordinador = async function (coordinadorId) {
  const lista = await FS.lista("peticiones", [["coordinadorId", "==", coordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

/** Peticiones de un sub-coordinador y de sus líderes */
FS.peticionesDelSub = async function (subcoordinadorId) {
  const lista = await FS.lista("peticiones", [["subcoordinadorId", "==", subcoordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

/** Peticiones de un líder */
FS.peticionesDelLider = async function (liderId) {
  const lista = await FS.lista("peticiones", [["creadoPorId", "==", liderId]]);
  return U.ordenarPorFechaDesc(lista);
};

/* -------------------------- RECAUDACIONES -------------------------- */

FS.recaudacionesDelCoordinador = async function (coordinadorId) {
  const lista = await FS.lista("recaudaciones", [["coordinadorId", "==", coordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

FS.recaudacionesDelSub = async function (subcoordinadorId) {
  const lista = await FS.lista("recaudaciones", [["subcoordinadorId", "==", subcoordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

FS.recaudacionesPropias = async function (usuarioId) {
  const lista = await FS.lista("recaudaciones", [["creadoPorId", "==", usuarioId]]);
  return U.ordenarPorFechaDesc(lista);
};

/* -------------------------- QUEJAS -------------------------- */

FS.quejasDelCoordinador = async function (coordinadorId) {
  const lista = await FS.lista("quejas", [["coordinadorId", "==", coordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

FS.quejasDelSub = async function (subcoordinadorId) {
  const lista = await FS.lista("quejas", [["subcoordinadorId", "==", subcoordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

FS.quejasDelLider = async function (liderId) {
  const lista = await FS.lista("quejas", [["creadoPorId", "==", liderId]]);
  return U.ordenarPorFechaDesc(lista);
};

FS.escalamientos = async function () {
  return U.ordenarPorFechaDesc(await FS.lista("escalamientosZonal"));
};

/* -------------------------- MENSAJES -------------------------- */

/**
 * Bandeja de lectura de un usuario, según su rol.
 * alcances:
 *   directo_coordinador -> solo al Coordinador elegido
 *   general_barrio      -> todo el grupo del barrio
 *   trabajo_sub         -> Coordinador a sus Sub-coordinadores
 *   grupo_lideres       -> Sub-coordinador a sus Líderes
 */
FS.bandejaMensajes = async function (perfil) {
  const todos = await FS.lista("mensajes");
  const barrio = U.UP(perfil.barrio);
  return U.ordenarPorFechaDesc(todos.filter(function (m) {
    switch (perfil.rol) {
      case "ZONAL":
        return false; // el ZonAL no recibe mensajes, envía
      case "COORDINADOR":
        return (m.alcance === "directo_coordinador" && m.paraCoordinadorId === perfil.id) ||
               (m.alcance === "general_barrio" && U.UP(m.barrio) === barrio);
      case "SUBCOORDINADOR":
        return (m.alcance === "trabajo_sub" && m.paraCoordinadorId === perfil.coordinadorId) ||
               (m.alcance === "general_barrio" && U.UP(m.barrio) === barrio);
      case "LIDER":
        return (m.alcance === "grupo_lideres" && m.paraSubId === perfil.subcoordinadorId) ||
               (m.alcance === "general_barrio" && U.UP(m.barrio) === barrio);
      case "PUBLICIDAD":
      case "COMPRAS":
        return m.alcance === "directo_rol" && m.paraRol === perfil.rol;
      default:
        return false;
    }
  }));
};

FS.mensajesEnviados = async function (usuarioId) {
  const lista = await FS.lista("mensajes", [["deId", "==", usuarioId]]);
  return U.ordenarPorFechaDesc(lista);
};

/* -------------------------- ARCHIVOS (STORAGE) -------------------------- */

/**
 * Sube un archivo y devuelve su URL pública.
 * Ruta base: escalamientos/{barrio}/{coordinadorId}/{escalamientoId}/
 */
FS.subirArchivo = async function (ruta, archivo) {
  const ref = FS.st().ref(ruta);
  await ref.put(archivo);
  return await ref.getDownloadURL();
};

/**
 * Sube un lote de archivos para un escalamiento y devuelve el arreglo adjuntos.
 */
FS.subirAdjuntos = async function (barrio, coordinadorId, escalamientoId, archivos) {
  const adjuntos = [];
  const lista = Array.prototype.slice.call(archivos || []);
  for (let i = 0; i < lista.length; i++) {
    const f = lista[i];
    const seguro = String(Date.now()) + "_" + String(i) + "_" + f.name.replace(/[^\w.\-]+/g, "_");
    const ruta = "escalamientos/" + barrio + "/" + coordinadorId + "/" + escalamientoId + "/" + seguro;
    const url = await FS.subirArchivo(ruta, f);
    adjuntos.push({ tipo: f.type || "", nombre: f.name, url: url });
  }
  return adjuntos;
};

/* -------------------------- METAS DE RECAUDACIÓN -------------------------- */

/**
 * Calcula la clave del periodo actual en zona horaria local:
 *   DIARIA  -> "DIA_2026-11-24"
 *   MENSUAL -> "MES_2026-11"
 */
FS.clavePeriodoMeta = function (tipo) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return U.UP(tipo) === "DIARIA"
    ? "DIA_" + y + "-" + m + "-" + day
    : "MES_" + y + "-" + m;
};

/** Metas asignadas a un usuario (Sub-coordinador o Líder) */
FS.metasDelUsuario = async function (usuarioId) {
  const lista = await FS.lista("metas", [["usuarioId", "==", usuarioId]]);
  return U.ordenarPorFechaDesc(lista);
};

/** Metas creadas por un Coordinador */
FS.metasDelCoordinador = async function (coordinadorId) {
  const lista = await FS.lista("metas", [["coordinadorId", "==", coordinadorId]]);
  return U.ordenarPorFechaDesc(lista);
};

/**
 * Calcula el resumen acumulativo de meta de un usuario para el día y mes actual.
 * Suma todas las metas asignadas en el periodo activo y las compara contra
 * los registros recaudados por ese usuario en el mismo periodo.
 */
FS.resumenMetaUsuario = async function (usuarioId, registrosUsuario) {
  const metas = await FS.metasDelUsuario(usuarioId);
  const claveDia = FS.clavePeriodoMeta("DIARIA");
  const claveMes = FS.clavePeriodoMeta("MENSUAL");

  const metasActivas = metas.filter(function (m) {
    return m.clavePeriodo === claveDia || m.clavePeriodo === claveMes;
  });

  if (!metasActivas.length) return null;

  // Priorizar si tiene metas diarias activas; si no, mensuales (o sumar todas las activas del ciclo)
  const tieneDiaria = metasActivas.some(function (m) { return m.clavePeriodo === claveDia; });
  const claveObjetivo = tieneDiaria ? claveDia : claveMes;
  const tipoEtiqueta = tieneDiaria ? "META DEL DÍA" : "META DEL MES";

  const metasPeriodo = metasActivas.filter(function (m) {
    return m.clavePeriodo === claveObjetivo;
  });

  const objetivoTotal = metasPeriodo.reduce(function (acc, m) {
    return acc + (parseInt(m.cantidad, 10) || 0);
  }, 0);

  const ultimoMensaje = metasPeriodo[0] ? metasPeriodo[0].mensaje : "";

  // Contar recaudaciones realizadas por el usuario dentro del mismo día o mes
  const recs = registrosUsuario || await FS.recaudacionesPropias(usuarioId);
  const prefijoFecha = tieneDiaria ? claveDia.replace("DIA_", "") : claveMes.replace("MES_", "");

  const recaudados = recs.filter(function (r) {
    if (!r.fecha) return false;
    const d = new Date(r.fecha);
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const fStr = tieneDiaria ? (y + "-" + m + "-" + day) : (y + "-" + m);
    return fStr === prefijoFecha;
  }).length;

  const faltantes = Math.max(0, objetivoTotal - recaudados);

  return {
    tipo: tipoEtiqueta,
    objetivo: objetivoTotal,
    recaudados: recaudados,
    faltantes: faltantes,
    cumplida: faltantes === 0 && objetivoTotal > 0,
    mensaje: ultimoMensaje
  };
};
