# Reporte: PWA de Contabilidad — Restaurante Pro (Familia González)

---

## Uso de este documento para IA (Cursor u otra)

**Este archivo es la fuente principal de contexto del proyecto.** Una IA (por ejemplo Cursor) que lo lea tiene visión completa del sistema sin necesidad de explorar todo el código: arquitectura, flujos de datos, IDs y clases clave, estructura Firestore, convenciones y relación entre archivos. Úsalo como onboarding técnico y como referencia al hacer cambios o debugging.

El documento combina:
1. **Perspectiva técnica** — Cómo está construido (stack, arquitectura, flujos, estructura de archivos).
2. **Perspectiva cliente** — Para qué sirve y qué puede hacer el negocio con la app.
3. **Contexto para IA** — Flujos paso a paso, elementos DOM importantes, modelos de datos y convenciones de código.

---

## 1. Perspectiva técnica (para programadores)

### ¿Qué se construyó?

Una **Progressive Web App (PWA)** de gestión y contabilidad para restaurante con **dos interfaces**: panel de administración y panel de mesero. Backend: **Firebase** (Auth + Firestore). Sin servidor propio. Lógica en **JavaScript vanilla** (IIFE, sin frameworks).

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | HTML5, CSS3 (variables CSS, Grid, Flexbox), JavaScript ES5/ES6 (vanilla) |
| **Backend / BBDD** | Firebase: Authentication (email/contraseña), Firestore (NoSQL, tiempo real) |
| **PWA** | `manifest.json`, Service Worker `sw.js` (Network First, exclusión Firebase) |
| **Gráficos** | Chart.js (ingresos/gastos últimos 7 días, dashboard) |
| **Notificaciones** | `toasts.js`: `showToast(message, type)` — success, error, info |
| **Tickets** | `ticket.js`: impresión 58 mm, PNG para WhatsApp (html2canvas) |
| **Hosting** | Vercel: `vercel.json` (headers para SW y manifest) |

### Arquitectura en una frase

**Login** (`login.html`) → Firebase Auth → Firestore `usuarios/{uid}` → campo `rol` → redirección a **index.html** (admin) o **mesero.html** (mesero). Admin: SPA con secciones y `onSnapshot` en órdenes, ventas, gastos, menú, usuarios, configuración. Mesero: página independiente que lee menú y `configuracion/mesas`, escribe/actualiza en `ordenes`. Tiempo real en todas las colecciones críticas.

---

## 2. Flujos de datos (paso a paso)

### 2.1 Login y redirección por rol

1. Usuario abre **login.html**. Formulario: `#loginForm`, inputs `#email`, `#password`, submit `#loginBtn`, errores en `#errorMessage`.
2. **Botones demo** (sin tocar el formulario manualmente):
   - **Ver demo completo (Admin):** rellena `demo@restiq.com` y `demo1234`, hace click en `#loginBtn`.
   - **Ver demo de mesero:** rellena `mesero@restiq.com` y `demo1234`, hace click en `#loginBtn`.
3. **auth.js**: al submit, `auth.signInWithEmailAndPassword(email, password)` → en éxito llama `checkUserRole(user.uid)`.
4. `checkUserRole(uid)`: `db.collection('usuarios').doc(uid).get()` → lee `doc.data().rol`:
   - `rol === 'admin'` → `window.location.href = 'index.html'`;
   - `rol === 'mesero'` → `window.location.href = 'mesero.html'`;
   - si no existe doc o rol no válido → muestra error, `auth.signOut()`.
5. **onAuthStateChanged** (auth.js): si no hay usuario y la página no es login → redirige a `login.html`; si hay usuario y está en login → llama de nuevo `checkUserRole` para redirigir según rol.

### 2.2 Panel admin (index.html + app.js)

1. **Navegación SPA:** Enlaces en sidebar con `data-section="dashboard"`, `data-section="ordenes"`, etc. Click → `mostrarSeccion(sectionId)`: quita `.active` de todas las secciones, añade `.active` a `#section-{sectionId}` y al enlace con ese `data-section`; actualiza `#headerTitle` con `titulosSeccion[sectionId]`.
2. **Secciones (IDs de sección):** dashboard, ordenes, pedidos, cotizaciones, menu, meseros, gastos, reportes, reporte-semanal, mantenimiento, configuracion.
3. **Tiempo real:** `onSnapshot` en:
   - `ventas` (rango día) y `gastos` (rango día) → dashboard (ventasDia, gastosDia, gananciaNeta);
   - `ordenes` → conteo órdenes activas y listado en `#ordenesBody`;
   - `menu` → listado menú;
   - `usuarios` con `where('rol','==','mesero')` → meseros;
   - `configuracion` doc `mesas` → configuración de mesas.
