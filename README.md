# GESTIÓN TERRITORIAL — PUERTO GAITÁN, META

Aplicación web completa, responsiva (PC / tablet / celular) y conectada a **Firebase**
(Authentication, Cloud Firestore y Firebase Storage) para la gestión territorial y
operativa de equipos.

---

## 1. ESTRUCTURA DEL PROYECTO

```
aplicacion/
├── index.html                  Pantalla de login + contenedor de la aplicación
├── css/
│   └── estilos.css             Estilos responsivos + hoja @media print (B/N)
├── js/
│   ├── nucleo.js               Espacio de nombres global App
│   ├── firebase-config.js      ⚠️  EDITAR: credenciales de tu proyecto
│   ├── utilidades.js           MAYÚSCULAS en tiempo real, validaciones, CSV, imprimir
│   ├── firestore.js            Servicio de datos (Firestore + Storage)
│   ├── ui.js                   Toast, modales, sellos, tablas responsive
│   ├── seed.js                 Sembrado: crea la cuenta ZONAL inicial
│   ├── auth.js                 Login usuario/cédula + contraseña, cuentas, sesión
│   ├── app.js                  Enrutador, menú por rol, arranque, bloqueos
│   └── modulos/
│       ├── comun.js            Formularios compartidos (recaudación, peticiones, quejas)
│       ├── area.js             Tabla base 2A/2B (desaparición de botón al ENTREGADO)
│       ├── zonal.js            NIVEL 1
│       ├── publicidad.js       NIVEL 2A
│       ├── compras.js          NIVEL 2B
│       ├── coordinador.js      NIVEL 3
│       ├── subcoordinador.js   NIVEL 4
│       └── lider.js            NIVEL 5
└── README.md
```

**No hay build ni dependencias locales.** Solo se sirve la carpeta.

---

## 2. CONFIGURAR FIREBASE

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. **Authentication → Sign-in method → habilita "Email/Password"** (y "Anonymous" si es posible).
3. **Cloud Firestore → Create database** (modo producción o test).
4. **Storage → Get started.**
5. Registra una app Web y copia la configuración.
6. Pega los valores en **`js/firebase-config.js`**:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:1234...:web:abc"
};
```

Si el `apiKey` sigue siendo `PEGA_AQUI_TU_API_KEY`, la app muestra un aviso naranja en el login.

---

## 3. REGLAS DE SEGURIDAD (Firestore)

Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function sesion() {
      return request.auth != null;
    }

    match /usuarios/{id} {
      allow read: if sesion();
      allow create, update, delete: if sesion();
    }

    match /recaudaciones/{id}  { allow read, write: if sesion(); }
    match /peticiones/{id}     { allow read, write: if sesion(); }
    match /quejas/{id}         { allow read, write: if sesion(); }
    match /mensajes/{id}       { allow read, write: if sesion(); }
    match /escalamientosZonal/{id} { allow read, write: if sesion(); }
  }
}
```

> En producción se recomienda endurecer estas reglas validando `request.resource.data.rol`
> contra la colección `usuarios` del usuario autenticado.

## 4. REGLAS DE SEGURIDAD (Storage)

