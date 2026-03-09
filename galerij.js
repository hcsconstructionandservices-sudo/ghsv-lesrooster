const folderLabel = document.getElementById('gallery-folder-name');
const folderPath = document.getElementById('gallery-folder-path');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryGrid = document.getElementById('gallery-grid');
const lightbox = document.getElementById('gallery-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxPlay = document.getElementById('lightbox-play');
const lightboxStop = document.getElementById('lightbox-stop');
const preloadedMediaIndex = window.MEDIA_INDEX;

const params = new URLSearchParams(window.location.search);
const selectedFolderParam = params.get('map');
let persistedFolder = null;

try {
    persistedFolder = localStorage.getItem('selectedMediaFolder');
} catch (error) {
    persistedFolder = null;
}

const requestedFolderId = selectedFolderParam || persistedFolder;
let currentImages = [];
let currentIndex = 0;
let slideshowTimer = null;
const slideshowIntervalMs = 3500;
let controlsHideTimer = null;
const controlsHideDelayMs = 2200;

if (folderLabel && folderPath) {
    if (requestedFolderId) {
        folderLabel.textContent = `Map: ${requestedFolderId}`;
        folderPath.textContent = `Pad: media_fotos/${requestedFolderId}/`;
    } else {
        folderLabel.textContent = 'Map: automatisch gekozen';
        folderPath.textContent = 'Geen map in URL, galerij kiest automatisch een map met foto\'s.';
    }
}

const renderThumbnails = (images) => {
    if (!galleryGrid || !galleryEmpty) {
        return;
    }

    galleryGrid.innerHTML = '';
    currentImages = images;
    currentIndex = 0;

    if (!images.length) {
        galleryGrid.hidden = true;
        galleryEmpty.hidden = false;
        galleryEmpty.textContent = 'Geen afbeeldingen gevonden in deze map.';
        return;
    }

    images.forEach((image, index) => {
        const item = document.createElement('figure');
        item.className = 'gallery-item';
        item.tabIndex = 0;

        const imageElem = document.createElement('img');
        imageElem.className = 'gallery-thumb';
        imageElem.src = encodeURI(image.src);
        imageElem.alt = image.name || 'Galerij foto';
        imageElem.loading = 'lazy';

        const caption = document.createElement('figcaption');
        caption.className = 'gallery-caption';
        caption.textContent = image.name || image.src;

        item.appendChild(imageElem);
        item.appendChild(caption);

        const openAtIndex = () => {
            openLightbox(index);
        };

        item.addEventListener('click', openAtIndex);
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAtIndex();
            }
        });

        galleryGrid.appendChild(item);
    });

    galleryEmpty.hidden = true;
    galleryGrid.hidden = false;
};

const stopSlideshow = () => {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }

    if (lightboxPlay && lightboxStop) {
        lightboxPlay.hidden = false;
        lightboxStop.hidden = true;
    }
};

const clearControlsHideTimer = () => {
    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
        controlsHideTimer = null;
    }
};

const scheduleControlsHide = () => {
    clearControlsHideTimer();

    controlsHideTimer = setTimeout(() => {
        if (lightbox && !lightbox.hidden) {
            lightbox.classList.add('controls-hidden');
        }
    }, controlsHideDelayMs);
};

const showLightboxControls = () => {
    if (!lightbox || lightbox.hidden) {
        return;
    }

    lightbox.classList.remove('controls-hidden');
    scheduleControlsHide();
};

const showImageAt = (index) => {
    if (!currentImages.length || !lightboxImage || !lightboxCaption) {
        return;
    }

    const total = currentImages.length;
    currentIndex = ((index % total) + total) % total;

    const image = currentImages[currentIndex];
    lightboxImage.src = encodeURI(image.src);
    lightboxImage.alt = image.name || 'Galerij afbeelding';
    lightboxCaption.textContent = `${image.name || image.src} (${currentIndex + 1}/${total})`;
};

const openLightbox = (index) => {
    if (!lightbox || !currentImages.length) {
        return;
    }

    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    lightbox.classList.remove('controls-hidden');
    showImageAt(index);
    scheduleControlsHide();
};

