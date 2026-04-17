// Reclame-overlay
const adOverlay = document.getElementById('ad-overlay');
const adImage = document.getElementById('ad-image');
const adVideo = document.getElementById('ad-video');
const adDatetimeElem = document.getElementById('ad-datetime');
const menuToggleBtn = document.getElementById('menu-toggle');
const quickMenuElem = document.getElementById('quick-menu');
const menuRefreshBtn = document.getElementById('menu-refresh');
const menuShowAdBtn = document.getElementById('menu-show-ad');
const menuHideAdBtn = document.getElementById('menu-hide-ad');
let adMedia = [];
let adIndex = 0;
let adTimeout = null;

function closeQuickMenu() {
    if (!quickMenuElem || !menuToggleBtn) return;
    quickMenuElem.hidden = true;
    menuToggleBtn.setAttribute('aria-expanded', 'false');
}

if (menuToggleBtn && quickMenuElem) {
    menuToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !quickMenuElem.hidden;
        quickMenuElem.hidden = isOpen;
        menuToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    quickMenuElem.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', () => {
        closeQuickMenu();
    });
}

function fetchAdMedia() {
    fetch('admedia.json?_=' + Date.now())
        .then(res => res.json())
        .then(data => {
            adMedia = data;
            adIndex = 0;
        });
}

function showAd() {
    if (!adOverlay || adMedia.length === 0) return;
    const media = adMedia[adIndex];
    if (adTimeout) {
        clearTimeout(adTimeout);
        adTimeout = null;
    }
    if (media.type === 'image' && adImage) {
        adImage.src = media.src;
        adImage.style.display = 'block';
        if (adVideo) adVideo.style.display = 'none';
        adOverlay.style.display = 'flex';
        adTimeout = setTimeout(() => {
            hideAd();
            adIndex = (adIndex + 1) % adMedia.length;
        }, 10000); // afbeelding 10 seconden tonen
    } else if (media.type === 'video' && adVideo) {
        adVideo.src = media.src;
        adVideo.style.display = 'block';
        adVideo.currentTime = 0;
        adVideo.play();
        if (adImage) adImage.style.display = 'none';
        adOverlay.style.display = 'flex';
        // Wacht tot video klaar is met afspelen
        const onEnded = () => {
            hideAd();
            adIndex = (adIndex + 1) % adMedia.length;
            adVideo.removeEventListener('ended', onEnded);
        };
        adVideo.addEventListener('ended', onEnded);
    }
}
function hideAd() {
    if (adOverlay) adOverlay.style.display = 'none';
    if (adTimeout) {
        clearTimeout(adTimeout);
        adTimeout = null;
    }
    if (adVideo) {
        adVideo.pause();
        adVideo.currentTime = 0;
    }
}

fetchAdMedia();
// Start automatische rotatie van advertenties
setInterval(() => {
    // Alleen nieuwe ad tonen als er geen overlay zichtbaar is
    if (!adOverlay || adOverlay.style.display === 'none') {
        showAd();
    }
}, 30000); // elke 30 seconden
const bannerDateElem = document.getElementById('banner-date');
const bannerClockElem = document.getElementById('banner-clock');
const currentLessonElem = document.getElementById('current-lesson-content');
const upcomingLessonsElem = document.getElementById('upcoming-lessons-content');

// QR-code genereren voor inschrijflink
const qrCodeElem = document.getElementById('qr-code');
const inschrijfUrl = 'https://www.ghsv.nl/contact-info-inschrijven-cursus-lidmaatschap/';
if (qrCodeElem) {
    // Gebruik een gratis QR-code API
    qrCodeElem.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(inschrijfUrl)}`;
}

// Banner-meldingen rouleren, datum en tijd links
const bannerMessages = [
    'Welkom bij de GHSV Harderwijk!',
    'Schrijf je in op onze website! Scan de QR-code of ga naar onze inschrijfpagina.',
    'Volg ons op Facebook en Instagram voor nieuws!',
    'Laat een riem op maat maken, vraag ernaar bij de instructeurs!',
    'Vergeet niet de examendag in de agenda te zetten!',
    'Wij zoeken hulp, wordt vrijwilliger en help mee met activiteiten en evenementen!',
    '2 mei hebben we de RtM-dag, een dag vol leuke activiteiten en wedstrijden!',
    'Uw reclame ook langs het veld? Neem contact op voor sponsormogelijkheden!',
    '30 mei de Bontehondendag, een gezellige dag vol demonstraties, spelletjes en kraampjes!'
];
let bannerIndex = 0;
const bannerElem = document.getElementById('banner-message');
const bannerDatetimeElem = document.getElementById('banner-datetime');
function getBannerDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr} | ${timeStr}`;
}
function updateBannerMessage() {
    if (bannerElem) {
        bannerElem.textContent = bannerMessages[bannerIndex];
        bannerIndex = (bannerIndex + 1) % bannerMessages.length;
    }
}
function updateBannerClock() {
    if (bannerDatetimeElem) {
        bannerDatetimeElem.textContent = getBannerDateTime();
    }
    if (adDatetimeElem) {
        adDatetimeElem.textContent = getBannerDateTime();
    }
}
setInterval(updateBannerClock, 1000);
setInterval(updateBannerMessage, 5000);
updateBannerClock();
updateBannerMessage();

