# Reporte: PWA de Contabilidad — Restaurante Pro (Familia González)

Este documento describe **qué se construyó**, **para qué sirve** y **cómo funciona** el sistema desde dos perspectivas: **técnica** (para desarrolladores e ingenieros: estructura, construcción y flujo del programa) y **orientada al cliente** (utilidad para el negocio y qué puede hacer con la aplicación). La app está personalizada con la marca **Familia González** en admin, mesero, login, tickets e impresiones.

---

## 1. Perspectiva técnica (para programadores)

### Objetivo de esta sección

Proporcionar una **estructura clara del sistema** a nivel de ingeniería: cómo está construido el programa, qué tecnologías se usan, cómo fluyen los datos y cómo se organizan los archivos para mantenimiento o ampliación.

### ¿Qué se construyó?

Una **Progressive Web App (PWA)** de gestión y contabilidad para restaurante con dos interfaces: **panel de administración** y **panel de mesero**. El backend es **Firebase** (Auth + Firestore); no hay servidor propio. La lógica está en **JavaScript vanilla** (IIFE, sin frameworks).

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | HTML5, CSS3 (variables CSS, Grid, Flexbox), JavaScript ES5/ES6 (vanilla) |
| **Backend / BBDD** | Firebase: **Authentication** (email/contraseña), **Firestore** (NoSQL, tiempo real) |
| **PWA** | `manifest.json` (standalone, theme, icons), **Service Worker** (`sw.js`: Network First, exclusión de APIs Firebase) |
| **Gráficos** | Chart.js (ingresos/gastos últimos 7 días en el dashboard) |
| **Notificaciones** | `toasts.js` (toast tipo success/error/info; sustituye `alert`) |
| **Hosting** | Vercel: `vercel.json` con headers para `service-worker.js` y `manifest.json` |

### Arquitectura y ciclo de datos

- **Entrada única:** `login.html` → Firebase Auth (`signInWithEmailAndPassword`). Tras el login se consulta Firestore `usuarios/{uid}` para el campo `rol` (`admin` o `mesero`).
- **Redirección por rol:** `auth.js` → si `rol === 'admin'` → `index.html`; si `rol === 'mesero'` → `mesero.html`.
- **Panel admin (`index.html` + `app.js`):** SPA con navegación por `data-section`; una sola sección visible (`.section.active`). Sin router; todo en un solo HTML. Usa `toasts.js` para feedback (éxito, error, info) y `ticket.js` para tickets e impresión.
- **Panel mesero (`mesero.html`):** Página independiente que lee `menu` y `configuracion/mesas`, escribe en `ordenes` y puede actualizar órdenes existentes (agregar platillos, enviar por WhatsApp). Incluye un bloque `<style>` propio con tema **dark/dorado** alineado al diseño del admin (variables CSS, botones, cards, toast de confirmación al agregar ítem). Responsive: grid de menú 2 columnas en móvil, total y botón WhatsApp en la misma fila por orden.
- **Tiempo real:** Firestore `onSnapshot` en colecciones críticas: `ordenes`, `ventas`, `gastos`, `menu`, `usuarios` (meseros), `configuracion`. El dashboard (ventas del día, gastos del día, ganancia, órdenes activas) se actualiza sin recargar.
- **Flujo orden → venta:** En admin, al marcar una orden como "Pagada" se elige método de pago; se escribe un documento en `ventas` y la orden se actualiza a `estado: 'pagada'` o se elimina según la lógica del código.

### Colecciones Firestore utilizadas

- **`usuarios`** — Documentos por `uid`; campos: `rol` (admin/mesero), `nombre`, `email`. Los meseros se listan con `where('rol', '==', 'mesero')`.
- **`menu`** — Platillos: `nombre`, `precio`, `categoria`.
- **`ordenes`** — Órdenes activas/histórico: `mesa`, `platillos[]`, `total`, `estado`, `timestamp`, `meseroId`, `meseroNombre`, etc.
- **`ventas`** — Ventas cerradas: `timestamp`, `total`, `platillos`, `mesa`, `meseroNombre`, etc.
- **`gastos`** — Gastos del negocio: `fecha`, `descripcion`, `categoria`, `monto`, `metodoPago`.
- **`cotizaciones`** — Cotizaciones (pedidos presupuestados): estructura similar a órdenes con `timestamp`, detalles, total.
- **`configuracion/mesas`** — Documento único con configuración de mesas para el panel del mesero.

