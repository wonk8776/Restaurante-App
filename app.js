/**
 * app.js - Panel administrador Restaurante Pro
 * Firebase v9 compat, tiempo real con onSnapshot
 */

(function () {
    'use strict';

    function showToastSafe(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type);
        else alert(msg);
    }

    function setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.dataset.originalText = btn.textContent || '';
            btn.disabled = true;
            btn.classList.add('btn-loading', 'btn-loading-text');
            btn.textContent = 'Sincronizando...';
        } else {
            btn.disabled = false;
            btn.classList.remove('btn-loading', 'btn-loading-text');
            btn.textContent = (btn.dataset.originalText != null && btn.dataset.originalText !== '') ? btn.dataset.originalText : 'Guardar';
        }
    }

    // --- Referencias DOM ---
    var sonidoActivo = localStorage.getItem('restiq_sonido') !== 'off';
    var adminNameEl = document.getElementById('adminName');
    var headerTitleEl = document.getElementById('headerTitle');
    var btnLogout = document.getElementById('btnLogout');
    var navLinks = document.querySelectorAll('.nav-list a');
    var sections = document.querySelectorAll('.section');
    var btnSilenciar = document.getElementById('btnSilenciar');

    // Dashboard
    var ventasDiaEl = document.getElementById('ventasDia');
    var gastosDiaEl = document.getElementById('gastosDia');
    var gananciaNetaEl = document.getElementById('gananciaNeta');
    var ordenesActivasEl = document.getElementById('ordenesActivas');

    // Órdenes
    var ordenesBody = document.getElementById('ordenesBody');
    var ordenesConocidas = null;
    var contadorNuevas = 0;
    var ordenPendientePago = null;
    var totalOrdenActual = 0;
    var modalMetodoPago = document.getElementById('modalMetodoPago');
    var btnCancelarMetodoPago = document.getElementById('btnCancelarMetodoPago');
    var btnCerrarModalMetodoPago = document.getElementById('btnCerrarModalMetodoPago');
    var inputCortePropina = document.getElementById('cortePropina');
    var inputCorteDescuento = document.getElementById('corteDescuento');
    var inputCorteCortesia = document.getElementById('corteCortesia');
    var divResumenCobro = document.getElementById('resumenCobro');

    // Menú
    var menuFilterPills = document.getElementById('menuFilterPills');
    var menuCardsGrid = document.getElementById('menuCardsGrid');
    var menuEmptyState = document.getElementById('menuEmptyState');
    var btnAgregarPlatillo = document.getElementById('btnAgregarPlatillo');
    var modalPlatillo = document.getElementById('modalPlatillo');
    var platilloNombre = document.getElementById('platilloNombre');
    var platilloPrecio = document.getElementById('platilloPrecio');
    var platilloCategoria = document.getElementById('platilloCategoria');
    var platilloImagen = document.getElementById('platilloImagen');
    var btnGuardarPlatillo = document.getElementById('btnGuardarPlatillo');
    var btnCancelarPlatillo = document.getElementById('btnCancelarPlatillo');

    // Meseros
    var meserosGrid = document.getElementById('meserosGrid');
    var btnCrearMesero = document.getElementById('btnCrearMesero');
    var modalMesero = document.getElementById('modalMesero');
    var meseroNombre = document.getElementById('meseroNombre');
    var meseroEmail = document.getElementById('meseroEmail');
    var meseroPassword = document.getElementById('meseroPassword');
    var btnGuardarMesero = document.getElementById('btnGuardarMesero');
    var btnCancelarMesero = document.getElementById('btnCancelarMesero');
    var meseroError = document.getElementById('meseroError');

    // Gastos
    var gastoDescripcion = document.getElementById('gastoDescripcion');
    var gastoCategoria = document.getElementById('gastoCategoria');
    var gastoMonto = document.getElementById('gastoMonto');
    var gastoMetodoPago = document.getElementById('gastoMetodoPago');
    var btnRegistrarGasto = document.getElementById('btnRegistrarGasto');
    var gastoOk = document.getElementById('gastoOk');
    var btnCerrarModalPlatillo = document.getElementById('btnCerrarModalPlatillo');
    var btnCerrarModalMesero = document.getElementById('btnCerrarModalMesero');

    // Reportes
    var reporteDesde = document.getElementById('reporteDesde');
    var reporteHasta = document.getElementById('reporteHasta');
    var btnFiltrarReporte = document.getElementById('btnFiltrarReporte');
    var btnExportarPdf = document.getElementById('btnExportarPdf');
    var reportesBody = document.getElementById('reportesBody');
    var reporteBalanceFoot = document.getElementById('reporteBalanceFoot');
    var reporteBalanceNeto = document.getElementById('reporteBalanceNeto');
    var reporteQuickHoy = document.getElementById('reporteQuickHoy');
    var reporteQuickSemana = document.getElementById('reporteQuickSemana');
    var reporteQuickMes = document.getElementById('reporteQuickMes');

    var titulosSeccion = {
        dashboard: 'Dashboard',
        ordenes: 'Órdenes en vivo',
        pedidos: 'Pedidos',
        cotizaciones: 'Cotizaciones',
        menu: 'Menú',
        meseros: 'Meseros',
        gastos: 'Gastos',
        reportes: 'Reportes',
        'reporte-semanal': 'Reporte Semanal',
        mantenimiento: 'Mantenimiento',
        configuracion: 'Configuración'
    };

    var pedidosInicializado = false;
    var cotizacionesInicializado = false;
    var menuItemsAdmin = [];

    // --- Navegación SPA ---
    function mostrarSeccion(sectionId) {
        sections.forEach(function (sec) {
            sec.classList.remove('active');
            if (sec.id === 'section-' + sectionId) sec.classList.add('active');
        });
        navLinks.forEach(function (a) {
            a.classList.remove('active');
            if (a.getAttribute('data-section') === sectionId) a.classList.add('active');
        });
        if (headerTitleEl) headerTitleEl.textContent = titulosSeccion[sectionId] || sectionId;
        // Abrir el grupo que contiene esta sección si estaba colapsado
        var linkActivo = document.querySelector('.nav-list a[data-section="' + sectionId + '"]');
        if (linkActivo) {
            var groupItems = linkActivo.closest('.nav-group-items');
            if (groupItems && groupItems.classList.contains('collapsed')) {
                groupItems.classList.remove('collapsed');
                var titleBtn = groupItems.previousElementSibling;
                if (titleBtn && titleBtn.classList.contains('nav-group-title')) titleBtn.classList.remove('collapsed');
            }
        }
    }
    window.mostrarSeccion = mostrarSeccion;

    navLinks.forEach(function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            var id = a.getAttribute('data-section');
            if (id) {
                mostrarSeccion(id);
                var sidebarToggle = document.getElementById('sidebar-toggle');
                if (sidebarToggle && sidebarToggle.checked) sidebarToggle.checked = false;
                if (id === 'pedidos' && !pedidosInicializado) {
                    iniciarSeccionPedidos();
                    pedidosInicializado = true;
                }
                if (id === 'cotizaciones' && !cotizacionesInicializado) {
                    iniciarSeccionCotizaciones();
                    cotizacionesInicializado = true;
                }
                if (id === 'reporte-semanal') {
                    actualizarPeriodoReporteSemanal();
                }
                if (id === 'configuracion') {
                    cargarConfigMesas();
                }
            }
        });
    });

    function actualizarPeriodoReporteSemanal() {
        var el = document.getElementById('reporteSemanalPeriodo');
        if (!el) return;
        var now = new Date();
        var day = now.getDay();
        var toMonday = day === 0 ? -6 : 1 - day;
        var monday = new Date(now);
        monday.setDate(monday.getDate() + toMonday);
        var sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        var opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        var lunesStr = monday.toLocaleDateString('es', opts);
        var domingoStr = sunday.toLocaleDateString('es', opts);
        el.textContent = lunesStr + ' — ' + domingoStr;
    }

    function generarReporteSemanal() {
        var now = new Date();
        var day = now.getDay();
        var toMonday = day === 0 ? -6 : 1 - day;
        var monday = new Date(now);
        monday.setDate(monday.getDate() + toMonday);
        monday.setHours(0, 0, 0, 0);
        var sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        var lunesTs = firebase.firestore.Timestamp.fromDate(monday);
        var domingoTs = firebase.firestore.Timestamp.fromDate(sunday);

        var inicioSemanaAnterior = new Date(monday);
        inicioSemanaAnterior.setDate(monday.getDate() - 7);
        inicioSemanaAnterior.setHours(0, 0, 0, 0);
        var lunesAnteriorTs = firebase.firestore.Timestamp.fromDate(inicioSemanaAnterior);

        var pVentas = db.collection('ventas').where('timestamp', '>=', lunesTs).where('timestamp', '<=', domingoTs).get();
        var pGastos = db.collection('gastos').where('fecha', '>=', lunesTs).where('fecha', '<=', domingoTs).get();
        var pOrdenes = db.collection('ordenes').where('timestamp', '>=', lunesTs).where('timestamp', '<=', domingoTs).get();
        var pVentasAnterior = db.collection('ventas').where('timestamp', '>=', lunesAnteriorTs).where('timestamp', '<', lunesTs).get();

        Promise.all([pVentas, pGastos, pOrdenes, pVentasAnterior]).then(function (results) {
            var ventasSnap = results[0];
            var gastosSnap = results[1];
            var ordenesSnap = results[2];
            var ventasAnteriorSnap = results[3];

            function normalizarMetodo(str) {
                var s = (str && String(str).toLowerCase()) || 'efectivo';
                if (s === 'tarjeta' || s === 'transferencia') return s;
                return 'efectivo';
            }

            var totalIngresos = 0;
            var ventasList = [];
            ventasSnap.forEach(function (d) {
                var data = d.data();
                var tot = data.total != null ? Number(data.total) : 0;
                totalIngresos += tot;
                ventasList.push({
                    total: tot,
                    platillos: data.platillos || [],
                    meseroNombre: data.meseroNombre || '',
                    timestamp: data.timestamp,
                    metodoPago: normalizarMetodo(data.metodoPago)
                });
            });

            var totalSemanaAnterior = 0;
            ventasAnteriorSnap.forEach(function (d) {
                var tot = d.data().total != null ? Number(d.data().total) : 0;
                totalSemanaAnterior += tot;
            });

            var totalGastos = 0;
            gastosSnap.forEach(function (d) {
                totalGastos += (d.data().monto != null ? Number(d.data().monto) : 0);
            });

            var gananciaNeta = totalIngresos - totalGastos;
            var promedioDia = totalIngresos / 7;

            var ventasPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];
            ventasList.forEach(function (v) {
                if (v.timestamp && v.timestamp.toDate) {
                    var d = v.timestamp.toDate();
                    var dayIdx = d.getDay();
                    ventasPorDiaSemana[dayIdx] += v.total;
                }
            });
            var nombresDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            var diaPicoIdx = 0;
            for (var i = 1; i < 7; i++) {
                if (ventasPorDiaSemana[i] > ventasPorDiaSemana[diaPicoIdx]) diaPicoIdx = i;
            }
            var diaPico = nombresDia[diaPicoIdx];

            var ordenesPorHora = {};
            ordenesSnap.forEach(function (d) {
                var data = d.data();
                var ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : null;
                if (ts) {
                    var h = ts.getHours();
                    ordenesPorHora[h] = (ordenesPorHora[h] || 0) + 1;
                }
            });
            var horaPico = '';
            var maxHora = 0;
            for (var h in ordenesPorHora) {
                if (ordenesPorHora[h] > maxHora) {
                    maxHora = ordenesPorHora[h];
                    horaPico = (h.length === 1 ? '0' + h : h) + ':00';
                }
            }
            if (!horaPico) horaPico = '—';

            var ventasPorHoraDolares = {};
            ventasList.forEach(function (v) {
                if (v.timestamp && v.timestamp.toDate) {
                    var h = v.timestamp.toDate().getHours();
                    ventasPorHoraDolares[h] = (ventasPorHoraDolares[h] || 0) + v.total;
                }
            });
            var horaMenor = '—';
            var minSum = Infinity;
            for (var kh in ventasPorHoraDolares) {
                var s = ventasPorHoraDolares[kh];
                if (s > 0 && s < minSum) {
                    minSum = s;
                    horaMenor = (kh.length === 1 ? '0' + kh : kh) + ':00';
                }
            }
            if (minSum === Infinity) horaMenor = '—';

            var rangoActivo = '—';
            var maxRangoSum = 0;
            var rangoStart = -1;
            for (var r = 0; r <= 22; r++) {
                var sum2 = (ventasPorHoraDolares[r] || 0) + (ventasPorHoraDolares[r + 1] || 0);
                if (sum2 > maxRangoSum) {
                    maxRangoSum = sum2;
                    rangoStart = r;
                }
            }
            if (rangoStart >= 0) {
                var h1 = (rangoStart < 10 ? '0' + rangoStart : '' + rangoStart) + ':00';
                var h2 = (rangoStart + 2 < 10 ? '0' + (rangoStart + 2) : '' + (rangoStart + 2)) + ':00';
                rangoActivo = h1 + ' — ' + h2;
            }

            var metodoCount = { efectivo: 0, tarjeta: 0, transferencia: 0 };
            ventasList.forEach(function (v) {
                var m = v.metodoPago || 'efectivo';
                if (metodoCount[m] !== undefined) metodoCount[m]++;
                else metodoCount.efectivo++;
            });
            var totalVentasCount = ventasList.length;
            var metodoPrincipal = '—';
            var metodoMax = 0;
            for (var mk in metodoCount) {
                if (metodoCount[mk] > metodoMax) {
                    metodoMax = metodoCount[mk];
                    metodoPrincipal = mk.charAt(0).toUpperCase() + mk.slice(1);
                }
            }
            if (totalVentasCount === 0) metodoPrincipal = '—';

            var platillosCount = {};
            ventasList.forEach(function (v) {
                var pl = Array.isArray(v.platillos) ? v.platillos : [];
                pl.forEach(function (p) {
                    var nom = (p && p.nombre) ? String(p.nombre) : '';
                    if (nom) {
                        var cant = (p && p.cantidad) ? parseInt(p.cantidad, 10) : 1;
                        platillosCount[nom] = (platillosCount[nom] || 0) + cant;
                    }
                });
            });
            var platilloEstrella = '—';
            var platilloVeces = 0;
            var top5 = [];
            var arr = [];
            for (var nombre in platillosCount) arr.push({ nombre: nombre, cant: platillosCount[nombre] });
            arr.sort(function (a, b) { return b.cant - a.cant; });
            if (arr.length > 0) {
                platilloEstrella = arr[0].nombre;
                platilloVeces = arr[0].cant;
                for (var t = 0; t < Math.min(5, arr.length); t++) top5.push(arr[t]);
            }

            var meserosTotal = {};
            ventasList.forEach(function (v) {
                var nom = v.meseroNombre || 'Sin asignar';
                meserosTotal[nom] = (meserosTotal[nom] || 0) + v.total;
            });
            var meseroTop = '—';
            var meseroTopTotal = 0;
            for (var m in meserosTotal) {
                if (meserosTotal[m] > meseroTopTotal) {
                    meseroTopTotal = meserosTotal[m];
                    meseroTop = m;
                }
            }
            var listaMeseros = [];
            for (var mm in meserosTotal) listaMeseros.push({ nombre: mm, total: meserosTotal[mm] });
            listaMeseros.sort(function (a, b) { return b.total - a.total; });

            var totalOrdenes = ordenesSnap.size;
            var ticketPromedio = totalOrdenes > 0 ? totalIngresos / totalOrdenes : 0;
            var mesaCount = {};
            ordenesSnap.forEach(function (d) {
                var mesa = (d.data().mesa != null) ? String(d.data().mesa) : '—';
                mesaCount[mesa] = (mesaCount[mesa] || 0) + 1;
            });
            var mesaMasActiva = '—';
            var mesaMax = 0;
            for (var mesa in mesaCount) {
                if (mesaCount[mesa] > mesaMax) {
                    mesaMax = mesaCount[mesa];
                    mesaMasActiva = mesa;
                }
            }
            var numMesas = Object.keys(mesaCount).length;
            var promMesa = numMesas > 0 ? (totalOrdenes / numMesas).toFixed(1) : '—';

            function set(id, text) {
                var el = document.getElementById(id);
                if (el) el.textContent = text;
            }
            function setClass(id, className) {
                var el = document.getElementById(id);
                if (el) el.className = className;
            }

            set('rsTotalIngresos', formatearDinero(totalIngresos));
            set('rsTotalGastos', formatearDinero(totalGastos));
            set('rsGananciaNeta', formatearDinero(gananciaNeta));
            set('rsPromedioDia', formatearDinero(promedioDia));
            set('rsTicketPromedio', formatearDinero(ticketPromedio));
            set('rsHoraPico', horaPico || '—');
            set('rsHoraMenor', horaMenor);
            set('rsRangoActivo', rangoActivo);
            set('rsPlatilloNombre', platilloEstrella);
            set('rsPlatilloCantidad', String(platilloVeces));
            set('rsMeseroTop', meseroTop);
            set('rsTotalOrdenes', String(totalOrdenes));
            set('rsMesaActiva', mesaMasActiva);
            set('rsPromMesa', String(promMesa));

            set('rsComparativaActual', formatearDinero(totalIngresos));
            set('rsComparativaAnterior', formatearDinero(totalSemanaAnterior));
            var diff = totalIngresos - totalSemanaAnterior;
            var diffStr = (diff >= 0 ? '+' : '') + ' ' + formatearDinero(Math.abs(diff));
            set('rsComparativaDif', diffStr);
            setClass('rsComparativaDif', 'reporte-metrica-principal ' + (diff >= 0 ? 'reporte-positivo' : 'reporte-negativo'));
            var pctVal = totalSemanaAnterior !== 0 ? ((totalIngresos - totalSemanaAnterior) / totalSemanaAnterior * 100) : null;
            var pctStr = pctVal != null ? (pctVal >= 0 ? '▲ ' : '▼ ') + Math.abs(pctVal).toFixed(1) + '%' : 'N/A';
            set('rsComparativaPct', pctStr);
            var pctClass = 'reporte-fila-valor';
            if (pctVal != null) pctClass += pctVal >= 0 ? ' reporte-positivo' : ' reporte-negativo';
            setClass('rsComparativaPct', pctClass);

            set('rsMetodoPrincipal', metodoPrincipal);
            var pctE = totalVentasCount > 0 ? (metodoCount.efectivo / totalVentasCount * 100).toFixed(1) : '0';
            var pctT = totalVentasCount > 0 ? (metodoCount.tarjeta / totalVentasCount * 100).toFixed(1) : '0';
            var pctTr = totalVentasCount > 0 ? (metodoCount.transferencia / totalVentasCount * 100).toFixed(1) : '0';
            set('rsMetodoEfectivo', metodoCount.efectivo + ' órdenes (' + pctE + '%)');
            set('rsMetodoTarjeta', metodoCount.tarjeta + ' órdenes (' + pctT + '%)');
            set('rsMetodoTransferencia', metodoCount.transferencia + ' órdenes (' + pctTr + '%)');

            set('kpiIngresosSemana', formatearDinero(totalIngresos));
            set('kpiGananciaSemana', formatearDinero(gananciaNeta));
            set('kpiOrdenesSemana', String(totalOrdenes));

            var rsTop3 = document.getElementById('rsTop3Platillos');
            if (rsTop3) {
                rsTop3.innerHTML = '';
                var top3 = arr.slice(0, 3);
                top3.forEach(function (p) {
                    var row = document.createElement('div');
                    row.className = 'reporte-fila';
                    row.innerHTML = '<span class="reporte-fila-label">' + escapeHtml(p.nombre || '—') + '</span><span class="reporte-fila-valor">' + p.cant + ' vendidos</span>';
                    rsTop3.appendChild(row);
                });
            }

            var rsRanking = document.getElementById('rsRankingMeseros');
            if (rsRanking) {
                rsRanking.innerHTML = '';
                listaMeseros.forEach(function (m) {
                    var row = document.createElement('div');
                    row.className = 'reporte-fila';
                    row.innerHTML = '<span class="reporte-fila-label">' + escapeHtml(m.nombre || '—') + '</span><span class="reporte-fila-valor">' + formatearDinero(m.total) + '</span>';
                    rsRanking.appendChild(row);
                });
            }

            var rsVentasPorDia = document.getElementById('rsVentasPorDia');
            if (rsVentasPorDia) {
                rsVentasPorDia.innerHTML = '';
                var ordenDias = [1, 2, 3, 4, 5, 6, 0];
                ordenDias.forEach(function (idx) {
                    var row = document.createElement('div');
                    row.className = 'reporte-fila';
                    var val = ventasPorDiaSemana[idx] || 0;
                    var esPico = idx === diaPicoIdx;
                    var valorHtml = formatearDinero(val) + (esPico ? ' ★' : '');
                    row.innerHTML = '<span class="reporte-fila-label">' + nombresDia[idx] + '</span><span class="reporte-fila-valor"' + (esPico ? ' style="color:var(--color-primary);font-weight:700;"' : '') + '>' + valorHtml + '</span>';
                    rsVentasPorDia.appendChild(row);
                });
            }

            var contenido = document.getElementById('reporteSemanalContenido');
            if (contenido) contenido.style.display = 'block';
        }).catch(function (err) {
            console.error('Error generando reporte semanal:', err);
            showToastSafe('No se pudo generar el reporte.', 'error');
        });
    }

    var btnGenerarReporteSemanal = document.getElementById('btnGenerarReporteSemanal');
    if (btnGenerarReporteSemanal) btnGenerarReporteSemanal.addEventListener('click', generarReporteSemanal);

    var btnImprimirReporteSemanal = document.getElementById('btnImprimirReporteSemanal');
    if (btnImprimirReporteSemanal) {
        btnImprimirReporteSemanal.addEventListener('click', function () {
            document.body.classList.add('print-reporte-semanal');
            window.addEventListener('afterprint', function limpiar() {
                document.body.classList.remove('print-reporte-semanal');
                window.removeEventListener('afterprint', limpiar);
            });
            window.print();
        });
    }

    // --- Mantenimiento: buscar registros por período (solo cuenta, no elimina) ---
    function buscarRegistrosPeriodo(coleccion, campoFecha, desdeId, hastaId, countId) {
        var desde = document.getElementById(desdeId) && document.getElementById(desdeId).value;
        var hasta = document.getElementById(hastaId) && document.getElementById(hastaId).value;
        if (!desde || !hasta) {
            showToastSafe('Selecciona las fechas Desde y Hasta.', 'info');
            return;
        }
        var tsDesde = firebase.firestore.Timestamp.fromDate(new Date(desde + 'T00:00:00'));
        var tsHasta = firebase.firestore.Timestamp.fromDate(new Date(hasta + 'T23:59:59.999'));
        var countEl = document.getElementById(countId);
        db.collection(coleccion).where(campoFecha, '>=', tsDesde).where(campoFecha, '<=', tsHasta).get()
            .then(function (snap) {
                var n = snap.size;
                if (countEl) countEl.textContent = n + ' registros encontrados en este período';
            })
            .catch(function (err) {
                console.error('Error al buscar:', err);
                if (countEl) countEl.textContent = '0 registros encontrados en este período';
            });
    }

    // --- Mantenimiento: eliminar registros por período (triple confirmación) ---
    function eliminarRegistrosPeriodo(coleccion, campoFecha, desdeId, hastaId, countId, nombreColeccion) {
        var desde = document.getElementById(desdeId) && document.getElementById(desdeId).value;
        var hasta = document.getElementById(hastaId) && document.getElementById(hastaId).value;
        if (!desde || !hasta) {
            showToastSafe('Selecciona las fechas Desde y Hasta.', 'info');
            return;
        }
        var tsDesde = firebase.firestore.Timestamp.fromDate(new Date(desde + 'T00:00:00'));
        var tsHasta = firebase.firestore.Timestamp.fromDate(new Date(hasta + 'T23:59:59.999'));

        db.collection(coleccion).where(campoFecha, '>=', tsDesde).where(campoFecha, '<=', tsHasta).get()
            .then(function (snap) {
                var total = snap.size;
                if (total === 0) {
                    showToastSafe('No hay registros en ese período.', 'info');
                    return;
                }
                var desdeStr = new Date(desde + 'T00:00:00').toLocaleDateString('es');
                var hastaStr = new Date(hasta + 'T00:00:00').toLocaleDateString('es');
                // PASO 1
                var msg1 = 'Se encontraron ' + total + ' registros en ' + nombreColeccion + ' del ' + desdeStr + ' al ' + hastaStr + '.\n¿Deseas continuar con la eliminación?';
                if (!confirm(msg1)) return;
                // PASO 2
                var msg2 = 'ADVERTENCIA FINAL: Esta acción eliminará permanentemente ' + total + ' registros de ' + nombreColeccion + '. Esta operación NO se puede deshacer.\n¿Estás completamente seguro?';
                if (!confirm(msg2)) return;
                // PASO 3
                var msg3 = 'Para confirmar la eliminación escribe exactamente la palabra: CONFIRMAR';
                var escrito = prompt(msg3);
                if (escrito !== 'CONFIRMAR') {
                    showToastSafe('Texto incorrecto. Operación cancelada.', 'error');
                    return;
                }
                var docs = [];
                snap.forEach(function (d) { docs.push(d); });
                var BATCH_SIZE = 500;
                var batch = db.batch();
                var committed = 0;
                function runBatches(idx) {
                    if (idx >= docs.length) {
                        if (committed > 0) {
                            var countEl = document.getElementById(countId);
                            if (countEl) countEl.textContent = '0 registros encontrados en este período';
                            showToastSafe(total + ' registros eliminados correctamente', 'success');
                        }
                        return;
                    }
                    var b = db.batch();
                    var end = Math.min(idx + BATCH_SIZE, docs.length);
                    for (var i = idx; i < end; i++) b.delete(docs[i].ref);
                    b.commit().then(function () {
                        committed += (end - idx);
                        runBatches(end);
                    }).catch(function (err) {
                        console.error('Error eliminando:', err);
                        showToastSafe('Error al eliminar algunos registros.', 'error');
                    });
                }
                runBatches(0);
            })
            .catch(function (err) {
                console.error('Error al contar:', err);
                showToastSafe('No se pudo verificar el período.', 'error');
            });
    }

    // --- Botones Mantenimiento ---
    var btnBuscarOrdenes = document.getElementById('btnBuscarOrdenes');
    if (btnBuscarOrdenes) btnBuscarOrdenes.addEventListener('click', function () {
        buscarRegistrosPeriodo('ordenes', 'timestamp', 'mantOrdenesDesde', 'mantOrdenesHasta', 'mantOrdenesCount');
    });
    var btnBuscarCotiz = document.getElementById('btnBuscarCotiz');
    if (btnBuscarCotiz) btnBuscarCotiz.addEventListener('click', function () {
        buscarRegistrosPeriodo('cotizaciones', 'timestamp', 'mantCotizDesde', 'mantCotizHasta', 'mantCotizCount');
    });
    var btnBuscarGastos = document.getElementById('btnBuscarGastos');
    if (btnBuscarGastos) btnBuscarGastos.addEventListener('click', function () {
        buscarRegistrosPeriodo('gastos', 'fecha', 'mantGastosDesde', 'mantGastosHasta', 'mantGastosCount');
    });
    var btnEliminarOrdenes = document.getElementById('btnEliminarOrdenes');
    if (btnEliminarOrdenes) btnEliminarOrdenes.addEventListener('click', function () {
        eliminarRegistrosPeriodo('ordenes', 'timestamp', 'mantOrdenesDesde', 'mantOrdenesHasta', 'mantOrdenesCount', 'Órdenes');
    });
    var btnEliminarCotiz = document.getElementById('btnEliminarCotiz');
    if (btnEliminarCotiz) btnEliminarCotiz.addEventListener('click', function () {
        eliminarRegistrosPeriodo('cotizaciones', 'timestamp', 'mantCotizDesde', 'mantCotizHasta', 'mantCotizCount', 'Cotizaciones');
    });
    var btnEliminarGastos = document.getElementById('btnEliminarGastos');
    if (btnEliminarGastos) btnEliminarGastos.addEventListener('click', function () {
        eliminarRegistrosPeriodo('gastos', 'fecha', 'mantGastosDesde', 'mantGastosHasta', 'mantGastosCount', 'Gastos');
    });

    // --- Cerrar sesión ---
    function cerrarSesion() {
        auth.signOut().then(function () {
            window.location.href = 'login.html';
        }).catch(function (err) {
            console.error('Error al cerrar sesión:', err);
            window.location.href = 'login.html';
        });
    }
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
    var btnLogoutSidebar = document.getElementById('btnLogoutSidebar');
    if (btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', cerrarSesion);

    // --- Configuración del Restaurante (Nombre y Moneda) ---
    var configuracionRestaurante = { nombre: 'Mi Restaurante', moneda: 'USD' }; // Valores por defecto

    function cargarConfiguracionRestaurante() {
        db.collection('configuracion').doc('restaurante').get().then(function (doc) {
            if (doc.exists) {
                configuracionRestaurante = doc.data() || configuracionRestaurante;
            }
            var inputNombre = document.getElementById('restauranteNombre');
            var selectMoneda = document.getElementById('restauranteMoneda');
            if (inputNombre) inputNombre.value = configuracionRestaurante.nombre || '';
            if (selectMoneda) selectMoneda.value = configuracionRestaurante.moneda || 'USD';
            actualizarHeaderConMarca();
        }).catch(function (error) {
            console.error('Error cargando configuración: ', error);
        });
    }

    function guardarConfiguracionRestaurante() {
        var inputNombre = document.getElementById('restauranteNombre');
        var selectMoneda = document.getElementById('restauranteMoneda');
        var nombre = inputNombre ? inputNombre.value.trim() : '';
        var moneda = selectMoneda ? selectMoneda.value : 'USD';

        if (!nombre) {
            showToastSafe('El nombre del restaurante no puede estar vacío.', 'info');
            return;
        }

        var nuevaConfig = { nombre: nombre, moneda: moneda };

        db.collection('configuracion').doc('restaurante').set(nuevaConfig, { merge: true })
            .then(function () {
                configuracionRestaurante = nuevaConfig;
                var mensaje = document.getElementById('configRestauranteMensaje');
                if (mensaje) {
                    mensaje.style.display = 'inline';
                    setTimeout(function () { mensaje.style.display = 'none'; }, 2000);
                }
                actualizarHeaderConMarca();
                showToastSafe('Configuración guardada.', 'success');
            })
            .catch(function (error) {
                console.error('Error guardando configuración: ', error);
                showToastSafe('Error al guardar.', 'error');
            });
    }

    function actualizarHeaderConMarca() {
        var el = document.getElementById('sidebarRestaurantName');
        if (el) el.textContent = configuracionRestaurante.nombre || 'Mi Restaurante';
    }

    // --- Nombre del admin + carga de configuración global ---
    auth.onAuthStateChanged(function (user) {
        if (user && adminNameEl) {
            var greetingEl = document.getElementById('headerGreeting');

            function actualizarSaludo() {
                if (!greetingEl || !adminNameEl.textContent) return;
                var hour = new Date().getHours();
                var greeting = 'Bienvenido,';
                if (hour < 12) {
                    greeting = 'Buenos días,';
                } else if (hour < 18) {
                    greeting = 'Buenas tardes,';
                } else {
                    greeting = 'Buenas noches,';
                }
                var firstName = adminNameEl.textContent.split(' ')[0];
                greetingEl.textContent = greeting + ' ' + firstName;
            }

            db.collection('usuarios').doc(user.uid).get().then(function (doc) {
                if (doc.exists && doc.data().nombre) {
                    adminNameEl.textContent = doc.data().nombre;
                } else {
                    adminNameEl.textContent = user.email || 'Admin';
                }
                actualizarSaludo();
            }).catch(function () {
                adminNameEl.textContent = user.email || 'Admin';
                actualizarSaludo();
            });

            // Cargar la configuración del restaurante (nombre y moneda)
            cargarConfiguracionRestaurante();
        }
    });

    // --- Función global de formateo de dinero ---
    function formatearDinero(valor) {
        var moneda = configuracionRestaurante && configuracionRestaurante.moneda ? configuracionRestaurante.moneda : 'MXN';
        var locale = 'es-MX';
        var currency = moneda === 'EUR' ? 'EUR' : moneda === 'USD' ? 'USD' : 'MXN';
        return Number(valor || 0).toLocaleString(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Botón para guardar configuración de restaurante
    var btnGuardarConfigRestaurante = document.getElementById('btnGuardarConfigRestaurante');
    if (btnGuardarConfigRestaurante) {
        btnGuardarConfigRestaurante.addEventListener('click', guardarConfiguracionRestaurante);
    }

    // --- PIN de Cocina (KDS) ---
    var inputPinCocina = document.getElementById('inputPinCocina');
    var btnGuardarPin = document.getElementById('btnGuardarPin');
    var msgPin = document.getElementById('msgPin');

    // Cargar PIN actual desde Firestore
    db.collection('configuracion').doc('restaurante').get()
        .then(function (doc) {
            if (doc.exists && doc.data().pinCocina) {
                if (inputPinCocina) inputPinCocina.value = doc.data().pinCocina;
            }
        });

    // Prevenir más de 4 dígitos
    if (inputPinCocina) {
        inputPinCocina.addEventListener('input', function () {
            if (this.value.length > 4) this.value = this.value.slice(0, 4);
        });
    }

    // Guardar PIN
    if (btnGuardarPin) {
        btnGuardarPin.addEventListener('click', function () {
            var pin = inputPinCocina ? inputPinCocina.value.trim() : '';
            if (!/^\d{4}$/.test(pin)) {
                showToastSafe('El PIN debe ser exactamente 4 dígitos', 'error');
                return;
            }
            db.collection('configuracion').doc('restaurante')
                .set({ pinCocina: pin }, { merge: true })
                .then(function () {
                    showToastSafe('PIN actualizado correctamente', 'success');
                    if (msgPin) {
                        msgPin.textContent = 'PIN guardado';
                        msgPin.style.display = 'block';
                        setTimeout(function () { msgPin.style.display = 'none'; }, 3000);
                    }
                })
                .catch(function () {
                    showToastSafe('Error al guardar el PIN', 'error');
                });
        });
    }

    // --- Helpers fecha (inicio/fin del día) ---
    function inicioDelDia(d) {
        var x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    }
    function finDelDia(d) {
        var x = new Date(d);
        x.setHours(23, 59, 59, 999);
        return x;
    }
    function hoy() {
        return new Date();
    }
    function ayer() {
        var d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    }

    // --- Dashboard: ventas, gastos, ganancia, órdenes activas (tiempo real) ---
    function aplicarTransicionValor(el) {
        if (!el) return;
        el.classList.add('card-value-updated');
        window.clearTimeout(el._cardValueTimeout);
        el._cardValueTimeout = window.setTimeout(function () {
            el.classList.remove('card-value-updated');
        }, 350);
    }

    function escucharDashboard() {
        var hoyInicio = firebase.firestore.Timestamp.fromDate(inicioDelDia(hoy()));
        var hoyFin = firebase.firestore.Timestamp.fromDate(finDelDia(hoy()));

        db.collection('ventas').where('timestamp', '>=', hoyInicio).where('timestamp', '<=', hoyFin)
            .onSnapshot(function (snap) {
                var total = 0;
                snap.forEach(function (d) {
                    total += (d.data().total || 0);
                });
                if (ventasDiaEl) {
                    ventasDiaEl.textContent = formatearDinero(total);
                    aplicarTransicionValor(ventasDiaEl);
                }
                window._ventasDia = total;
                actualizarGananciaDashboard();
                var ayerInicio = firebase.firestore.Timestamp.fromDate(inicioDelDia(ayer()));
                var ayerFin = firebase.firestore.Timestamp.fromDate(finDelDia(ayer()));
                db.collection('ventas').where('timestamp', '>=', ayerInicio).where('timestamp', '<=', ayerFin).get().then(function (res) {
                    var totalAyer = 0;
                    res.forEach(function (d) { totalAyer += (d.data().total || 0); });
                    window._ventasAyer = totalAyer;
                    var trendEl = document.getElementById('ventasDiaTrend');
                    if (trendEl) {
                        if (total > totalAyer) trendEl.setAttribute('data-dir', 'up');
                        else if (total < totalAyer) trendEl.setAttribute('data-dir', 'down');
                        else trendEl.setAttribute('data-dir', 'neutral');
                    }
                    actualizarGananciaDashboard();
                });
            });

        db.collection('gastos').where('fecha', '>=', hoyInicio).where('fecha', '<=', hoyFin)
            .onSnapshot(function (snap) {
                var total = 0;
                snap.forEach(function (d) {
                    total += (d.data().monto || 0);
                });
                if (gastosDiaEl) {
                    gastosDiaEl.textContent = formatearDinero(total);
                    aplicarTransicionValor(gastosDiaEl);
                }
                window._gastosDia = total;
                actualizarGananciaDashboard();
                var ayerInicio = firebase.firestore.Timestamp.fromDate(inicioDelDia(ayer()));
                var ayerFin = firebase.firestore.Timestamp.fromDate(finDelDia(ayer()));
                db.collection('gastos').where('fecha', '>=', ayerInicio).where('fecha', '<=', ayerFin).get().then(function (res) {
                    var totalAyer = 0;
                    res.forEach(function (d) { totalAyer += (d.data().monto || 0); });
                    window._gastosAyer = totalAyer;
                    var trendEl = document.getElementById('gastosDiaTrend');
                    if (trendEl) {
                        if (total > totalAyer) trendEl.setAttribute('data-dir', 'up');
                        else if (total < totalAyer) trendEl.setAttribute('data-dir', 'down');
                        else trendEl.setAttribute('data-dir', 'neutral');
                    }
                    actualizarGananciaDashboard();
                });
            });

        db.collection('ordenes').onSnapshot(function (snap) {
            var activas = 0;
            snap.forEach(function (d) {
                var est = (d.data().estado || '').toLowerCase();
                if (est !== 'pagada' && est !== 'cancelada') activas++;
            });
            if (ordenesActivasEl) {
                ordenesActivasEl.textContent = activas;
                aplicarTransicionValor(ordenesActivasEl);
            }
        });
    }

    function cargarResumenPeriodos() {
        var now = new Date();
        var dayOfWeek = now.getDay();
        var toMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        var mondayStart = new Date(now);
        mondayStart.setDate(mondayStart.getDate() + toMonday);
        mondayStart.setHours(0, 0, 0, 0);
        var semanaInicio = firebase.firestore.Timestamp.fromDate(mondayStart);
        var hoyFin = firebase.firestore.Timestamp.fromDate(finDelDia(now));
        var mesStart = new Date(now.getFullYear(), now.getMonth(), 1);
        var mesInicio = firebase.firestore.Timestamp.fromDate(mesStart);

        var pVentasSemana = db.collection('ventas').where('timestamp', '>=', semanaInicio).where('timestamp', '<=', hoyFin).get();
        var pVentasMes = db.collection('ventas').where('timestamp', '>=', mesInicio).where('timestamp', '<=', hoyFin).get();
        var pGastosSemana = db.collection('gastos').where('fecha', '>=', semanaInicio).where('fecha', '<=', hoyFin).get();
        var pGastosMes = db.collection('gastos').where('fecha', '>=', mesInicio).where('fecha', '<=', hoyFin).get();
        var pVentasTotal = db.collection('ventas').get();
        var pGastosTotal = db.collection('gastos').get();

        Promise.all([pVentasSemana, pVentasMes, pGastosSemana, pGastosMes, pVentasTotal, pGastosTotal]).then(function (results) {
            var totalVentasSemana = 0;
            results[0].forEach(function (d) { totalVentasSemana += (d.data().total || 0); });
            var totalVentasMes = 0;
            results[1].forEach(function (d) { totalVentasMes += (d.data().total || 0); });
            var totalGastosSemana = 0;
            results[2].forEach(function (d) { totalGastosSemana += (d.data().monto || 0); });
            var totalGastosMes = 0;
            results[3].forEach(function (d) { totalGastosMes += (d.data().monto || 0); });
            var totalVentasHist = 0;
            results[4].forEach(function (d) { totalVentasHist += (d.data().total || 0); });
            var totalGastosHist = 0;
            results[5].forEach(function (d) { totalGastosHist += (d.data().monto || 0); });

            var saldoSemana = totalVentasSemana - totalGastosSemana;
            var saldoMes = totalVentasMes - totalGastosMes;
            var saldoTotal = totalVentasHist - totalGastosHist;

            function setEl(id, val) {
                var el = document.getElementById(id);
            if (el) el.textContent = formatearDinero(Number(val));
            }
            setEl('resumenSemanaIngresos', totalVentasSemana);
            setEl('resumenSemanaGastos', totalGastosSemana);
            setEl('resumenSemanaSaldo', saldoSemana);
            setEl('resumenMesIngresos', totalVentasMes);
            setEl('resumenMesGastos', totalGastosMes);
            setEl('resumenMesSaldo', saldoMes);
            setEl('resumenTotalIngresos', totalVentasHist);
            setEl('resumenTotalGastos', totalGastosHist);
            setEl('resumenTotalSaldo', saldoTotal);
        }).catch(function (err) {
            console.error('Error cargando resumen períodos:', err);
        });
    }

    var graficaSemanaChart = null;

    function cargarGraficaSemana() {
        var now = new Date();
        var hace7 = new Date(now);
        hace7.setDate(hace7.getDate() - 6);
        var inicio7 = firebase.firestore.Timestamp.fromDate(inicioDelDia(hace7));
        var finHoy = firebase.firestore.Timestamp.fromDate(finDelDia(now));

        var pVentas = db.collection('ventas').where('timestamp', '>=', inicio7).where('timestamp', '<=', finHoy).get();
        var pGastos = db.collection('gastos').where('fecha', '>=', inicio7).where('fecha', '<=', finHoy).get();

        Promise.all([pVentas, pGastos]).then(function (results) {
            var labels = [];
            var ingresosPorDia = [0, 0, 0, 0, 0, 0, 0];
            var gastosPorDia = [0, 0, 0, 0, 0, 0, 0];
            for (var i = 0; i < 7; i++) {
                var d = new Date(hace7);
                d.setDate(d.getDate() + i);
                labels.push(d.getDate() + '/' + (d.getMonth() + 1));
            }
            var base = inicioDelDia(hace7).getTime();
            var oneDay = 24 * 60 * 60 * 1000;
            results[0].forEach(function (doc) {
                var data = doc.data();
                var ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : null;
                if (ts) {
                    var idx = Math.floor((ts.getTime() - base) / oneDay);
                    if (idx >= 0 && idx < 7) ingresosPorDia[idx] += (data.total || 0);
                }
            });
            results[1].forEach(function (doc) {
                var data = doc.data();
                var ts = data.fecha && data.fecha.toDate ? data.fecha.toDate() : null;
                if (ts) {
                    var idx = Math.floor((ts.getTime() - base) / oneDay);
                    if (idx >= 0 && idx < 7) gastosPorDia[idx] += (data.monto || 0);
                }
            });

            var canvas = document.getElementById('graficaSemana');
            if (!canvas || typeof Chart === 'undefined') return;
            if (graficaSemanaChart) {
                graficaSemanaChart.destroy();
                graficaSemanaChart = null;
            }
            var ctx = canvas.getContext('2d');
            var h = 300;
            var gradienteIngresos = ctx.createLinearGradient(0, 0, 0, h);
            gradienteIngresos.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
            gradienteIngresos.addColorStop(0.5, 'rgba(212, 175, 55, 0.12)');
            gradienteIngresos.addColorStop(1, 'rgba(212, 175, 55, 0)');
            graficaSemanaChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Ingresos',
                            data: ingresosPorDia,
                            borderColor: '#D4AF37',
                            backgroundColor: gradienteIngresos,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: '#D4AF37',
                            pointBorderColor: 'rgba(15, 23, 42, 0.9)',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Gastos',
                            data: gastosPorDia,
                            borderColor: 'rgba(239, 68, 68, 0.9)',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: 'rgba(239, 68, 68, 0.9)',
                            pointBorderColor: 'rgba(15, 23, 42, 0.9)',
                            pointBorderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { color: '#94a3b8' }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8' },
                            border: { display: false }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8' },
                            border: { display: false }
                        }
                    }
                }
            });
        }).catch(function (err) {
            console.error('Error cargando gráfica semana:', err);
        });
    }

    function actualizarGananciaDashboard() {
        var v = window._ventasDia || 0;
        var g = window._gastosDia || 0;
        var gan = Math.max(0, v - g);
        if (gananciaNetaEl) {
            gananciaNetaEl.textContent = formatearDinero(gan);
            aplicarTransicionValor(gananciaNetaEl);
        }
        var ventasAyer = window._ventasAyer != null ? window._ventasAyer : null;
        var gastosAyer = window._gastosAyer != null ? window._gastosAyer : null;
        var ganAyer = (ventasAyer != null && gastosAyer != null) ? Math.max(0, ventasAyer - gastosAyer) : null;
        var trendEl = document.getElementById('gananciaNetaTrend');
        if (trendEl) {
            if (ganAyer === null) trendEl.setAttribute('data-dir', 'neutral');
            else if (gan > ganAyer) trendEl.setAttribute('data-dir', 'up');
            else if (gan < ganAyer) trendEl.setAttribute('data-dir', 'down');
            else trendEl.setAttribute('data-dir', 'neutral');
        }
    }

    // --- Órdenes en vivo ---
    function estadoToClass(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'pagada') return 'estado-pagada';
        if (e === 'servido' || e === 'servida') return 'estado-servido';
        if (e === 'preparando') return 'estado-preparando';
        return 'estado-pendiente';
    }

    function abrirModalMetodoPago() {
        if (!modalMetodoPago) return;
        if (inputCortePropina) { inputCortePropina.value = ''; inputCortePropina.disabled = false; }
        if (inputCorteDescuento) { inputCorteDescuento.value = ''; inputCorteDescuento.disabled = false; }
        if (inputCorteCortesia) inputCorteCortesia.checked = false;
        totalOrdenActual = 0;
        if (ordenPendientePago) {
            db.collection('ordenes').doc(ordenPendientePago).get().then(function (doc) {
                totalOrdenActual = (doc.exists && doc.data().total) ? Number(doc.data().total) : 0;
                actualizarResumenCobro();
            });
        } else {
            actualizarResumenCobro();
        }
        modalMetodoPago.classList.add('open');
        modalMetodoPago.style.display = 'flex';
    }

    function cerrarModalMetodoPago() {
        if (!modalMetodoPago) return;
        modalMetodoPago.classList.remove('open');
        setTimeout(function () {
            if (!modalMetodoPago.classList.contains('open')) {
                modalMetodoPago.style.display = 'none';
            }
        }, 300);
    }

    function cambiarEstadoOrden(id, nuevoEstado, metodoPago) {
        var esPagada = (nuevoEstado || '').toLowerCase() === 'pagada';
        if (esPagada && !metodoPago) {
            ordenPendientePago = id;
            abrirModalMetodoPago();
            return;
        }
        db.collection('ordenes').doc(id).get().then(function (doc) {
            if (!doc.exists) return;
            var data = doc.data();
            var updatePayload = { estado: nuevoEstado };
            if (esPagada && metodoPago) updatePayload.metodoPago = metodoPago;
            db.collection('ordenes').doc(id).update(updatePayload).then(function () {
                if (esPagada) {
                    var esCortesia = inputCorteCortesia ? inputCorteCortesia.checked : false;
                    var descGuardado = inputCorteDescuento ? (parseFloat(inputCorteDescuento.value) || 0) : 0;
                    var propGuardada = inputCortePropina ? (parseFloat(inputCortePropina.value) || 0) : 0;
                    var totalOrig = totalOrdenActual || (data.total ? Number(data.total) : 0);
                    var tFinal = esCortesia ? 0 : (totalOrig - descGuardado + propGuardada);
                    var venta = {
                        mesa: data.mesa || '',
                        platillos: data.platillos || [],
                        total: tFinal,
                        totalOriginal: totalOrig,
                        totalFinal: tFinal,
                        propina: propGuardada,
                        descuento: descGuardado,
                        cortesia: esCortesia,
                        meseroNombre: data.meseroNombre || '',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    if (metodoPago) venta.metodoPago = metodoPago;
                    db.collection('ventas').add(venta);
                }
            }).catch(function (err) {
                console.error('Error actualizando orden:', err);
            });
        });
    }

    function actualizarResumenCobro() {
        if (!divResumenCobro) return;
        var cortesia = inputCorteCortesia ? inputCorteCortesia.checked : false;
        var descuentoAplicado = 0;
        var propinaAplicada = 0;
        var totalFinal = 0;

        if (cortesia) {
            descuentoAplicado = totalOrdenActual;
            propinaAplicada = 0;
            totalFinal = 0;
            if (inputCortePropina) { inputCortePropina.value = '0'; inputCortePropina.disabled = true; }
            if (inputCorteDescuento) { inputCorteDescuento.value = '0'; inputCorteDescuento.disabled = true; }
        } else {
            if (inputCortePropina) inputCortePropina.disabled = false;
            if (inputCorteDescuento) inputCorteDescuento.disabled = false;
            descuentoAplicado = inputCorteDescuento ? (parseFloat(inputCorteDescuento.value) || 0) : 0;
            if (descuentoAplicado > totalOrdenActual) {
                showToast('El descuento no puede superar el total', 'error');
                if (inputCorteDescuento) inputCorteDescuento.value = '0';
                descuentoAplicado = 0;
            }
            propinaAplicada = inputCortePropina ? (parseFloat(inputCortePropina.value) || 0) : 0;
            totalFinal = totalOrdenActual - descuentoAplicado + propinaAplicada;
        }

        function fmt(v) { return Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }); }

        var filaDescuento = descuentoAplicado > 0
            ? '<div class="resumen-fila descuento"><span>Descuento</span><span>- ' + fmt(descuentoAplicado) + '</span></div>'
            : '';
        var filaPropina = propinaAplicada > 0
            ? '<div class="resumen-fila propina"><span>Propina</span><span>+ ' + fmt(propinaAplicada) + '</span></div>'
            : '';

        divResumenCobro.innerHTML =
            '<div class="resumen-cobro-detalle">' +
            '<div class="resumen-fila"><span>Total orden</span><span>' + fmt(totalOrdenActual) + '</span></div>' +
            filaDescuento +
            filaPropina +
            '<div class="resumen-fila total-final"><span>TOTAL A COBRAR</span><span>' + fmt(totalFinal) + '</span></div>' +
            '</div>';
    }

    if (inputCortePropina) inputCortePropina.addEventListener('input', actualizarResumenCobro);
    if (inputCorteDescuento) inputCorteDescuento.addEventListener('input', actualizarResumenCobro);
    if (inputCorteCortesia) inputCorteCortesia.addEventListener('change', actualizarResumenCobro);

    // Modal método de pago: botones y cancelar
    if (modalMetodoPago) {
        modalMetodoPago.querySelectorAll('.btn-metodo-pago').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var metodo = this.getAttribute('data-metodo') || '';
                cerrarModalMetodoPago();
                if (ordenPendientePago) {
                    var id = ordenPendientePago;
                    ordenPendientePago = null;
                    cambiarEstadoOrden(id, 'pagada', metodo);
                }
            });
        });
    }
    if (btnCancelarMetodoPago) {
        btnCancelarMetodoPago.addEventListener('click', function () {
            cerrarModalMetodoPago();
            ordenPendientePago = null;
        });
    }
    if (btnCerrarModalMetodoPago) {
        btnCerrarModalMetodoPago.addEventListener('click', function () {
            cerrarModalMetodoPago();
            ordenPendientePago = null;
        });
    }

    function estadoToBadgeText(estado) {
        var e = (estado || '').toLowerCase();
        if (e === 'pagada') return 'Pagada';
        if (e === 'servido' || e === 'servida') return 'Listo';
        if (e === 'preparando') return 'Preparando';
        return 'Pendiente';
    }

    function renderOrdenes(snap) {
        if (!ordenesBody) return;
        var cards = [];
        if (snap.empty) {
            cards.push('<div class="msg-empty order-msg-empty"><span class="order-msg-empty-spinner" aria-hidden="true"></span>Monitoreando pedidos en tiempo real...</div>');
        } else {
            var now = Date.now();
            snap.forEach(function (d) {
                var data = d.data();
                var id = d.id;
                var mesa = data.mesa || '—';
                var mesero = data.meseroNombre || '—';
                var estado = data.estado || 'pendiente';
                
                // CORRECCIÓN: Normalización de estados
                var estadoRaw = (String(estado)).trim().toLowerCase();
                var estadoNormalizado = estadoRaw.replace(/\s+/g, '-');
                
                // Mapeo correcto de estados
                if (estadoNormalizado === 'servido' || estadoNormalizado === 'servida') {
                    estadoNormalizado = 'listo';
                }
                
                // La clase CSS debe ser EXACTAMENTE: status-pendiente, status-preparando, status-listo, status-pagada
                var estadoClase = 'status-' + estadoNormalizado;
                
                // Badge text para mostrar
                var badgeText = '';
                if (estadoRaw === 'pagada') badgeText = 'Pagada';
                else if (estadoRaw === 'servido' || estadoRaw === 'servida' || estadoNormalizado === 'listo') badgeText = 'Listo';
                else if (estadoRaw === 'preparando') badgeText = 'Preparando';
                else badgeText = 'Pendiente';
                
                // Badge class para el círculo de color
                var badgeClass = '';
                if (estadoRaw === 'pagada') badgeClass = 'estado-pagada';
                else if (estadoRaw === 'servido' || estadoRaw === 'servida' || estadoNormalizado === 'listo') badgeClass = 'estado-servido';
                else if (estadoRaw === 'preparando') badgeClass = 'estado-preparando';
                else badgeClass = 'estado-pendiente';
    
                // Cálculo de tiempo
                var elapsedMin = 0;
                var timerText = '—';
                if (data.timestamp && data.timestamp.toDate) {
                    var created = data.timestamp.toDate().getTime();
                    elapsedMin = Math.floor((now - created) / 60000);
                    if (elapsedMin < 60) {
                        timerText = elapsedMin + ' min';
                    } else {
                        var h = Math.floor(elapsedMin / 60);
                        var m = elapsedMin % 60;
                        timerText = h + ' h ' + m + ' min';
                    }
                }
    
                var urgentClass = (estadoRaw !== 'pagada' && estadoRaw !== 'cancelada' && elapsedMin >= 15) ? ' order-urgent' : '';
    
        // Items HTML
        var itemsHtml = '';
        if (Array.isArray(data.platillos) && data.platillos.length > 0) {
            itemsHtml = data.platillos.map(function (p) {
                var nombre = (p && p.nombre) ? p.nombre : (typeof p === 'string' ? p : '—');
                var cant = (p && p.cantidad) ? p.cantidad : 1;
                var nota = (p && p.nota) ? String(p.nota).trim() : '';
                var notaHtml = '';
                if (nota) {
                    notaHtml = '<span class="nota-platillo-display">→ ' + escapeHtml(nota) + '</span>';
                }
                return '<li class="order-item"><span class="order-item-qty">' + cant + '</span><span class="order-item-name">' + escapeHtml(nombre) + '</span>' + notaHtml + '</li>';
            }).join('');
        } else {
            itemsHtml = '<li class="order-item"><span class="order-item-qty">0</span><span class="order-item-name">—</span></li>';
        }
    
        var totalStr = (data.total != null) ? formatearDinero(Number(data.total)) : '—';
        var notaOrdenStr = (data.notaOrden && String(data.notaOrden).trim()) || '';
        var notaOrdenHtml = '';
        if (notaOrdenStr) {
            notaOrdenHtml = '<div class="nota-orden-display"><span class="nota-orden-label">Nota:</span> ' + escapeHtml(notaOrdenStr) + '</div>';
        }
    
                // Botones de acción
                var esPagadaOCancelada = estadoRaw === 'pagada' || estadoRaw === 'cancelada';
                var btnsHtml = '';
                if (!esPagadaOCancelada) {
                    if (estadoRaw !== 'preparando') {
                        btnsHtml += '<button type="button" class="order-btn-icon order-btn-preparando" data-id="' + id + '" data-estado="preparando" title="Preparando"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>';
                    }
                    btnsHtml += '<button type="button" class="order-btn-icon order-btn-servido" data-id="' + id + '" data-estado="servido" title="Marcar servido"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></button>';
                    btnsHtml += '<button type="button" class="order-btn-icon order-btn-pagada" data-id="' + id + '" data-estado="pagada" title="Marcar pagada"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5h1.125c.621 0 1.129.504 1.09 1.124a7.627 7.627 0 01-1.09 3.986 4.648 4.648 0 01-3.986-3.986 7.625 7.625 0 011.09-5.235M9 10.5h.375M9 9h3.621a2.25 2.25 0 011.06 4.31 2.25 2.25 0 01.95 2.19M9 15h3.621a2.25 2.25 0 011.06 4.31 2.25 2.25 0 01.95-2.19M9 12h.375"/></svg></button>';
                    btnsHtml += '<button type="button" class="order-btn-icon btn-whatsapp" data-id="' + id + '" title="Enviar por WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 2.293.283.107 0 1.21-.123 2.29-.283 1.585-.233 2.708-1.626 2.708-3.228V12m0 0c0 1.6-1.123 2.994-2.707 3.227-1.087.16-2.185.283-2.293.283-.107 0-1.21-.123-2.29-.283-1.585-.233-2.708-1.626-2.708-3.228V6.741c0-1.602 1.123-2.994 2.708-3.227C13.79 3.354 14.884 3.234 16 3.234s2.21.12 2.293.283c1.585.233 2.708 1.626 2.708 3.228v5.018z"/></svg></button>';
                }
                btnsHtml += '<button type="button" class="order-btn-icon order-btn-print" data-id="' + id + '" title="Imprimir ticket"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227 7.502 7.502 0 01-7.538-1.227M17.66 18l-.229-2.523a1.125 1.125 0 00-1.12-1.227 7.502 7.502 0 00-7.538 1.227M12 15.75h3m-3.75 3.75h3m-6.75 3.75h3m-3.75 3.75h3m-6.75 3.75h3m-3.75 3.75h3"/></svg></button>';
                btnsHtml += '<button type="button" class="order-btn-icon order-btn-danger eliminar-orden" data-id="' + id + '" title="Eliminar orden"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></button>';
    
                // IMPORTANTE: La clase 'estadoClase' se aplica directamente al div principal
                cards.push(
                    '<div class="order-card ' + estadoClase + urgentClass + '" data-id="' + id + '">' +
                    '<div class="order-card-header">' +
                    '<span class="order-card-mesa">Mesa ' + escapeHtml(mesa) + '</span>' +
                    '<span class="order-card-badge ' + badgeClass + '">' + escapeHtml(badgeText) + '</span>' +
                    '</div>' +
                    '<div class="order-card-body">' +
                    '<div class="order-card-mesero">' + escapeHtml(mesero) + '</div>' +
                    '<ul class="order-items">' + itemsHtml + '</ul>' +
                    notaOrdenHtml +
                    '<div class="order-card-total">' + totalStr + '</div>' +
                    '</div>' +
                    '<div class="order-card-footer">' +
                    '<span class="order-timer">' + timerText + '</span>' +
                    '<div class="order-actions">' + btnsHtml + '</div>' +
                    '</div>' +
                    '</div>'
                );
            });
        }
        ordenesBody.innerHTML = cards.join('');
    
        // Event listeners para botones...
        ordenesBody.querySelectorAll('.order-btn-preparando[data-id], .order-btn-servido[data-id], .order-btn-pagada[data-id]').forEach(function (btn) {
            var id = btn.getAttribute('data-id');
            var estado = btn.getAttribute('data-estado');
            if (id && estado) {
                btn.addEventListener('click', function () {
                    cambiarEstadoOrden(id, estado);
                });
            }
        });
        ordenesBody.querySelectorAll('.btn-whatsapp[data-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (typeof window.enviarWhatsApp === 'function') {
                    window.enviarWhatsApp(btn.getAttribute('data-id'));
                }
            });
        });
        ordenesBody.querySelectorAll('.order-btn-print[data-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (typeof window.prepararTicket === 'function') {
                    window.prepararTicket(btn.getAttribute('data-id'));
                } else {
                    showToastSafe('El módulo de impresión no está disponible.\nRecarga la página e intenta de nuevo.', 'error');
                }
            });
        });
        ordenesBody.querySelectorAll('.eliminar-orden[data-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-id');
                if (!confirm('¿Eliminar esta orden permanentemente? Esta acción no se puede deshacer.')) return;
                db.collection('ordenes').doc(id).delete().catch(function (err) {
                    console.error('Error al eliminar orden:', err);
                    showToastSafe('No se pudo eliminar la orden.', 'error');
                });
            });
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function actualizarIconoSilencio() {
        if (!btnSilenciar) return;
        if (sonidoActivo) {
            btnSilenciar.textContent = '🔔';
            btnSilenciar.title = 'Silenciar notificaciones';
        } else {
            btnSilenciar.textContent = '🔕';
            btnSilenciar.title = 'Activar notificaciones';
        }
    }

    if (btnSilenciar) {
        actualizarIconoSilencio();
        btnSilenciar.addEventListener('click', function () {
            sonidoActivo = !sonidoActivo;
            localStorage.setItem('restiq_sonido', sonidoActivo ? 'on' : 'off');
            actualizarIconoSilencio();
            showToastSafe(
                sonidoActivo ? 'Notificaciones activadas' : 'Notificaciones silenciadas',
                'info'
            );
        });
    }

    var filtroOrdenActual = 'activas';
    var btnFiltroActivas = document.getElementById('filtroActivas');
    var btnFiltroPagadas = document.getElementById('filtroPagadas');
    var todasLasOrdenes = [];
    var notifBadge = document.getElementById('notifBadge');
    var notifIcon = document.getElementById('notifIcon');
    var notifCount = document.getElementById('notifCount');
    var adminToast = document.getElementById('adminToast');
    var adminToastMsg = document.getElementById('adminToastMsg');
    var adminToastHideTimeout = null;

    db.collection('ordenes').onSnapshot(function (snap) {
        todasLasOrdenes = snap;
        var idsActuales = new Set();
        snap.forEach(function (doc) { idsActuales.add(doc.id); });
        if (ordenesConocidas === null) {
            ordenesConocidas = new Set(idsActuales);
        } else {
            idsActuales.forEach(function (id) {
                if (!ordenesConocidas.has(id)) {
                    var doc = snap.docs.find(function (d) { return d.id === id; });
                    if (doc) {
                        var data = doc.data();
                        contadorNuevas++;
                        if (adminToast && adminToastMsg) {
                            adminToastMsg.textContent = 'Mesa ' + (data.mesa || '—') + ' — ' + (data.meseroNombre || '—');
                            adminToast.style.opacity = '1';
                            if (adminToastHideTimeout) clearTimeout(adminToastHideTimeout);
                            adminToastHideTimeout = setTimeout(function () {
                                if (adminToast) adminToast.style.opacity = '0';
                                adminToastHideTimeout = null;
                            }, 4000);
                        }
                        if (sonidoActivo) {
                            try {
                                var ctx = new (window.AudioContext || window.webkitAudioContext)();
                                var o = ctx.createOscillator();
                                var g = ctx.createGain();
                                o.connect(g);
                                g.connect(ctx.destination);
                                o.frequency.value = 800;
                                g.gain.setValueAtTime(0.15, ctx.currentTime);
                                g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                                o.start(ctx.currentTime);
                                o.stop(ctx.currentTime + 0.15);
                            } catch (e) {}
                        }
                    }
                }
            });
            if (contadorNuevas > 0 && notifBadge && notifCount) {
                notifBadge.style.display = '';
                notifCount.textContent = String(contadorNuevas);
            }
        }
        ordenesConocidas = new Set(idsActuales);
        aplicarFiltroOrdenes();
    }, function (err) {
        if (ordenesBody) ordenesBody.innerHTML = '<div class="msg-empty order-msg-empty">Error al cargar órdenes.</div>';
        console.error(err);
    });

    function aplicarFiltroOrdenes() {
        if (!todasLasOrdenes) return;
        var docsfiltrados = [];
        todasLasOrdenes.forEach(function (doc) {
            var estado = (doc.data().estado || '').toLowerCase();
            var esPagada = estado === 'pagada';
            if (filtroOrdenActual === 'activas' && !esPagada) {
                docsfiltrados.push(doc);
            } else if (filtroOrdenActual === 'pagadas' && esPagada) {
                docsfiltrados.push(doc);
            }
        });
        var filtradas = {
            empty: docsfiltrados.length === 0,
            forEach: function (cb) {
                docsfiltrados.forEach(cb);
            }
        };
        renderOrdenes(filtradas);
    }

    if (btnFiltroActivas) {
        btnFiltroActivas.addEventListener('click', function () {
            filtroOrdenActual = 'activas';
            btnFiltroActivas.style.opacity = '1';
            btnFiltroPagadas.style.opacity = '0.6';
            btnFiltroActivas.className = 'btn';
            btnFiltroPagadas.className = 'btn btn-secondary';
            aplicarFiltroOrdenes();
        });
    }
    if (btnFiltroPagadas) {
        btnFiltroPagadas.addEventListener('click', function () {
            filtroOrdenActual = 'pagadas';
            btnFiltroPagadas.style.opacity = '1';
            btnFiltroActivas.style.opacity = '0.6';
            btnFiltroPagadas.className = 'btn';
            btnFiltroActivas.className = 'btn btn-secondary';
            aplicarFiltroOrdenes();
        });
    }
    if (notifIcon) {
        notifIcon.addEventListener('click', function () {
            contadorNuevas = 0;
            if (notifBadge) notifBadge.style.display = 'none';
            if (notifCount) notifCount.textContent = '0';
            mostrarSeccion('ordenes');
        });
    }

    // --- Menú ---
    function agregarPlatillo(nombre, precio, categoria, imagen) {
        if (!nombre || !nombre.trim()) return;
        var p = parseFloat(precio);
        if (isNaN(p) || p < 0) return;
        var cat = (categoria || 'Otros').trim();
        return db.collection('menu').add({ nombre: nombre.trim(), precio: p, categoria: cat, imagen: imagen || '' });
    }

    function editarPlatillo(id, nombre, precio, categoria, imagen) {
        var p = parseFloat(precio);
        if (isNaN(p) || p < 0) return;
        var cat = (categoria || 'Otros').trim();
        return db.collection('menu').doc(id).update({ nombre: (nombre || '').trim(), precio: p, categoria: cat, imagen: imagen || '' });
    }

    function eliminarPlatillo(id) {
        if (!confirm('¿Eliminar este platillo?')) return;
        db.collection('menu').doc(id).delete();
    }

    var CATEGORIAS_ORDEN = ['Entradas', 'Platos fuertes', 'Bebidas', 'Postres', 'Otros'];
    var menuFilterCategoria = null; // null = todas

    function slugCategoria(cat) {
        var s = (cat || 'Otros').toLowerCase().replace(/\s+/g, '-');
        return (s === 'platos-fuertes' || s === 'entradas' || s === 'bebidas' || s === 'postres' || s === 'otros') ? s : 'otros';
    }

    function inicialesProducto(nombre) {
        if (!nombre || !nombre.trim()) return '?';
        var parts = nombre.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return (nombre.trim().substring(0, 2) || '?').toUpperCase();
    }

    function renderMenu(snap) {
        if (!menuCardsGrid || !menuFilterPills || !menuEmptyState) return;
        var items = [];
        if (!snap.empty) {
            snap.forEach(function (d) {
                var data = d.data();
                var cat = data.categoria || 'Otros';
                items.push({
                    id: d.id,
                    data: data,
                    nombre: data.nombre || '',
                    precio: data.precio != null ? Number(data.precio) : 0,
                    categoria: cat,
                    imagen: data.imagen || data.image || ''
                });
            });
        }

        // Pills de categoría
        menuFilterPills.innerHTML = '';
        var pillTodos = document.createElement('button');
        pillTodos.type = 'button';
        pillTodos.className = 'menu-filter-pill' + (menuFilterCategoria === null ? ' active' : '');
        pillTodos.textContent = 'Todos';
        pillTodos.setAttribute('data-categoria', '');
        pillTodos.addEventListener('click', function () {
            menuFilterCategoria = null;
            menuFilterPills.querySelectorAll('.menu-filter-pill').forEach(function (p) {
                var c = p.getAttribute('data-categoria');
                p.classList.toggle('active', (c === '' && menuFilterCategoria === null) || (c === menuFilterCategoria));
            });
            renderMenuFromItems(menuItemsAdmin);
        });
        menuFilterPills.appendChild(pillTodos);
        CATEGORIAS_ORDEN.forEach(function (cat) {
            var pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'menu-filter-pill' + (menuFilterCategoria === cat ? ' active' : '');
            pill.textContent = cat;
            pill.setAttribute('data-categoria', cat);
            pill.addEventListener('click', function () {
                menuFilterCategoria = cat;
                menuFilterPills.querySelectorAll('.menu-filter-pill').forEach(function (p) {
                    var c = p.getAttribute('data-categoria');
                    p.classList.toggle('active', (c === '' && menuFilterCategoria === null) || (c === menuFilterCategoria));
                });
                renderMenuFromItems(menuItemsAdmin);
            });
            menuFilterPills.appendChild(pill);
        });

        menuItemsAdmin = items.map(function (x) {
            return { id: x.id, nombre: x.nombre, precio: x.precio, categoria: x.categoria, imagen: x.imagen };
        });
        renderMenuFromItems(menuItemsAdmin);
    }

    function renderMenuFromItems(items) {
        if (!menuCardsGrid || !menuEmptyState) return;
        var filtrados = menuFilterCategoria ? items.filter(function (i) { return i.categoria === menuFilterCategoria; }) : items;

        if (filtrados.length === 0) {
            menuCardsGrid.style.display = 'none';
            menuEmptyState.style.display = 'block';
            var msgEl = menuEmptyState.querySelector('.empty-state-text');
            if (msgEl) {
                msgEl.textContent = items.length === 0
                    ? 'Esperando nuevas experiencias gastronómicas…'
                    : 'Ningún platillo en esta categoría.';
            }
            return;
        }
        menuEmptyState.style.display = 'none';
        menuCardsGrid.style.display = 'grid';
        menuCardsGrid.innerHTML = '';

        filtrados.forEach(function (item) {
            var slug = slugCategoria(item.categoria);
            var iniciales = inicialesProducto(item.nombre);
            var imgUrl = (item.imagen || '').trim();
            var card = document.createElement('div');
            card.className = 'product-card';

            var topWrap = document.createElement('div');
            topWrap.className = 'product-card-image-wrap';
            if (imgUrl) {
                var img = document.createElement('img');
                img.className = 'product-card-image';
                img.src = imgUrl;
                img.alt = item.nombre;
                img.loading = 'lazy';
                img.onerror = function () {
                    var ph = document.createElement('div');
                    ph.className = 'product-card-placeholder';
                    ph.setAttribute('data-cat', slug);
                    ph.textContent = iniciales;
                    topWrap.innerHTML = '';
                    topWrap.appendChild(ph);
                };
                topWrap.appendChild(img);
            } else {
                var ph = document.createElement('div');
                ph.className = 'product-card-placeholder';
                ph.setAttribute('data-cat', slug);
                ph.textContent = iniciales;
                topWrap.appendChild(ph);
            }
            card.appendChild(topWrap);

            var body = document.createElement('div');
            body.className = 'product-card-body';
            body.innerHTML = '<span class="product-card-name">' + escapeHtml(item.nombre) + '</span>' +
                '<span class="product-card-meta">' + escapeHtml(item.categoria) + '</span>';
            var footer = document.createElement('div');
            footer.className = 'product-card-footer';
            footer.innerHTML = '<div class="product-card-actions">' +
                '<button type="button" class="btn-sm btn-secondary editar-platillo" data-id="' + item.id + '" data-nombre="' + escapeHtml(item.nombre) + '" data-precio="' + (item.precio != null ? item.precio : '') + '" data-categoria="' + escapeHtml(item.categoria) + '" data-imagen="' + escapeHtml(item.imagen || '') + '">Editar</button> ' +
                '<button type="button" class="btn-sm btn-danger eliminar-platillo" data-id="' + item.id + '">Eliminar</button></div>' +
                '<span class="product-card-price">' + formatearDinero(item.precio) + '</span>';
            body.appendChild(footer);
            card.appendChild(body);

            menuCardsGrid.appendChild(card);
        });

        menuCardsGrid.querySelectorAll('.editar-platillo').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-id');
                var nombre = btn.getAttribute('data-nombre') || '';
                var precio = btn.getAttribute('data-precio') || '';
                var categoria = btn.getAttribute('data-categoria') || 'Otros';
                var imagen = btn.getAttribute('data-imagen') || '';
                platilloNombre.value = nombre;
                platilloPrecio.value = precio;
                if (platilloCategoria) platilloCategoria.value = categoria;
                if (platilloImagen) platilloImagen.value = imagen;
                abrirModalPlatillo(id);
            });
        });
        menuCardsGrid.querySelectorAll('.eliminar-platillo').forEach(function (btn) {
            btn.addEventListener('click', function () {
                eliminarPlatillo(btn.getAttribute('data-id'));
            });
        });
    }

    db.collection('menu').onSnapshot(function (snap) {
        menuItemsAdmin = [];
        snap.forEach(function (d) {
            var data = d.data();
            menuItemsAdmin.push({
                id: d.id,
                nombre: data.nombre != null ? String(data.nombre) : '',
                precio: data.precio != null ? Number(data.precio) : 0,
                categoria: data.categoria || 'Otros'
            });
        });
        renderMenu(snap);
    }, function (err) {
        if (menuCardsGrid) menuCardsGrid.innerHTML = '';
        if (menuEmptyState) {
            menuEmptyState.style.display = 'block';
            var p = menuEmptyState.querySelector('.empty-state-text');
            if (p) p.textContent = 'Error al cargar el menú.';
        }
        console.error(err);
    });

    function abrirModalPlatillo(editId) {
        if (!modalPlatillo) return;
        var titleEl = document.getElementById('modalPlatilloTitle');
        if (editId) {
            if (titleEl) titleEl.textContent = 'Editar Platillo';
            modalPlatillo.setAttribute('data-edit-id', editId);
        } else {
            if (titleEl) titleEl.textContent = 'Agregar Platillo';
            modalPlatillo.removeAttribute('data-edit-id');
            platilloNombre.value = '';
            platilloPrecio.value = '';
            if (platilloCategoria) platilloCategoria.value = 'Otros';
            if (platilloImagen) platilloImagen.value = '';
        }
        modalPlatillo.classList.add('open');
        modalPlatillo.style.display = 'flex';
    }

    function cerrarModalPlatillo() {
        if (!modalPlatillo) return;
        modalPlatillo.classList.remove('open');
        setTimeout(function () {
            if (!modalPlatillo.classList.contains('open')) {
                modalPlatillo.style.display = 'none';
            }
        }, 300);
    }

    if (btnAgregarPlatillo) {
        btnAgregarPlatillo.addEventListener('click', function () {
            abrirModalPlatillo(null);
        });
    }
    if (btnCancelarPlatillo) {
        btnCancelarPlatillo.addEventListener('click', function () {
            cerrarModalPlatillo();
        });
    }
    if (btnCerrarModalPlatillo) {
        btnCerrarModalPlatillo.addEventListener('click', function () {
            cerrarModalPlatillo();
        });
    }
    if (btnGuardarPlatillo) {
        btnGuardarPlatillo.addEventListener('click', function () {
            var editId = modalPlatillo.getAttribute('data-edit-id');
            var nombre = platilloNombre.value.trim();
            var precio = platilloPrecio.value;
            var categoria = platilloCategoria ? platilloCategoria.value : 'Otros';
            var imagenUrl = platilloImagen ? platilloImagen.value.trim() : '';
            var btn = this;
            setButtonLoading(btn, true);
            var prom = editId ? editarPlatillo(editId, nombre, precio, categoria, imagenUrl) : agregarPlatillo(nombre, precio, categoria, imagenUrl);
            if (prom && typeof prom.then === 'function') {
                prom.then(function () {
                    modalPlatillo.style.display = 'none';
                    setButtonLoading(btn, false);
                }).catch(function () {
                    setButtonLoading(btn, false);
                });
            } else {
                modalPlatillo.style.display = 'none';
                setButtonLoading(btn, false);
            }
        });
    }

    // --- Meseros ---
    function crearMesero(nombre, email, password) {
        if (!email || !password) {
            if (meseroError) {
                meseroError.textContent = 'Correo y contraseña son obligatorios.';
                meseroError.style.display = 'block';
            }
            return;
        }
        if (password.length < 6) {
            if (meseroError) {
                meseroError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                meseroError.style.display = 'block';
            }
            return;
        }
        if (meseroError) meseroError.style.display = 'none';

        var secondaryApp;
        try {
            secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
        } catch (e) {
            secondaryApp = firebase.app('Secondary');
        }
        var secondaryAuth = secondaryApp.auth();

        secondaryAuth.createUserWithEmailAndPassword(email, password).then(function (userCredential) {
            var uid = userCredential.user.uid;
            return db.collection('usuarios').doc(uid).set({
                nombre: (nombre || '').trim() || email,
                email: email,
                rol: 'mesero'
            });
        }).then(function () {
            return secondaryApp.delete();
        }).then(function () {
            if (modalMesero) modalMesero.style.display = 'none';
            meseroNombre.value = '';
            meseroEmail.value = '';
            meseroPassword.value = '';
            showToastSafe('Mesero creado correctamente.', 'success');
        }).catch(function (err) {
            if (err && err.code === 'auth/email-already-in-use') {
                secondaryAuth.signInWithEmailAndPassword(email, password).then(function (userCredential) {
                    var uid = userCredential.user.uid;
                    return db.collection('usuarios').doc(uid).set({
                        nombre: (nombre || '').trim() || email,
                        email: email,
                        rol: 'mesero'
                    });
                }).then(function () {
                    return secondaryApp.delete();
                }).then(function () {
                    if (modalMesero) modalMesero.style.display = 'none';
                    meseroNombre.value = '';
                    meseroEmail.value = '';
                    meseroPassword.value = '';
                    showToastSafe('Mesero actualizado correctamente.', 'success');
                }).catch(function (signInErr) {
                    if (meseroError) {
                        meseroError.textContent = 'El correo ya existe pero la contraseña no coincide. Usa la contraseña original de esa cuenta o elimínala desde Firebase Console → Authentication.';
                        meseroError.style.display = 'block';
                    }
                    try {
                        if (firebase.app('Secondary')) firebase.app('Secondary').delete();
                    } catch (e) { }
                });
            } else {
                try {
                    if (firebase.app('Secondary')) firebase.app('Secondary').delete();
                } catch (e) { }
                if (meseroError) {
                    meseroError.textContent = err.message || 'Error al crear mesero.';
                    meseroError.style.display = 'block';
                }
                console.error(err);
            }
        });
    }

    // --- Meseros (Renderizado con Tarjetas) ---
    db.collection('usuarios').where('rol', '==', 'mesero').onSnapshot(function (snap) {
        var grid = document.getElementById('meserosGrid'); // Asegúrate de que este ID exista en el HTML
        if (!grid) return;

        if (snap.empty) {
            grid.innerHTML = '<div class="msg-empty" style="grid-column: 1/-1;">No hay meseros registrados.</div>';
            return;
        }

        var cardsHtml = '';
        snap.forEach(function (doc) {
            var data = doc.data();
            var nombre = data.nombre || '—';
            var email = data.email || '—';
            // Obtener iniciales para el avatar
            var iniciales = (nombre || '').split(' ').map(function (n) { return n[0]; }).join('').substring(0, 2).toUpperCase() || '?';

            cardsHtml +=
                '<div class="mesero-card" data-id="' + doc.id + '">' +
                    '<div class="mesero-avatar">' + escapeHtml(iniciales) + '</div>' +
                    '<div class="mesero-nombre" title="' + escapeHtml(nombre) + '">' + escapeHtml(nombre) + '</div>' +
                    '<div class="mesero-email" title="' + escapeHtml(email) + '">' + escapeHtml(email) + '</div>' +
                    '<div class="mesero-acciones">' +
                        '<button type="button" class="btn-sm btn-danger eliminar-mesero" data-id="' + doc.id + '" data-nombre="' + escapeHtml(nombre) + '">Eliminar</button>' +
                    '</div>' +
                '</div>';
        });
        grid.innerHTML = cardsHtml;
    }, function (err) {
        console.error('Error al cargar meseros:', err);
        var grid = document.getElementById('meserosGrid');
        if (grid) grid.innerHTML = '<div class="msg-empty">Error al cargar meseros.</div>';
    });

    // Delegación de eventos para eliminar meseros en la cuadrícula
    if (meserosGrid) {
        meserosGrid.addEventListener('click', function (e) {
            var btn = e.target.closest('.eliminar-mesero');
            if (!btn) return;
            var id = btn.getAttribute('data-id');
            var nombre = btn.getAttribute('data-nombre') || 'este mesero';
            if (!confirm('¿Eliminar a ' + nombre + '? Perderá acceso al sistema inmediatamente.')) return;
            db.collection('usuarios').doc(id).delete().then(function () {
                showToastSafe('Mesero eliminado de la base de datos. Para revocar el acceso de Firebase Auth completamente, elimínalo también en Firebase Console → Authentication → Users.', 'success');
            }).catch(function (err) {
                console.error('Error al eliminar mesero:', err);
                showToastSafe('No se pudo eliminar el mesero.', 'error');
            });
        });
    }

    function abrirModalMesero() {
        if (!modalMesero) return;
        var titleEl = document.getElementById('modalMeseroTitle');
        if (titleEl) titleEl.textContent = 'Crear mesero';
        meseroNombre.value = '';
        meseroEmail.value = '';
        meseroPassword.value = '';
        if (meseroError) meseroError.style.display = 'none';
        modalMesero.classList.add('open');
        modalMesero.style.display = 'flex';
    }

    function cerrarModalMesero() {
        if (!modalMesero) return;
        modalMesero.classList.remove('open');
        setTimeout(function () {
            if (!modalMesero.classList.contains('open')) {
                modalMesero.style.display = 'none';
            }
        }, 300);
    }

    if (btnCrearMesero) {
        btnCrearMesero.addEventListener('click', function () {
            abrirModalMesero();
        });
    }
    if (btnCancelarMesero) {
        btnCancelarMesero.addEventListener('click', function () {
            cerrarModalMesero();
        });
    }
    if (btnCerrarModalMesero) {
        btnCerrarModalMesero.addEventListener('click', function () {
            cerrarModalMesero();
        });
    }
    if (btnGuardarMesero) {
        btnGuardarMesero.addEventListener('click', function () {
            crearMesero(meseroNombre.value, meseroEmail.value, meseroPassword.value);
        });
    }

    // Nota: crearMesero hace signUp y luego el usuario queda logueado como el nuevo mesero.
    // Para que el admin siga logueado, en producción se usaría Cloud Functions con Admin SDK.
    // Aquí re-autenticamos al admin si es posible (auth.currentUser puede ser el nuevo mesero).
    // Dejamos el flujo como pedido; el admin puede volver a iniciar sesión si queda deslogueado.

    // --- Gastos ---
    function registrarGasto(descripcion, categoria, monto, metodoPago) {
        var m = parseFloat(monto);
        if (isNaN(m) || m <= 0) return Promise.reject(new Error('Monto inválido'));
        return db.collection('gastos').add({
            descripcion: (descripcion || '').trim(),
            categoria: categoria || 'otros',
            monto: m,
            metodoPago: metodoPago || 'efectivo',
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
            gastoDescripcion.value = '';
            gastoMonto.value = '';
            if (gastoOk) {
                gastoOk.style.display = 'block';
                setTimeout(function () { gastoOk.style.display = 'none'; }, 3000);
            }
        });
    }

    if (btnRegistrarGasto) {
        btnRegistrarGasto.addEventListener('click', function () {
            var btn = this;
            var prom = registrarGasto(gastoDescripcion.value, gastoCategoria.value, gastoMonto.value, gastoMetodoPago.value);
            if (prom && typeof prom.then === 'function') {
                setButtonLoading(btn, true);
                prom.then(function () { setButtonLoading(btn, false); }).catch(function (err) {
                    console.error(err);
                    setButtonLoading(btn, false);
                });
            }
        });
    }

    // --- Reportes ---
    var reporteVentas = [];

    function setReporteRango(rango) {
        var now = new Date();
        var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
        var hoy = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        if (rango === 'hoy') {
            if (reporteDesde) reporteDesde.value = hoy;
            if (reporteHasta) reporteHasta.value = hoy;
        } else if (rango === 'semana') {
            var lunes = new Date(now);
            var d = now.getDay();
            lunes.setDate(now.getDate() - (d === 0 ? 6 : d - 1));
            var lunesStr = lunes.getFullYear() + '-' + pad(lunes.getMonth() + 1) + '-' + pad(lunes.getDate());
            if (reporteDesde) reporteDesde.value = lunesStr;
            if (reporteHasta) reporteHasta.value = hoy;
        } else if (rango === 'mes') {
            var primerDia = new Date(now.getFullYear(), now.getMonth(), 1);
            var primerDiaStr = primerDia.getFullYear() + '-' + pad(primerDia.getMonth() + 1) + '-' + pad(primerDia.getDate());
            if (reporteDesde) reporteDesde.value = primerDiaStr;
            if (reporteHasta) reporteHasta.value = hoy;
        }
        [reporteQuickHoy, reporteQuickSemana, reporteQuickMes].forEach(function (btn) {
            if (btn) btn.classList.toggle('active', btn.getAttribute('data-range') === rango);
        });
        filtrarReporte();
    }

    if (reporteQuickHoy) reporteQuickHoy.addEventListener('click', function () { setReporteRango('hoy'); });
    if (reporteQuickSemana) reporteQuickSemana.addEventListener('click', function () { setReporteRango('semana'); });
    if (reporteQuickMes) reporteQuickMes.addEventListener('click', function () { setReporteRango('mes'); });
    setReporteRango('hoy');

    function filtrarReporte() {
        var desde = reporteDesde && reporteDesde.value ? reporteDesde.value : '';
        var hasta = reporteHasta && reporteHasta.value ? reporteHasta.value : '';
        if (!desde || !hasta) {
            if (reportesBody) reportesBody.innerHTML = '<tr><td colspan="4" class="msg-empty">Seleccione fechas desde y hasta.</td></tr>';
            if (reporteBalanceFoot) reporteBalanceFoot.style.display = 'none';
            return;
        }
        var d1 = firebase.firestore.Timestamp.fromDate(new Date(desde + 'T00:00:00'));
        var d2 = firebase.firestore.Timestamp.fromDate(new Date(hasta + 'T23:59:59.999'));
        var pVentas = db.collection('ventas').where('timestamp', '>=', d1).where('timestamp', '<=', d2).get();
        var pGastos = db.collection('gastos').where('fecha', '>=', d1).where('fecha', '<=', d2).get();
        Promise.all([pVentas, pGastos]).then(function (results) {
            var ventasSnap = results[0];
            var gastosSnap = results[1];
            var transacciones = [];
            var totalIngresos = 0;
            ventasSnap.forEach(function (d) {
                var data = d.data();
                var tot = data.total != null ? Number(data.total) : 0;
                totalIngresos += tot;
                var fechaObj = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : null;
                transacciones.push({
                    tipo: 'ingreso',
                    fecha: fechaObj,
                    descripcion: 'Mesa ' + (data.mesa || '—') + ' · ' + (data.meseroNombre || '—'),
                    monto: tot
                });
            });
            var totalGastos = 0;
            gastosSnap.forEach(function (d) {
                var data = d.data();
                var monto = data.monto != null ? Number(data.monto) : 0;
                totalGastos += monto;
                var fechaObj = data.fecha && data.fecha.toDate ? data.fecha.toDate() : null;
                transacciones.push({
                    tipo: 'gasto',
                    fecha: fechaObj,
                    descripcion: (data.descripcion || '—') + ' · ' + (data.categoria || ''),
                    monto: -monto
                });
            });
            transacciones.sort(function (a, b) {
                var ta = a.fecha ? a.fecha.getTime() : 0;
                var tb = b.fecha ? b.fecha.getTime() : 0;
                return ta - tb;
            });
            var balanceNeto = totalIngresos - totalGastos;

            // Mini KPIs de resumen rápido
            var miniIngresos = document.getElementById('reporteMiniIngresos');
            var miniGastos = document.getElementById('reporteMiniGastos');
            var miniBalance = document.getElementById('reporteMiniBalance');
            if (miniIngresos) miniIngresos.textContent = formatearDinero(totalIngresos);
            if (miniGastos) miniGastos.textContent = formatearDinero(totalGastos);
            if (miniBalance) miniBalance.textContent = formatearDinero(balanceNeto);
            var rows = [];
            if (transacciones.length === 0) {
                rows.push('<tr><td colspan="4" class="msg-empty">No hay transacciones en este período.</td></tr>');
            } else {
                transacciones.forEach(function (t) {
                    var fStr = t.fecha ? (t.fecha.getFullYear() + '-' + String(t.fecha.getMonth() + 1).padStart(2, '0') + '-' + String(t.fecha.getDate()).padStart(2, '0') + ' ' + t.fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })) : '—';
                    var badge = t.tipo === 'ingreso'
                        ? '<span class="reporte-badge reporte-badge-ingreso">Ingreso</span>'
                        : '<span class="reporte-badge reporte-badge-gasto">Gasto</span>';
                    var montoStr = t.monto >= 0 ? formatearDinero(t.monto) : '-' + formatearDinero(Math.abs(t.monto));
                    rows.push(
                        '<tr>' +
                        '<td class="reporte-cell-fecha" data-label="Fecha">' + escapeHtml(fStr) + '</td>' +
                        '<td data-label="Tipo">' + badge + '</td>' +
                        '<td data-label="Descripción">' + escapeHtml(t.descripcion) + '</td>' +
                        '<td class="reporte-cell-monto" data-label="Monto">' + montoStr + '</td>' +
                        '</tr>'
                    );
                });
            }
            if (reportesBody) reportesBody.innerHTML = rows.join('');
            if (reporteBalanceFoot && reporteBalanceNeto) {
                reporteBalanceFoot.style.display = transacciones.length > 0 ? 'table-footer-group' : 'none';
                reporteBalanceNeto.textContent = formatearDinero(balanceNeto);
                reporteBalanceNeto.classList.remove('reporte-balance-positivo', 'reporte-balance-negativo');
                if (balanceNeto > 0) reporteBalanceNeto.classList.add('reporte-balance-positivo');
                else if (balanceNeto < 0) reporteBalanceNeto.classList.add('reporte-balance-negativo');
            }
        }).catch(function (err) {
            console.error('Error filtrando reporte:', err);
            if (reportesBody) reportesBody.innerHTML = '<tr><td colspan="4" class="msg-empty">Error al cargar. Intente de nuevo.</td></tr>';
            if (reporteBalanceFoot) reporteBalanceFoot.style.display = 'none';
        });
    }

    if (btnFiltrarReporte) btnFiltrarReporte.addEventListener('click', filtrarReporte);

    function exportarPdf() {
        var desde = reporteDesde ? reporteDesde.value : '';
        var hasta = reporteHasta ? reporteHasta.value : '';
        if (!desde || !hasta) {
            showToastSafe('Seleccione las fechas Desde y Hasta para generar el reporte.', 'info');
            return;
        }
        var tsDesde = firebase.firestore.Timestamp.fromDate(new Date(desde + 'T00:00:00'));
        var tsHasta = firebase.firestore.Timestamp.fromDate(new Date(hasta + 'T23:59:59.999'));
        var pVentas = db.collection('ventas').where('timestamp', '>=', tsDesde).where('timestamp', '<=', tsHasta).get();
        var pGastos = db.collection('gastos').where('fecha', '>=', tsDesde).where('fecha', '<=', tsHasta).get();
        Promise.all([pVentas, pGastos]).then(function (results) {
            var ventasSnap = results[0];
            var gastosSnap = results[1];
            var totalIngresos = 0;
            var ventasList = [];
            ventasSnap.forEach(function (d) {
                var data = d.data();
                var tot = data.total != null ? Number(data.total) : 0;
                totalIngresos += tot;
                var fechaObj = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : null;
                ventasList.push({
                    fecha: fechaObj,
                    mesa: data.mesa || '—',
                    mesero: data.meseroNombre || '—',
                    total: tot
                });
            });
            var totalGastos = 0;
            var gastosList = [];
            gastosSnap.forEach(function (d) {
                var data = d.data();
                var monto = data.monto != null ? Number(data.monto) : 0;
                totalGastos += monto;
                var fechaObj = data.fecha && data.fecha.toDate ? data.fecha.toDate() : null;
                gastosList.push({
                    fecha: fechaObj,
                    descripcion: data.descripcion || '—',
                    categoria: data.categoria || '—',
                    monto: monto,
                    metodoPago: data.metodoPago || '—'
                });
            });
            var saldoFinal = totalIngresos - totalGastos;
            var saldoClase = saldoFinal >= 0 ? 'color:#228B22;' : 'color:#B22222;';
            var filasIngresos = '';
            ventasList.forEach(function (v) {
                var f = v.fecha ? v.fecha.toLocaleString('es') : '—';
                filasIngresos += '<tr><td>' + escapeHtml(f) + '</td><td>' + escapeHtml(String(v.mesa)) + '</td><td>' + escapeHtml(String(v.mesero)) + '</td><td>' + formatearDinero(v.total) + '</td></tr>';
            });
            if (ventasList.length === 0) {
                filasIngresos = '<tr><td colspan="4" style="text-align:center;">No hay ventas en este período.</td></tr>';
            }
            var filasGastos = '';
            gastosList.forEach(function (g) {
                var f = g.fecha ? g.fecha.toLocaleString('es') : '—';
                filasGastos += '<tr><td>' + escapeHtml(f) + '</td><td>' + escapeHtml(String(g.descripcion)) + '</td><td>' + escapeHtml(String(g.categoria)) + '</td><td>' + formatearDinero(g.monto) + '</td><td>' + escapeHtml(String(g.metodoPago)) + '</td></tr>';
            });
            if (gastosList.length === 0) {
                filasGastos = '<tr><td colspan="5" style="text-align:center;">No hay gastos en este período.</td></tr>';
            }
            var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Financiero — ' + escapeHtml(desde) + ' al ' + escapeHtml(hasta) + '</title>' +
                '<style type="text/css">' +
                'body{font-family:sans-serif;margin:1rem;color:#111;background:#fff;}' +
                'h1{font-size:1.25rem;margin-bottom:0.5rem;}' +
                '.resumen{display:flex;flex-wrap:wrap;gap:1rem;margin:1rem 0;}' +
                '.resumen-item{padding:0.75rem 1rem;border:1px solid #333;min-width:140px;}' +
                '.resumen-item strong{display:block;font-size:0.8rem;color:#555;}' +
                'table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:0.9rem;}' +
                'th,td{border:1px solid #333;padding:8px;text-align:left;}' +
                'th{background:#e8e8e8;font-weight:700;}' +
                '.no-print{margin-top:1rem;}' +
                '@media print{.no-print{display:none !important;}}' +
                '</style></head><body>' +
                '<h1>Reporte Financiero — ' + escapeHtml(desde) + ' al ' + escapeHtml(hasta) + '</h1>' +
                '<div class="resumen">' +
                '<div class="resumen-item"><strong>Total Ingresos</strong><span>' + formatearDinero(totalIngresos) + '</span></div>' +
                '<div class="resumen-item"><strong>Total Gastos</strong><span>' + formatearDinero(totalGastos) + '</span></div>' +
                '<div class="resumen-item" style="' + saldoClase + '"><strong>Saldo Final</strong><span>' + formatearDinero(saldoFinal) + '</span></div>' +
                '</div>' +
                '<h2 style="font-size:1.1rem;margin-top:1.5rem;">Ingresos (ventas)</h2>' +
                '<table><thead><tr><th>Fecha</th><th>Mesa</th><th>Mesero</th><th>Total</th></tr></thead><tbody>' + filasIngresos + '</tbody></table>' +
                '<h2 style="font-size:1.1rem;margin-top:1.5rem;">Gastos</h2>' +
                '<table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Método de pago</th></tr></thead><tbody>' + filasGastos + '</tbody></table>' +
                '<div class="no-print"><button type="button" onclick="window.print();" style="padding:10px 20px;cursor:pointer;font-size:1rem;">Imprimir</button></div>' +
                '</body></html>';
            var ventana = window.open('', '_blank');
            if (!ventana) {
                showToastSafe('Permita ventanas emergentes para abrir el reporte.', 'info');
                return;
            }
            ventana.document.write(html);
            ventana.document.close();
            ventana.focus();
        }).catch(function (err) {
            console.error('Error generando reporte PDF:', err);
            showToastSafe('No se pudo generar el reporte. Intente de nuevo.', 'error');
        });
    }
    if (btnExportarPdf) btnExportarPdf.addEventListener('click', exportarPdf);

    // --- Iniciar listeners dashboard ---
    escucharDashboard();
    cargarResumenPeriodos();
    cargarGraficaSemana();

    // Cards del dashboard clickeables → navegación
    var cardVentas = document.getElementById('ventasDia');
    if (cardVentas) {
        cardVentas.closest('.card').addEventListener('click', function () {
            mostrarSeccion('reportes');
        });
    }
    var cardGastos = document.getElementById('gastosDia');
    if (cardGastos) {
        cardGastos.closest('.card').addEventListener('click', function () {
            mostrarSeccion('gastos');
        });
    }
    var cardOrdenes = document.getElementById('ordenesActivas');
    if (cardOrdenes) {
        cardOrdenes.closest('.card').addEventListener('click', function () {
            mostrarSeccion('ordenes');
        });
    }

    // --- Reset total (zona de peligro): elimina todo excepto ventas, con reautenticación ---
    function eliminarSnapshotEnBatches(snap) {
        var docs = [];
        snap.forEach(function (d) { docs.push(d); });
        if (docs.length === 0) return Promise.resolve();
        var BATCH_SIZE = 500;
        function run(idx) {
            if (idx >= docs.length) return Promise.resolve();
            var batch = db.batch();
            var end = Math.min(idx + BATCH_SIZE, docs.length);
            for (var i = idx; i < end; i++) batch.delete(docs[i].ref);
            return batch.commit().then(function () { return run(end); });
        }
        return run(0);
    }

    function resetTotal() {
        var btn = document.getElementById('btnResetTotal');
        var inputPassword = document.getElementById('resetPassword');

        function restaurarBoton() {
            if (btn) {
                btn.textContent = 'RESET OPERATIVO — CONSERVA VENTAS';
                btn.disabled = false;
            }
            if (inputPassword) inputPassword.value = '';
        }

        // PASO 1
        var msg1 = '⚠️ ADVERTENCIA: Estás a punto de eliminar TODOS los datos del sistema.\nEsto incluye: todas las órdenes, cotizaciones, gastos, platillos del menú y cuentas de meseros.\nLos registros de ventas se conservarán.\n¿Deseas continuar?';
        if (!confirm(msg1)) return;

        // PASO 2
        var msg2 = 'ÚLTIMA ADVERTENCIA: Esta acción es IRREVERSIBLE. No hay forma de recuperar los datos eliminados.\n¿Estás completamente seguro de que deseas proceder con el reset total?';
        if (!confirm(msg2)) return;

        // PASO 3
        var passwordIngresada = inputPassword && inputPassword.value ? inputPassword.value.trim() : '';
        if (!passwordIngresada) {
            showToastSafe('Debes ingresar tu contraseña', 'error');
            return;
        }
        var user = auth.currentUser;
        if (!user || !user.email) {
            showToastSafe('No hay sesión de administrador activa.', 'error');
            restaurarBoton();
            return;
        }
        var credential = firebase.auth.EmailAuthProvider.credential(user.email, passwordIngresada);
        user.reauthenticateWithCredential(credential).then(function () {
            // PASO 4
            if (btn) {
                btn.textContent = 'Eliminando datos...';
                btn.disabled = true;
            }
            var pOrdenes = db.collection('ordenes').get();
            var pCotiz = db.collection('cotizaciones').get();
            var pGastos = db.collection('gastos').get();
            var pMenu = db.collection('menu').get();
            var pMeseros = db.collection('usuarios').where('rol', '==', 'mesero').get();

            Promise.all([pOrdenes, pCotiz, pGastos, pMenu, pMeseros])
                .then(function (results) {
                    return eliminarSnapshotEnBatches(results[0])
                        .then(function () { return eliminarSnapshotEnBatches(results[1]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[2]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[3]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[4]); });
                })
                .then(function () {
                    if (inputPassword) inputPassword.value = '';
                    if (btn) {
                        btn.textContent = 'RESET OPERATIVO — CONSERVA VENTAS';
                        btn.disabled = false;
                    }
                    showToastSafe('Reset completado. Todos los datos han sido eliminados. Los registros de ventas se conservaron.', 'success');
                })
                .catch(function (err) {
                    console.error('Error en reset total:', err);
                    showToastSafe(err && err.message ? err.message : 'Error al eliminar datos.', 'error');
                    restaurarBoton();
                });
        }).catch(function (err) {
            console.error('Error reautenticación:', err);
            showToastSafe('Contraseña incorrecta. Operación cancelada.', 'error');
            if (inputPassword) inputPassword.value = '';
        });
    }

    var btnResetTotal = document.getElementById('btnResetTotal');
    if (btnResetTotal) btnResetTotal.addEventListener('click', resetTotal);

    // --- Reset nuclear: borra TODO incluyendo ventas ---
    function resetNuclear() {
        var btn = document.getElementById('btnResetNuclear');
        var inputPassword = document.getElementById('resetNuclearPassword');

        function restaurarBotonNuclear() {
            if (btn) {
                btn.textContent = '☢️ BORRAR TODO — SIN EXCEPCIÓN';
                btn.disabled = false;
            }
            if (inputPassword) inputPassword.value = '';
        }

        // PASO 1
        var msg1 = '☢️ RESET NUCLEAR ACTIVADO\n\nEstás a punto de borrar ABSOLUTAMENTE TODO incluyendo el historial completo de ventas.\n\nEsto es irreversible. No quedará ningún dato.\n\n¿Deseas continuar?';
        if (!confirm(msg1)) return;

        // PASO 2
        var msg2 = 'SEGUNDA CONFIRMACIÓN REQUERIDA\n\nConfirmas que entiendes que:\n- Se borrarán TODAS las ventas\n- Se borrarán TODOS los gastos\n- Se borrará TODO el menú\n- Se borrarán TODOS los meseros\n- Se borrarán TODAS las órdenes\n- Se borrarán TODAS las cotizaciones\n\nNo quedará absolutamente nada.\n\n¿Confirmas?';
        if (!confirm(msg2)) return;

        // PASO 3
        var textoConfirmacion = prompt('CONFIRMACIÓN FINAL: Escribe exactamente BORRAR TODO para proceder');
        if (textoConfirmacion !== 'BORRAR TODO') {
            showToastSafe('Texto incorrecto. Operación cancelada.', 'error');
            return;
        }

        // VERIFICACIÓN DE CONTRASEÑA
        var passwordIngresada = inputPassword && inputPassword.value ? inputPassword.value.trim() : '';
        if (!passwordIngresada) {
            showToastSafe('Debes ingresar tu contraseña de administrador.', 'error');
            return;
        }
        var user = auth.currentUser;
        if (!user || !user.email) {
            showToastSafe('No hay sesión de administrador activa.', 'error');
            restaurarBotonNuclear();
            return;
        }
        var credential = firebase.auth.EmailAuthProvider.credential(user.email, passwordIngresada);
        user.reauthenticateWithCredential(credential).then(function () {
            // PASO 4 — ELIMINACIÓN TOTAL
            if (btn) {
                btn.textContent = 'Eliminando todo...';
                btn.disabled = true;
            }
            var pOrdenes = db.collection('ordenes').get();
            var pCotiz = db.collection('cotizaciones').get();
            var pGastos = db.collection('gastos').get();
            var pMenu = db.collection('menu').get();
            var pVentas = db.collection('ventas').get();
            var pMeseros = db.collection('usuarios').where('rol', '==', 'mesero').get();

            Promise.all([pOrdenes, pCotiz, pGastos, pMenu, pVentas, pMeseros])
                .then(function (results) {
                    return eliminarSnapshotEnBatches(results[0])
                        .then(function () { return eliminarSnapshotEnBatches(results[1]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[2]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[3]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[4]); })
                        .then(function () { return eliminarSnapshotEnBatches(results[5]); });
                })
                .then(function () {
                    if (inputPassword) inputPassword.value = '';
                    if (btn) {
                        btn.textContent = '☢️ BORRAR TODO — SIN EXCEPCIÓN';
                        btn.disabled = false;
                    }
                    showToastSafe('Reset nuclear completado. El sistema ha sido reiniciado completamente. Todos los datos han sido eliminados.', 'success');
                })
                .catch(function (err) {
                    console.error('Error en reset nuclear:', err);
                    showToastSafe(err && err.message ? err.message : 'Error al eliminar datos.', 'error');
                    restaurarBotonNuclear();
                    if (inputPassword) inputPassword.value = '';
                });
        }).catch(function (err) {
            console.error('Error reautenticación:', err);
            showToastSafe('Contraseña incorrecta', 'error');
            if (inputPassword) inputPassword.value = '';
        });
    }

    var btnResetNuclear = document.getElementById('btnResetNuclear');
    if (btnResetNuclear) btnResetNuclear.addEventListener('click', resetNuclear);

    // --- Configuración: mesas disponibles ---
    var mesasPendientes = null;

    function cargarConfigMesas() {
        var el = document.getElementById('mesasConfigActual');
        if (!el) return;
        db.collection('configuracion').doc('mesas').get().then(function (doc) {
            if (doc.exists && doc.data().numeros && Array.isArray(doc.data().numeros) && doc.data().numeros.length > 0) {
                var arr = doc.data().numeros;
                var min = Math.min.apply(null, arr);
                var max = Math.max.apply(null, arr);
                if (min === max) {
                    el.textContent = 'Configuración actual: ' + arr.length + ' mesa(s) (solo mesa ' + min + ')';
                } else {
                    el.textContent = 'Configuración actual: ' + arr.length + ' mesas (del ' + min + ' al ' + max + ')';
                }
            } else {
                el.textContent = 'Configuración actual: 50 mesas (1 al 50) — configuración por defecto';
            }
        }).catch(function (err) {
            console.error('Error cargando config mesas:', err);
            if (el) el.textContent = 'Configuración actual: 50 mesas (1 al 50) — configuración por defecto';
        });
    }

    function generarPreviewMesas(arrayNumeros) {
        var preview = document.getElementById('mesasPreview');
        var btnGuardar = document.getElementById('btnGuardarMesas');
        if (!preview) return;
        preview.innerHTML = '';
        arrayNumeros.forEach(function (num) {
            var span = document.createElement('span');
            span.className = 'mesa-badge-preview';
            span.textContent = 'Mesa ' + num;
            preview.appendChild(span);
        });
        mesasPendientes = arrayNumeros.slice().sort(function (a, b) { return a - b; });
        if (btnGuardar) btnGuardar.disabled = false;
    }

    var btnAplicarIntervalo = document.getElementById('btnAplicarIntervalo');
    if (btnAplicarIntervalo) {
        btnAplicarIntervalo.addEventListener('click', function () {
            var desdeEl = document.getElementById('mesasDesde');
            var hastaEl = document.getElementById('mesasHasta');
            var desde = desdeEl && parseInt(desdeEl.value, 10);
            var hasta = hastaEl && parseInt(hastaEl.value, 10);
            if (!desde || !hasta || isNaN(desde) || isNaN(hasta) || desde < 1 || hasta < 1) {
                showToastSafe('Ingresa números válidos para Desde y Hasta (mínimo 1).', 'error');
                return;
            }
            if (desde > hasta) {
                showToastSafe('Desde debe ser menor o igual que Hasta.', 'error');
                return;
            }
            if (hasta - desde + 1 > 200) {
                showToastSafe('El intervalo no puede superar 200 mesas.', 'error');
                return;
            }
            var arr = [];
            for (var i = desde; i <= hasta; i++) arr.push(i);
            generarPreviewMesas(arr);
        });
    }

    var btnAplicarManual = document.getElementById('btnAplicarManual');
    if (btnAplicarManual) {
        btnAplicarManual.addEventListener('click', function () {
            var manualEl = document.getElementById('mesasManual');
            var raw = (manualEl && manualEl.value) ? manualEl.value.trim() : '';
            if (!raw) {
                showToastSafe('Escribe los números de mesa separados por comas.', 'info');
                return;
            }
            var partes = raw.split(',').map(function (s) { return parseInt(s.trim(), 10); });
            var numeros = partes.filter(function (n) { return !isNaN(n) && n >= 1; });
            if (numeros.length === 0) {
                showToastSafe('No se encontraron números de mesa válidos', 'error');
                return;
            }
            numeros.sort(function (a, b) { return a - b; });
            var unicos = [];
            for (var u = 0; u < numeros.length; u++) {
                if (unicos.indexOf(numeros[u]) === -1) unicos.push(numeros[u]);
            }
            generarPreviewMesas(unicos);
        });
    }

    var btnGuardarMesas = document.getElementById('btnGuardarMesas');
    if (btnGuardarMesas) {
        btnGuardarMesas.addEventListener('click', function () {
            if (!mesasPendientes || mesasPendientes.length === 0) return;
            var btn = this;
            setButtonLoading(btn, true);
            db.collection('configuracion').doc('mesas').set({
                numeros: mesasPendientes,
                actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function () {
                showToastSafe('Configuración de mesas guardada correctamente', 'success');
                cargarConfigMesas();
                setButtonLoading(btn, false);
            }).catch(function (err) {
                console.error('Error guardando mesas:', err);
                showToastSafe(err && err.message ? err.message : 'Error al guardar.', 'error');
                setButtonLoading(btn, false);
            });
        });
    }

    // --- Sección Pedidos (admin crea órdenes) ---
    function iniciarSeccionPedidos() {
        var pedidoMesa = document.getElementById('pedidoMesa');
        var pedidoMesero = document.getElementById('pedidoMesero');
        var pedidoFilas = document.getElementById('pedidoFilas');
        if (!pedidoMesa || !pedidoMesero || !pedidoFilas) return;

        db.collection('configuracion').doc('mesas').onSnapshot(function (doc) {
            var valorAntes = pedidoMesa.value;
            while (pedidoMesa.options.length > 1) pedidoMesa.remove(1);
            var numeros = [];
            if (doc.exists && doc.data().numeros && Array.isArray(doc.data().numeros) && doc.data().numeros.length > 0) {
                numeros = doc.data().numeros;
            } else {
                for (var i = 1; i <= 50; i++) numeros.push(i);
            }
            numeros.forEach(function (num) {
                var opt = document.createElement('option');
                opt.value = String(num);
                opt.textContent = 'Mesa ' + num;
                pedidoMesa.appendChild(opt);
            });
            if (valorAntes && numeros.indexOf(parseInt(valorAntes, 10)) !== -1) pedidoMesa.value = valorAntes;
        });

        db.collection('usuarios').where('rol', '==', 'mesero').get().then(function (snap) {
            pedidoMesero.innerHTML = '<option value="">Seleccione mesero</option>';
            snap.forEach(function (d) {
                var data = d.data();
                var uid = d.id;
                var nombre = data.nombre || data.displayName || data.email || 'Mesero';
                var opt = document.createElement('option');
                opt.value = uid;
                opt.setAttribute('data-nombre', nombre);
                opt.textContent = nombre;
                pedidoMesero.appendChild(opt);
            });
        }).catch(function (err) {
            console.error('Error cargando meseros:', err);
        });

        pedidoFilas.innerHTML = '';
        agregarFilaPedido();
    }

    function agregarFilaPedido() {
        var pedidoFilas = document.getElementById('pedidoFilas');
        if (!pedidoFilas) return;
        var tr = document.createElement('tr');
        var selectPlatillo = document.createElement('select');
        selectPlatillo.className = 'input-tabla';
        var optVacía = document.createElement('option');
        optVacía.value = '';
        optVacía.textContent = 'Seleccione platillo';
        selectPlatillo.appendChild(optVacía);
        var porCat = {};
        menuItemsAdmin.forEach(function (item) {
            var cat = item.categoria || 'Otros';
            if (!porCat[cat]) porCat[cat] = [];
            porCat[cat].push(item);
        });
        CATEGORIAS_ORDEN.forEach(function (categoria) {
            var items = porCat[categoria];
            if (!items || items.length === 0) return;
            var optgroup = document.createElement('optgroup');
            optgroup.label = categoria;
            items.forEach(function (item) {
                var opt = document.createElement('option');
                opt.value = item.id;
                opt.setAttribute('data-precio', String(item.precio));
                opt.textContent = item.nombre + ' — ' + formatearDinero(item.precio);
                optgroup.appendChild(opt);
            });
            selectPlatillo.appendChild(optgroup);
        });
        var inpPrecio = document.createElement('input');
        inpPrecio.type = 'number';
        inpPrecio.className = 'input-tabla';
        inpPrecio.value = '0';
        inpPrecio.disabled = true;
        inpPrecio.step = '0.01';
        inpPrecio.min = '0';
        var inpCant = document.createElement('input');
        inpCant.type = 'number';
        inpCant.className = 'input-tabla';
        inpCant.value = '1';
        inpCant.min = '1';
        var spanSub = document.createElement('span');
        spanSub.className = 'pedido-subtotal';
        spanSub.textContent = '$0.00';
        var btnX = document.createElement('button');
        btnX.type = 'button';
        btnX.className = 'btn-sm btn-eliminar-fila';
        btnX.textContent = 'X';
        btnX.title = 'Eliminar fila';

        function actualizarSubtotal() {
            var precio = parseFloat(inpPrecio.value) || 0;
            var cant = parseInt(inpCant.value, 10) || 0;
            var sub = precio * cant;
            spanSub.textContent = formatearDinero(sub);
            recalcularTotalPedido();
        }
        selectPlatillo.addEventListener('change', function () {
            var opt = selectPlatillo.options[selectPlatillo.selectedIndex];
            if (!opt || opt.value === '') {
                inpPrecio.value = '0';
                inpPrecio.disabled = true;
            } else {
                var precio = opt.getAttribute('data-precio');
                inpPrecio.value = precio != null ? precio : '0';
                inpPrecio.disabled = true;
            }
            actualizarSubtotal();
        });
        inpPrecio.addEventListener('input', actualizarSubtotal);
        inpCant.addEventListener('input', actualizarSubtotal);

        btnX.addEventListener('click', function () {
            tr.remove();
            recalcularTotalPedido();
        });

        var tdPlatillo = document.createElement('td');
        tdPlatillo.appendChild(selectPlatillo);
        var tdPrecio = document.createElement('td');
        tdPrecio.appendChild(inpPrecio);
        var tdCant = document.createElement('td');
        tdCant.appendChild(inpCant);
        var tdSub = document.createElement('td');
        tdSub.appendChild(spanSub);
        var tdAcc = document.createElement('td');
        tdAcc.appendChild(btnX);
        tr.appendChild(tdPlatillo);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdCant);
        tr.appendChild(tdSub);
        tr.appendChild(tdAcc);
        pedidoFilas.appendChild(tr);
    }

    function recalcularTotalPedido() {
        var pedidoFilas = document.getElementById('pedidoFilas');
        var pedidoTotal = document.getElementById('pedidoTotal');
        if (!pedidoFilas || !pedidoTotal) return;
        var total = 0;
        pedidoFilas.querySelectorAll('tr').forEach(function (row) {
            var subEl = row.querySelector('.pedido-subtotal');
            if (subEl) {
                var t = parseFloat(subEl.textContent.replace('$', '').replace(',', '')) || 0;
                total += t;
            }
        });
        pedidoTotal.textContent = formatearDinero(total);
    }

    function guardarPedido() {
        var pedidoMesa = document.getElementById('pedidoMesa');
        var pedidoMesero = document.getElementById('pedidoMesero');
        var pedidoFilas = document.getElementById('pedidoFilas');
        var mesa = pedidoMesa && pedidoMesa.value ? pedidoMesa.value.trim() : '';
        if (!mesa) {
            showToastSafe('Seleccione una mesa.', 'info');
            return;
        }
        var meseroOpt = pedidoMesero && pedidoMesero.selectedIndex >= 0 ? pedidoMesero.options[pedidoMesero.selectedIndex] : null;
        var meseroId = meseroOpt ? meseroOpt.value : '';
        var meseroNombre = meseroOpt ? (meseroOpt.getAttribute('data-nombre') || meseroOpt.textContent) : '';
        if (!meseroId) {
            showToastSafe('Seleccione un mesero.', 'info');
            return;
        }
        var platillos = [];
        var total = 0;
        if (pedidoFilas) {
            pedidoFilas.querySelectorAll('tr').forEach(function (row) {
                var selectPlatillo = row.querySelector('select');
                var inputs = row.querySelectorAll('input');
                var precioEl = inputs[0];
                var cantEl = inputs[1];
                if (!selectPlatillo || selectPlatillo.value === '') return;
                var opt = selectPlatillo.options[selectPlatillo.selectedIndex];
                var nombre = opt ? (opt.textContent || '').trim() : '';
                var precio = precioEl ? (parseFloat(precioEl.value) || 0) : 0;
                var cantidad = cantEl ? (parseInt(cantEl.value, 10) || 1) : 1;
                if (nombre && precio > 0) {
                    platillos.push({ nombre: nombre, precio: precio, cantidad: cantidad });
                    total += precio * cantidad;
                }
            });
        }
        if (platillos.length === 0) {
            showToastSafe('Agregue al menos un platillo: seleccione uno en el desplegable.', 'info');
            return;
        }
        var btnPedido = document.getElementById('btnGuardarPedido');
        setButtonLoading(btnPedido, true);
        db.collection('ordenes').add({
            mesa: mesa,
            platillos: platillos,
            total: total,
            estado: 'pendiente',
            meseroId: meseroId,
            meseroNombre: meseroNombre,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            creadoPorAdmin: true
        }).then(function () {
            showToastSafe('Pedido guardado correctamente. Aparecerá en Órdenes en vivo.', 'success');
            if (pedidoMesa) pedidoMesa.value = '';
            if (pedidoMesero) pedidoMesero.value = '';
            if (pedidoFilas) {
                pedidoFilas.innerHTML = '';
                agregarFilaPedido();
            }
            recalcularTotalPedido();
            setButtonLoading(btnPedido, false);
        }).catch(function (err) {
            console.error('Error guardando pedido:', err);
            showToastSafe('No se pudo guardar el pedido.', 'error');
            setButtonLoading(btnPedido, false);
        });
    }

    var btnGuardarPedido = document.getElementById('btnGuardarPedido');
    if (btnGuardarPedido) btnGuardarPedido.addEventListener('click', guardarPedido);
    var btnAgregarFila = document.getElementById('btnAgregarFila');
    if (btnAgregarFila) btnAgregarFila.addEventListener('click', agregarFilaPedido);

    // --- Sección Cotizaciones ---
    var cotizacionEditandoId = null;

    function iniciarSeccionCotizaciones() {
        var cotizacionFilas = document.getElementById('cotizacionFilas');
        var cotizacionesBody = document.getElementById('cotizacionesBody');
        if (!cotizacionFilas || !cotizacionesBody) return;

        db.collection('cotizaciones').orderBy('timestamp', 'desc').onSnapshot(function (snap) {
            if (snap.empty) {
                cotizacionesBody.innerHTML = '<p class="msg-empty" style="padding:2rem;text-align:center;">No hay cotizaciones.</p>';
                return;
            }
            var cards = [];
            snap.forEach(function (d) {
                var data = d.data();
                var id = d.id;
                var titulo = escapeHtml(data.titulo || '—');
                var detallesStr = String(data.detalles || '—');
                if (detallesStr.length > 60) detallesStr = detallesStr.substring(0, 60) + '...';
                detallesStr = escapeHtml(detallesStr);
                var total = (data.total != null) ? formatearDinero(Number(data.total)) : formatearDinero(0);
                var fecha = '—';
                if (data.timestamp && data.timestamp.toDate) {
                    fecha = data.timestamp.toDate().toLocaleDateString('es');
                }
                cards.push(
                    '<div class="cotizacion-card" data-id="' + escapeHtml(id) + '">' +
                    '<div class="cotizacion-card-header">' +
                    '<span class="cotizacion-card-titulo">' + titulo + '</span>' +
                    '<span class="cotizacion-card-fecha">' + fecha + '</span>' +
                    '</div>' +
                    '<p class="cotizacion-card-detalles">' + detallesStr + '</p>' +
                    '<div class="cotizacion-card-footer">' +
                    '<span class="cotizacion-card-total">' + total + '</span>' +
                    '<div class="cotizacion-card-acciones">' +
                    '<button type="button" class="btn-sm btn-editar-cotizacion" data-id="' + escapeHtml(id) + '" title="Editar">✏️</button>' +
                    '<button type="button" class="btn-sm btn-imprimir-cotizacion" data-id="' + escapeHtml(id) + '" title="Imprimir">🖨️</button>' +
                    '<button type="button" class="btn-sm btn-whatsapp btn-whatsapp-cotizacion" data-id="' + escapeHtml(id) + '" title="WhatsApp">💬</button>' +
                    '<button type="button" class="btn-sm btn-danger btn-eliminar-cotizacion" data-id="' + escapeHtml(id) + '" title="Eliminar">🗑️</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                );
            });
            cotizacionesBody.innerHTML = cards.join('');

            cotizacionesBody.querySelectorAll('.btn-eliminar-cotizacion').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-id');
                    if (!confirm('¿Eliminar esta cotización?')) return;
                    db.collection('cotizaciones').doc(id).delete().catch(function (err) {
                        console.error('Error al eliminar cotización:', err);
                        showToastSafe('No se pudo eliminar.', 'error');
                    });
                });
            });
            cotizacionesBody.querySelectorAll('.btn-editar-cotizacion').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-id');
                    db.collection('cotizaciones').doc(id).get().then(function (doc) {
                        if (doc.exists) abrirEditarCotizacion(id, doc.data());
                    }).catch(function (err) { console.error(err); });
                });
            });
            cotizacionesBody.querySelectorAll('.btn-imprimir-cotizacion').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    imprimirCotizacion(btn.getAttribute('data-id'));
                });
            });
            cotizacionesBody.querySelectorAll('.btn-whatsapp-cotizacion').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (typeof window.enviarWhatsAppCotizacion === 'function') {
                        window.enviarWhatsAppCotizacion(btn.getAttribute('data-id'));
                    }
                });
            });

        });

        cotizacionFilas.innerHTML = '';
        agregarFilaCotizacion();
    }

    function agregarFilaCotizacion() {
        var cotizacionFilas = document.getElementById('cotizacionFilas');
        if (!cotizacionFilas) return;
        var tr = document.createElement('tr');
        var inpDesc = document.createElement('input');
        inpDesc.type = 'text';
        inpDesc.className = 'pedido-input';
        inpDesc.placeholder = 'Descripción';
        var inpPrecio = document.createElement('input');
        inpPrecio.type = 'number';
        inpPrecio.className = 'pedido-input';
        inpPrecio.placeholder = '0';
        inpPrecio.step = '0.01';
        inpPrecio.min = '0';
        var inpCant = document.createElement('input');
        inpCant.type = 'number';
        inpCant.className = 'pedido-input';
        inpCant.placeholder = '1';
        inpCant.min = '1';
        inpCant.value = '1';
        var spanSub = document.createElement('span');
        spanSub.className = 'pedido-subtotal';
        spanSub.textContent = '$0.00';
        var btnX = document.createElement('button');
        btnX.type = 'button';
        btnX.className = 'btn-sm btn-eliminar-fila';
        btnX.textContent = 'X';
        btnX.title = 'Eliminar fila';

        function actualizarSubtotal() {
            var precio = parseFloat(inpPrecio.value) || 0;
            var cant = parseInt(inpCant.value, 10) || 0;
            var sub = precio * cant;
            spanSub.textContent = formatearDinero(sub);
            recalcularTotalCotizacion();
        }
        inpPrecio.addEventListener('input', actualizarSubtotal);
        inpCant.addEventListener('input', actualizarSubtotal);

        btnX.addEventListener('click', function () {
            tr.remove();
            recalcularTotalCotizacion();
        });

        var tdDesc = document.createElement('td');
        tdDesc.appendChild(inpDesc);
        var tdPrecio = document.createElement('td');
        tdPrecio.appendChild(inpPrecio);
        var tdCant = document.createElement('td');
        tdCant.appendChild(inpCant);
        var tdSub = document.createElement('td');
        tdSub.appendChild(spanSub);
        var tdAcc = document.createElement('td');
        tdAcc.appendChild(btnX);
        tr.appendChild(tdDesc);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdCant);
        tr.appendChild(tdSub);
        tr.appendChild(tdAcc);
        cotizacionFilas.appendChild(tr);
    }

    function recalcularTotalCotizacion() {
        var cotizacionFilas = document.getElementById('cotizacionFilas');
        var cotizacionTotal = document.getElementById('cotizacionTotal');
        if (!cotizacionFilas || !cotizacionTotal) return;
        var total = 0;
        cotizacionFilas.querySelectorAll('tr').forEach(function (row) {
            var subEl = row.querySelector('.pedido-subtotal');
            if (subEl) {
                var t = parseFloat(subEl.textContent.replace('$', '').replace(',', '')) || 0;
                total += t;
            }
        });
        cotizacionTotal.textContent = formatearDinero(total);
    }

    function guardarCotizacion() {
        var cotizacionTitulo = document.getElementById('cotizacionTitulo');
        var cotizacionDetalles = document.getElementById('cotizacionDetalles');
        var cotizacionFilas = document.getElementById('cotizacionFilas');
        var titulo = (cotizacionTitulo && cotizacionTitulo.value) ? cotizacionTitulo.value.trim() : '';
        if (!titulo) {
            showToastSafe('Ingrese un título para la cotización.', 'info');
            return;
        }
        var detalles = (cotizacionDetalles && cotizacionDetalles.value) ? String(cotizacionDetalles.value).trim() : '';
        var platillos = [];
        var total = 0;
        if (cotizacionFilas) {
            cotizacionFilas.querySelectorAll('tr').forEach(function (row) {
                var inputs = row.querySelectorAll('input');
                var descEl = inputs[0];
                var precioEl = inputs[1];
                var cantEl = inputs[2];
                if (!descEl || !precioEl) return;
                var nombre = (descEl.value || '').trim();
                var precio = parseFloat(precioEl.value) || 0;
                var cantidad = cantEl ? (parseInt(cantEl.value, 10) || 1) : 1;
                if (nombre && precio > 0) {
                    platillos.push({ nombre: nombre, precio: precio, cantidad: cantidad });
                    total += precio * cantidad;
                }
            });
        }
        if (platillos.length === 0) {
            showToastSafe('Agregue al menos un platillo con descripción y precio mayor a 0.', 'info');
            return;
        }

        var payload = { titulo: titulo, detalles: detalles, platillos: platillos, total: total, timestamp: firebase.firestore.FieldValue.serverTimestamp() };

        var btnCotiz = document.getElementById('btnGuardarCotizacion');
        setButtonLoading(btnCotiz, true);
        if (cotizacionEditandoId) {
            db.collection('cotizaciones').doc(cotizacionEditandoId).update(payload).then(function () {
                cerrarFormularioCotizacion();
                setButtonLoading(btnCotiz, false);
            }).catch(function (err) {
                console.error('Error al actualizar cotización:', err);
                showToastSafe('No se pudo guardar.', 'error');
                setButtonLoading(btnCotiz, false);
            });
        } else {
            db.collection('cotizaciones').add(payload).then(function () {
                cerrarFormularioCotizacion();
                setButtonLoading(btnCotiz, false);
            }).catch(function (err) {
                console.error('Error al guardar cotización:', err);
                showToastSafe('No se pudo guardar.', 'error');
                setButtonLoading(btnCotiz, false);
            });
        }
    }

    function cerrarFormularioCotizacion() {
        var formCotizacion = document.getElementById('formCotizacion');
        var cotizacionTitulo = document.getElementById('cotizacionTitulo');
        var cotizacionDetalles = document.getElementById('cotizacionDetalles');
        var cotizacionFilas = document.getElementById('cotizacionFilas');
        if (formCotizacion) formCotizacion.style.display = 'none';
        cotizacionEditandoId = null;
        if (cotizacionTitulo) cotizacionTitulo.value = '';
        if (cotizacionDetalles) cotizacionDetalles.value = '';
        if (cotizacionFilas) {
            cotizacionFilas.innerHTML = '';
            agregarFilaCotizacion();
        }
        recalcularTotalCotizacion();
    }

    function abrirEditarCotizacion(id, data) {
        cotizacionEditandoId = id;
        var formCotizacion = document.getElementById('formCotizacion');
        var cotizacionTitulo = document.getElementById('cotizacionTitulo');
        var cotizacionDetalles = document.getElementById('cotizacionDetalles');
        var cotizacionFilas = document.getElementById('cotizacionFilas');
        if (formCotizacion) formCotizacion.style.display = 'block';
        if (cotizacionTitulo) cotizacionTitulo.value = data.titulo || '';
        if (cotizacionDetalles) cotizacionDetalles.value = String(data.detalles || '');
        if (!cotizacionFilas) return;
        cotizacionFilas.innerHTML = '';
        var platillos = Array.isArray(data.platillos) ? data.platillos : [];
        platillos.forEach(function (p) {
            agregarFilaCotizacion();
            var lastRow = cotizacionFilas.querySelector('tr:last-child');
            if (lastRow) {
                var inputs = lastRow.querySelectorAll('input');
                if (inputs[0]) inputs[0].value = p.nombre || '';
                if (inputs[1]) inputs[1].value = String(p.precio != null ? p.precio : '');
                if (inputs[2]) inputs[2].value = String(p.cantidad != null ? p.cantidad : 1);
                var subEl = lastRow.querySelector('.pedido-subtotal');
                if (subEl) {
                    var precio = Number(p.precio) || 0;
                    var cant = parseInt(p.cantidad, 10) || 1;
                    subEl.textContent = formatearDinero(precio * cant);
                }
            }
        });
        if (platillos.length === 0) agregarFilaCotizacion();
        recalcularTotalCotizacion();
    }

    function imprimirCotizacion(id) {
    if (!id) return;
    if (typeof window.prepararCotizacion === 'function') {
        window.prepararCotizacion(id);
    } else {
        showToastSafe('El módulo de impresión no está disponible. Recarga la página.', 'error');
    }
}

    var btnNuevaCotizacion = document.getElementById('btnNuevaCotizacion');
    if (btnNuevaCotizacion) {
        btnNuevaCotizacion.addEventListener('click', function () {
            cotizacionEditandoId = null;
            var formCotizacion = document.getElementById('formCotizacion');
            var cotizacionTitulo = document.getElementById('cotizacionTitulo');
            var cotizacionDetalles = document.getElementById('cotizacionDetalles');
            var cotizacionFilas = document.getElementById('cotizacionFilas');
            if (formCotizacion) formCotizacion.style.display = 'block';
            if (cotizacionTitulo) cotizacionTitulo.value = '';
            if (cotizacionDetalles) cotizacionDetalles.value = '';
            if (cotizacionFilas) {
                cotizacionFilas.innerHTML = '';
                agregarFilaCotizacion();
            }
            recalcularTotalCotizacion();
        });
    }
    var btnCancelarCotizacion = document.getElementById('btnCancelarCotizacion');
    if (btnCancelarCotizacion) btnCancelarCotizacion.addEventListener('click', cerrarFormularioCotizacion);
    var btnGuardarCotizacion = document.getElementById('btnGuardarCotizacion');
    if (btnGuardarCotizacion) btnGuardarCotizacion.addEventListener('click', guardarCotizacion);
    var btnAgregarFilaCot = document.getElementById('btnAgregarFilaCot');
    if (btnAgregarFilaCot) btnAgregarFilaCot.addEventListener('click', agregarFilaCotizacion);

    // --- Historial de gastos ---
    var gastosHistorialBody = document.getElementById('gastosHistorialBody');
    var modalEditarGasto = document.getElementById('modalEditarGasto');
    var editGastoDescripcion = document.getElementById('editGastoDescripcion');
    var editGastoCategoria = document.getElementById('editGastoCategoria');
    var editGastoMonto = document.getElementById('editGastoMonto');
    var editGastoMetodo = document.getElementById('editGastoMetodo');
    var btnGuardarEditGasto = document.getElementById('btnGuardarEditGasto');
    var btnCancelarEditGasto = document.getElementById('btnCancelarEditGasto');
    var btnCerrarModalEditarGasto = document.getElementById('btnCerrarModalEditarGasto');
    var gastoEditandoId = null;

    function abrirModalEditarGasto() {
        if (!modalEditarGasto) return;
        var titleEl = document.getElementById('modalEditarGastoTitle');
        if (titleEl) titleEl.textContent = 'Editar gasto';
        modalEditarGasto.classList.add('open');
        modalEditarGasto.style.display = 'flex';
    }

    function cerrarModalEditarGasto() {
        if (!modalEditarGasto) return;
        modalEditarGasto.classList.remove('open');
        setTimeout(function () {
            if (!modalEditarGasto.classList.contains('open')) {
                modalEditarGasto.style.display = 'none';
            }
        }, 300);
    }

    db.collection('gastos').orderBy('fecha', 'desc').onSnapshot(function (snap) {
        if (!gastosHistorialBody) return;
        if (snap.empty) {
            gastosHistorialBody.innerHTML = '<tr><td colspan="6" class="msg-empty">Sin gastos registrados.</td></tr>';
            return;
        }
        var rows = [];
        snap.forEach(function (d) {
            var g = d.data();
            var fecha = g.fecha && g.fecha.toDate ? g.fecha.toDate().toLocaleDateString('es') : '—';
            var desc = escapeHtml(g.descripcion || '—');
            var cat = escapeHtml(g.categoria || '—');
            var monto = g.monto != null ? formatearDinero(Number(g.monto)) : '—';
            var metodo = escapeHtml(g.metodoPago || '—');
            rows.push(
                '<tr>' +
                '<td data-label="Fecha">' + fecha + '</td>' +
                '<td data-label="Descripción">' + desc + '</td>' +
                '<td data-label="Categoría">' + cat + '</td>' +
                '<td data-label="Monto">' + monto + '</td>' +
                '<td data-label="Método">' + metodo + '</td>' +
                '<td data-label="Acciones">' +
                '<button type="button" class="btn-sm btn-secondary editar-gasto" data-id="' + d.id + '" data-desc="' + escapeHtml(g.descripcion || '') + '" data-cat="' + escapeHtml(g.categoria || 'otros') + '" data-monto="' + (g.monto || 0) + '" data-metodo="' + escapeHtml(g.metodoPago || 'efectivo') + '">Editar</button>' +
                '</td>' +
                '</tr>'
            );
        });
        gastosHistorialBody.innerHTML = rows.join('');
        gastosHistorialBody.querySelectorAll('.editar-gasto').forEach(function (btn) {
            btn.addEventListener('click', function () {
                gastoEditandoId = btn.getAttribute('data-id');
                editGastoDescripcion.value = btn.getAttribute('data-desc');
                editGastoCategoria.value = btn.getAttribute('data-cat');
                editGastoMonto.value = btn.getAttribute('data-monto');
                editGastoMetodo.value = btn.getAttribute('data-metodo');
                abrirModalEditarGasto();
            });
        });
    });

    if (btnGuardarEditGasto) {
        btnGuardarEditGasto.addEventListener('click', function () {
            if (!gastoEditandoId) return;
            var monto = parseFloat(editGastoMonto.value);
            if (isNaN(monto) || monto <= 0) return;
            var btn = this;
            setButtonLoading(btn, true);
            db.collection('gastos').doc(gastoEditandoId).update({
                descripcion: editGastoDescripcion.value.trim(),
                categoria: editGastoCategoria.value,
                monto: monto,
                metodoPago: editGastoMetodo.value
            }).then(function () {
                cerrarModalEditarGasto();
                gastoEditandoId = null;
                setButtonLoading(btn, false);
            }).catch(function (err) {
                console.error('Error al editar gasto:', err);
                setButtonLoading(btn, false);
            });
        });
    }

    if (btnCancelarEditGasto) {
        btnCancelarEditGasto.addEventListener('click', function () {
            cerrarModalEditarGasto();
            gastoEditandoId = null;
        });
    }
    if (btnCerrarModalEditarGasto) {
        btnCerrarModalEditarGasto.addEventListener('click', function () {
            cerrarModalEditarGasto();
            gastoEditandoId = null;
        });
    }

    // --- Corte de Caja ---
    var corteDesdeEl = document.getElementById('corteDesde');
    var corteHastaEl = document.getElementById('corteHasta');
    var btnGenerarCorte = document.getElementById('btnGenerarCorte');
    var corteResumenEl = document.getElementById('corteResumen');
    var corteVentasBodyEl = document.getElementById('corteVentasBody');
    var corteGastosBodyEl = document.getElementById('corteGastosBody');
    var corteDesgloseMeserosEl = document.getElementById('corteDesgloseMeseros');
    var btnImprimirCorte = document.getElementById('btnImprimirCorte');

    function toDatetimeLocalValue(date) {
        var yyyy = date.getFullYear();
        var mm = String(date.getMonth() + 1).padStart(2, '0');
        var dd = String(date.getDate()).padStart(2, '0');
        var hh = String(date.getHours()).padStart(2, '0');
        var min = String(date.getMinutes()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + min;
    }

    function inicializarFechasCorte() {
        var ahora = new Date();
        var hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
        if (corteDesdeEl) corteDesdeEl.value = toDatetimeLocalValue(hoyInicio);
        if (corteHastaEl) corteHastaEl.value = toDatetimeLocalValue(ahora);
    }

    function renderCorte(ventasSnap, gastosSnap) {
        function fmtCorte(valor) {
            var num = Number(valor) || 0;
            return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
        }

        var ventas = [];
        ventasSnap.forEach(function (doc) { ventas.push(doc.data()); });
        var gastos = [];
        gastosSnap.forEach(function (doc) { gastos.push(doc.data()); });

        if (ventas.length === 0 && gastos.length === 0) {
            if (corteResumenEl) corteResumenEl.innerHTML = '<p class="msg-empty">No hay registros en este período.</p>';
            if (corteVentasBodyEl) corteVentasBodyEl.innerHTML = '<tr><td colspan="5" class="msg-empty">Sin ventas en este período.</td></tr>';
            if (corteGastosBodyEl) corteGastosBodyEl.innerHTML = '<tr><td colspan="5" class="msg-empty">Sin gastos en este período.</td></tr>';
            if (corteDesgloseMeserosEl) corteDesgloseMeserosEl.innerHTML = '';
            return;
        }

        // Ordenar por fecha ascendente
        ventas.sort(function (a, b) {
            var ta = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            var tb = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return ta - tb;
        });
        gastos.sort(function (a, b) {
            var ta = a.fecha && a.fecha.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
            var tb = b.fecha && b.fecha.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
            return ta - tb;
        });

        // Totales
        var totalVentas = 0;
        var metodos = { efectivo: 0, tarjeta: 0, transferencia: 0, sinEspecificar: 0 };
        ventas.forEach(function (v) {
            var t = v.totalFinal !== undefined ? Number(v.totalFinal) : (Number(v.total) || 0);
            totalVentas += t;
            var m = v.metodoPago ? String(v.metodoPago).toLowerCase().trim() : '';
            if (m === 'efectivo') metodos.efectivo += t;
            else if (m === 'tarjeta') metodos.tarjeta += t;
            else if (m === 'transferencia') metodos.transferencia += t;
            else metodos.sinEspecificar += t;
        });
        var totalGastos = 0;
        gastos.forEach(function (g) { totalGastos += Number(g.monto) || 0; });
        var gananciaNeta = totalVentas - totalGastos;
        var totalPropinas = ventas.reduce(function (acc, v) { return acc + (v.propina || 0); }, 0);

        // Tarjetas de resumen
        var metodosHtml = '';
        if (metodos.efectivo > 0) {
            metodosHtml += '<div class="card" style="padding:1rem;"><div class="card-title">Efectivo</div><div class="card-value" style="font-size:1.4rem;">' + fmtCorte(metodos.efectivo) + '</div></div>';
        }
        if (metodos.tarjeta > 0) {
            metodosHtml += '<div class="card" style="padding:1rem;"><div class="card-title">Tarjeta</div><div class="card-value" style="font-size:1.4rem;">' + fmtCorte(metodos.tarjeta) + '</div></div>';
        }
        if (metodos.transferencia > 0) {
            metodosHtml += '<div class="card" style="padding:1rem;"><div class="card-title">Transferencia</div><div class="card-value" style="font-size:1.4rem;">' + fmtCorte(metodos.transferencia) + '</div></div>';
        }
        if (metodos.sinEspecificar > 0) {
            metodosHtml += '<div class="card" style="padding:1rem;"><div class="card-title">Sin especificar</div><div class="card-value" style="font-size:1.4rem;">' + fmtCorte(metodos.sinEspecificar) + '</div></div>';
        }
        var propinasHtml = totalPropinas > 0
            ? '<div class="card" style="padding:1rem;"><div class="card-title">Propinas</div><div class="card-value" style="font-size:1.4rem;">' + fmtCorte(totalPropinas) + '</div></div>'
            : '';
        var gananciaColor = gananciaNeta >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
        if (corteResumenEl) {
            corteResumenEl.innerHTML =
                '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">' +
                '<div class="card" style="padding:1rem;"><div class="card-title">Total Ventas</div><div class="card-value" style="font-size:1.4rem;">' + fmtCorte(totalVentas) + '</div></div>' +
                metodosHtml +
                propinasHtml +
                '<div class="card" style="padding:1rem;"><div class="card-title">Total Gastos</div><div class="card-value" style="font-size:1.4rem;color:var(--color-danger);">' + fmtCorte(totalGastos) + '</div></div>' +
                '<div class="card" style="padding:1rem;"><div class="card-title">Ganancia Neta</div><div class="card-value" style="font-size:1.4rem;color:' + gananciaColor + ';">' + fmtCorte(gananciaNeta) + '</div></div>' +
                '<div class="card" style="padding:1rem;"><div class="card-title">Total Órdenes</div><div class="card-value" style="font-size:1.4rem;">' + ventas.length + '</div></div>' +
                '</div>';
        }

        // Tabla de ventas
        if (corteVentasBodyEl) {
            if (ventas.length === 0) {
                corteVentasBodyEl.innerHTML = '<tr><td colspan="5" class="msg-empty">Sin ventas en este período.</td></tr>';
            } else {
                var filasV = '';
                ventas.forEach(function (v) {
                    var fecha = v.timestamp && v.timestamp.toDate ? v.timestamp.toDate() : new Date(v.timestamp || 0);
                    var hora = String(fecha.getHours()).padStart(2, '0') + ':' + String(fecha.getMinutes()).padStart(2, '0');
                    var metodo = v.metodoPago ? escapeHtml(String(v.metodoPago)) : 'Sin especificar';
                    filasV += '<tr>' +
                        '<td data-label="Hora">' + hora + '</td>' +
                        '<td data-label="Mesa">' + escapeHtml(String(v.mesa || '—')) + '</td>' +
                        '<td data-label="Mesero">' + escapeHtml(String(v.meseroNombre || '—')) + '</td>' +
                        '<td data-label="Total">' + fmtCorte(v.totalFinal !== undefined ? v.totalFinal : v.total) + '</td>' +
                        '<td data-label="Método de Pago">' + metodo + '</td>' +
                        '</tr>';
                });
                corteVentasBodyEl.innerHTML = filasV;
            }
        }

        // Tabla de gastos
        if (corteGastosBodyEl) {
            if (gastos.length === 0) {
                corteGastosBodyEl.innerHTML = '<tr><td colspan="5" class="msg-empty">Sin gastos en este período.</td></tr>';
            } else {
                var filasG = '';
                gastos.forEach(function (g) {
                    var fecha = g.fecha && g.fecha.toDate ? g.fecha.toDate() : new Date(g.fecha || 0);
                    var hora = String(fecha.getHours()).padStart(2, '0') + ':' + String(fecha.getMinutes()).padStart(2, '0');
                    var metodo = g.metodoPago ? escapeHtml(String(g.metodoPago)) : 'Sin especificar';
                    filasG += '<tr>' +
                        '<td data-label="Hora">' + hora + '</td>' +
                        '<td data-label="Descripción">' + escapeHtml(String(g.descripcion || '—')) + '</td>' +
                        '<td data-label="Categoría">' + escapeHtml(String(g.categoria || '—')) + '</td>' +
                        '<td data-label="Monto">' + fmtCorte(g.monto) + '</td>' +
                        '<td data-label="Método">' + metodo + '</td>' +
                        '</tr>';
                });
                corteGastosBodyEl.innerHTML = filasG;
            }
        }

        // Desglose por mesero
        if (corteDesgloseMeserosEl) {
            var meseroMap = {};
            ventas.forEach(function (v) {
                var nombre = v.meseroNombre ? String(v.meseroNombre).trim() : 'Sin asignar';
                if (!meseroMap[nombre]) meseroMap[nombre] = { total: 0, ordenes: 0, propinas: 0, metodos: {} };
                meseroMap[nombre].total += v.totalFinal !== undefined ? Number(v.totalFinal) : (Number(v.total) || 0);
                meseroMap[nombre].ordenes += 1;
                meseroMap[nombre].propinas += (v.propina || 0);
                var m = v.metodoPago ? String(v.metodoPago).toLowerCase().trim() : 'sin especificar';
                meseroMap[nombre].metodos[m] = (meseroMap[nombre].metodos[m] || 0) + 1;
            });
            var meseroList = Object.keys(meseroMap).map(function (nombre) {
                var data = meseroMap[nombre];
                var metodoPrincipal = Object.keys(data.metodos).reduce(function (a, b) {
                    return data.metodos[a] >= data.metodos[b] ? a : b;
                }, 'sin especificar');
                return { nombre: nombre, total: data.total, ordenes: data.ordenes, propinas: data.propinas, metodoPrincipal: metodoPrincipal };
            });
            meseroList.sort(function (a, b) { return b.total - a.total; });

            var filasMeseros = '';
            meseroList.forEach(function (m) {
                filasMeseros += '<tr>' +
                    '<td data-label="Mesero">' + escapeHtml(m.nombre) + '</td>' +
                    '<td data-label="Órdenes">' + m.ordenes + '</td>' +
                    '<td data-label="Total Vendido">' + fmtCorte(m.total) + '</td>' +
                    '<td data-label="Propinas">' + fmtCorte(m.propinas) + '</td>' +
                    '<td data-label="Método Frecuente">' + escapeHtml(m.metodoPrincipal) + '</td>' +
                    '</tr>';
            });
            corteDesgloseMeserosEl.innerHTML =
                '<div class="table-wrap">' +
                '<table>' +
                '<thead><tr><th>Mesero</th><th>Órdenes</th><th>Total Vendido</th><th>Propinas</th><th>Método Frecuente</th></tr></thead>' +
                '<tbody>' + filasMeseros + '</tbody>' +
                '</table>' +
                '</div>';
        }
    }

    function generarCorte() {
        if (!corteDesdeEl || !corteHastaEl) return;
        var fechaDesde = new Date(corteDesdeEl.value);
        var fechaHasta = new Date(corteHastaEl.value);

        if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) {
            showToastSafe('Selecciona un rango de fechas válido.', 'error');
            return;
        }
        if (fechaDesde >= fechaHasta) {
            showToastSafe('La fecha de inicio debe ser anterior a la fecha de fin.', 'error');
            return;
        }

        if (corteResumenEl) corteResumenEl.innerHTML = '<p class="msg-empty">Generando corte...</p>';
        if (corteVentasBodyEl) corteVentasBodyEl.innerHTML = '<tr><td colspan="5" class="msg-empty">Cargando...</td></tr>';
        if (corteGastosBodyEl) corteGastosBodyEl.innerHTML = '<tr><td colspan="5" class="msg-empty">Cargando...</td></tr>';
        if (corteDesgloseMeserosEl) corteDesgloseMeserosEl.innerHTML = '';

        var tsDesde = firebase.firestore.Timestamp.fromDate(fechaDesde);
        var tsHasta = firebase.firestore.Timestamp.fromDate(fechaHasta);

        var pVentas = db.collection('ventas')
            .where('timestamp', '>=', tsDesde)
            .where('timestamp', '<=', tsHasta)
            .get();
        var pGastos = db.collection('gastos')
            .where('fecha', '>=', tsDesde)
            .where('fecha', '<=', tsHasta)
            .get();

        Promise.all([pVentas, pGastos]).then(function (results) {
            renderCorte(results[0], results[1]);
        }).catch(function (err) {
            console.error('Error al generar corte:', err);
            showToastSafe('Error al generar el corte', 'error');
            if (corteResumenEl) corteResumenEl.innerHTML = '';
        });
    }

    if (btnGenerarCorte) {
        btnGenerarCorte.addEventListener('click', generarCorte);
    }
    if (btnImprimirCorte) {
        btnImprimirCorte.addEventListener('click', function () {
            document.body.classList.add('printing-corte');
            window.print();
            document.body.classList.remove('printing-corte');
        });
    }

    // Pre-rellenar fechas al entrar a la sección
    var corteNavLink = document.querySelector('.nav-list a[data-section="corte"]');
    if (corteNavLink) {
        corteNavLink.addEventListener('click', inicializarFechasCorte);
    }

    // --- Grupos colapsables del nav ---
    var navGroupTitles = document.querySelectorAll('.nav-group-title');
    navGroupTitles.forEach(function (btn) {
        btn.classList.add('collapsed');
        var items = btn.nextElementSibling;
        if (items && items.classList.contains('nav-group-items')) items.classList.add('collapsed');
    });
    navGroupTitles.forEach(function (btn) {
        btn.addEventListener('click', function () {
            btn.classList.toggle('collapsed');
            var items = btn.nextElementSibling;
            if (items && items.classList.contains('nav-group-items')) items.classList.toggle('collapsed');
        });
    });
})();

