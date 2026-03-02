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
    'Welkom bij de GHSV!',
    'Schrijf je nu op onze website! Scan de QR-code of ga naar onze inschrijfpagina.',
    'Volg ons op Facebook en Instagram voor nieuws!',
    'Laat een riem op maat maken, vraag ernaar bij de instructeurs!',
    'Vergeet niet de examendag in de agenda te zetten!',
    '2 mei hebben we de RtM-dag, een dag vol leuke activiteiten en wedstrijden!',
    '30 mei de Bontehondendag, een gezellige dag vol demonstraties, spelletjes en kraampjes!',
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

    // komende lessen
    upcomingLessonsElem.innerHTML = upcoming.slice(0, 3).map(renderLesson).join('');
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
    return `<div class="lesson">
        <div class="lesson-title">${les.titel}</div>
        <div class="lesson-time">${les.start} - ${les.eind}</div>
        ${instructorsHtml}
    </div>`;
}

// ...existing code...

// Rooster ophalen en refreshen
function refreshData() {
    fetchRooster();
    setTimeout(refreshData, refreshInterval);
}
refreshData();
