const mediaPhotosBtn = document.getElementById('media-photos-btn');
const mediaFolderList = document.getElementById('media-folder-list');
const mediaFolderOptions = document.getElementById('media-folder-options');
const mediaFolderSelected = document.getElementById('media-folder-selected');
const preloadedMediaIndex = window.MEDIA_INDEX;

if (mediaPhotosBtn && mediaFolderList) {
    mediaPhotosBtn.addEventListener('click', () => {
        const isOpen = !mediaFolderList.hidden;
        mediaFolderList.hidden = isOpen;
        mediaPhotosBtn.setAttribute('aria-expanded', String(!isOpen));
    });
}

const renderFolderOptions = (folders) => {
    if (!mediaFolderOptions || !mediaFolderSelected) {
        return;
    }

    mediaFolderOptions.innerHTML = '';

    if (!folders.length) {
        mediaFolderSelected.textContent = 'Geen mappen gevonden. Voeg een map toe onder media_fotos en draai update-media-index.ps1.';
        return;
    }

    folders.forEach((folder) => {
        const link = document.createElement('a');
        link.className = 'media-folder-option';
        link.href = `galerij.html?map=${encodeURIComponent(folder.id)}`;
        link.textContent = folder.name || folder.id;

        link.addEventListener('click', () => {
            try {
                localStorage.setItem('selectedMediaFolder', folder.id);
            } catch (error) {
                // Ignore storage issues and continue with URL-based navigation.
            }
        });

        mediaFolderOptions.appendChild(link);
    });
};

const loadFolderOptions = async () => {
    if (!mediaFolderSelected) {
        return;
    }

    try {
        const response = await fetch('media-index.json', { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            const folders = Array.isArray(data.folders) ? data.folders : [];
            renderFolderOptions(folders);
            return;
        }

        if (preloadedMediaIndex && Array.isArray(preloadedMediaIndex.folders)) {
            renderFolderOptions(preloadedMediaIndex.folders);
            return;
        }

        throw new Error('Indexbestand niet beschikbaar.');
    } catch (error) {
        if (preloadedMediaIndex && Array.isArray(preloadedMediaIndex.folders)) {
            renderFolderOptions(preloadedMediaIndex.folders);
            mediaFolderSelected.textContent = 'Mappen geladen via lokale fallback. Draai update-media-index.ps1 voor de nieuwste data.';
            return;
        }

        mediaFolderSelected.textContent = 'Kon mappen niet laden. Draai update-media-index.ps1 en ververs de pagina.';
    }
};

loadFolderOptions();
