/* =====================================================================
   CONFIGURACIÓN DE FIREBASE
   ---------------------------------------------------------------------
   REEMPLAZA LOS VALORES DE ABAJO CON LOS DE TU PROYECTO DE FIREBASE:
   Firebase Console -> Configuración del proyecto -> Tus apps -> SDK
   ===================================================================== */
const firebaseConfig = {
  apiKey:            "AIzaSyBk6-bm1fC8K18dG061dnOYNskuieuHPKA",
  authDomain:        "red-zonal-puerto-gaitan.firebaseapp.com",
  projectId:         "red-zonal-puerto-gaitan",
  storageBucket:     "red-zonal-puerto-gaitan.firebasestorage.app",
  messagingSenderId: "943075951309",
  appId:             "1:943075951309:web:2ca5b4908589fd1bba5f84"
};

/* -------- Inicialización -------- */
try {
  firebase.initializeApp(firebaseConfig);
  App.configOk = !String(firebaseConfig.apiKey).includes("PEGA_AQUI");
} catch (e) {
  App.configOk = false;
  console.error("FIREBASE NO SE PUDO INICIALIZAR:", e);
}

if (!App.configOk) {
  console.warn(
    "FIREBASE SIN CONFIGURAR: edite js/firebase-config.js con los valores reales " +
    "de su proyecto antes de usar la aplicación."
  );
}
