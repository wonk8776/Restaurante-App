# Reporte: PWA de Contabilidad — Restaurante Pro (Familia González)

Este documento describe **qué se construyó**, **para qué sirve** y **cómo funciona** el sistema, desde dos perspectivas: **técnica** (para desarrolladores) y **orientada al cliente** (beneficios y funciones para el negocio). La aplicación está personalizada con la marca **Familia González** en todas las pantallas (admin, mesero, login), tickets e impresiones.

---

## 1. Perspectiva técnica (para programadores)

### ¿Qué se construyó?

Una **Progressive Web App (PWA)** de gestión y contabilidad para restaurante, con dos interfaces: **panel de administración** y **panel de mesero**. El backend es **Firebase** (Auth + Firestore); no hay servidor propio. La lógica está en JavaScript vanilla (IIFE, sin frameworks).

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | HTML5, CSS3 (variables CSS, Grid, Flexbox), JavaScript ES5/ES6 (vanilla) |
| **Backend / BBDD** | Firebase: **Authentication** (email/contraseña), **Firestore** (NoSQL, tiempo real) |
| **PWA** | `manifest.json` (standalone, theme, icons), **Service Worker** (caché Network First, exclusión de APIs Firebase) |
| **Gráficos** | Chart.js (gráfica de ingresos/gastos últimos 7 días en el dashboard) |
| **Hosting** | Vercel: `vercel.json` con headers para `service-worker.js` (no-cache, Service-Worker-Allowed) y `manifest.json` (Content-Type correcto) |

### Arquitectura y ciclo de datos

- **Entrada única:** `login.html` → Firebase Auth (`signInWithEmailAndPassword`). Tras login, se consulta Firestore `usuarios/{uid}` para el campo `rol` (`admin` o `mesero`).
- **Redirección por rol:** `auth.js` → si `rol === 'admin'` → `index.html`; si `rol === 'mesero'` → `mesero.html`.
- **Panel admin (`index.html` + `app.js`):** SPA con navegación por `data-section`; cada sección muestra/oculta un `.section.active`. Sin router; todo en un solo HTML.
- **Panel mesero (`mesero.html`):** Página independiente que lee `menu` y `configuracion/mesas`, y escribe en `ordenes`. Opcionalmente usa su propio script embebido o compartido para lógica de pedidos.
- **Tiempo real:** Firestore `onSnapshot` en colecciones críticas: `ordenes`, `ventas`, `gastos`, `menu`, `usuarios` (meseros), `configuracion`. El dashboard (ventas del día, gastos del día, ganancia, órdenes activas) se actualiza sin recargar.
- **Flujo orden → venta:** En admin, al marcar una orden como "Pagada" se elige método de pago; se escribe un documento en `ventas` (timestamp, mesa, mesero, platillos, total) y la orden se actualiza a `estado: 'pagada'` o se elimina según lógica del código.

### Colecciones Firestore utilizadas

- **`usuarios`** — Documentos por `uid`; campos: `rol` (admin/mesero), `nombre`, `email`. Los meseros se listan con `where('rol', '==', 'mesero')`.
- **`menu`** — Platillos: `nombre`, `precio`, `categoria`.
- **`ordenes`** — Órdenes activas/histórico: `mesa`, `platillos[]`, `total`, `estado`, `timestamp`, `meseroId`, `meseroNombre`, etc.
- **`ventas`** — Ventas cerradas: `timestamp`, `total`, `platillos`, `mesa`, `meseroNombre`, etc.
- **`gastos`** — Gastos del negocio: `fecha`, `descripcion`, `categoria`, `monto`, `metodoPago`.
- **`cotizaciones`** — Cotizaciones (pedidos presupuestados): estructura similar a órdenes con `timestamp`, detalles, total.
- **`configuracion/mesas`** — Documento único con configuración de mesas (ej. número o lista de mesas) para el panel del mesero.

### Lógica de negocio relevante

