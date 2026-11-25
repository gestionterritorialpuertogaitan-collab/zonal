/* =====================================================================
   NÚCLEO — Espacio de nombres global de la aplicación
   ===================================================================== */
window.App = window.App || {
  roles: {},      // definiciones de módulos por rol
  perfil: null,   // perfil del usuario en Firestore
  authUser: null, // usuario de Firebase Authentication
  vistaActual: null,
  configOk: false
};

/**
 * Registra el módulo (conjunto de vistas) de un rol.
 * @param {string} rol - ZONAL | PUBLICIDAD | COMPRAS | COORDINADOR | SUBCOORDINADOR | LIDER
 * @param {{orden:string[], vistas:Object}} definicion
 */
App.registrarRol = function (rol, definicion) {
  App.roles[rol] = definicion;
};