Storage → Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /escalamientos/{barrio}/{coordId}/{docId}/{archivo} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 25 * 1024 * 1024;
    }
  }
}
```

## 5. ÍNDICES DE FIRESTORE

**No se necesita crear ningún índice compuesto.**
Todas las consultas usan como máximo un `where(...)` (índice automático) y el filtrado
complementario (categoría, estado, etc.) se resuelve en memoria.

---

## 6. PRIMER ARRANQUE — CUENTA ZONAL AUTOMÁTICA

Al abrir la aplicación por primera vez (con `firebase-config.js` ya configurado) el sistema:

1. Inicia una sesión base anónima para poder leer/escribir en Firestore.
2. Revisa si la colección `usuarios` tiene alguna cuenta `ZONAL`.
3. **Si está vacía, crea automáticamente la cuenta inicial:**

| Campo | Valor |
|---|---|
| ROL | ZONAL (NIVEL 1) |
| NOMBRE | ZONAL PUERTO GAITÁN |
| **USUARIO / CÉDULA** | **`AMBAR@2027`** |
| **CONTRASEÑA** | **`ZONAL2027`** |
| TELÉFONO | 3000000000 |
| BARRIO | TODO EL MUNICIPIO |

> ⚠️ **SEGURIDAD:** cambie la contraseña desde *GESTIONAR USUARIOS* después del primer
> ingreso. Los datos de la cuenta viven en `js/seed.js` (`Seed.USUARIO` / `Seed.PASSWORD`).

Los valores de usuario se pueden editar en **`js/seed.js`**.

**Proveedores que debe habilitar en Firebase Authentication:**
* **Email/Password** → para el ingreso normal.
* **Anonymous** → necesario para el primer arranque (lectura/escritura inicial en Firestore).

**Respaldo manual:** si el sembrado no está disponible, el botón
**PRIMER ACCESO: CREAR CUENTA ZONAL** del login permite crear la cuenta manualmente
(solo aparece útil cuando la colección `usuarios` no tiene ningún ZONAL).

---

## 6.1. FORMATO DEL USUARIO / CÉDULA

Validación en `U.usuarioValido`:
* **Cédula:** solo dígitos, de 5 a 12.
* **Usuario:** de 4 a 30 caracteres, alfanuméricos con `@` `_` `.` `-`
  (ej: `AMBAR@2027`, `COORD1`, `1023456789`).

Para Firebase Authentication se deriva un email sintético válido con
`Auth.emailDe()` (reemplaza los caracteres no válidos y agrega un sufijo
determinista), evitando errores `auth/invalid-email` en usuarios como `AMBAR@2027`.

---

## 7. JERARQUÍA Y FLUJOS

| Nivel | Rol | Funciones principales |
|---|---|---|
| 1 | ZONAL | Consolidado global, crear/gestionar cuentas, mover líderes, mensajes (directo o general), escalamientos recibidos |
| 2A | PUBLICIDAD | Tabla de peticiones aprobadas de categoría PUBLICIDAD, observaciones, EN GESTIÓN / ENTREGADO |
| 2B | COMPRAS | Igual que 2A pero para categoría COMPRAS |
| 3 | COORDINADOR | Bandeja de aprobaciones (APRUEBO/NIEGO), equipo en 3 modos, crear usuarios, ubicar líderes, directrices, recaudación, consolidado, quejas, escalamiento al ZonAL con adjuntos |
| 4 | SUB-COORDINADOR | Directrices recibidas, mensajes a sus líderes, revisión (lectura), peticiones/quejas propias al Coordinador, recaudación, tabla de líderes |
| 5 | LÍDER | 5 botones: recaudar datos, enviar petición, solicitudes y quejas, bandeja de mensajes, mis registros y estado |

**Flujo de una petición:**
`LÍDER / SUB → PENDIENTE → COORDINADOR aprueba (APROBADA) → 2A o 2B → EN GESTIÓN → ENTREGADO`
Al quedar **ENTREGADO**, los botones de gestión desaparecen de la fila y solo queda el sello
junto con la observación registrada.

---

## 8. REGLA GLOBAL DE MAYÚSCULAS

* `js/utilidades.js → U.instalarMayusculas()` instala un detector global de evento `input`
  que convierte en MAYÚSCULAS **en tiempo real** cualquier `input[type=text|password|search|tel|url]`
  y cualquier `<textarea>`, conservando la posición del cursor.
* Todo lo que se guarda en Firestore pasa además por `U.UP(...)` al momento de persistir.
* La exportación a CSV también se escribe en mayúsculas.

---

## 9. EXPORTAR E IMPRIMIR

* **EXPORTAR CSV** → genera un archivo `.csv` con separador `;` y BOM UTF-8 (abre directo en Excel en español).
* **IMPRIMIR** → usa la hoja `@media print` incluida: oculta menú, botones y barra de
  herramientas, y deja la tabla en blanco y negro con bordes limpios.

---

## 10. SOLUCIÓN DE PROBLEMAS

| Síntoma | Causa / solución |
|---|---|
| "FALTA CONFIGURAR js/firebase-config.js" | Pega tus credenciales reales |
| "USUARIO O CONTRASEÑA INCORRECTOS" | Verifica que el usuario exista en `usuarios` y que la contraseña coincida |
| No carga la lista | Revisa la consola del navegador; verifica que Firestore esté en modo lectura/escritura |
| Los adjuntos no suben | Revisa las reglas de Storage y que el proyecto tenga Storage habilitado |
| La app no responde en móvil | Confirma que `viewport` esté presente (ya está en `index.html`) |
