const settingImageMsInput = document.getElementById('setting-image-ms');
const settingWebMsInput = document.getElementById('setting-web-ms');
const settingVideoMsInput = document.getElementById('setting-video-ms');

const newItemTypeInput = document.getElementById('new-item-type');
const newItemFileInput = document.getElementById('new-item-file');
const newItemSrcInput = document.getElementById('new-item-src');
const newItemDurationInput = document.getElementById('new-item-duration');

const newItemFilePickerInput = document.getElementById('new-item-file-picker');
const importJsonInput = document.getElementById('import-json-input');
const addItemBtn = document.getElementById('add-item-btn');
const itemsList = document.getElementById('items-list');
const itemsEmpty = document.getElementById('items-empty');
const buildJsonBtn = document.getElementById('build-json-btn');
const downloadJsonBtn = document.getElementById('download-json-btn');
const jsonOutput = document.getElementById('json-output');
const saveStatus = document.getElementById('save-status');

let promoState = {
    settings: {
        imageDurationMs: 9000,
        webDurationMs: 22000,
        videoFallbackDurationMs: 30000
    },
    items: []
};

function asPositiveInt(value, fallback) {
    const n = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(n) || n <= 0) {
        return fallback;
    }
    return n;
}

function sanitizeItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const type = String(item.type || '').toLowerCase();
    if (!type) {
        return null;
    }

    const clean = { type };

    if (typeof item.file === 'string' && item.file.trim()) {
        clean.file = item.file.trim();
    }

    if (typeof item.src === 'string' && item.src.trim()) {
        clean.src = item.src.trim();
    }

    if (!clean.file && !clean.src) {
        return null;
    }

    const durationMs = asPositiveInt(item.durationMs, 0);
    if (durationMs > 0) {
        clean.durationMs = durationMs;
    }

    return clean;
}

function normalizePayload(raw) {
    if (Array.isArray(raw)) {
        return {
            settings: {
                imageDurationMs: 9000,
                webDurationMs: 22000,
                videoFallbackDurationMs: 30000
            },
            items: raw
        };
    }

    if (!raw || typeof raw !== 'object') {
        return {
            settings: {
                imageDurationMs: 9000,
                webDurationMs: 22000,
                videoFallbackDurationMs: 30000
            },
            items: []
        };
    }

    return {
        settings: {
            imageDurationMs: asPositiveInt(raw.settings && raw.settings.imageDurationMs, 9000),
            webDurationMs: asPositiveInt(raw.settings && raw.settings.webDurationMs, 22000),
            videoFallbackDurationMs: asPositiveInt(raw.settings && raw.settings.videoFallbackDurationMs, 30000)
        },
        items: Array.isArray(raw.items) ? raw.items : []
    };
}

function renderItems() {
    if (!itemsList || !itemsEmpty) {
        return;
    }

    itemsList.innerHTML = '';

    if (!promoState.items.length) {
        itemsEmpty.hidden = false;
        return;
    }

    itemsEmpty.hidden = true;

    promoState.items.forEach((item, index) => {
        const row = document.createElement('article');
        row.className = 'promo-item-row';

        const info = document.createElement('div');
        info.className = 'promo-item-info';
        const sourceText = item.file ? `file: ${item.file}` : `src: ${item.src}`;
        const durationText = item.durationMs ? ` | duur: ${item.durationMs}ms` : '';
        info.textContent = `${index + 1}. ${item.type} | ${sourceText}${durationText}`;

        const actions = document.createElement('div');
        actions.className = 'promo-item-actions';

        const moveUpBtn = document.createElement('button');
        moveUpBtn.type = 'button';
        moveUpBtn.textContent = 'Omhoog';
        moveUpBtn.disabled = index === 0;
        moveUpBtn.addEventListener('click', () => {
            if (index === 0) return;
            const temp = promoState.items[index - 1];
            promoState.items[index - 1] = promoState.items[index];
            promoState.items[index] = temp;
            renderItems();
            setStatus('Item omhoog verplaatst.');
        });

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type = 'button';
        moveDownBtn.textContent = 'Omlaag';
        moveDownBtn.disabled = index >= promoState.items.length - 1;
        moveDownBtn.addEventListener('click', () => {
            if (index >= promoState.items.length - 1) return;
            const temp = promoState.items[index + 1];
            promoState.items[index + 1] = promoState.items[index];
            promoState.items[index] = temp;
            renderItems();
            setStatus('Item omlaag verplaatst.');
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Verwijderen';
        removeBtn.addEventListener('click', () => {
            promoState.items.splice(index, 1);
            renderItems();
            setStatus('Item verwijderd.');
        });

        actions.appendChild(moveUpBtn);
        actions.appendChild(moveDownBtn);
        actions.appendChild(removeBtn);

        row.appendChild(info);
        row.appendChild(actions);
        itemsList.appendChild(row);
    });
}

function setSettingsFromState() {
    if (settingImageMsInput) settingImageMsInput.value = String(promoState.settings.imageDurationMs);
    if (settingWebMsInput) settingWebMsInput.value = String(promoState.settings.webDurationMs);
    if (settingVideoMsInput) settingVideoMsInput.value = String(promoState.settings.videoFallbackDurationMs);
}

function readSettingsFromForm() {
    promoState.settings.imageDurationMs = asPositiveInt(settingImageMsInput && settingImageMsInput.value, 9000);
    promoState.settings.webDurationMs = asPositiveInt(settingWebMsInput && settingWebMsInput.value, 22000);
    promoState.settings.videoFallbackDurationMs = asPositiveInt(settingVideoMsInput && settingVideoMsInput.value, 30000);
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
            const clean = { type: item.type };
            if (item.file) clean.file = item.file;
            if (item.src) clean.src = item.src;
            if (item.durationMs) clean.durationMs = item.durationMs;
            return clean;
        })
    };
}

