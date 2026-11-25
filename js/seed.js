/* =====================================================================
   SEMBRADO — Creación automática de la cuenta ZONAL (NIVEL 1)
   ---------------------------------------------------------------------
   En la PRIMERA conexión, si la colección `usuarios` no tiene ningún
   ZONAL, se crea automáticamente la cuenta indicada abajo.

   >>> SEGURIDAD: cambie la contraseña después del primer ingreso. <<<
   ===================================================================== */
const Seed = {};

/* ---------------- DATOS DE LA CUENTA ZONAL INICIAL ---------------- */
Seed.USUARIO = "AMBAR@2027";
Seed.PASSWORD = "ZONAL2027";
Seed.NOMBRE = "ZONAL PUERTO GAITÁN";
Seed.TELEFONO = "3000000000";
Seed.DIRECCION = "PUERTO GAITÁN — DEPARTAMENTO DEL META";
Seed.BARRIO = "TODO EL MUNICIPIO";

/**
 * Ejecuta el sembrado. Devuelve:
 *   { estado: "creado" | "ya_existe" | "usuario_ocupado" | "sin_config" | "error" }
 *
 * Requiere una sesión de Firebase activa (anónima o real) para poder
 * leer/escribir en Firestore según las reglas `request.auth != null`.
 */
Seed.crearZonalInicial = async function () {
  if (!App.configOk) return { estado: "sin_config" };

  try {
    const zonales = await FS.lista("usuarios", [["rol", "==", "ZONAL"]]);
    if (zonales.length) return { estado: "ya_existe" };

    const ocupado = await FS.usuarioExiste(Seed.USUARIO);
    if (ocupado) return { estado: "usuario_ocupado" };

    const perfil = await Auth.crearZonal({
      nombre: Seed.NOMBRE,
      usuario: Seed.USUARIO,
      telefono: Seed.TELEFONO,
      barrio: Seed.BARRIO,
      direccion: Seed.DIRECCION,
      password: Seed.PASSWORD,
      confirmar: Seed.PASSWORD
    }, false); // no inicia sesión: el usuario debe ingresar con sus credenciales

    return { estado: "creado", usuario: perfil.usuario };
  } catch (e) {
    console.warn("SEED ZONAL:", e.code || "", e.message || e);
    return { estado: "error", mensaje: e.message || String(e) };
  }
};
