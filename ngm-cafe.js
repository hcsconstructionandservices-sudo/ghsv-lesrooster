const ngmAdImage = document.getElementById('ngm-ad-image');
const ngmAdVideo = document.getElementById('ngm-ad-video');
const ngmAdIframe = document.getElementById('ngm-ad-iframe');
const ngmAdEmpty = document.getElementById('ngm-ad-empty');
const ngmMenuFloating = document.querySelector('.menu-floating');
const ngmQuickMenu = document.getElementById('quick-menu');

const IMAGE_DURATION_MS = 8000;
const WEB_VIDEO_DURATION_MS = 20000;
const VIDEO_FALLBACK_DURATION_MS = 30000;
const MENU_AUTO_HIDE_MS = 5000;

let ngmMediaList = [];
let ngmMediaIndex = 0;
let ngmTimer = null;
let ngmMenuHideTimer = null;

function clearNgmTimer() {
    if (ngmTimer) {
        clearTimeout(ngmTimer);
        ngmTimer = null;
    }
}

function clearMenuHideTimer() {
    if (ngmMenuHideTimer) {
        clearTimeout(ngmMenuHideTimer);
        ngmMenuHideTimer = null;
    }
}

function hideMenuFloating() {
    if (!ngmMenuFloating) return;
    if (ngmQuickMenu && !ngmQuickMenu.hidden) return;
    ngmMenuFloating.classList.add('ngm-auto-hidden');
}

function showMenuFloatingTemporarily() {
    if (!ngmMenuFloating) return;
    ngmMenuFloating.classList.remove('ngm-auto-hidden');
    clearMenuHideTimer();
    ngmMenuHideTimer = setTimeout(hideMenuFloating, MENU_AUTO_HIDE_MS);
}

function setupMenuAutoHide() {
    if (!document.body.classList.contains('ngm-fullscreen-page')) return;
    if (!ngmMenuFloating) return;

    const wakeEvents = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'click'];
    wakeEvents.forEach((eventName) => {
        document.addEventListener(eventName, showMenuFloatingTemporarily, { passive: true });
    });

    if (ngmQuickMenu) {
        ngmQuickMenu.addEventListener('transitionend', showMenuFloatingTemporarily);
    }

    showMenuFloatingTemporarily();
}

function scheduleNext(delayMs) {
    clearNgmTimer();
    ngmTimer = setTimeout(moveNext, delayMs);
}

function hideAllMedia() {
    clearNgmTimer();

    if (ngmAdImage) {
        ngmAdImage.hidden = true;
        ngmAdImage.removeAttribute('src');
    }

    if (ngmAdVideo) {
        ngmAdVideo.hidden = true;
        ngmAdVideo.pause();
        ngmAdVideo.removeAttribute('src');
        ngmAdVideo.load();
    }

    if (ngmAdIframe) {
        ngmAdIframe.hidden = true;
        ngmAdIframe.removeAttribute('src');
    }
}

function isDirectVideoUrl(src) {
    return /\.mp4(\?.*)?$/i.test(src);
}

function toYoutubeEmbed(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes('youtube.com')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0`;
            }

            const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/i);
            if (shortsMatch) {
                return `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=1&mute=1&rel=0`;
            }
        }

        if (parsed.hostname.includes('youtu.be')) {
            const videoId = parsed.pathname.replace('/', '').trim();
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0`;
            }
        }
    } catch (error) {
        return null;
    }

    return null;
}

function toVimeoEmbed(url) {
    if (!url) return null;

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
    return toYoutubeEmbed(url) || toVimeoEmbed(url) || url;
}

function moveNext() {
    if (ngmMediaList.length === 0) return;
    ngmMediaIndex = (ngmMediaIndex + 1) % ngmMediaList.length;
    showCurrentMedia();
}