4. **Cobro de orden:** Usuario marca orden como pagada → se abre modal método de pago → al confirmar se escribe un doc en `ventas` (timestamp, mesa, total, platillos, meseroNombre, etc.) y la orden se actualiza o se elimina (`ordenes.doc(id).update` o `.delete()`).
5. **Menú:** CRUD vía `menu` (add, update, delete). **Meseros:** creación con Auth + Firestore `usuarios` (rol `mesero`). **Gastos:** `gastos.add()`. **Reportes:** consultas por rango de fechas sobre `ventas` y `gastos`, exportación HTML para imprimir/PDF. **Reporte semanal:** agregaciones por día, mesero, platillo (lunes–domingo). **Mantenimiento:** búsqueda/eliminación por período en órdenes, cotizaciones, gastos (con confirmación). **Configuración:** `configuracion/mesas` (lista de mesas) y `configuracion/restaurante` (nombre, moneda).

### 2.3 Panel mesero (mesero.html)

1. **Carga:** `auth.onAuthStateChanged` → si hay user, se obtiene nombre en `usuarios/{uid}` y se muestran mesas. Mesas desde `db.collection('configuracion').doc('mesas').onSnapshot` (campo tipo array o lista de números de mesa).
2. **Grid de mesas:** `#tablesGrid` con botones por mesa. Estado por mesa: sin orden, con orden del propio mesero (`meseroId === uid`), con orden de otro mesero (clases `.has-order`, `.mesa-propia`, `.mesa-ocupada-otro`). Datos de ocupación desde `ordenes.onSnapshot` (mapeo mesa → meseroId).
3. **Abrir pedido:** Click en mesa → `openModal(tableNum)`: `selectedTable = tableNum`, `order = {}`, se rellena el menú en el modal (desde `menu.onSnapshot`), se muestra resumen vacío. Modal: overlay con lista de productos (`.btn-add` por ítem), resumen en `#orderItems` y `#orderTotal`, botón `#btnSend` (Enviar Orden).
4. **Agregar ítems:** Cada `.btn-add` llama `addItem(id, name, price)`: actualiza objeto `order[id] = { name, price, qty }`, incrementa `qty`, llama `updateOrderSummary()` (refresca HTML del resumen y total) y muestra toast `#toastAdd` con texto tipo "+ Nombre  ×2" (500 ms).
5. **Enviar orden:** Si es mesa nueva: `db.collection('ordenes').add({ mesa, platillos, total, estado: 'pendiente', meseroId: user.uid, meseroNombre, timestamp })`. Si es "Agregar platillo" a orden existente: se fusionan platillos y `ordenes.doc(editandoOrdenId).update({ platillos, total })`. Luego se cierra el modal y se resetea `order`.
6. **Mis órdenes:** Listener `ordenes.where('meseroId','==', user.uid)` (y filtro por fecha si existe). Cada orden se pinta como card: mesa, estado, platillos, total y botón WhatsApp en la misma fila, botón "Agregar platillo". Desde la card se puede: enviar WhatsApp (`ticket.js`), imprimir, agregar platillos (abre modal en modo edición), +/- cantidad o eliminar ítem (update del doc `ordenes` con array `platillos` y `total` recalculado).

### 2.4 Tickets

- **ticket.js** (cargado en index y mesero): `prepararTicket(ordenId)` — lee orden en Firestore, genera HTML de ticket 58 mm, abre ventana y `window.print()`. `enviarWhatsApp(ordenId)` — mismo HTML adaptado para imagen (tabla), html2canvas para PNG y enlace WhatsApp. Cotizaciones: `prepararCotizacion(cotizacionId)`, `enviarWhatsAppCotizacion(cotizacionId)`. En **mesero.html** hay además un contenedor e estilos `@media print` para impresión térmica 80 mm.

---

## 3. Elementos DOM e IDs clave

### Login (login.html)

