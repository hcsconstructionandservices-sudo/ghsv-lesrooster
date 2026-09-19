const promoImage = document.getElementById('promo-image');
const promoVideo = document.getElementById('promo-video');
const promoIframe = document.getElementById('promo-iframe');
const promoEmpty = document.getElementById('promo-empty');
const promoMenuFloating = document.querySelector('.menu-floating');
const promoQuickMenu = document.getElementById('quick-menu');

const DEFAULT_IMAGE_DURATION_MS = 8000;
const DEFAULT_WEB_DURATION_MS = 20000;
const DEFAULT_VIDEO_FALLBACK_DURATION_MS = 30000;
const MENU_AUTO_HIDE_MS = 5000;

let promoMediaList = [];
let promoConfig = {};
let promoIndex = 0;
let promoTimer = null;
let promoMenuHideTimer = null;
let _videoEndedHandler = null;
let _videoErrorHandler = null;
let _iframeType = null;
let _navigating = false;
let _cacheBuster = Date.now();

const DB_NAME = 'ghsv-promo-db';
const DB_STORE = 'items';
const DB_VERSION = 1;
let dbPromise = null;

function clearPromoTimer() { if (promoTimer) { clearTimeout(promoTimer); promoTimer = null; } }
function clearMenuHideTimer() { if (promoMenuHideTimer) { clearTimeout(promoMenuHideTimer); promoMenuHideTimer = null; } }
function hideMenuFloating() { if (!promoMenuFloating) return; if (promoQuickMenu && !promoQuickMenu.hidden) return; promoMenuFloating.classList.add('ngm-auto-hidden'); }
function showMenuFloatingTemporarily() { if (!promoMenuFloating) return; promoMenuFloating.classList.remove('ngm-auto-hidden'); clearMenuHideTimer(); promoMenuHideTimer = setTimeout(hideMenuFloating, MENU_AUTO_HIDE_MS); }
function setupMenuAutoHide() {
    if (!document.body.classList.contains('ngm-fullscreen-page')) return;
    if (!promoMenuFloating) return;
    const wakeEvents = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'click'];
    wakeEvents.forEach((eventName) => document.addEventListener(eventName, showMenuFloatingTemporarily, { passive: true }));
    showMenuFloatingTemporarily();
}
function scheduleNext(delayMs) { clearPromoTimer(); promoTimer = setTimeout(showNext, Math.max(500, delayMs || 0)); }
function hideAllMedia() {
    clearPromoTimer();
    if (promoImage) { promoImage.hidden = true; promoImage.removeAttribute('src'); promoImage.onerror = null; }
    if (promoVideo) {
        if (_videoEndedHandler) { promoVideo.removeEventListener('ended', _videoEndedHandler); _videoEndedHandler = null; }
        if (_videoErrorHandler) { promoVideo.removeEventListener('error', _videoErrorHandler); _videoErrorHandler = null; }
        promoVideo.hidden = true; promoVideo.pause(); promoVideo.removeAttribute('src'); promoVideo.load();
    }
    if (promoIframe) { promoIframe.hidden = true; promoIframe.removeAttribute('src'); _iframeType = null; }
}
function isDirectVideoUrl(src) { return /\.(mp4|webm|ogg)(\?.*)?$/i.test(src); }
function isLikelyVideoStreamUrl(src) { return /\.(m3u8|mpd)(\?.*)?$/i.test(src); }
function isImageUrl(src) { return /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(src); }
function normalizeMediaPath(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    if (/^(\.\/|\.\.\/|img\/)/i.test(trimmed)) return trimmed;
    return `img/${trimmed}`;
}
function getItemKey(item) {
    if (!item || typeof item !== 'object') return '';
    return [item.type || '', item.file || '', item.src || '', item.name || ''].join('|');
}
function resolveSource(item) {
    if (item.blob instanceof Blob) { if (!item._previewUrl) item._previewUrl = URL.createObjectURL(item.blob); return item._previewUrl; }
    const src = typeof item.src === 'string' ? item.src.trim() : '';
    if (src) return src;
    const file = typeof item.file === 'string' ? item.file.trim() : '';
    if (!file) return '';
    const normalized = normalizeMediaPath(file);
    if (/^(https?:\/\/|data:|blob:)/i.test(normalized)) return normalized;
    return normalized.includes('?') ? `${normalized}&v=${_cacheBuster}` : `${normalized}?v=${_cacheBuster}`;
}
function toYoutubeEmbed(url) { try { const parsed = new URL(url); if (parsed.hostname.includes('youtube.com')) { const videoId = parsed.searchParams.get('v'); if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&enablejsapi=1`; const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/i); if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=1&mute=1&rel=0&enablejsapi=1`; } if (parsed.hostname.includes('youtu.be')) { const videoId = parsed.pathname.replace('/', '').trim(); if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&enablejsapi=1`; } } catch (error) { return null; } return null; }
function toVimeoEmbed(url) { try { const parsed = new URL(url); if (!parsed.hostname.includes('vimeo.com')) return null; const match = parsed.pathname.match(/\/(\d+)/); if (!match) return null; return `https://player.vimeo.com/video/${match[1]}?autoplay=1&muted=1`; } catch (error) { return null; } }
function toWebVideoEmbed(url) { const yt = toYoutubeEmbed(url); if (yt) return { embedUrl: yt, type: 'youtube' }; const vimeo = toVimeoEmbed(url); if (vimeo) return { embedUrl: vimeo, type: 'vimeo' }; return { embedUrl: url, type: null }; }
function getConfigDuration(type, itemDuration) { const settings = promoConfig && typeof promoConfig.settings === 'object' ? promoConfig.settings : {}; if (type === 'web' || type === 'video') return 2147483647; if (typeof itemDuration === 'number' && Number.isFinite(itemDuration) && itemDuration > 0) return itemDuration; if (type === 'image' && typeof settings.imageDurationMs === 'number' && settings.imageDurationMs > 0) return settings.imageDurationMs; if (type === 'image') return DEFAULT_IMAGE_DURATION_MS; return DEFAULT_WEB_DURATION_MS; }
function showNext() { if (_navigating) return; _navigating = true; clearPromoTimer(); if (!promoMediaList.length) { if (promoEmpty) { promoEmpty.hidden = false; promoEmpty.textContent = 'Geen actieve promotie-items gevonden.'; } _navigating = false; return; } promoIndex = (promoIndex + 1) % promoMediaList.length; _navigating = false; showCurrent(); }
function showCurrent() {
    if (!promoMediaList.length) return;

    const item = promoMediaList[promoIndex] || {};
    const type = String(item.type || '').toLowerCase();
    const src = resolveSource(item);
    const isHttpUrl = /^https?:\/\//i.test(src);
    const isImage = type === 'image' || (type !== 'video' && type !== 'web' && !type.startsWith('web') && isImageUrl(src));
    const isVideoSource = type === 'video' || isDirectVideoUrl(src) || isLikelyVideoStreamUrl(src);
    const isWebType = type === 'web' || type === 'webvideo';
    const isWebPage = isWebType || (isHttpUrl && !isVideoSource && !isImage);

    hideAllMedia();
    if (promoEmpty) promoEmpty.hidden = true;

    if (!src) {
        scheduleNext(1000);
        return;
    }

    if (isImage && promoImage) {
        promoImage.onerror = () => { clearPromoTimer(); showNext(); };
        promoImage.src = src;
        promoImage.hidden = false;
        scheduleNext(getConfigDuration('image', item.durationMs));
        return;
    }

    // Play direct video links in the video element, including webvideo items with .mp4/.m3u8/etc.
    if (isVideoSource && promoVideo) {
        if (_videoEndedHandler) promoVideo.removeEventListener('ended', _videoEndedHandler);
        if (_videoErrorHandler) promoVideo.removeEventListener('error', _videoErrorHandler);

        _videoEndedHandler = () => {
            clearPromoTimer();
            promoVideo.removeEventListener('ended', _videoEndedHandler);
            promoVideo.removeEventListener('error', _videoErrorHandler);
            _videoEndedHandler = null;
            _videoErrorHandler = null;
            showNext();
        };

        _videoErrorHandler = () => {
            clearPromoTimer();
            promoVideo.removeEventListener('ended', _videoEndedHandler);
            promoVideo.removeEventListener('error', _videoErrorHandler);
            _videoEndedHandler = null;
            _videoErrorHandler = null;
            showNext();
        };

        promoVideo.addEventListener('ended', _videoEndedHandler);
        promoVideo.addEventListener('error', _videoErrorHandler);
        promoVideo.src = src;
        promoVideo.hidden = false;
        promoVideo.load();
        promoVideo.play().catch(() => {});
        return;
    }

    if (isWebPage && promoIframe) {
        const embed = toWebVideoEmbed(src);
        promoIframe.src = embed.embedUrl;
        promoIframe.hidden = false;
        _iframeType = embed.type;
        return;
    }

    scheduleNext(1000);
}
function normalizePayload(raw) { if (Array.isArray(raw)) return { settings: {}, items: raw }; if (raw && typeof raw === 'object') { const items = Array.isArray(raw.items) ? raw.items : []; const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {}; return { settings, items }; } return { settings: {}, items: [] }; }
function loadPromoItemsFromDb() { if (!dbPromise) { dbPromise = new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } return dbPromise.then((db) => new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, 'readonly'); const store = tx.objectStore(DB_STORE); const request = store.getAll(); request.onsuccess = () => resolve((request.result || []).filter((item) => item && typeof item === 'object')); request.onerror = () => reject(request.error); })); }
function startPromoPlaylist(data) { const payload = normalizePayload(data); const currentItem = promoMediaList[promoIndex] || null; const currentKey = getItemKey(currentItem); promoConfig = payload; promoMediaList = payload.items.filter((item) => item && typeof item === 'object' && item.active !== false); _cacheBuster = Date.now(); if (!promoMediaList.length) { promoIndex = 0; hideAllMedia(); if (promoEmpty) { promoEmpty.hidden = false; promoEmpty.textContent = 'Geen zichtbare promotie-items. Zet een item op Toon op promotiepagina.'; } return; } const nextIndex = currentKey ? promoMediaList.findIndex((item) => getItemKey(item) === currentKey) : -1; const shouldKeepCurrentDisplay = currentKey && nextIndex >= 0; promoIndex = nextIndex >= 0 ? nextIndex : Math.min(promoIndex, promoMediaList.length - 1); if (shouldKeepCurrentDisplay) return; showCurrent(); }
function refreshPromoPlaylist() { return fetch('./promotie-media.json?_=' + Date.now(), { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('Kon JSON niet laden'); return response.json(); }).then((data) => { startPromoPlaylist(data); }).catch(() => { return loadPromoItemsFromDb().then((items) => { if (items.length) { startPromoPlaylist({ settings: {}, items }); return; } throw new Error('No promo data'); }); }); }
window.addEventListener('message', (event) => { if (!_iframeType) return; const origin = String(event.origin || ''); if (_iframeType === 'youtube' && origin.includes('youtube.com')) { try { const data = JSON.parse(event.data); if (data.event === 'onStateChange' && data.info === 0) { clearPromoTimer(); showNext(); } } catch (error) {} } if (_iframeType === 'vimeo' && origin.includes('vimeo.com')) { try { const data = JSON.parse(event.data); if (data.event === 'finish') { clearPromoTimer(); showNext(); } } catch (error) {} } });
function boot() { refreshPromoPlaylist().catch(() => { if (promoEmpty) { promoEmpty.hidden = false; promoEmpty.textContent = 'Kon promotie-media.json niet laden.'; } }); setupMenuAutoHide(); window.addEventListener('focus', () => { refreshPromoPlaylist().catch(() => {}); }); setInterval(() => { refreshPromoPlaylist().catch(() => {}); }, 5000); }
boot();