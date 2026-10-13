/* Capa mínima de IndexedDB, compartida por la página y el Service Worker */
const DB = (() => {
    const NAME = 'mi-universo';
    const STORE = 'lista';

    function abrir() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(NAME, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function todos() {
        const db = await abrir();
        return new Promise((resolve, reject) => {
            const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }

    async function agregar(emoji, texto) {
        const db = await abrir();
        return new Promise((resolve, reject) => {
            const t = db.transaction(STORE, 'readwrite');
            t.objectStore(STORE).add({ emoji, texto, creada: Date.now(), sincronizada: false });
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
        });
    }

    async function eliminar(id) {
        const db = await abrir();
        return new Promise((resolve, reject) => {
            const t = db.transaction(STORE, 'readwrite');
            t.objectStore(STORE).delete(id);
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
        });
    }

    async function pendientes() {
        return (await todos()).filter((n) => !n.sincronizada);
    }

    async function marcarSincronizadas(ids) {
        const db = await abrir();
        return new Promise((resolve, reject) => {
            const t = db.transaction(STORE, 'readwrite');
            const s = t.objectStore(STORE);
            ids.forEach((id) => {
                const g = s.get(id);
                g.onsuccess = () => {
                    if (g.result) s.put({ ...g.result, sincronizada: true });
                };
            });
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
        });
    }

    return { todos, agregar, eliminar, pendientes, marcarSincronizadas };
})();