function showCurrentMedia() {
    if (ngmMediaList.length === 0) {
        if (ngmAdEmpty) {
            ngmAdEmpty.hidden = false;
            ngmAdEmpty.textContent = 'Geen geselecteerde reclame gevonden.';
        }
        return;
    }

    const media = ngmMediaList[ngmMediaIndex];
    const type = (media.type || '').toLowerCase();
    const src = media.src || '';
    const isImage = type === 'image' || /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(src);
    const isMp4 = isDirectVideoUrl(src);
    const isHttpUrl = /^https?:\/\//i.test(src);
    const shouldUseIframe = type === 'webvideo' || (isHttpUrl && !isMp4 && type !== 'image');

    hideAllMedia();

    if (ngmAdEmpty) {
        ngmAdEmpty.hidden = true;
    }

    if (isImage && ngmAdImage) {
        ngmAdImage.onerror = () => moveNext();
        ngmAdImage.src = src;
        ngmAdImage.hidden = false;
        scheduleNext(IMAGE_DURATION_MS);
        return;
    }

    if ((type === 'video' || isMp4) && ngmAdVideo && !shouldUseIframe) {
        const onEnded = () => {
            ngmAdVideo.removeEventListener('ended', onEnded);
            ngmAdVideo.removeEventListener('error', onError);
            moveNext();
        };

        const onError = () => {
            ngmAdVideo.removeEventListener('ended', onEnded);
            ngmAdVideo.removeEventListener('error', onError);
            moveNext();
        };

        ngmAdVideo.addEventListener('ended', onEnded);
        ngmAdVideo.addEventListener('error', onError);
        ngmAdVideo.src = src;
        ngmAdVideo.hidden = false;
        ngmAdVideo.load();
        scheduleNext(VIDEO_FALLBACK_DURATION_MS);
        ngmAdVideo.play().catch(() => {
            scheduleNext(WEB_VIDEO_DURATION_MS);
        });
        return;
    }

    if (shouldUseIframe && ngmAdIframe) {
        ngmAdIframe.src = toWebVideoEmbed(src);
        ngmAdIframe.hidden = false;
        scheduleNext(WEB_VIDEO_DURATION_MS);
        return;
    }

    scheduleNext(1000);
}

function parseMediaData(rawData) {
    if (Array.isArray(rawData)) {
        return rawData;
    }

    if (typeof rawData === 'string') {
        try {
            const parsed = JSON.parse(rawData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    return [];
}

function loadMediaViaFetch(filePath) {
    return fetch(`${filePath}?_=${Date.now()}`).then((response) => {
        if (!response.ok) {
            throw new Error('Fetch failed');
        }
        return response.json();
    });
}

function loadMediaViaXhr(filePath) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', `${filePath}?_=${Date.now()}`, true);
        request.onreadystatechange = () => {
            if (request.readyState !== 4) return;
            const hasBody = typeof request.responseText === 'string' && request.responseText.trim().length > 0;
            if ((request.status >= 200 && request.status < 300) || (request.status === 0 && hasBody)) {
                resolve(request.responseText);
                return;
            }
            reject(new Error('XHR failed'));
        };
        request.onerror = () => reject(new Error('XHR network error'));
        request.send();
    });
}

function loadMediaFile(filePath) {
    return loadMediaViaFetch(filePath).catch(() => {
        return loadMediaViaXhr(filePath);
    });
}

function startPlaylistFromData(data) {
    ngmMediaList = parseMediaData(data);
    ngmMediaIndex = 0;
    showCurrentMedia();
}

function loadNgmAdMedia() {
    loadMediaFile('./ngm-admedia.json')
        .then((data) => {
            startPlaylistFromData(data);
        })
        .catch(() => {
            loadMediaFile('./admedia.json')
                .then((data) => {
                    startPlaylistFromData(data);
                })
                .catch(() => {
                    if (ngmAdEmpty) {
                        ngmAdEmpty.hidden = false;
                        ngmAdEmpty.textContent = 'Reclame kon niet geladen worden.';
                    }
                });
        });
}

loadNgmAdMedia();
setupMenuAutoHide();