### Lógica de negocio relevante

- **Dashboard:** Ventas del día y gastos del día con consultas Firestore por rango de fechas; ganancia neta = ventas − gastos. Órdenes activas = conteo de órdenes con estado distinto de `pagada`/`cancelada`.
- **Reportes:** Filtro por fechas "Desde/Hasta" sobre `ventas` y `gastos`; totales y listados; "Exportar PDF" abre una ventana con HTML generado (resumen + tablas) para imprimir o guardar como PDF desde el navegador.
- **Reporte semanal:** Rango lunes–domingo de la semana actual; agregaciones por día, mesero y platillo (más vendido, top 5); hora pico y mesa más activa; salida en pantalla e impresión con estilos `print-reporte-semanal`.
- **Mantenimiento:** Búsqueda por período y eliminación por período en `ordenes`, `cotizaciones`, `gastos` con confirmaciones y escritura explícita "CONFIRMAR" para evitar borrados accidentales; uso de batches para eliminar en lotes (límite Firestore).
- **Tickets:** `ticket.js` obtiene la orden por ID desde Firestore, genera HTML de ticket (58 mm para impresión estándar) y dispara `window.print()`. En `mesero.html` existe además un contenedor para impresión térmica 80 mm con estilos en `@media print` dentro del mismo archivo.

### Diseño visual (estilos)

- **`estilos.css`:** Sistema de diseño global (variables `:root`: fondos oscuros, acento dorado `#D4AF37`, tipografía Inter / DM Serif Display, sombras, radios). Usado por `index.html`, `login.html` y `mesero.html`.
- **`mesero.html`:** Incluye un bloque `<style>` al final del `<head>` que redefine variables y componentes para mantener el mismo tema dark/dorado (botones de mesa, enviar orden, cantidad, cards de órdenes, toast de confirmación al agregar platillo, grid de menú responsive, etc.) sin depender solo de `estilos.css` para la vista mesero.

### Service Worker y PWA

- **Estrategia:** Network First: petición a red primero; si falla, se sirve desde caché.
- **Exclusiones:** Las peticiones a dominios de Firebase (Firestore, Auth, etc.) no se cachean; siempre se pasan a la red.
- **Assets estáticos:** En `sw.js` se precachean `index.html`, `mesero.html`, `login.html`, `firebase-config.js`, `auth.js`, `app.js` e iconos PWA (192/512). En `activate` se limpian cachés antiguos y se usa `skipWaiting`/`clients.claim`.
- **Manifest:** Nombre "Familia González", `short_name` "Fam. González", descripción del panel y operación, `display: standalone`, `theme_color` y `background_color`, iconos 192 y 512.

### Seguridad y consideraciones

- Las reglas de Firestore deben restringir lectura/escritura por `auth.uid` y/o rol (por ejemplo, solo admin puede escribir en `usuarios` o en `gastos`); el código asume que Firebase valida.
- Las credenciales están en `firebase-config.js` (frontend); en producción es recomendable proteger con reglas y, si aplica, restringir dominios en la consola de Firebase.

### Resumen técnico en una frase

*Se construyó una PWA con HTML/CSS/JS vanilla que usa Firebase Auth para roles (admin/mesero) y Firestore en tiempo real para menú, órdenes, ventas, gastos y cotizaciones, con Service Worker Network First, sistema de toasts, reportes por fechas, exportación a HTML imprimible, tickets de impresión (58 mm y 80 mm en mesero), y diseño dark/dorado unificado (estilos.css + estilos inline en mesero), personalizada con la marca Familia González.*

---

## 2. Perspectiva cliente (para el negocio)

### Objetivo de esta sección

Explicar **para qué sirve** la aplicación y **qué se construyó desde el punto de vista de utilidad**: qué puede hacer el cliente con el sistema en el día a día y qué beneficios obtiene.

### ¿Para qué sirve?

