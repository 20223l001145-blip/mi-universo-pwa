const $ = (id) => document.getElementById(id);
const lista = $('lista');
const vacio = $('vacio');
const estado = $('estado');
const net = $('net');
let promptInstalar = null;

function decir(msg) { estado.textContent = msg; }

function pintarRed() {
    const on = navigator.onLine;
    net.textContent = on ? '● En línea' : '● Sin conexión';
    net.className = 'badge ' + (on ? 'online' : 'offline');
}

async function pintarLista() {
    const items = (await DB.todos()).sort((a, b) => b.creada - a.creada);
    lista.innerHTML = '';
    vacio.hidden = items.length > 0;

    for (const n of items) {
        const li = document.createElement('li');

        const emoji = document.createElement('span');
        emoji.textContent = n.emoji;

        const txt = document.createElement('div');
        txt.className = 'txt';
        txt.textContent = n.texto;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = new Date(n.creada).toLocaleString('es-MX');
        txt.appendChild(meta);

        const tag = document.createElement('span');
        tag.className = 'tag ' + (n.sincronizada ? 'sincronizada' : 'pendiente');
        tag.textContent = n.sincronizada ? 'Sincronizada' : 'Pendiente';

        const del = document.createElement('button');
        del.className = 'del';
        del.setAttribute('aria-label', 'Eliminar');
        del.textContent = '✕';
        del.onclick = async () => { await DB.eliminar(n.id); pintarLista(); };

        li.append(emoji, txt, tag, del);
        lista.appendChild(li);
    }
}

// 1) Registrar el Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => {
        decir('No se pudo registrar el Service Worker: ' + e.message);
    });

    // 2) Escuchar los mensajes que manda el Service Worker
    navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.texto) decir(e.data.texto);
        pintarLista();
    });
}

// 3) Pedir la sincronización (el navegador dispara el evento "sync" con conexión)
async function pedirSync() {
    const registro = await navigator.serviceWorker.ready;
    if ('sync' in registro) {
        await registro.sync.register('sync-mi-universo');
        return true;
    }
    return false;
}

$('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = $('text').value.trim();
    if (!texto) return;
    await DB.agregar($('cat').value, texto);
    $('text').value = '';
    await pintarLista();
    try {
        const ok = await pedirSync();
        decir(ok
            ? (navigator.onLine
                ? 'Guardado. Pedido de sync registrado…'
                : 'Guardado sin conexión. Se sincronizará cuando vuelva internet.')
            : 'Guardado. Tu navegador no soporta Background Sync (usa Chrome o Edge).');
    } catch (err) {
        decir('Guardado, pero no se pudo pedir el sync.');
    }
});

$('btn-sync').addEventListener('click', async () => {
    try {
        const ok = await pedirSync();
        decir(ok
            ? 'Pedido registrado. El navegador avisará cuando haya conexión.'
            : 'Tu navegador no soporta Background Sync (usa Chrome o Edge).');
    } catch (err) {
        decir('Error: ' + err.message);
    }
});

$('btn-notif').addEventListener('click', async () => {
    if (!('Notification' in window)) return decir('Este navegador no soporta notificaciones.');
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return decir('Permiso de notificaciones denegado.');
    const registro = await navigator.serviceWorker.ready;
    registro.showNotification('★ Notificaciones activadas', {
        body: 'Te avisaré cuando tu lista se sincronice.',
        icon: 'img/icons/icon-192x192.png',
        badge: 'img/icons/icon-72x72.png'
    });
    decir('Notificaciones activadas.');
});

// Instalación
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptInstalar = e;
    $('btn-install').hidden = false;
});
$('btn-install').addEventListener('click', async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt();
    await promptInstalar.userChoice;
    promptInstalar = null;
    $('btn-install').hidden = true;
});
window.addEventListener('appinstalled', () => decir('App instalada ✅'));

window.addEventListener('online', () => { pintarRed(); pedirSync().catch(() => {}); });
window.addEventListener('offline', pintarRed);

pintarRed();
pintarLista();
