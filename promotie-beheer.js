const settingImageMsInput = document.getElementById('setting-image-ms');

const uploadInput = document.getElementById('upload-input');
const refreshItemsBtn = document.getElementById('refresh-items-btn');
const itemsList = document.getElementById('items-list');
const itemsEmpty = document.getElementById('items-empty');
const saveJsonBtn = document.getElementById('save-json-btn');
const clearStorageBtn = document.getElementById('clear-storage-btn');
const saveStatus = document.getElementById('save-status');
const uploadStatus = document.getElementById('upload-status');

const DB_NAME = 'ghsv-promo-db';
const DB_STORE = 'items';
const DB_VERSION = 1;

let dbPromise = null;
let previewUrls = new Set();

let promoState = {
    settings: {
        imageDurationMs: 9000,
        webDurationMs: 22000,
        videoFallbackDurationMs: 30000
    },
    items: []
};

function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asPositiveInt(value, fallback) {
    const n = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(n) || n <= 0) {
        return fallback;
    }
    return n;
}

function asBoolean(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function getDefaultSettings() {
    return {
        imageDurationMs: 9000,
        webDurationMs: 22000,
        videoFallbackDurationMs: 30000
    };
}

function sanitizeItem(item) {
    if (!item || typeof item !== 'object') return null;

    const type = String(item.type || '').toLowerCase();
    if (!type) return null;

    const clean = {
        id: item.id || createId(),
        type,
        active: asBoolean(item.active, true),
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        durationMs: asPositiveInt(item.durationMs, type === 'image' ? 9000 : type === 'video' ? 30000 : 22000)
    };

    if (typeof item.file === 'string' && item.file.trim()) clean.file = item.file.trim();
    if (typeof item.src === 'string' && item.src.trim()) clean.src = item.src.trim();
    if (typeof item.name === 'string' && item.name.trim()) clean.name = item.name.trim();
    else if (typeof item.originalName === 'string' && item.originalName.trim()) clean.name = item.originalName.trim();
    if (item.blob instanceof Blob) clean.blob = item.blob;

    return clean;
}

function normalizePayload(raw) {
    if (Array.isArray(raw)) return { settings: getDefaultSettings(), items: raw };
    if (!raw || typeof raw !== 'object') return { settings: getDefaultSettings(), items: [] };
    return {
        settings: {
            imageDurationMs: asPositiveInt(raw.settings && raw.settings.imageDurationMs, 9000),
            webDurationMs: asPositiveInt(raw.settings && raw.settings.webDurationMs, 22000),
            videoFallbackDurationMs: asPositiveInt(raw.settings && raw.settings.videoFallbackDurationMs, 30000)
        },
        items: Array.isArray(raw.items) ? raw.items : []
    };
}

function setStatus(text) {
    if (saveStatus) saveStatus.textContent = text;
    if (uploadStatus) uploadStatus.textContent = text;
}

function msToSeconds(value, fallbackMs) {
    return String(Math.max(1, Math.round(asPositiveInt(value, fallbackMs) / 1000)));
}

function secondsToMs(value, fallbackMs) {
    return asPositiveInt(value, Math.round(fallbackMs / 1000)) * 1000;
}

function setSettingsFromState() {
    if (settingImageMsInput) settingImageMsInput.value = msToSeconds(promoState.settings.imageDurationMs, 9000);
}

function readSettingsFromForm() {
    promoState.settings.imageDurationMs = secondsToMs(settingImageMsInput && settingImageMsInput.value, 9000);
}

function revokePreviewUrls() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.clear();
}

function openDb() {
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

function saveItemsToDb() {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        const request = store.clear();
        request.onsuccess = () => {
            promoState.items.forEach((item) => store.put(item));
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

function loadItemsFromDb() {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result || []).map((item) => sanitizeItem(item)).filter(Boolean));
        request.onerror = () => reject(request.error);
    }));
}

function buildPayload() {
    readSettingsFromForm();
    return {
        settings: {
            imageDurationMs: promoState.settings.imageDurationMs,
            webDurationMs: promoState.settings.webDurationMs,
            videoFallbackDurationMs: promoState.settings.videoFallbackDurationMs
        },
        items: promoState.items.map((item) => {
            const clean = { type: item.type, active: item.active !== false };
            if (item.durationMs) clean.durationMs = item.durationMs;
            if (item.file) clean.file = item.file;
            if (item.src) clean.src = item.src;
            if (item.name) clean.name = item.name;
            return clean;
        })
    };
}

function hydrateFromServer() {
    return fetch('./promotie-media.json?_=' + Date.now(), { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) throw new Error('Kon JSON niet laden');
            return response.json();
        })
        .then((rawData) => {
            const normalized = normalizePayload(rawData);
            promoState.settings = normalized.settings;
            promoState.items = normalized.items.map((item) => sanitizeItem(item)).filter(Boolean);
            setSettingsFromState();
            return saveItemsToDb().then(() => {
                renderItems();
                updateJsonOutput();
                return normalized;
            });
        });
}