function setStatus(text) {
    if (saveStatus) {
        saveStatus.textContent = text;
    }
}

function updateJsonOutput() {
    const payload = buildPayload();
    if (jsonOutput) {
        jsonOutput.value = JSON.stringify(payload, null, 2);
    }
    return payload;
}

function addItemFromForm() {
    const item = sanitizeItem({
        type: newItemTypeInput ? newItemTypeInput.value : 'image',
        file: newItemFileInput ? newItemFileInput.value : '',
        src: newItemSrcInput ? newItemSrcInput.value : '',
        durationMs: newItemDurationInput ? newItemDurationInput.value : ''
    });

    if (!item) {
        setStatus('Vul minimaal een type en file of src in.');
        return;
    }

    promoState.items.push(item);
    renderItems();

    if (newItemFileInput) newItemFileInput.value = '';
    if (newItemSrcInput) newItemSrcInput.value = '';
    if (newItemDurationInput) newItemDurationInput.value = '';

    setStatus('Item toegevoegd. Klik op Opslaan naar JSON om het resultaat te vernieuwen.');
}

function downloadJson() {
    const payload = updateJsonOutput();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'promotie-media.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('JSON gedownload als promotie-media.json.');
}

function loadExistingJson() {
    fetch(`promotie-media.json?_=${Date.now()}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Kon JSON niet laden');
            }
            return response.json();
        })
        .then((rawData) => {
            const normalized = normalizePayload(rawData);
            promoState.settings = normalized.settings;
            promoState.items = normalized.items
                .map((item) => sanitizeItem(item))
                .filter((item) => item !== null);

            setSettingsFromState();
            renderItems();
            updateJsonOutput();
            setStatus('Bestaande promotie-media.json geladen.');
        })
        .catch(() => {
            setSettingsFromState();
            renderItems();
            updateJsonOutput();
            setStatus('Kon promotie-media.json niet laden. Je kunt wel een nieuwe samenstellen.');
        });
}

if (addItemBtn) {
    addItemBtn.addEventListener('click', addItemFromForm);
}

if (newItemFilePickerInput) {
    newItemFilePickerInput.addEventListener('change', () => {
        const file = newItemFilePickerInput.files && newItemFilePickerInput.files[0];
        newItemFilePickerInput.value = '';

        if (!file) {
            return;
        }

        const name = file.name;

        if (newItemFileInput) {
            newItemFileInput.value = name;
        }

        if (newItemSrcInput) {
            newItemSrcInput.value = '';
        }

        const isVideo = /\.(mp4|webm|ogg)$/i.test(name);
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);

        if (newItemTypeInput) {
            if (isVideo) {
                newItemTypeInput.value = 'video';
            } else if (isImage) {
                newItemTypeInput.value = 'image';
            }
        }

        setStatus(`Bestand geselecteerd: ${name}. Controleer het type en klik op Item toevoegen.`);
    });
}

if (importJsonInput) {
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

if (buildJsonBtn) {
    buildJsonBtn.addEventListener('click', () => {
        updateJsonOutput();
        setStatus('JSON bijgewerkt.');
    });
}

if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', downloadJson);
}

loadExistingJson();