| ID / elemento | Uso |
|---------------|-----|
| `#loginForm` | Formulario de login (submit → auth) |
| `#email` | Input correo |
| `#password` | Input contraseña |
| `#loginBtn` | Botón submit (texto "Ingresar", spinner mientras carga) |
| `#errorMessage` | Mensaje de error (clase `.visible` para mostrar) |
| `#btnDemo` | Botón "Ver demo completo" (Admin: demo@restiq.com / demo1234) |
| `#btnDemoMesero` | Botón "Ver demo de mesero" (mesero@restiq.com / demo1234) |
| `#btnInstall` | Botón instalar PWA (oculto hasta beforeinstallprompt) |

Layout: `.page` (grid dos columnas), `.brand-panel` (izquierda), `.form-panel` (derecha). Variables CSS en `:root`: `--gold`, `--bg`, `--text`, `--text-muted`, `--border`, etc.

### Panel admin (index.html)

| ID / elemento | Uso |
|---------------|-----|
| `#headerTitle` | Título de la sección actual |
| `#adminName` | Nombre del admin (opcional) |
| `#btnLogout` / `#btnLogoutSidebar` | Cerrar sesión |
| `.nav-list a[data-section]` | Navegación; `data-section` = id de sección |
| `.section` / `#section-dashboard`, `#section-ordenes`, … | Secciones; solo una con `.active` |
| `#ventasDia`, `#gastosDia`, `#gananciaNeta`, `#ordenesActivas` | Dashboard |
| `#ordenesBody` | Listado de órdenes en vivo |
| `#modalMetodoPago`, `#btnCancelarMetodoPago`, … | Modal método de pago al cobrar |
| `#menuCardsGrid`, `#menuFilterPills`, `#menuEmptyState` | Sección menú |
| `#modalPlatillo`, `#platilloNombre`, `#platilloPrecio`, `#platilloCategoria`, `#btnGuardarPlatillo` | Modal alta/edición platillo |
| `#meserosGrid`, `#modalMesero`, `#meseroNombre`, `#meseroEmail`, `#meseroPassword`, `#btnGuardarMesero` | Meseros |
| `#gastoDescripcion`, `#gastoCategoria`, `#gastoMonto`, `#gastoMetodoPago`, `#btnRegistrarGasto` | Gastos |
| `#reporteDesde`, `#reporteHasta`, `#btnFiltrarReporte`, `#btnExportarPdf`, `#reportesBody` | Reportes |
| `#reporteSemanalPeriodo`, `#btnGenerarReporteSemanal`, `#reporteSemanalContenido` | Reporte semanal |
| Mantenimiento: `#btnBuscarOrdenes`, `#btnEliminarOrdenes`, etc. | Búsqueda y eliminación por período |
| Configuración: `#restauranteNombre`, `#configRestauranteMensaje`, carga/guardado `configuracion/mesas` | Config restaurante y mesas |

### Panel mesero (mesero.html)

| ID / elemento | Uso |
|---------------|-----|
| `#waiterName` | Nombre del mesero en header |
| `#btnLogout` | Cerrar sesión |
| `#tablesGrid` | Contenedor de botones de mesas |
| `.table-btn` | Botón por mesa (selected: `.selected` / `.active`) |
| Modal pedido: overlay con clase `.open` para abrir | Contenedor del modal de orden |
| `#orderItems` | Lista de ítems del resumen en el modal |
| `#orderTotal` | Total del pedido en el modal |
| `#btnSend` | "Enviar Orden" o "Agregar platillos" (según modo) |
| `#toastAdd` | Toast de confirmación al agregar ítem ("+ Nombre  ×N") |
| `#myOrdersList` | Lista de "Mis órdenes" (cards por orden) |
| Cards: `.order-card`, `.order-card-mesa`, `.order-card-total`, `.order-card-actions` (oculto), `.btn-whatsapp-mesero`, `.btn-agregar-mas` | Estructura de cada orden en la lista |

Menú en modal: productos con `.product-card`, `.btn-add` con `data-id`, `data-name`, `data-price`. Filtros por categoría (pills). Grid de menú en móvil: `.menu-cards-grid` (2 columnas en `@media (max-width: 768px)`).

---

## 4. Estructura Firestore (modelo de datos)

- **`usuarios/{uid}`**  
  Campos: `rol` ('admin' | 'mesero'), `nombre`, `email`. El rol determina la redirección tras login.

