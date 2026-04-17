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

// Persistent video listener refs to prevent accumulation across items.
let _videoEndedHandler = null;
let _videoErrorHandler = null;

// Tracks whether the current iframe is a YouTube or Vimeo embed so the
// postMessage listener knows whether to act on end-of-video events.
let _iframeType = null; // 'youtube' | 'vimeo' | null

// Guard flag: prevents showNext() from firing more than once per item.
let _navigating = false;

function clearPromoTimer() {
    if (promoTimer) {
        clearTimeout(promoTimer);
        promoTimer = null;
    }
}

function clearMenuHideTimer() {
    if (promoMenuHideTimer) {
        clearTimeout(promoMenuHideTimer);
        promoMenuHideTimer = null;
    }
}

function hideMenuFloating() {
    if (!promoMenuFloating) return;
    if (promoQuickMenu && !promoQuickMenu.hidden) return;
    promoMenuFloating.classList.add('ngm-auto-hidden');
}

function showMenuFloatingTemporarily() {
    if (!promoMenuFloating) return;
    promoMenuFloating.classList.remove('ngm-auto-hidden');
    clearMenuHideTimer();
    promoMenuHideTimer = setTimeout(hideMenuFloating, MENU_AUTO_HIDE_MS);
}

function setupMenuAutoHide() {
    if (!document.body.classList.contains('ngm-fullscreen-page')) return;
    if (!promoMenuFloating) return;

    const wakeEvents = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'click'];
    wakeEvents.forEach((eventName) => {
        document.addEventListener(eventName, showMenuFloatingTemporarily, { passive: true });
    });

    showMenuFloatingTemporarily();
}

function scheduleNext(delayMs) {
    clearPromoTimer();
    promoTimer = setTimeout(showNext, Math.max(500, delayMs || 0));
}

function hideAllMedia() {
    clearPromoTimer();

    if (promoImage) {
        promoImage.hidden = true;
        promoImage.removeAttribute('src');
        promoImage.onerror = null;
    }

    if (promoVideo) {
        // Remove any lingering event listeners before hiding.
        if (_videoEndedHandler) {
            promoVideo.removeEventListener('ended', _videoEndedHandler);
            _videoEndedHandler = null;
        }
        if (_videoErrorHandler) {
            promoVideo.removeEventListener('error', _videoErrorHandler);
            _videoErrorHandler = null;
        }
        promoVideo.hidden = true;
        promoVideo.pause();
        promoVideo.removeAttribute('src');
        promoVideo.load();
    }

    if (promoIframe) {
        promoIframe.hidden = true;
        promoIframe.removeAttribute('src');
        _iframeType = null;
    }
}

function isDirectVideoUrl(src) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);
}

function isImageUrl(src) {
    return /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(src);
}

function resolveSource(item) {
    const src = typeof item.src === 'string' ? item.src.trim() : '';
    if (src) {
        return src;
    }

    const file = typeof item.file === 'string' ? item.file.trim() : '';
    if (!file) {
        return '';
    }

    if (/^(https?:\/\/|\.\/|\.\.\/|img\/)/i.test(file)) {
        return file;
    }

    return `img/${file}`;
}

function toYoutubeEmbed(url) {
    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes('youtube.com')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&enablejsapi=1`;
            }

            const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/i);
            if (shortsMatch) {
                return `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=1&mute=1&rel=0&enablejsapi=1`;
            }
        }

        if (parsed.hostname.includes('youtu.be')) {
            const videoId = parsed.pathname.replace('/', '').trim();
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&enablejsapi=1`;
            }
        }
    } catch (error) {
        return null;
    }

    return null;
}

function toVimeoEmbed(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('vimeo.com')) {
            return null;
        }

        const match = parsed.pathname.match(/\/(\d+)/);
        if (!match) {
            return null;
        }

        return `https://player.vimeo.com/video/${match[1]}?autoplay=1&muted=1`;
    } catch (error) {
        return null;
    }
}

function toWebVideoEmbed(url) {
    const yt = toYoutubeEmbed(url);
    if (yt) return { embedUrl: yt, type: 'youtube' };

    const vimeo = toVimeoEmbed(url);
    if (vimeo) return { embedUrl: vimeo, type: 'vimeo' };

    return { embedUrl: url, type: null };
}

function getConfigDuration(type, itemDuration) {
    if (typeof itemDuration === 'number' && Number.isFinite(itemDuration) && itemDuration > 0) {
        return itemDuration;
    }

    const settings = promoConfig && typeof promoConfig.settings === 'object' ? promoConfig.settings : {};

    if (type === 'image' && typeof settings.imageDurationMs === 'number' && settings.imageDurationMs > 0) {
        return settings.imageDurationMs;
    }

    if (type === 'web' && typeof settings.webDurationMs === 'number' && settings.webDurationMs > 0) {
        return settings.webDurationMs;
    }

    if (type === 'video' && typeof settings.videoFallbackDurationMs === 'number' && settings.videoFallbackDurationMs > 0) {
        return settings.videoFallbackDurationMs;
    }

    if (type === 'image') return DEFAULT_IMAGE_DURATION_MS;
    if (type === 'web') return DEFAULT_WEB_DURATION_MS;
    return DEFAULT_VIDEO_FALLBACK_DURATION_MS;
}