function updateJsonOutput() {
    return buildPayload();
}

function normalizeMediaPath(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    if (/^(\.\/|\.\.\/|img\/)/i.test(trimmed)) return trimmed;
    return `img/${trimmed}`;
}

function getPreviewUrl(item) {
    if (item.blob instanceof Blob) {
        if (!item._previewUrl) {
            item._previewUrl = URL.createObjectURL(item.blob);
            previewUrls.add(item._previewUrl);
        }
        return item._previewUrl;
    }
    if (typeof item.src === 'string' && item.src.trim()) return item.src.trim();
    if (typeof item.file === 'string' && item.file.trim()) return normalizeMediaPath(item.file);
    return '';
}

function renderItems() {
    if (!itemsList || !itemsEmpty) return;
    itemsList.innerHTML = '';

    if (!promoState.items.length) {
        itemsEmpty.hidden = false;
        return;
    }

    itemsEmpty.hidden = true;

    promoState.items.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'promo-item-card';

        const preview = document.createElement('div');
        preview.className = 'promo-item-preview';
        const previewUrl = getPreviewUrl(item);

        if (item.type === 'video' || /\.(mp4|webm|ogg)$/i.test(previewUrl)) {
            const video = document.createElement('video');
            video.src = previewUrl;
            video.preload = 'metadata';
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            preview.appendChild(video);
        } else if (previewUrl) {
            const img = document.createElement('img');
            img.src = previewUrl;
            img.alt = item.name || item.file || 'Promotie media';
            preview.appendChild(img);
        } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = item.type || 'Media';
            placeholder.className = 'promo-item-placeholder';
            preview.appendChild(placeholder);
        }

        const body = document.createElement('div');
        body.className = 'promo-item-body';

        const meta = document.createElement('div');
        meta.className = 'promo-item-meta';
        meta.textContent = item.name || item.file || item.src || item.type;

        const subtext = document.createElement('div');
        subtext.className = 'promo-item-subtext';
        const source = item.file ? `bestand: ${item.file}` : item.src ? `link: ${item.src}` : 'browser upload';
        subtext.textContent = `${item.type} • ${source}`;

        const controls = document.createElement('div');
        controls.className = 'promo-item-controls';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = `promo-toggle-btn ${item.active === false ? 'inactive' : 'active'}`;
        toggleBtn.textContent = item.active === false ? 'Toon op promotiepagina' : 'Verbergen';
        toggleBtn.addEventListener('click', () => {
            item.active = item.active === false;
            saveItemsToDb()
                .then(() => savePromoJson('Wijziging wordt opgeslagen...'))
                .then(() => {
                    renderItems();
                    updateJsonOutput();
                    setStatus(item.active === false ? 'Item verborgen voor promotiepagina.' : 'Item zichtbaar op promotiepagina.');
                })
                .catch(() => setStatus('Opslaan mislukt.'));
        });

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.textContent = '↑';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => {
            if (index === 0) return;
            const tmp = promoState.items[index - 1];
            promoState.items[index - 1] = promoState.items[index];
            promoState.items[index] = tmp;
            saveItemsToDb()
                .then(() => savePromoJson('Volgorde wordt opgeslagen...'))
                .then(() => {
                    renderItems();
                    updateJsonOutput();
                    setStatus('Volgorde aangepast.');
                })
                .catch(() => setStatus('Opslaan mislukt.'));
        });

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.textContent = '↓';
        downBtn.disabled = index >= promoState.items.length - 1;
        downBtn.addEventListener('click', () => {
            if (index >= promoState.items.length - 1) return;
            const tmp = promoState.items[index + 1];
            promoState.items[index + 1] = promoState.items[index];
            promoState.items[index] = tmp;
            saveItemsToDb()
                .then(() => savePromoJson('Volgorde wordt opgeslagen...'))
                .then(() => {
                    renderItems();
                    updateJsonOutput();
                    setStatus('Volgorde aangepast.');
                })
                .catch(() => setStatus('Opslaan mislukt.'));
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Verwijderen';
        removeBtn.className = 'promo-remove-btn';
        removeBtn.addEventListener('click', () => {
            promoState.items.splice(index, 1);
            saveItemsToDb()
                .then(() => savePromoJson('Verwijdering wordt opgeslagen...'))
                .then(() => {
                    renderItems();
                    updateJsonOutput();
                    setStatus('Item verwijderd.');
                })
                .catch(() => setStatus('Opslaan mislukt.'));
        });

        controls.appendChild(toggleBtn);
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        controls.appendChild(removeBtn);

        body.appendChild(meta);
        body.appendChild(subtext);
        body.appendChild(controls);
        card.appendChild(preview);
        card.appendChild(body);
        itemsList.appendChild(card);
    });
}