Sirve para **llevar el control de ventas, gastos y operación del restaurante** desde el celular o la computadora: el dueño o encargado ve en tiempo real cuánto se vende y cuánto se gasta, y los meseros pueden tomar pedidos por mesa sin necesidad de una caja registradora compleja. Todo queda registrado en la nube y se pueden generar reportes e imprimir tickets.

### ¿Qué beneficios tiene para el cliente?

- **Un solo sistema:** Entra desde el navegador (o instalando la PWA en el teléfono) y tiene panel de administración y panel para meseros en un mismo proyecto.
- **Datos en tiempo real:** Ventas del día, gastos del día y ganancia se actualizan solos; las órdenes que toman los meseros se ven al instante en el panel del admin.
- **Menos errores y más orden:** Pedidos por mesa, con menú actualizable; al cobrar se registra la venta y queda historial (ventas, gastos) para reportes.
- **Reportes y contabilidad:** Puede filtrar por fechas, ver total de ingresos y gastos, saldo del período y exportar o imprimir un reporte (para el contador o revisión semanal).
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
8. **Reportes:** Filtrar ventas por fechas; ver total del período; exportar reporte (abre ventana con resumen y tablas para imprimir o guardar como PDF).
9. **Reporte semanal:** Resumen de la semana (lunes a domingo): ingresos, gastos, ganancia, día y hora pico, platillo más vendido, mesero destacado, etc.; imprimible.
10. **Pedidos y cotizaciones:** Gestionar pedidos y cotizaciones (crear, editar, imprimir).
11. **Configuración:** Ajustar mesas (número o lista de mesas) que ven los meseros.
12. **Mantenimiento:** Buscar y, si se desea, eliminar registros antiguos de órdenes, cotizaciones o gastos por rango de fechas (con confirmaciones para evitar borrados por error).

**Para el mesero:**

1. Iniciar sesión con su cuenta (redirección automática al panel de mesero).
2. Ver las mesas configuradas y elegir una.
3. Armar el pedido desde el menú (cantidades y platillos); enviar la orden a cocina/administración.
4. Ver sus órdenes activas por mesa: total y botón para enviar por WhatsApp en la misma fila; opción “Agregar platillo” para ampliar una orden ya enviada.
5. Recibir confirmación visual (toast) al agregar un platillo al pedido (nombre y cantidad).
6. (Según implementación) Imprimir ticket desde su pantalla; impresión térmica 80 mm disponible en la vista mesero.

### ¿Cómo lo usa en el día a día?

- **Entrada:** Abre la página de login, ingresa email y contraseña. Si es admin, entra al panel de administración; si es mesero, al panel de mesero.
- **En servicio:** El mesero elige mesa, arma el pedido en la app y lo envía; en el panel admin se ve la orden y se puede cambiar estado y, al cobrar, registrar la venta e imprimir ticket.
- **Al cierre o para contabilidad:** En Reportes elige fechas, ve totales y usa “Exportar PDF” para imprimir o guardar el reporte; también puede usar el Reporte semanal para una vista consolidada de la semana.

### Resumen para el cliente en una frase

*Es una aplicación que instala o abre en el navegador para controlar ventas y gastos del restaurante en tiempo real, que los meseros tomen pedidos por mesa, que se impriman tickets y que pueda sacar reportes por fechas para su contabilidad o revisión, sin necesidad de tener un servidor propio.*

---

## 3. Estructura técnica del proyecto (perspectiva archivo por archivo)

Esta sección documenta **cómo está construido** el proyecto: ubicación de cada archivo, **qué hace** y **cómo se relaciona** con el resto. Objetivo: visión integral y clara para mantenimiento, onboarding o auditoría técnica.

### 3.1 Árbol de archivos y carpetas

