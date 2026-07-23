const settingImageMsInput = document.getElementById('setting-image-ms');

const uploadInput = document.getElementById('upload-input');
const mediaLinkInput = document.getElementById('media-link-input');
const addMediaLinkBtn = document.getElementById('add-media-link-btn');
const refreshItemsBtn = document.getElementById('refresh-items-btn');
const itemsList = document.getElementById('items-list');
const itemsEmpty = document.getElementById('items-empty');
const saveJsonBtn = document.getElementById('save-json-btn');
const downloadJsonBtn = document.getElementById('download-json-btn');
const clearStorageBtn = document.getElementById('clear-storage-btn');
const saveStatus = document.getElementById('save-status');
const uploadStatus = document.getElementById('upload-status');

const DB_NAME = 'ghsv-promo-db';
const DB_STORE = 'items';
const DB_VERSION = 1;

let dbPromise = null;
let previewUrls = new Set();
let serverMode = null;

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

function isServerModeEnabled() {
    if (typeof serverMode === 'boolean') return Promise.resolve(serverMode);
    return fetch('/health', { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) throw new Error('No health endpoint');
            return response.json();
        })
        .then((data) => {
            serverMode = Boolean(data && data.ok === true);
            return serverMode;
        })
        .catch(() => {
            serverMode = false;
            return false;
        });
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

function downloadPromoJson() {
    const payload = updateJsonOutput();
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'promotie-media.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('JSON gedownload. Upload media-bestanden apart naar img/ op de server.');
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

function inferTypeFromUrl(url) {
    if (/\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url)) return 'image';
    if (/\.(mp4|webm|ogg|m3u8|mpd)(\?.*)?$/i.test(url)) return 'video';
    return 'web';
}

function guessNameFromUrl(url) {
    try {
        const parsed = new URL(url);
        const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
        if (lastSegment) return decodeURIComponent(lastSegment);
        return parsed.hostname || 'web-link';
    } catch (error) {
        return 'web-link';
    }
}

async function addMediaLinkFromInput() {
    const raw = mediaLinkInput && typeof mediaLinkInput.value === 'string' ? mediaLinkInput.value.trim() : '';
    if (!raw) {
        setStatus('Plak eerst een geldige link.');
        return;
    }

    let url;
    try {
        url = new URL(raw);
    } catch (error) {
        setStatus('Ongeldige link. Gebruik een volledige http/https URL.');
        return;
    }

    if (!/^https?:$/i.test(url.protocol)) {
        setStatus('Alleen http/https links zijn toegestaan.');
        return;
    }

    const normalizedUrl = url.toString();
    const type = inferTypeFromUrl(normalizedUrl);
    const name = guessNameFromUrl(normalizedUrl);

    const newItem = sanitizeItem({
        id: createId(),
        type,
        active: true,
        name,
        src: normalizedUrl,
        durationMs: type === 'image' ? 9000 : type === 'video' ? 30000 : 22000
    });

    if (!newItem) {
        setStatus('Kon deze link niet toevoegen.');
        return;
    }

    promoState.items = [...promoState.items, newItem];
    await saveItemsToDb();
    const useServer = await isServerModeEnabled();
    if (useServer) {
        await savePromoJson('Nieuwe link wordt opgeslagen...');
    }
    renderItems();
    updateJsonOutput();

    if (mediaLinkInput) mediaLinkInput.value = '';
    if (useServer) {
        setStatus('Link toegevoegd en opgeslagen.');
    } else {
        setStatus('Link lokaal toegevoegd. Gebruik Download promotie-media.json voor export.');
    }
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
    const selectedFiles = Array.isArray(files) ? files : Array.from(files || []);

    if (!selectedFiles.length) {
        setStatus('Geen bestanden gekozen.');
        return;
    }

    try {
        const useServer = await isServerModeEnabled();
        const pending = await Promise.all(selectedFiles.map(async (file) => {
            const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(file.name);
            const type = isVideo ? 'video' : 'image';
            let filePath = file.name;

            if (useServer) {
                const uploadResult = await uploadFileToServer(file);
                filePath = uploadResult.url || uploadResult.path || file.name;
            }

            return sanitizeItem({
                id: createId(),
                type,
                name: file.name,
                originalName: file.name,
                active: true,
                durationMs: type === 'image' ? 9000 : 30000,
                file: filePath,
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
        if (useServer) {
            await savePromoJson('Nieuwe upload wordt opgeslagen...');
        }
        renderItems();
        updateJsonOutput();
        if (useServer) {
            setStatus(`${validItems.length} bestand(en) toegevoegd. Je kunt ze nu zichtbaar of verborgen maken.`);
        } else {
            setStatus(`${validItems.length} bestand(en) lokaal toegevoegd. Gebruik Download promotie-media.json voor export.`);
        }
    } catch (error) {
        setStatus('Uploaden is mislukt.');
    }
}

function savePromoJson(statusText = 'Opslaan naar promotie-media.json...') {
    return isServerModeEnabled().then((useServer) => {
        if (!useServer) {
            setStatus('Opslaan naar server kan niet op GitHub Pages. Gebruik Download promotie-media.json.');
            return { ok: false, localOnly: true };
        }

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
    isServerModeEnabled().then((useServer) => {
        hydrateFromServer()
            .then(() => {
                if (useServer) {
                    setStatus('Bestaande promotie-media.json geladen als beheeritems.');
                } else {
                    setStatus('GitHub Pages modus: lokaal beheren en JSON downloaden.');
                }
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
        const selectedFiles = Array.from(uploadInput.files || []);
        uploadInput.value = '';
        handleUploadedFiles(selectedFiles);
    });
}

if (refreshItemsBtn) refreshItemsBtn.addEventListener('click', () => loadInitialData());
if (saveJsonBtn) saveJsonBtn.addEventListener('click', savePromoJson);
if (downloadJsonBtn) downloadJsonBtn.addEventListener('click', downloadPromoJson);
if (addMediaLinkBtn) addMediaLinkBtn.addEventListener('click', () => {
    addMediaLinkFromInput().catch(() => setStatus('Toevoegen van link is mislukt.'));
});
if (mediaLinkInput) {
    mediaLinkInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addMediaLinkFromInput().catch(() => setStatus('Toevoegen van link is mislukt.'));
        }
    });
}
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

