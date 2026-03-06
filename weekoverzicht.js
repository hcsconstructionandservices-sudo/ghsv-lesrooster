const weekGridElem = document.getElementById('week-grid');
const bannerDatetimeElem = document.getElementById('banner-datetime');

const orderedDays = [
    'maandag',
    'dinsdag',
    'woensdag',
    'donderdag',
    'vrijdag',
    'zaterdag',
    'zondag'
];

function toMinutes(timeValue) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    return (hours * 60) + minutes;
}

function formatInstructors(lesson) {
    if (!lesson.instructeurs || lesson.instructeurs.length === 0) {
        return 'Instructeur: n.v.t.';
    }

    const names = lesson.instructeurs.map((instr) => instr.naam).join(', ');
    return `Instructeur(s): ${names}`;
}

function renderWeek(data) {
    if (!weekGridElem) return;

    const byDay = new Map();
    for (const dayData of data) {
        byDay.set(dayData.dag, dayData.lessen || []);
    }

    const sections = orderedDays.map((dayName) => {
        const lessons = (byDay.get(dayName) || []).slice().sort((a, b) => {
            return toMinutes(a.start) - toMinutes(b.start);
        });

        if (lessons.length === 0) {
            return '';
        }

        const lessonsHtml = lessons.map((lesson) => {
            return `<article class="week-lesson"><div class="week-time">${lesson.start} - ${lesson.eind}</div><div class="week-title">${lesson.titel}</div><div class="week-instructors">${formatInstructors(lesson)}</div></article>`;
        }).join('');

        return `<section class="week-day"><h2>${dayName}</h2><div class="week-day-body">${lessonsHtml}</div></section>`;
    });

    const visibleSections = sections.filter((sectionHtml) => sectionHtml !== '');

    if (visibleSections.length === 0) {
        weekGridElem.innerHTML = '<section class="week-day"><h2>Weekoverzicht</h2><div class="week-day-body"><div class="week-empty">Er zijn geen lessen ingepland.</div></div></section>';
        return;
    }

    weekGridElem.innerHTML = visibleSections.join('');
}

function getBannerDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return `${dateStr} | ${timeStr}`;
}

function updateBannerClock() {
    if (bannerDatetimeElem) {
        bannerDatetimeElem.textContent = getBannerDateTime();
    }
}

function loadWeekOverview() {
    fetch(`rooster.json?_=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => renderWeek(data))
        .catch(() => {
            if (weekGridElem) {
                weekGridElem.innerHTML = '<section class="week-day"><h2>Fout</h2><div class="week-day-body"><div class="week-empty">Rooster kon niet geladen worden.</div></div></section>';
            }
        });
}

updateBannerClock();
setInterval(updateBannerClock, 1000);
loadWeekOverview();
