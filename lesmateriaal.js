const uploadInput = document.getElementById('materials-upload-input');
const refreshBtn = document.getElementById('materials-refresh-btn');
const materialsList = document.getElementById('materials-list');
const materialsEmpty = document.getElementById('materials-empty');
const materialsStatus = document.getElementById('materials-status');
const materialsCount = document.getElementById('materials-count');

const modal = document.getElementById('material-modal');
const modalShell = modal ? modal.querySelector('.material-modal-shell') : null;
const modalControls = document.getElementById('material-modal-controls');
const modalPrev = document.getElementById('material-modal-prev');
const modalBody = document.getElementById('material-modal-body');
const modalCaption = document.getElementById('material-modal-caption');
const modalClose = document.getElementById('material-modal-close');
const modalFullscreen = document.getElementById('material-modal-fullscreen');
const modalNext = document.getElementById('material-modal-next');

const contextMenu = document.getElementById('material-context-menu');
const contextOpenBtn = document.getElementById('material-context-open');
const contextRenameBtn = document.getElementById('material-context-rename');
const contextDeleteBtn = document.getElementById('material-context-delete');

const DB_NAME = 'ghsv-lesmateriaal-db';
const DB_STORE = 'materials';
const DB_VERSION = 1;

let dbPromise = null;
let activeContextItem = null;
let activeContextX = 0;
let activeContextY = 0;
let modalObjectUrl = '';
let previewObjectUrls = new Set();
let activeModalItem = null;
let activeModalIndex = -1;
let controlsHideTimer = null;

let state = {
    items: []
};

function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(text) {
    if (materialsStatus) materialsStatus.textContent = text;
}

function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function inferKind(file) {
    const mime = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.txt') || mime.startsWith('text/')) return 'text';
    return 'document';
}

function getDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(DB_STORE)) {
                    db.createObjectStore(DB_STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

function sanitizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    const file = item.blob instanceof Blob ? item.blob : null;
    const mime = file ? file.type : String(item.mime || '');
    const kind = String(item.kind || inferKind({ type: mime, name: item.title || item.name || '' })).toLowerCase();

    return {
        id: item.id || createId(),
        title: String(item.title || item.name || 'Onbekend materiaal').trim() || 'Onbekend materiaal',
        kind,
        mime,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        size: Number.isFinite(item.size) ? item.size : (file ? file.size : 0),
        blob: file,
        notes: typeof item.notes === 'string' ? item.notes.trim() : ''
    };
}

function getObjectUrl(item) {
    if (!(item.blob instanceof Blob)) return '';
    if (!item._objectUrl) {
        const sourceBlob = item.blob;
        const needsPdfMime = item.kind === 'pdf' && (!sourceBlob.type || sourceBlob.type !== 'application/pdf');
        const blobForUrl = needsPdfMime ? new Blob([sourceBlob], { type: 'application/pdf' }) : sourceBlob;
        item._objectUrl = URL.createObjectURL(blobForUrl);
        previewObjectUrls.add(item._objectUrl);
    }
    return item._objectUrl;
}

function revokeObjectUrls() {
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrls.clear();
    if (modalObjectUrl) {
        URL.revokeObjectURL(modalObjectUrl);
        modalObjectUrl = '';
    }
}

function renderCount() {
    if (!materialsCount) return;
    const count = state.items.length;
    materialsCount.textContent = `${count} item${count === 1 ? '' : 's'}`;
}

function closeContextMenu() {
    if (contextMenu) contextMenu.hidden = true;
    activeContextItem = null;
}

function showContextMenu(item, x, y) {
    if (!contextMenu) return;
    activeContextItem = item;
    activeContextX = x;
    activeContextY = y;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.hidden = false;
}

function closeModal() {
    exitFullscreenIfActive();
    if (modal) modal.hidden = true;
    if (modalBody) modalBody.innerHTML = '';
    if (modalCaption) modalCaption.textContent = '';
    if (modalFullscreen) modalFullscreen.hidden = true;
    if (modalControls) modalControls.classList.remove('controls-hidden');
    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
        controlsHideTimer = null;
    }
    if (modalObjectUrl) {
        URL.revokeObjectURL(modalObjectUrl);
        modalObjectUrl = '';
    }
    activeModalItem = null;
    activeModalIndex = -1;
    document.body.classList.remove('material-modal-open');
}