let roosterData = [];
let refreshInterval = 60 * 1000; // 1 minuut

// ...existing code...

function fetchRooster() {
    fetch('rooster.json?_=' + Date.now())
        .then(res => res.json())
        .then(data => {
            roosterData = data;
            renderLessons();
        })
        .catch(() => {
            currentLessonElem.textContent = 'Kan rooster niet laden.';
            upcomingLessonsElem.textContent = '';
        });
}

if (menuRefreshBtn) {
    menuRefreshBtn.addEventListener('click', () => {
        fetchRooster();
        fetchAdMedia();
        closeQuickMenu();
    });
}

if (menuShowAdBtn) {
    menuShowAdBtn.addEventListener('click', () => {
        showAd();
        closeQuickMenu();
    });
}

if (menuHideAdBtn) {
    menuHideAdBtn.addEventListener('click', () => {
        hideAd();
        closeQuickMenu();
    });
}

function renderLessons() {
    const now = new Date();
    const daysNl = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const today = daysNl[now.getDay()];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let current = [];
    let upcoming = [];

    // Zoek de lessen van vandaag
    const dagData = roosterData.find(d => d.dag === today);
    if (dagData && dagData.lessen) {
        for (const les of dagData.lessen) {
            const startParts = les.start.split(':');
            const endParts = les.eind.split(':');
            const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
            if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
                current.push(les);
            } else if (startMinutes > nowMinutes) {
                upcoming.push(les);
            }
        }
    }

    // huidige les
    if (current.length > 0) {
        currentLessonElem.innerHTML = current.map(renderLesson).join('');
    } else {
        currentLessonElem.textContent = 'Er is op dit moment geen les.';
    }

    // komende lessen gesorteerd op tijd
    upcoming.sort((a, b) => {
        const aStart = parseInt(a.start.split(':')[0]) * 60 + parseInt(a.start.split(':')[1]);
        const bStart = parseInt(b.start.split(':')[0]) * 60 + parseInt(b.start.split(':')[1]);
        return aStart - bStart;
    });
    upcomingLessonsElem.innerHTML = upcoming.map(renderLesson).join('');
}

function renderLesson(les) {
    let instructorsHtml = '';
    if (les.instructeurs && les.instructeurs.length) {
        instructorsHtml = les.instructeurs.map(instr =>
            `<div class="instructor">
                <img src="img/${instr.foto || 'placeholder.png'}" alt="${instr.naam}">
                <span>${instr.naam}</span>
            </div>`
        ).join('');
    }

    let pakwerkersHtml = '';
    if (les.pakwerkers && les.pakwerkers.length) {
        pakwerkersHtml = les.pakwerkers.map(pakwerker =>
            `<div class="instructor pakwerker">
                <img src="img/${pakwerker.foto || 'placeholder.png'}" alt="${pakwerker.naam}">
                <span>Pakwerker: ${pakwerker.naam}</span>
            </div>`
        ).join('');
    }

    return `<div class="lesson">
        <div class="lesson-title">${les.titel}</div>
        <div class="lesson-time">${les.start} - ${les.eind}</div>
        ${instructorsHtml}
        ${pakwerkersHtml}
    </div>`;
}

// ...existing code...

// Rooster ophalen en refreshen
function refreshData() {
    fetchRooster();
    setTimeout(refreshData, refreshInterval);
}
refreshData();