- **Dashboard:** Ventas del día y gastos del día con consultas Firestore por rango de fechas (inicio/fin del día); ganancia neta = ventas − gastos. Órdenes activas = conteo de órdenes con estado distinto de `pagada`/`cancelada`.
- **Reportes:** Filtro por fechas "Desde/Hasta" sobre `ventas` y `gastos`; totales y listados; "Exportar PDF" abre una ventana nueva con HTML generado (resumen + tablas) y permite imprimir (no usa librería PDF externa).
- **Reporte semanal:** Rango lunes–domingo de la semana actual; agregaciones por día, por mesero, por platillo (más vendido, top 5); hora pico y mesa más activa; salida en pantalla e impresión con estilos `print-reporte-semanal`.
- **Mantenimiento:** Búsqueda por período (solo conteo) y eliminación por período en `ordenes`, `cotizaciones`, `gastos` con confirmaciones y escritura explícita "CONFIRMAR" para evitar borrados accidentales; uso de batches para eliminar en lotes (límite Firestore).
- **Tickets:** `ticket.js` obtiene la orden por ID desde Firestore, genera HTML de ticket (80 mm / impresión) y dispara `window.print()` con limpieza en `afterprint`.

### Service Worker y PWA

- **Estrategia:** Network First: petición a red primero; si falla, se sirve desde caché.
- **Exclusiones:** Las peticiones a dominios de Firebase (Firestore, Auth, etc.) no se cachean; siempre se pasan a la red.
- **Assets estáticos:** HTML (index, mesero, login), JS (app, auth, firebase-config, ticket), manifest, iconos PWA (192/512); favicons (Favicon.png, Favicon.jpg) disponibles para la pestaña del navegador. Se precachean en `install` y se usa `skipWaiting`/`clients.claim` en `activate`.
- **Manifest:** Nombre "Familia González", `short_name` "Fam. González", descripción "Sistema de gestión · Familia González", `display: standalone`, `theme_color: #D4AF37`, `background_color: #121212`, iconos 192 y 512.

### Seguridad y consideraciones

- Reglas de Firestore deben restringir lectura/escritura por `auth.uid` y/o rol (por ejemplo, solo admin puede escribir en `usuarios` o en `gastos`); el código asume que el backend (Firebase) valida.
- Credenciales de Firebase están en `firebase-config.js` (frontend); en producción es recomendable proteger con reglas y, si aplica, restringir dominios en la consola de Firebase.

### Resumen técnico en una frase

*Se construyó una PWA con HTML/CSS/JS vanilla que usa Firebase Auth para roles (admin/mesero) y Firestore en tiempo real para menú, órdenes, ventas, gastos y cotizaciones, con Service Worker Network First, reportes por fechas, exportación a HTML imprimible y tickets de impresión, personalizada con la marca Familia González.*

---

## 2. Perspectiva cliente (para el negocio)

### ¿Para qué sirve?

Sirve para **llevar el control de ventas, gastos y operación del restaurante** desde el celular o la computadora: el dueño o encargado ve en tiempo real cuánto se vende y cuánto se gasta, y los meseros pueden tomar pedidos por mesa sin necesidad de una caja registradora compleja. Todo queda registrado en la nube y se pueden generar reportes e imprimir tickets.

### ¿Qué beneficios tiene para el cliente?

- **Un solo sistema:** Entra desde el navegador (o instalando la PWA en el teléfono) y tiene panel de administración y panel para meseros en un mismo proyecto.
- **Datos en tiempo real:** Ventas del día, gastos del día y ganancia se actualizan solos; las órdenes que toman los meseros se ven al instante en el panel del admin.
- **Menos errores y más orden:** Pedidos por mesa, con menú actualizable; al cobrar se registra la venta y queda historial (ventas, gastos) para reportes.
- **Reportes y contabilidad:** Puede filtrar por fechas, ver total de ingresos y gastos, saldo del período y exportar/imprimir un reporte (por ejemplo para el contador o para revisión semanal).
- **Uso en móvil:** La PWA se puede “instalar” en el teléfono y usarse como una app; si hay internet inestable, la interfaz puede seguir cargando desde caché (según estrategia del Service Worker).
- **Sin servidor propio:** No tiene que mantener un servidor; todo corre en Firebase (Google), con copia de seguridad y disponibilidad gestionadas por el proveedor.