const closeLightbox = () => {
    if (!lightbox) {
        return;
    }

    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    lightbox.classList.remove('controls-hidden');
    clearControlsHideTimer();
    stopSlideshow();
};

const showNextImage = () => {
    showImageAt(currentIndex + 1);
};

const showPreviousImage = () => {
    showImageAt(currentIndex - 1);
};

const startSlideshow = () => {
    if (!currentImages.length) {
        return;
    }

    stopSlideshow();
    slideshowTimer = setInterval(showNextImage, slideshowIntervalMs);

    if (lightboxPlay && lightboxStop) {
        lightboxPlay.hidden = true;
        lightboxStop.hidden = false;
    }
};

if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
}

if (lightboxNext) {
    lightboxNext.addEventListener('click', () => {
        showNextImage();
        showLightboxControls();
    });
}

if (lightboxPrev) {
    lightboxPrev.addEventListener('click', () => {
        showPreviousImage();
        showLightboxControls();
    });
}

if (lightboxPlay) {
    lightboxPlay.addEventListener('click', () => {
        startSlideshow();
        showLightboxControls();
    });
}

if (lightboxStop) {
    lightboxStop.addEventListener('click', () => {
        stopSlideshow();
        showLightboxControls();
    });
}

if (lightbox) {
    lightbox.addEventListener('mousemove', showLightboxControls);
    lightbox.addEventListener('click', showLightboxControls);

    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });
}

document.addEventListener('keydown', (event) => {
    if (!lightbox || lightbox.hidden) {
        return;
    }

    showLightboxControls();

    if (event.key === 'Escape') {
        closeLightbox();
    } else if (event.key === 'ArrowRight') {
        showNextImage();
    } else if (event.key === 'ArrowLeft') {
        showPreviousImage();
    }
});

const loadGallery = async () => {
    try {
        let data = null;
        const response = await fetch('media-index.json', { cache: 'no-store' });

        if (response.ok) {
            data = await response.json();
        } else if (preloadedMediaIndex && Array.isArray(preloadedMediaIndex.folders)) {
            data = preloadedMediaIndex;
        } else {
            throw new Error('Indexbestand kon niet worden geladen.');
        }

        const folders = Array.isArray(data.folders) ? data.folders : [];

        const selected = requestedFolderId
            ? folders.find((folder) => folder.id === requestedFolderId)
            : folders.find((folder) => Array.isArray(folder.images) && folder.images.length > 0) || folders[0];

        if (!selected) {
            renderThumbnails([]);
            return;
        }

        const images = selected && Array.isArray(selected.images) ? selected.images : [];

        if (folderLabel) {
            folderLabel.textContent = `Map: ${selected.name || selected.id}`;
        }

        if (folderPath) {
            folderPath.textContent = `Pad: media_fotos/${selected.id}/`;
        }

        try {
            localStorage.setItem('selectedMediaFolder', selected.id);
        } catch (error) {
            // Ignore storage issues and keep gallery working.
        }

        renderThumbnails(images);
    } catch (error) {
        if (preloadedMediaIndex && Array.isArray(preloadedMediaIndex.folders)) {
            const folders = preloadedMediaIndex.folders;
            const selected = requestedFolderId
                ? folders.find((folder) => folder.id === requestedFolderId)
                : folders.find((folder) => Array.isArray(folder.images) && folder.images.length > 0) || folders[0];

            if (selected) {
                if (folderLabel) {
                    folderLabel.textContent = `Map: ${selected.name || selected.id}`;
                }
                if (folderPath) {
                    folderPath.textContent = `Pad: media_fotos/${selected.id}/`;
                }
                renderThumbnails(Array.isArray(selected.images) ? selected.images : []);
                return;
            }
        }

        if (galleryEmpty) {
            galleryEmpty.hidden = false;
            galleryEmpty.textContent = 'Kon miniaturen niet laden. Draai update-media-index.ps1 en probeer opnieuw.';
        }
        if (galleryGrid) {
            galleryGrid.hidden = true;
        }
    }
};

loadGallery();