async function handleUploadedFiles(files) {
    if (!files || !files.length) {
        setStatus('Geen bestanden gekozen.');
        return;
    }

    try {
        const pending = await Promise.all(Array.from(files).map(async (file) => {
            const uploadResult = await uploadFileToServer(file);
            const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(file.name);
            const type = isVideo ? 'video' : 'image';
            return sanitizeItem({
                id: createId(),
                type,
                name: file.name,
                originalName: file.name,
                active: true,
                durationMs: type === 'image' ? 9000 : 30000,
                file: uploadResult.url || uploadResult.path || file.name,
                blob: file
            });
        }));

        const validItems = pending.filter(Boolean);
        if (!validItems.length) {
            setStatus('Kon geen bruikbare bestanden toevoegen.');
            return;
        }

        promoState.items = [...promoState.items, ...validItems];
        await saveItemsToDb();
        await savePromoJson('Nieuwe upload wordt opgeslagen...');
        renderItems();
        updateJsonOutput();
        setStatus(`${validItems.length} bestand(en) toegevoegd. Je kunt ze nu zichtbaar of verborgen maken.`);
    } catch (error) {
        setStatus('Uploaden is mislukt.');
    }
}

function savePromoJson(statusText = 'Opslaan naar promotie-media.json...') {
    const payload = updateJsonOutput();
    setStatus(statusText);

    return fetch('/api/promo-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then((response) => response.json())
        .then((data) => {
            if (data && data.ok) {
                return hydrateFromServer().then(() => {
                    setStatus('Opgeslagen in promotie-media.json.');
                    return data;
                });
            }
            throw new Error('Opslaan mislukt');
        })
        .catch(() => {
            setStatus('Opslaan mislukt.');
            throw new Error('Opslaan mislukt');
        });
}

function uploadFileToServer(file) {
    return fetch('/api/upload', {
        method: 'POST',
        headers: {
            'X-File-Name': file.name || 'upload.bin'
        },
        body: file
    }).then((response) => response.json()).then((data) => {
        if (!data || !data.ok) {
            throw new Error('Upload failed');
        }
        return data;
    });
}

function loadInitialData() {
    hydrateFromServer()
        .then(() => {
            setStatus('Bestaande promotie-media.json geladen als beheeritems.');
        })
        .catch(() => {
            loadItemsFromDb().then((items) => {
                if (items.length) {
                    promoState.items = items;
                    setSettingsFromState();
                    renderItems();
                    updateJsonOutput();
                    setStatus('Bestaande beheeritems geladen.');
                    return;
                }
                setSettingsFromState();
                renderItems();
                updateJsonOutput();
                setStatus('Kon de beheeritems niet laden. Je kunt ze direct uploaden.');
            });
        });
}

function clearStoredItems() {
    revokePreviewUrls();
    promoState.items = [];
    promoState.settings = getDefaultSettings();
    setSettingsFromState();
    updateJsonOutput();
    renderItems();

    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    })).then(() => savePromoJson('Lege promotielijst wordt opgeslagen...')).then(() => setStatus('Lokale beheerdata gewist.'));
}

if (uploadInput) {
    uploadInput.addEventListener('change', () => {
        handleUploadedFiles(uploadInput.files);
        uploadInput.value = '';
    });
}

if (refreshItemsBtn) refreshItemsBtn.addEventListener('click', () => loadInitialData());
if (saveJsonBtn) saveJsonBtn.addEventListener('click', savePromoJson);
if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', () => {
        clearStoredItems().catch(() => setStatus('Wisactie mislukt.'));
    });
}

window.addEventListener('beforeunload', revokePreviewUrls);

window.addEventListener('pageshow', () => {
    loadInitialData();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadInitialData();
    }
});

if (typeof importJsonInput !== 'undefined' && importJsonInput) {
    importJsonInput.addEventListener('change', () => {
        const file = importJsonInput.files && importJsonInput.files[0];
        importJsonInput.value = '';

        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const rawData = JSON.parse(event.target.result);
                const normalized = normalizePayload(rawData);
                promoState.settings = normalized.settings;
                promoState.items = normalized.items
                    .map((item) => sanitizeItem(item))
                    .filter((item) => item !== null);

                setSettingsFromState();
                renderItems();
                updateJsonOutput();
                setStatus(`Geïmporteerd uit ${file.name} — ${promoState.items.length} item(s) geladen.`);
            } catch (error) {
                setStatus('Kon het bestand niet lezen. Is het een geldig JSON-bestand?');
            }
        };
        reader.onerror = () => {
            setStatus('Fout bij lezen van het bestand.');
        };
        reader.readAsText(file);
    });
}

loadInitialData();