```
restaurante-pro/
├── index.html              # Panel de administración (SPA)
├── login.html              # Página de inicio de sesión
├── mesero.html             # Panel del mesero (pedidos por mesa, tema dark/dorado inline)
├── estilos.css             # Estilos globales (sistema dark/dorado, variables, layout, componentes)
├── firebase-config.js      # Configuración e inicialización de Firebase (Auth + Firestore)
├── auth.js                 # Lógica de login y redirección por rol (admin / mesero)
├── app.js                  # Lógica completa del panel admin (dashboard, órdenes, menú, reportes, etc.)
├── toasts.js               # Sistema de notificaciones toast (success, error, info); sustituye alert()
├── ticket.js               # Generación de tickets (impresión 58 mm y PNG para WhatsApp)
├── sw.js                   # Service Worker registrado por la app (PWA, caché Network First)
├── service-worker.js       # Variante de Service Worker (Network First, exclusiones Firebase)
├── manifest.json           # Manifest PWA (nombre, iconos, display standalone)
├── vercel.json             # Configuración de despliegue en Vercel (headers SW y manifest)
├── REPORTE_PWA_CONTABILIDAD.md   # Este documento
└── icons/
    ├── icon-192.png        # Icono PWA 192×192
    └── icon-512.png        # Icono PWA 512×512
```

**Nota:** La aplicación registra **`sw.js`** en el navegador (`index.html`, `login.html`, `mesero.html`). El archivo **`service-worker.js`** es una variante más detallada; si se desea usar esa versión, hay que registrar `service-worker.js` en lugar de `sw.js` y asegurar que Vercel sirva ese archivo (en `vercel.json` ya hay headers para `/service-worker.js`).

---

### 3.2 Descripción archivo por archivo