function showNext() {
    if (_navigating) return;
    _navigating = true;

    clearPromoTimer();

    if (!promoMediaList.length) {
        if (promoEmpty) {
            promoEmpty.hidden = false;
            promoEmpty.textContent = 'Geen promotie-items gevonden in promotie-media.json.';
        }
        _navigating = false;
        return;
    }

    promoIndex = (promoIndex + 1) % promoMediaList.length;
    _navigating = false;
    showCurrent();
}

function showCurrent() {
    if (!promoMediaList.length) {
        return;
    }

    const item = promoMediaList[promoIndex] || {};
    const type = String(item.type || '').toLowerCase();
    const src = resolveSource(item);
    const isHttpUrl = /^https?:\/\//i.test(src);
    const isImage = type === 'image' || (type !== 'video' && type !== 'web' && isImageUrl(src));
    const isDirectVideo = type === 'video' || isDirectVideoUrl(src);
    const isWeb = type === 'web' || type === 'webvideo' || (isHttpUrl && !isDirectVideo && !isImage);

    hideAllMedia();
    if (promoEmpty) {
        promoEmpty.hidden = true;
    }

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

    if (isDirectVideo && promoVideo && !isWeb) {
        // Remove any previously attached handlers before adding new ones.
        if (_videoEndedHandler) {
            promoVideo.removeEventListener('ended', _videoEndedHandler);
        }
        if (_videoErrorHandler) {
            promoVideo.removeEventListener('error', _videoErrorHandler);
        }

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
        // Fallback timer in case the video stalls or gets stuck.
        scheduleNext(getConfigDuration('video', item.durationMs));
        promoVideo.play().catch(() => {
            scheduleNext(DEFAULT_WEB_DURATION_MS);
        });
        return;
    }

    if (isWeb && promoIframe) {
        const embed = toWebVideoEmbed(src);
        promoIframe.src = embed.embedUrl;
        promoIframe.hidden = false;
        _iframeType = embed.type;
        // Fallback timer for when postMessage events are unavailable.
        scheduleNext(getConfigDuration('web', item.durationMs));
        return;
    }

    scheduleNext(1000);
}

function normalizePayload(raw) {
    if (Array.isArray(raw)) {
        return {
            settings: {},
            items: raw
        };
    }

    if (raw && typeof raw === 'object') {
        const items = Array.isArray(raw.items) ? raw.items : [];
        const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
        return { settings, items };
    }

    return { settings: {}, items: [] };
}

function parseJsonText(jsonText) {
    try {
        return JSON.parse(jsonText);
    } catch (error) {
        return null;
    }
}

function loadViaFetch(filePath) {
    return fetch(`${filePath}?_=${Date.now()}`).then((response) => {
        if (!response.ok) {
            throw new Error('Fetch failed');
        }
        return response.json();
    });
}

function loadViaXhr(filePath) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', `${filePath}?_=${Date.now()}`, true);
        request.onreadystatechange = () => {
            if (request.readyState !== 4) return;

            const hasBody = typeof request.responseText === 'string' && request.responseText.trim().length > 0;
            if ((request.status >= 200 && request.status < 300) || (request.status === 0 && hasBody)) {
                const parsed = parseJsonText(request.responseText);
                if (parsed !== null) {
                    resolve(parsed);
                    return;
                }
            }

            reject(new Error('XHR failed'));
        };
        request.onerror = () => reject(new Error('XHR network error'));
        request.send();
    });
}

function loadPromoMedia(filePath) {
    return loadViaFetch(filePath).catch(() => loadViaXhr(filePath));
}

function startPromoPlaylist(data) {
    const payload = normalizePayload(data);
    promoConfig = payload;
    promoMediaList = payload.items.filter((item) => item && typeof item === 'object');
    promoIndex = 0;
    showCurrent();
}

// Listen for YouTube / Vimeo end-of-video events via postMessage so we can
// immediately move to the next item instead of waiting for the fallback timer.
window.addEventListener('message', (event) => {
    if (!_iframeType) return;

    const origin = String(event.origin || '');

    // YouTube sends a JSON string with event + info fields.
    if (_iframeType === 'youtube' && origin.includes('youtube.com')) {
        try {
            const data = JSON.parse(event.data);
            // YT.PlayerState.ENDED === 0
            if (data.event === 'onStateChange' && data.info === 0) {
                clearPromoTimer();
                showNext();
            }
        } catch (error) {
            // Not a JSON message; ignore.
        }
    }

    // Vimeo sends a JSON string with event === 'finish'.
    if (_iframeType === 'vimeo' && origin.includes('vimeo.com')) {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'finish') {
                clearPromoTimer();
                showNext();
            }
        } catch (error) {
            // Not a JSON message; ignore.
        }
    }
});

function boot() {
    loadPromoMedia('./promotie-media.json')
        .then((data) => {
            startPromoPlaylist(data);
        })
        .catch(() => {
            if (promoEmpty) {
                promoEmpty.hidden = false;
                promoEmpty.textContent = 'Kon promotie-media.json niet laden.';
            }
        });

    setupMenuAutoHide();
}

boot();