/**
 * toasts.js - Sistema de Toast Notifications (sustituye alert())
 * Tipos: success, error, info. Fallback a alert() si el contenedor no existe.
 */
(function () {
    'use strict';

    var TOAST_DURATION = 4500;
    var CONTAINER_ID = 'toast-container';

    function getContainer() {
        var el = document.getElementById(CONTAINER_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = CONTAINER_ID;
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('aria-label', 'Notificaciones');
            document.body.appendChild(el);
        }
        return el;
    }

    var icons = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    function showToast(message, type) {
        type = type || 'info';
        if (!message) return;

        try {
            var container = getContainer();
            var toast = document.createElement('div');
            toast.className = 'toast toast--' + type;
            toast.setAttribute('role', 'alert');
            var icon = icons[type] || icons.info;
            toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-message">' + escapeHtml(String(message)) + '</span>';
            container.appendChild(toast);

            requestAnimationFrame(function () {
                toast.classList.add('toast-visible');
            });

            setTimeout(function () {
                toast.classList.remove('toast-visible');
                setTimeout(function () {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 320);
            }, TOAST_DURATION);
        } catch (e) {
            console.warn('Toast error:', e);
            alert(message);
        }
    }

    function escapeHtml(s) {
        if (s == null) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    window.showToast = showToast;
})();