### Funciones principales (qué puede hacer)

**Para el administrador / dueño:**

1. **Dashboard:** Ver ventas del día, gastos del día, ganancia neta y cantidad de órdenes activas.
2. **Resumen por períodos:** Semana, mes y total histórico de ingresos, gastos y saldo.
3. **Gráfica:** Últimos 7 días de ingresos y gastos en una gráfica.
4. **Órdenes en vivo:** Listado de órdenes; cambiar estado (pendiente, preparando, servido); cobrar (elegir método de pago) y registrar la venta; imprimir ticket.
5. **Menú:** Dar de alta, editar y eliminar platillos (nombre, precio, categoría).
6. **Meseros:** Crear cuentas de mesero (email/contraseña) y asignar rol; listar y eliminar meseros.
7. **Gastos:** Registrar gastos con descripción, categoría, monto y método de pago; listado en tiempo real.
8. **Reportes:** Filtrar ventas por fechas; ver total de ventas del período; exportar reporte (abre ventana con resumen + tablas de ingresos y gastos para imprimir o guardar como PDF desde el navegador).
9. **Reporte semanal:** Resumen de la semana (lunes a domingo): ingresos, gastos, ganancia, día y hora pico, platillo más vendido, mesero destacado, etc.; imprimible.
10. **Pedidos y cotizaciones:** Gestionar pedidos y cotizaciones (crear, editar, imprimir).
11. **Configuración:** Ajustar mesas (número o lista de mesas) que ven los meseros.
12. **Mantenimiento:** Buscar y, si se desea, eliminar registros antiguos de órdenes, cotizaciones o gastos por rango de fechas (con confirmaciones para evitar borrados por error).

**Para el mesero:**

1. Iniciar sesión con su cuenta (redirección automática al panel de mesero).
2. Ver las mesas configuradas y elegir una.
3. Armar el pedido desde el menú (cantidades y platillos); enviar la orden a cocina/administración.
4. (Según implementación) Ver órdenes activas de sus mesas e imprimir ticket si está disponible en su pantalla.

### ¿Cómo lo usa en el día a día?

- **Entrada:** Abre la página de login, ingresa email y contraseña. Si es admin, entra al panel de administración; si es mesero, al panel de mesero.
- **En servicio:** El mesero elige mesa, arma el pedido en la app y lo envía; en el panel admin se ve la orden y se puede cambiar estado y, al cobrar, registrar la venta e imprimir ticket.
- **Al cierre o para contabilidad:** En Reportes elige fechas, ve totales y usa “Exportar PDF” para imprimir o guardar el reporte; también puede usar el Reporte semanal para una vista consolidada de la semana.

### Resumen para el cliente en una frase

*Es una aplicación que instala o abre en el navegador para controlar ventas y gastos del restaurante en tiempo real, que los meseros tomen pedidos por mesa, que se impriman tickets y que pueda sacar reportes por fechas para su contabilidad o revisión, sin necesidad de tener un servidor propio.*

---

## 3. Estructura técnica del proyecto (perspectiva archivo por archivo)

Esta sección documenta **cómo está construido** el proyecto: ubicación de cada archivo, **qué hace** y **cómo se relaciona** con el resto. El objetivo es tener una visión integral y clara para mantenimiento, onboarding o auditoría técnica.

### 3.1 Árbol de archivos y carpetas