| Ubicación | Archivo | Qué hace | Dónde se usa / dependencias |
|-----------|---------|----------|-----------------------------|
| **Raíz** | `index.html` | Página única del **panel de administración**. Markup de todas las secciones (Dashboard, Órdenes, Menú, Meseros, Gastos, Reportes, Reporte semanal, Mantenimiento, Configuración). Navegación por `data-section` sin recargar; una sola sección visible (`.section.active`). Incluye modales (platillo, mesero, método de pago, etc.). | Carga: `estilos.css`, Firebase (compat), `firebase-config.js`, `auth.js`, `toasts.js`, `ticket.js`, `app.js`, Chart.js, html2canvas. Registra `sw.js`. Solo accesible tras login con rol `admin`. |
| **Raíz** | `login.html` | Página de **inicio de sesión**: formulario email/contraseña. Al enviar, llama a Firebase Auth y consulta el rol en Firestore (`usuarios/{uid}`); redirige a `index.html` (admin) o `mesero.html` (mesero). Muestra errores de login y estado de carga. | Carga: `estilos.css`, Firebase (compat), `firebase-config.js`, `auth.js`. Registra `sw.js`. No requiere estar logueado. |
| **Raíz** | `mesero.html` | **Panel del mesero**: selección de mesa, menú desde Firestore, armado del pedido (cantidades/platillos) y envío a la colección `ordenes`. Puede agregar platillos a órdenes ya enviadas; total y botón WhatsApp en la misma fila por orden. Incluye bloque `<style>` con tema dark/dorado (variables, botones, cards, toast de confirmación al agregar ítem, grid de menú responsive 2 columnas en móvil). Impresión térmica 80 mm en `@media print`. | Carga: `estilos.css`, Firebase (compat), `firebase-config.js`, `auth.js`, `toasts.js`, `ticket.js`, script inline del mesero. Registra `sw.js`. Solo accesible tras login con rol `mesero`. |
| **Raíz** | `estilos.css` | **Hojas de estilo globales**: sistema dark/dorado (`:root` con fondos oscuros, acento #D4AF37, tipografía Inter / DM Serif Display), layout (sidebar, contenido, cards), componentes (botones, tablas, modales, formularios), estados (hover, active, error). Usado por `index.html`, `login.html` y `mesero.html`. | Referenciado con `<link rel="stylesheet" href="estilos.css">` en las tres páginas HTML. |
| **Raíz** | `firebase-config.js` | **Configuración de Firebase**: objeto `firebaseConfig` (apiKey, authDomain, projectId, etc.) y llamada a `firebase.initializeApp()`. Expone `auth` y `db` (Firestore) como variables globales. Debe cargarse **después** de los SDKs de Firebase y **antes** de `auth.js` y `app.js`. | Cargado en `index.html`, `login.html` y `mesero.html` después de los SDKs de Firebase. |
| **Raíz** | `auth.js` | **Autenticación y redirección por rol**: maneja el submit del formulario de login (`signInWithEmailAndPassword`), obtiene el documento `usuarios/{uid}` en Firestore, lee el campo `rol` y redirige a `index.html` (admin) o `mesero.html` (mesero). Incluye `onAuthStateChanged` para redirigir al login si no hay sesión en una página protegida. | Cargado en las tres páginas HTML después de `firebase-config.js`. Depende de `auth` y `db` definidos en `firebase-config.js`. |
| **Raíz** | `app.js` | **Lógica del panel administrador**: IIFE. Navegación por secciones, listeners en tiempo real de Firestore (`onSnapshot`) para órdenes, ventas, gastos, menú, usuarios (meseros), configuración. Dashboard, CRUD de menú y meseros, registro de gastos, reportes por fechas, reporte semanal, mantenimiento, configuración de mesas. Cobro de órdenes (modal método de pago, escritura en `ventas`). Llama a `prepararTicket`, `enviarWhatsApp`, etc. de `ticket.js` y a `showToast` de `toasts.js`. | Cargado solo en `index.html` después de `ticket.js`. Depende de `auth`, `db`, `ticket.js` y `toasts.js`. |
| **Raíz** | `toasts.js` | **Notificaciones toast**: IIFE que expone `showToast(message, type)`. Tipos: success, error, info. Crea contenedor dinámico si no existe; fallback a `alert()` si falla. Duración configurable. | Cargado en `index.html` y `mesero.html` antes de `ticket.js` y `app.js`. No tiene dependencias de Firebase. |
| **Raíz** | `ticket.js` | **Tickets e impresión**: IIFE que expone `prepararTicket(ordenId)`, `enviarWhatsApp(ordenId)`, `prepararCotizacion(cotizacionId)`, `enviarWhatsAppCotizacion(cotizacionId)`. Lee orden/cotización desde Firestore, genera HTML con estilos para impresión (58 mm) o para imagen PNG (WhatsApp), abre ventana e imprime o usa html2canvas para descargar PNG. Marca "Familia González" en cabecera y pie. | Cargado en `index.html` y `mesero.html` después de `auth.js`. Depende de `db`; usa `html2canvas` si está presente (WhatsApp). |
| **Raíz** | `sw.js` | **Service Worker** registrado por la app: en `install` precachea lista de estáticos (`index.html`, `mesero.html`, `login.html`, `firebase-config.js`, `auth.js`, `app.js`, iconos). En `fetch` no intercepta peticiones a orígenes distintos ni URLs que contengan "firebase" o "googleapis"/"gstatic"; para el resto de estáticos usa red y actualiza caché (Network First con fallback a caché). En `activate` limpia cachés antiguos y hace `skipWaiting`/`clients.claim`. | Registrado desde `index.html`, `login.html` y `mesero.html` con `navigator.serviceWorker.register('/sw.js')`. |
| **Raíz** | `service-worker.js` | **Service Worker alternativo**: estrategia Network First documentada; excluye explícitamente Firestore y APIs de Firebase. No se registra por defecto en el código actual. | Pensado para registrarse en lugar de `sw.js` si se quiere esta variante; `vercel.json` define headers para `/service-worker.js`. |
| **Raíz** | `manifest.json` | **Web App Manifest**: nombre "Familia González", `short_name` "Fam. González", descripción, `display: standalone`, `theme_color`, `background_color`, iconos 192 y 512. Usado por el navegador para instalar la PWA y mostrar splash/barra. | Enlazado con `<link rel="manifest" href="/manifest.json">` en las tres páginas HTML. |
| **Raíz** | `vercel.json` | **Configuración Vercel**: headers para `/service-worker.js` (Cache-Control: no-cache, Service-Worker-Allowed: /) y para `/manifest.json` (Content-Type: application/manifest+json). | Aplicado en el despliegue en Vercel; no lo referencia ningún archivo del front. |
| **Raíz** | `REPORTE_PWA_CONTABILIDAD.md` | **Documentación**: reporte integral del proyecto (perspectiva técnica, cliente y estructura archivo por archivo). | Solo lectura/documentación. |
| **icons/** | `icon-192.png` | Icono de la PWA 192×192 px. | Referenciado en `manifest.json` y como favicon/apple-touch-icon en los HTML. |
| **icons/** | `icon-512.png` | Icono de la PWA 512×512 px. | Referenciado en `manifest.json`. |

---

### 3.3 Orden de carga de scripts (flujo técnico)

- **Login (`login.html`):**  
  Firebase SDKs → `firebase-config.js` → `auth.js` → registro de `sw.js`.

- **Panel admin (`index.html`):**  
  Chart.js → html2canvas → Firebase SDKs → `firebase-config.js` → `auth.js` → `toasts.js` → `ticket.js` → `app.js` → registro de `sw.js`.

- **Panel mesero (`mesero.html`):**  
  html2canvas → Firebase SDKs → `firebase-config.js` → `auth.js` → `toasts.js` → `ticket.js` → script propio del mesero (inline) → registro de `sw.js`.

En todas las páginas, **Firebase** y **firebase-config.js** deben cargarse antes que cualquier script que use `auth` o `db`.

---

### 3.4 Dependencias externas (CDN)

| Recurso | Uso |
|--------|-----|
| Firebase JS (app-compat, auth-compat, firestore-compat) v9 | Autenticación y Firestore. |
| Chart.js (jsdelivr) | Gráfica de ingresos/gastos últimos 7 días en el dashboard (solo `index.html`). |
| html2canvas (cdnjs) | Generación de imagen PNG del ticket para WhatsApp en `ticket.js` (`index.html` y `mesero.html`). |
| Google Fonts (Inter, DM Serif Display) | Tipografía en `estilos.css` y en los HTML. |

---

### 3.5 Resumen de la estructura

- **Entrada:** `login.html` → autenticación y redirección por rol (`auth.js`).
- **Pantallas:** `index.html` (admin) y `mesero.html` (mesero), ambas con `estilos.css` y la misma base Firebase + auth; mesero además con estilos inline (tema dark/dorado y componentes propios).
- **Backend:** Solo Firebase (Auth + Firestore); no hay servidor propio.
- **PWA:** `manifest.json` + `sw.js` (o `service-worker.js`), con `vercel.json` para headers en producción.
- **Documentación:** Este reporte describe qué hace el sistema, para quién y cómo está construido archivo por archivo.

Con esta sección se tiene una **perspectiva técnica integral** del proyecto: estructura clara, ubicación de archivos, función de cada uno y relaciones entre ellos.

---

## Resumen ejecutivo

| Pregunta | Respuesta técnica | Respuesta cliente |
|----------|-------------------|-------------------|
| **¿Qué construí?** | PWA con Firebase (Auth + Firestore), dos frontends (admin + mesero), Service Worker, toasts, reportes por fechas y tickets de impresión (58 mm y 80 mm en mesero); diseño dark/dorado unificado; marca Familia González en toda la app. | Sistema para manejar ventas, gastos y pedidos del restaurante (Familia González) desde el celular o la computadora. |
| **¿Para qué sirve?** | Centralizar operación y contabilidad en Firestore en tiempo real, con roles y sin backend propio. | Llevar control de caja, ver ganancia en vivo, que meseros tomen pedidos y sacar reportes para contabilidad. |
| **¿Cómo funciona?** | Login → rol en Firestore → redirección; lecturas/escrituras en tiempo real; toasts para feedback; reportes con consultas por rango de fechas; PWA con caché Network First. | Entra con usuario/contraseña; admin ve dashboard y reportes; mesero toma pedidos por mesa y puede agregar a órdenes y enviar por WhatsApp; al cobrar se registra la venta y puede imprimir ticket y reportes. |

**Documentación de estructura:** El apartado *3. Estructura técnica del proyecto* describe la construcción archivo por archivo: árbol de carpetas, función de cada archivo, ubicación, dependencias y orden de carga de scripts, para una visión integral del proyecto.

---

*Documento generado a partir del proyecto Restaurante Pro — Familia González — PWA de contabilidad. Última actualización: marzo 2025.*