- **`menu/{id}`**  
  Campos: `nombre`, `precio` (number), `categoria`.

- **`ordenes/{id}`**  
  Campos: `mesa` (string), `platillos` (array de `{ nombre, precio, cantidad }`), `total` (number), `estado` ('pendiente', 'preparando', 'listo', 'entregado', 'pagada', etc.), `meseroId` (uid), `meseroNombre` (string), `timestamp` (Firestore serverTimestamp). El mesero filtra "mis órdenes" con `where('meseroId','==', user.uid)`.

- **`ventas/{id}`**  
  Campos: `timestamp`, `total`, `platillos`, `mesa`, `meseroNombre`, y opcionales como `metodoPago`. Se crean al cobrar una orden desde el admin.

- **`gastos/{id}`**  
  Campos: `fecha` (timestamp o string), `descripcion`, `categoria`, `monto`, `metodoPago`.

- **`cotizaciones/{id}`**  
  Estructura similar a órdenes; usada para pedidos presupuestados. Reporte semanal y mantenimiento pueden leer/eliminar por período.

- **`configuracion/mesas`**  
  Documento único: típicamente un campo (ej. `numeros` o `mesas`) con array de números o nombres de mesa para el grid del mesero.

- **`configuracion/restaurante`**  
  Documento único: nombre del restaurante, moneda, etc., usado en configuración del admin.

---

## 5. Archivos del proyecto y relaciones