```
restaurante-pro/
├── index.html              # Panel de administración (SPA)
├── login.html              # Página de inicio de sesión
├── mesero.html             # Panel del mesero (tomar pedidos por mesa)
├── estilos.css             # Estilos globales (variables, layout, componentes)
├── firebase-config.js      # Configuración e inicialización de Firebase (Auth + Firestore)
├── auth.js                 # Lógica de login y redirección por rol (admin / mesero)
├── app.js                  # Lógica completa del panel admin (dashboard, órdenes, menú, reportes, etc.)
├── ticket.js               # Generación de tickets (impresión 58mm y PNG para WhatsApp)
├── sw.js                   # Service Worker registrado por la app (PWA, caché)
├── service-worker.js       # Alternativa de Service Worker (Network First, exclusiones Firebase)
├── manifest.json           # Manifest PWA (nombre, iconos, display standalone)
├── vercel.json             # Configuración de despliegue en Vercel (headers SW y manifest)
├── REPORTE_PWA_CONTABILIDAD.md   # Este documento
└── icons/
    ├── icon-192.png        # Icono PWA 192×192
    └── icon-512.png        # Icono PWA 512×512
```

**Nota:** La aplicación registra **`sw.js`** en el navegador (`index.html`, `login.html`, `mesero.html`). El archivo **`service-worker.js`** es una variante más detallada (Network First, exclusión explícita de Firebase); si se desea usar esa versión, hay que registrar `service-worker.js` en lugar de `sw.js` y asegurar que Vercel sirva ese archivo (en `vercel.json` ya hay headers para `/service-worker.js`).

---

### 3.2 Descripción archivo por archivo