function showModalControls() {
    if (!modalControls) return;
    modalControls.classList.remove('controls-hidden');
    if (activeModalItem && activeModalItem.kind === 'pdf') {
        if (controlsHideTimer) {
            clearTimeout(controlsHideTimer);
            controlsHideTimer = null;
        }
        return;
    }
    if (controlsHideTimer) clearTimeout(controlsHideTimer);
    controlsHideTimer = setTimeout(() => {
        if (modalControls) modalControls.classList.add('controls-hidden');
    }, 2500);
}

function exitFullscreenIfActive() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
}

function toggleModalFullscreen() {
    if (!activeModalItem || (activeModalItem.kind !== 'image' && activeModalItem.kind !== 'pdf') || !modalBody) return;

    if (document.fullscreenElement) {
        exitFullscreenIfActive();
        return;
    }

    if (modalShell && modalShell.requestFullscreen) {
        modalShell.requestFullscreen().catch(() => {});
    }
}

function updateFullscreenButton() {
    if (!modalFullscreen) return;
    if (!activeModalItem || (activeModalItem.kind !== 'image' && activeModalItem.kind !== 'pdf')) {
        modalFullscreen.hidden = true;
        return;
    }
    modalFullscreen.hidden = false;
    modalFullscreen.textContent = document.fullscreenElement ? 'Fullscreen afsluiten' : 'Volledig scherm';
}

function openItemByIndex(index) {
    if (!state.items.length) return;
    const normalizedIndex = ((index % state.items.length) + state.items.length) % state.items.length;
    const item = state.items[normalizedIndex];
    activeModalIndex = normalizedIndex;
    openItem(item);
}

function openAdjacentItem(step) {
    if (!state.items.length) return;
    if (activeModalIndex < 0) {
        activeModalIndex = state.items.findIndex((item) => activeModalItem && item.id === activeModalItem.id);
    }
    const nextIndex = activeModalIndex < 0 ? 0 : activeModalIndex + step;
    openItemByIndex(nextIndex);
}

function openInNewTab(item) {
    const url = getObjectUrl(item);
    if (!url) {
        setStatus('Dit bestand kon niet worden geopend.');
        return;
    }
    window.open(url, '_blank', 'noopener');
}

function openItem(item) {
    const url = getObjectUrl(item);
    if (!url) {
        setStatus('Dit bestand kon niet worden geopend.');
        return;
    }

    activeModalItem = item;

    if (item.kind === 'image') {
        if (modalBody) {
            modalBody.innerHTML = '';
            const img = document.createElement('img');
            img.src = url;
            img.alt = item.title;
            img.className = 'material-modal-image';
            modalBody.appendChild(img);
        }
        updateFullscreenButton();
    } else if (item.kind === 'video') {
        if (modalBody) {
            modalBody.innerHTML = '';
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            video.className = 'material-modal-video';
            modalBody.appendChild(video);
        }
        updateFullscreenButton();
    } else if (item.kind === 'pdf') {
        if (modalBody) {
            modalBody.innerHTML = '';
            const object = document.createElement('object');
            object.data = url;
            object.type = 'application/pdf';
            object.className = 'material-modal-frame material-pdf-object';
            object.setAttribute('aria-label', item.title);

            const pdfFallback = document.createElement('div');
            pdfFallback.className = 'material-pdf-fallback';
            const fallbackText = document.createElement('p');
            fallbackText.textContent = 'PDF-weergave niet beschikbaar in deze browser. Gebruik openen in nieuw tabblad.';
            const fallbackBtn = document.createElement('button');
            fallbackBtn.type = 'button';
            fallbackBtn.className = 'material-modal-action';
            fallbackBtn.textContent = 'Open PDF in nieuw tabblad';
            fallbackBtn.addEventListener('click', () => openInNewTab(item));
            pdfFallback.appendChild(fallbackText);
            pdfFallback.appendChild(fallbackBtn);
            object.appendChild(pdfFallback);

            modalBody.appendChild(object);
        }
        updateFullscreenButton();
    } else {
        openInNewTab(item);
        setStatus(`${item.title} geopend in een nieuw tabblad.`);
        return;
    }

    if (modalCaption) {
        modalCaption.textContent = item.title;
    }
    if (modal) modal.hidden = false;
    document.body.classList.add('material-modal-open');
    showModalControls();
}