```
restaurante-pro/
├── index.html          # Panel admin (SPA): todas las secciones, modales
├── login.html          # Login: formulario + botones demo Admin/Mesero
├── mesero.html         # Panel mesero: mesas, modal menú, mis órdenes, script inline
├── estilos.css         # Sistema dark/dorado global (variables, layout, componentes)
├── firebase-config.js  # firebaseConfig + firebase.initializeApp; expone auth, db
├── auth.js             # Submit login, checkUserRole(uid), onAuthStateChanged
├── app.js              # Lógica admin: mostrarSeccion, onSnapshot, CRUD, reportes, cobro
├── toasts.js           # showToast(message, type) — success | error | info
├── ticket.js           # prepararTicket, enviarWhatsApp, prepararCotizacion, enviarWhatsAppCotizacion
├── sw.js               # Service Worker: precache estáticos, fetch Network First, excluye Firebase
├── service-worker.js   # Variante SW (no registrada por defecto)
├── manifest.json       # PWA: nombre, iconos, display standalone
├── vercel.json         # Headers para SW y manifest
├── REPORTE_PWA_CONTABILIDAD.md
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

### Orden de carga de scripts

- **login.html:** Firebase SDKs → firebase-config.js → auth.js → script inline (SW, install, demo buttons).
- **index.html:** Chart.js, html2canvas → Firebase SDKs → firebase-config.js → auth.js → toasts.js → ticket.js → app.js → SW.
- **mesero.html:** html2canvas → Firebase SDKs → firebase-config.js → auth.js → toasts.js → ticket.js → script inline (mesero) → SW.

**Dependencias:** Cualquier script que use `auth` o `db` debe cargar después de Firebase SDKs y `firebase-config.js`. En admin, `app.js` usa `showToast` (toasts.js) y `prepararTicket`/`enviarWhatsApp` (ticket.js). Mesero usa `showToast`, `enviarWhatsApp` y el propio script inline (order, addItem, updateOrderSummary, listeners Firestore).

### Descripción breve por archivo

| Archivo | Qué hace |
|---------|----------|
| **login.html** | Página de acceso: form email/contraseña, botones demo (Admin y Mesero), layout dos columnas (brand + form). No carga toasts.js. |
| **auth.js** | Submit → signInWithEmailAndPassword → checkUserRole → get usuarios/{uid} → redirect. onAuthStateChanged protege páginas y redirige al login o por rol. |
| **index.html** | SPA admin: secciones con id `section-*`, nav por `data-section`, modales (platillo, mesero, método pago). Carga estilos.css, Chart.js, html2canvas, Firebase, auth, toasts, ticket, app. |
| **app.js** | IIFE. Referencias a todos los IDs del admin; mostrarSeccion; onSnapshot ventas, gastos, ordenes, menu, usuarios (meseros), configuracion; dashboard; CRUD menú y meseros; gastos; reportes por fechas y reporte semanal; mantenimiento; configuración mesas/restaurante; cobro orden (modal → ventas.add, orden update/delete). |
| **mesero.html** | Grid mesas desde configuracion/mesas; modal con menú (menu.onSnapshot), order {}, addItem, updateOrderSummary, btnSend → ordenes.add o update; listener ordenes por meseroId; cards con total + WhatsApp y "Agregar platillo"; toast #toastAdd. Bloque <style> con tema dark/dorado. |
| **estilos.css** | :root (colores, tipografía, sombras, radios). Layout sidebar + content. Componentes: botones, tablas, modales, formularios. Usado por index, login, mesero. |
| **toasts.js** | showToast(msg, type). Crea contenedor si no existe; fallback a alert. |
| **ticket.js** | Lee orden/cotización de Firestore, genera HTML ticket (58 mm o formato WhatsApp), print o html2canvas. |
| **sw.js** | install: precache index, mesero, login, firebase-config, auth, app, iconos. fetch: mismo origen; excluye URLs con firebase/googleapis/gstatic; Network First con fallback a caché. |

---

## 6. Convenciones de código

- **JavaScript:** Vanilla, IIFE, sin frameworks. Uso de `getElementById`, `querySelector`, `addEventListener`. Variables globales: `auth`, `db` (firebase-config.js), `showToast` (toasts.js), y en ventana las funciones de ticket.js.
- **Navegación admin:** `data-section` en enlaces; sección visible = elemento con id `section-{sectionId}` y clase `active`.
- **Nombres Firestore:** Colecciones en minúsculas: `usuarios`, `menu`, `ordenes`, `ventas`, `gastos`, `cotizaciones`, `configuracion`. Documentos: `configuracion/mesas`, `configuracion/restaurante`; usuarios por uid.
- **Marca:** "Familia González" en tickets e impresiones (ticket.js y textos en la app). RESTIQ como nombre de producto en login y headers.

---

## 7. Perspectiva cliente (para el negocio)

### ¿Para qué sirve?

Control de **ventas, gastos y operación** del restaurante desde navegador o PWA: el dueño ve en tiempo real ventas y gastos; los meseros toman pedidos por mesa. Todo en la nube, con reportes e impresión de tickets.

### Funciones principales

**Admin:** Dashboard (ventas/gastos del día, ganancia, órdenes activas), gráfica 7 días, órdenes en vivo (cambiar estado, cobrar, imprimir ticket), menú (CRUD), meseros (crear/listar/eliminar), gastos, reportes por fechas y exportar/PDF, reporte semanal, pedidos y cotizaciones, configuración (mesas, restaurante), mantenimiento (eliminar por período con confirmación).

**Mesero:** Login → panel mesero; ver mesas y elegir una; abrir modal, agregar ítems del menú, enviar orden (o agregar a una existente); ver "Mis órdenes" con total y WhatsApp en la misma fila; agregar platillos, cambiar cantidades; toast al agregar ítem; imprimir ticket / 80 mm si está disponible.

### Credenciales demo (login)

- **Admin:** demo@restiq.com / demo1234 (botón "Ver demo completo").
- **Mesero:** mesero@restiq.com / demo1234 (botón "Ver demo de mesero").

---

## 8. Resumen ejecutivo

| Pregunta | Respuesta técnica | Respuesta cliente |
|----------|-------------------|-------------------|
| **¿Qué es?** | PWA con Firebase (Auth + Firestore), dos frontends (admin + mesero), Service Worker, toasts, reportes, tickets 58 mm y 80 mm (mesero), diseño dark/dorado, marca Familia González. | App para ventas, gastos y pedidos del restaurante desde navegador o app instalada. |
| **¿Para qué sirve?** | Centralizar operación y contabilidad en Firestore en tiempo real, con roles admin/mesero y sin backend propio. | Control de caja, pedidos por mesa, reportes e impresión de tickets. |
| **¿Cómo funciona?** | Login → rol en Firestore → redirect; onSnapshot en colecciones; toasts; reportes por fechas; PWA Network First. | Entrar con usuario/contraseña o demo; admin gestiona todo; mesero toma pedidos y ve sus órdenes; al cobrar se registra venta y se puede imprimir. |

---

*Documento de contexto del proyecto Restaurante Pro — Familia González — PWA de contabilidad. Actualizado para servir como referencia completa para IA (p. ej. Cursor) y para desarrolladores. Última actualización: marzo 2026.*