// --- Sidebar Retráctil (Toggle y Persistencia) ---
(function initSidebarToggle() {
    var sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    var appLayout = document.querySelector('.app-layout');

    if (!sidebarToggleBtn || !appLayout) return;

    // Función para actualizar el ícono del botón
    function updateToggleIcon(isCollapsed) {
        var svg = sidebarToggleBtn.querySelector('svg');
        if (!svg) return;

        if (isCollapsed) {
            // Ícono para "expandir" (línea a la derecha)
            svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line>';
            sidebarToggleBtn.setAttribute('title', 'Expandir menú (Ctrl+B)');
        } else {
            // Ícono para "contraer" (línea a la izquierda)
            svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line>';
            sidebarToggleBtn.setAttribute('title', 'Contraer menú (Ctrl+B)');
        }
    }

    // Cargar estado guardado
    var savedState = null;
    try {
        savedState = localStorage.getItem('restiq_sidebar_collapsed');
    } catch (e) {
        savedState = null;
    }

    if (savedState === 'true') {
        appLayout.classList.add('sidebar-collapsed');
        updateToggleIcon(true);
    } else {
        updateToggleIcon(false);
    }

    // Evento click
    sidebarToggleBtn.addEventListener('click', function () {
        var isCollapsed = appLayout.classList.toggle('sidebar-collapsed');
        try {
            localStorage.setItem('restiq_sidebar_collapsed', isCollapsed);
        } catch (e) {
            // ignorar errores de almacenamiento
        }
        updateToggleIcon(isCollapsed);
    });

    // Atajo de teclado: Ctrl+B para toggle
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
            // Evitar conflicto con atajos del navegador cuando el foco está en inputs
            var target = e.target || e.srcElement;
            var tag = target && target.tagName ? target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) return;

            e.preventDefault();
            sidebarToggleBtn.click();
        }
    });
})();

// --- Detectar Sticky State para efectos visuales (Header) ---
(function initStickyHeader() {
    var header = document.querySelector('.header, header.app-header');
    if (!header || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(
        function (entries) {
            var entry = entries[0];
            // Cuando el header deja de estar completamente visible en su contenedor,
            // asumimos que está en estado "pegado"
            header.classList.toggle('sticky', entry.intersectionRatio < 1);
        },
        { threshold: [1] }
    );

    observer.observe(header);
})();