function renameItem(item) {
    const nextTitle = window.prompt('Nieuwe naam:', item.title);
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) {
        setStatus('Naam mag niet leeg zijn.');
        return;
    }
    item.title = trimmed;
    saveItems().then(() => {
        renderItems();
        setStatus('Item hernoemd.');
    }).catch(() => setStatus('Hernoemen mislukt.'));
}

function deleteItem(item) {
    const ok = window.confirm(`Weet je zeker dat je "${item.title}" wilt verwijderen?`);
    if (!ok) return;
    state.items = state.items.filter((entry) => entry.id !== item.id);
    saveItems().then(() => {
        renderItems();
        setStatus('Item verwijderd.');
    }).catch(() => setStatus('Verwijderen mislukt.'));
}

function saveItems() {
    return getDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
            state.items.forEach((item) => store.put(item));
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

function loadItems() {
    return getDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result || []).map((item) => sanitizeItem(item)).filter(Boolean));
        request.onerror = () => reject(request.error);
    }));
}

function renderPreview(item) {
    const preview = document.createElement('div');
    preview.className = 'material-card-preview';
    const url = getObjectUrl(item);

    if (item.kind === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.alt = item.title;
        preview.appendChild(img);
        return preview;
    }

    if (item.kind === 'video') {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        preview.appendChild(video);
        return preview;
    }

    if (item.kind === 'pdf') {
        const tile = document.createElement('div');
        tile.className = 'material-kind-badge material-kind-badge--pdf';
        tile.textContent = 'PDF';
        preview.appendChild(tile);
        return preview;
    }

    const badge = document.createElement('div');
    badge.className = 'material-kind-badge';
    badge.textContent = item.kind === 'text' ? 'TXT' : 'DOC';
    preview.appendChild(badge);
    return preview;
}

function renderItems() {
    if (!materialsList || !materialsEmpty) return;
    materialsList.innerHTML = '';
    renderCount();

    if (!state.items.length) {
        materialsEmpty.hidden = false;
        return;
    }

    materialsEmpty.hidden = true;

    state.items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'material-card';
        card.tabIndex = 0;
        card.dataset.id = item.id;
        card.title = 'Klik om te openen, rechtsklik voor acties';

        const preview = renderPreview(item);
        const body = document.createElement('div');
        body.className = 'material-card-body';

        const title = document.createElement('div');
        title.className = 'material-card-title';
        title.textContent = item.title;

        const meta = document.createElement('div');
        meta.className = 'material-card-meta';
        const metaParts = [item.kind.toUpperCase()];
        if (item.size) metaParts.push(formatSize(item.size));
        const createdLabel = formatDate(item.createdAt);
        if (createdLabel) metaParts.push(createdLabel);
        meta.textContent = metaParts.join(' • ');

        const hint = document.createElement('div');
        hint.className = 'material-card-hint';
        hint.textContent = item.kind === 'image' || item.kind === 'video' || item.kind === 'pdf'
            ? 'Klik om te openen'
            : 'Klik opent in een nieuw tabblad';

        body.appendChild(title);
        body.appendChild(meta);
        body.appendChild(hint);

        card.appendChild(preview);
        card.appendChild(body);

        card.addEventListener('click', () => {
            const itemIndex = state.items.findIndex((entry) => entry.id === item.id);
            activeModalIndex = itemIndex;
            openItem(item);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const itemIndex = state.items.findIndex((entry) => entry.id === item.id);
                activeModalIndex = itemIndex;
                openItem(item);
            }
        });
        card.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showContextMenu(item, event.clientX, event.clientY);
        });

        materialsList.appendChild(card);
    });
}

