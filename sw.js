const CACHE_NAME = 'mi-universo-v1';
const APP_SHELL = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/db.js',
    './manifest.json',
    './img/favicon.ico',
    './img/icons/icon-72x72.png',
    './img/icons/icon-96x96.png',
    './img/icons/icon-128x128.png',
    './img/icons/icon-144x144.png',
    './img/icons/icon-152x152.png',
    './img/icons/icon-192x192.png',
    './img/icons/icon-384x384.png',
    './img/icons/icon-512x512.png',
    './img/icons/maskable-512x512.png',
    './img/icons/apple-touch-icon.png'
];

importScripts('js/db.js');

self.addEventListener('install', (e) => {
    const cache = caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL));
    e.waitUntil(cache);
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    const limpiar = caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    );
    e.waitUntil(limpiar);
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    // datos.json es "el servidor": siempre va a la red (nunca desde caché),
    // así si no hay conexión el fetch falla y el sync se reintenta solo.
    if (new URL(e.request.url).pathname.endsWith('/datos.json')) {
        e.respondWith(fetch(e.request, { cache: 'no-store' }));
        return;
    }

    const respuesta = caches.match(e.request).then((cacheResp) => {
        if (cacheResp) return cacheResp;
        return fetch(e.request).then((netResp) => {
            if (netResp.ok && new URL(e.request.url).origin === location.origin) {
                const copia = netResp.clone();
                caches.open(CACHE_NAME).then((c) => c.put(e.request, copia));
            }
            return netResp;
        }).catch(() => {
            if (e.request.mode === 'navigate') return caches.match('./index.html');
        });
    });
    e.respondWith(respuesta);
});

// El navegador dispara este evento cuando hay conexión
self.addEventListener('sync', (event) => {
    console.log('¡Evento sync recibido! Etiqueta:', event.tag);

    if (event.tag === 'sync-mi-universo') {
        event.waitUntil(sincronizar());
    }
});

async function sincronizar() {
    // Hablamos con el servidor (Live Server). Si falla, el error hace que el
    // navegador reintente el sync más tarde.
    const resp = await fetch('datos.json', { cache: 'no-store' });
    const datos = await resp.json();
    if (!datos.ok) throw new Error('El servidor no respondió ok');

    const pendientes = await DB.pendientes();
    await DB.marcarSincronizadas(pendientes.map((n) => n.id));

    const texto = pendientes.length
        ? `✅ Sync listo: ${pendientes.length} elemento(s) sincronizado(s)`
        : '✅ Sync listo: todo estaba al día';

    await notificar('★ Mi Universo', texto);
    await avisarALaPagina(texto);
}

// Notificación
async function notificar(titulo, cuerpo) {
    try {
        await self.registration.showNotification(titulo, {
            body: cuerpo,
            icon: './img/icons/icon-192x192.png',
            badge: './img/icons/icon-72x72.png',
            tag: 'sync-mi-universo'
        });
    } catch (err) {
        // Sin permiso de notificaciones: no pasa nada, seguimos.
        console.log('No se pudo mostrar la notificación:', err.message);
    }
}

// Envía un texto a todas las páginas abiertas
async function avisarALaPagina(texto) {
    const ventanas = await self.clients.matchAll({ includeUncontrolled: true });
    ventanas.forEach((v) => v.postMessage({ texto }));
}

// Al tocar la notificación se abre (o enfoca) la app
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
            for (const v of ventanas) if ('focus' in v) return v.focus();
            return self.clients.openWindow('./index.html');
        })
    );
});

// También sirve para notificaciones push reales (como en Twittor)
self.addEventListener('push', (e) => {
    let datos = { title: 'Mi Universo', body: 'Tienes algo nuevo ★' };
    if (e.data) datos = e.data.json();
    e.waitUntil(notificar(datos.title, datos.body));
});
