const menuToggleBtn = document.getElementById('menu-toggle');
const quickMenuElem = document.getElementById('quick-menu');

if (menuToggleBtn && quickMenuElem) {
    const closeQuickMenu = () => {
        quickMenuElem.hidden = true;
        menuToggleBtn.setAttribute('aria-expanded', 'false');
    };

    menuToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !quickMenuElem.hidden;
        quickMenuElem.hidden = isOpen;
        menuToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    quickMenuElem.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', closeQuickMenu);
}