function handleFiles(files) {
    if (!files || !files.length) {
        setStatus('Geen bestanden gekozen.');
        return;
    }

    const items = Array.from(files).map((file) => ({
        id: createId(),
        title: file.name,
        kind: inferKind(file),
        mime: file.type || '',
        createdAt: new Date().toISOString(),
        size: file.size,
        blob: file,
        notes: ''
    })).map(sanitizeItem).filter(Boolean);

    if (!items.length) {
        setStatus('Geen bruikbare bestanden geselecteerd.');
        return;
    }

    state.items = [...state.items, ...items];
    saveItems().then(() => {
        renderItems();
        setStatus(`${items.length} item${items.length === 1 ? '' : 's'} toegevoegd.`);
    }).catch(() => setStatus('Opslaan mislukt.'));
}

function loadInitialData() {
    loadItems().then((items) => {
        state.items = items;
        renderItems();
        setStatus('Lesmateriaal geladen.');
    }).catch(() => {
        state.items = [];
        renderItems();
        setStatus('Kon lesmateriaal niet laden. Je kunt direct uploaden.');
    });
}

if (uploadInput) {
    uploadInput.addEventListener('change', () => {
        handleFiles(uploadInput.files);
        uploadInput.value = '';
    });
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadInitialData());
}

if (modalClose) {
    modalClose.addEventListener('click', closeModal);
}

if (modalFullscreen) {
    modalFullscreen.addEventListener('click', toggleModalFullscreen);
}

if (modalPrev) {
    modalPrev.addEventListener('click', () => openAdjacentItem(-1));
}

if (modalNext) {
    modalNext.addEventListener('click', () => openAdjacentItem(1));
}

if (modal) {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });
}

if (modalShell) {
    modalShell.addEventListener('mousemove', showModalControls);
    modalShell.addEventListener('mouseenter', showModalControls);
    modalShell.addEventListener('touchstart', showModalControls, { passive: true });
}

if (modal) {
    modal.addEventListener('mousemove', showModalControls);
    modal.addEventListener('touchstart', showModalControls, { passive: true });
}

if (contextOpenBtn) {
    contextOpenBtn.addEventListener('click', () => {
        if (!activeContextItem) return;
        closeContextMenu();
        openItem(activeContextItem);
    });
}

if (contextRenameBtn) {
    contextRenameBtn.addEventListener('click', () => {
        if (!activeContextItem) return;
        const item = activeContextItem;
        closeContextMenu();
        renameItem(item);
    });
}

if (contextDeleteBtn) {
    contextDeleteBtn.addEventListener('click', () => {
        if (!activeContextItem) return;
        const item = activeContextItem;
        closeContextMenu();
        deleteItem(item);
    });
}

window.addEventListener('click', closeContextMenu);
window.addEventListener('scroll', closeContextMenu, true);
window.addEventListener('resize', closeContextMenu);
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (document.fullscreenElement) {
            exitFullscreenIfActive();
            event.preventDefault();
            return;
        }
        closeContextMenu();
        closeModal();
    } else if (event.key === 'ArrowLeft' && modal && !modal.hidden) {
        event.preventDefault();
        openAdjacentItem(-1);
    } else if (event.key === 'ArrowRight' && modal && !modal.hidden) {
        event.preventDefault();
        openAdjacentItem(1);
    }
});
document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton();
    showModalControls();
});
window.addEventListener('beforeunload', revokeObjectUrls);
window.addEventListener('pageshow', () => loadInitialData());

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadInitialData();
});

loadInitialData();