| Ubicación | Archivo | Qué hace | Dónde se usa / dependencias |
|-----------|---------|----------|-----------------------------|
| **Raíz** | `index.html` | Página única del **panel de administración**. Contiene el markup de todas las secciones (Dashboard, Órdenes, Menú, Meseros, Gastos, Reportes, Reporte semanal, Mantenimiento, Configuración). Navegación por `data-section` sin recargar; una sola sección visible (`.section.active`). Incluye modales (platillo, mesero, método de pago, etc.). | Carga: `estilos.css`, Firebase (compat), `firebase-config.js`, `auth.js`, `ticket.js`, `app.js`, Chart.js, html2canvas. Registra `sw.js`. Solo accesible tras login con rol `admin`. |
| **Raíz** | `login.html` | Página de **inicio de sesión**: formulario email/contraseña. Al enviar, llama a Firebase Auth y luego consulta el rol en Firestore (`usuarios/{uid}`); redirige a `index.html` (admin) o `mesero.html` (mesero). Muestra errores de login y estado de carga. | Carga: `estilos.css`, Firebase (compat), `firebase-config.js`, `auth.js`. Registra `sw.js`. No requiere estar logueado. |
| **Raíz** | `mesero.html` | Página del **panel del mesero**: selección de mesa, menú desde Firestore, armado del pedido (cantidades/platillos) y envío a la colección `ordenes`. Opcionalmente impresión de ticket y envío por WhatsApp (usa `ticket.js`). | Carga: `estilos.css`, Firebase (compat), `firebase-config.js`, `auth.js`, `ticket.js`, script inline del mesero. Registra `sw.js`. Solo accesible tras login con rol `mesero`. |
| **Raíz** | `estilos.css` | **Hojas de estilo globales**: variables CSS (`:root`), tipografía (Inter), layout (sidebar, contenido, cards), componentes (botones, tablas, modales, formularios), estados (hover, active, error). Usado por `index.html`, `login.html` y `mesero.html`. | Referenciado con `<link rel="stylesheet" href="estilos.css">` en las tres páginas HTML. |
| **Raíz** | `firebase-config.js` | **Configuración de Firebase**: objeto `firebaseConfig` (apiKey, authDomain, projectId, etc.) y llamada a `firebase.initializeApp()`. Expone `auth` y `db` (Firestore) como variables globales. Debe cargarse **después** de los scripts de Firebase (app, auth, firestore) y **antes** de `auth.js` y `app.js`. | Cargado en `index.html`, `login.html` y `mesero.html` después de los SDKs de Firebase. |
| **Raíz** | `auth.js` | **Autenticación y redirección por rol**: maneja el submit del formulario de login (`signInWithEmailAndPassword`), obtiene el documento `usuarios/{uid}` en Firestore, lee el campo `rol` y redirige a `index.html` (admin) o `mesero.html` (mesero). Incluye `onAuthStateChanged` para redirigir al login si no hay sesión en una página protegida. Muestra errores y estado de carga en la UI. | Cargado en las tres páginas HTML después de `firebase-config.js`. Depende de `auth` y `db` definidos en `firebase-config.js`. |
| **Raíz** | `app.js` | **Lógica del panel administrador**: envuelto en IIFE. Gestiona navegación por secciones, listeners en tiempo real de Firestore (`onSnapshot`) para órdenes, ventas, gastos, menú, usuarios (meseros), configuración. Dashboard (ventas/gastos del día, ganancia, órdenes activas), CRUD de menú y meseros, registro de gastos, reportes por fechas, reporte semanal, mantenimiento (eliminación por período), configuración de mesas. Cobro de órdenes (modal método de pago, escritura en `ventas`). Llama a `prepararTicket`, `enviarWhatsApp`, etc. de `ticket.js`. | Cargado solo en `index.html` después de `ticket.js`. Depende de `auth`, `db` y de las funciones globales de `ticket.js`. |
| **Raíz** | `ticket.js` | **Tickets e impresión**: IIFE que expone `prepararTicket(ordenId)`, `enviarWhatsApp(ordenId)`, `prepararCotizacion(cotizacionId)`, `enviarWhatsAppCotizacion(cotizacionId)`. Lee orden/cotización desde Firestore, genera HTML con estilos para impresión (58 mm) o para imagen PNG (WhatsApp), abre ventana e imprime o usa html2canvas para descargar PNG. Marca "Familia González" en cabecera y pie. | Cargado en `index.html` y `mesero.html` después de `auth.js`. Depende de `db`; usa `html2canvas` si está presente (para WhatsApp). |
| **Raíz** | `sw.js` | **Service Worker** registrado por la app: en `install` precachea lista de estáticos (`index.html`, `mesero.html`, `login.html`, `firebase-config.js`, `auth.js`, `app.js`, iconos). En `fetch` no intercepta peticiones a orígenes distintos ni URLs que contengan "firebase" o "googleapis"/"gstatic"; para el resto de estáticos usa red y actualiza caché (estrategia tipo Network First con fallback a caché). En `activate` limpia cachés antiguos y hace `skipWaiting`/`clients.claim`. | Registrado desde `index.html`, `login.html` y `mesero.html` con `navigator.serviceWorker.register('/sw.js')`. |
| **Raíz** | `service-worker.js` | **Service Worker alternativo**: estrategia Network First documentada; excluye explícitamente Firestore y APIs de Firebase (por hostname). Lista de estáticos incluye `manifest.json` y variantes SVG de iconos. No se registra por defecto en el código actual. | Pensado para registrarse en lugar de `sw.js` si se quiere esta variante; `vercel.json` define headers para `/service-worker.js`. |
| **Raíz** | `manifest.json` | **Web App Manifest**: nombre "Familia González", `short_name`, descripción, `display: standalone`, `theme_color`, `background_color`, iconos 192 y 512. Usado por el navegador para instalar la PWA y mostrar splash/barra. | Enlazado con `<link rel="manifest" href="/manifest.json">` en las tres páginas HTML. |
| **Raíz** | `vercel.json` | **Configuración Vercel**: headers para `/service-worker.js` (Cache-Control: no-cache, Service-Worker-Allowed: /) y para `/manifest.json` (Content-Type: application/manifest+json). Asegura que el SW y el manifest se sirvan correctamente en producción. | Aplicado en el despliegue en Vercel; no lo referencia ningún archivo del front. |
| **Raíz** | `REPORTE_PWA_CONTABILIDAD.md` | **Documentación**: reporte integral del proyecto (perspectiva técnica, cliente y estructura archivo por archivo). | Solo lectura/documentación. |
| **icons/** | `icon-192.png` | Icono de la PWA 192×192 px. | Referenciado en `manifest.json` y como favicon/apple-touch-icon en los HTML. |
| **icons/** | `icon-512.png` | Icono de la PWA 512×512 px. | Referenciado en `manifest.json`. |

---

### 3.3 Orden de carga de scripts (flujo técnico)

- **Login (`login.html`):**  
  Firebase SDKs → `firebase-config.js` → `auth.js` → registro de `sw.js`.

- **Panel admin (`index.html`):**  
  Chart.js (para gráficas) → html2canvas (para PNG WhatsApp) → Firebase SDKs → `firebase-config.js` → `auth.js` → `ticket.js` → `app.js` → registro de `sw.js`.

- **Panel mesero (`mesero.html`):**  
  html2canvas → Firebase SDKs → `firebase-config.js` → `auth.js` → `ticket.js` → script propio del mesero → registro de `sw.js`.

En todas las páginas, **Firebase** y **firebase-config.js** deben cargarse antes que cualquier script que use `auth` o `db`.

---

### 3.4 Dependencias externas (CDN)

| Recurso | Uso |
|--------|-----|
| Firebase JS (app-compat, auth-compat, firestore-compat) v9 | Autenticación y Firestore. |
| Chart.js (jsdelivr) | Gráfica de ingresos/gastos últimos 7 días en el dashboard (solo `index.html`). |
| html2canvas (cdnjs) | Generación de imagen PNG del ticket para WhatsApp en `ticket.js` (en `index.html` y `mesero.html`). |
| Google Fonts (Inter, DM Serif Display) | Tipografía en `estilos.css` y en los HTML. |

---

### 3.5 Resumen de la estructura

- **Entrada:** `login.html` → autenticación y redirección por rol (`auth.js`).
- **Pantallas:** `index.html` (admin) y `mesero.html` (mesero), ambas con `estilos.css` y la misma base Firebase + auth.
- **Backend:** Solo Firebase (Auth + Firestore); no hay servidor propio.
- **PWA:** `manifest.json` + `sw.js` (o `service-worker.js`), con `vercel.json` para headers en producción.
- **Documentación:** `REPORTE_PWA_CONTABILIDAD.md` describe qué hace el sistema, para quién y cómo está construido archivo por archivo.

Con esta sección se tiene una **perspectiva técnica integral** del proyecto: estructura clara, ubicación de archivos, función de cada uno y relaciones entre ellos.

---

## Resumen ejecutivo

| Pregunta | Respuesta técnica | Respuesta cliente |
|----------|-------------------|-------------------|
| **¿Qué construí?** | PWA con Firebase (Auth + Firestore), dos frontends (admin + mesero), Service Worker, reportes por fechas y tickets de impresión; marca Familia González en toda la app. | Sistema para manejar ventas, gastos y pedidos del restaurante (Familia González) desde el celular o la computadora. |
| **¿Para qué sirve?** | Centralizar operación y contabilidad en Firestore en tiempo real, con roles y sin backend propio. | Llevar control de caja, ver ganancia en vivo, que meseros tomen pedidos y sacar reportes para contabilidad. |
| **¿Cómo funciona?** | Login → rol en Firestore → redirección; lecturas/escrituras en tiempo real; reportes con consultas por rango de fechas; PWA con caché Network First. | Entra con usuario/contraseña; admin ve dashboard y reportes; mesero toma pedidos por mesa; al cobrar se registra la venta y puede imprimir ticket y reportes. |

**Documentación de estructura:** El apartado *3. Estructura técnica del proyecto* describe la construcción archivo por archivo: árbol de carpetas, función de cada archivo, ubicación, dependencias y orden de carga de scripts, para una visión integral y plena del proyecto.

---

*Documento generado a partir del proyecto Restaurante Pro — Familia González — PWA de contabilidad. Última actualización: marzo 2025.*
