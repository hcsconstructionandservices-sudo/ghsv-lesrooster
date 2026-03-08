const weekGridElem = document.getElementById('week-grid');
const bannerDatetimeElem = document.getElementById('banner-datetime');
const weekInstructorsGalleryElem = document.getElementById('week-instructors-gallery');

const orderedDays = [
    'maandag',
    'dinsdag',
    'woensdag',
    'donderdag',
    'vrijdag',
    'zaterdag',
    'zondag'
];

const extraInstructors = [
    { naam: 'Marina', foto: 'marina.jpg' },
    { naam: 'Henk', foto: 'henk.jpg' }
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

function renderInstructorGallery(data) {
    if (!weekInstructorsGalleryElem) return;

    const uniqueInstructors = new Map();

    for (const dayData of data) {
        const lessons = dayData.lessen || [];
        for (const lesson of lessons) {
            const list = lesson.instructeurs || [];
            for (const instructor of list) {
                const key = String(instructor.naam || '').trim().toLowerCase();
                if (!key || uniqueInstructors.has(key)) continue;
                uniqueInstructors.set(key, {
                    naam: instructor.naam,
                    foto: instructor.foto || 'logo-ghsv.jpg'
                });
            }
        }
    }

    for (const instructor of extraInstructors) {
        const key = String(instructor.naam || '').trim().toLowerCase();
        if (!key || uniqueInstructors.has(key)) continue;
        uniqueInstructors.set(key, instructor);
    }

    const instructors = Array.from(uniqueInstructors.values()).sort((a, b) => {
        return a.naam.localeCompare(b.naam, 'nl-NL');
    });

    if (instructors.length === 0) {
        weekInstructorsGalleryElem.innerHTML = '<div class="week-empty">Geen instructeurs gevonden in het rooster.</div>';
        return;
    }

    weekInstructorsGalleryElem.innerHTML = instructors.map((instructor) => {
        return `<article class="week-instructor-card"><img src="img/${instructor.foto}" alt="${instructor.naam}" onerror="this.onerror=null;this.src='img/logo-ghsv.jpg';"><div class="week-instructor-name">${instructor.naam}</div></article>`;
    }).join('');
}

function renderWeek(data) {
    if (!weekGridElem) return;

    renderInstructorGallery(data);

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
            if (weekInstructorsGalleryElem) {
                weekInstructorsGalleryElem.innerHTML = '<div class="week-empty">Instructeurs konden niet geladen worden.</div>';
            }
            if (weekGridElem) {
                weekGridElem.innerHTML = '<section class="week-day"><h2>Fout</h2><div class="week-day-body"><div class="week-empty">Rooster kon niet geladen worden.</div></div></section>';
            }
        });
}

updateBannerClock();
setInterval(updateBannerClock, 1000);
loadWeekOverview();
