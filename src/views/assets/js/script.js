document.addEventListener('DOMContentLoaded', () => {
    const mediaWrapper = document.getElementById('media-wrapper');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const rescanButton = document.getElementById('rescan-button');
    const directoryNameElement = document.getElementById('directory-name');
    const settingsButton = document.getElementById('settings-button');
    const settingsPanel = document.getElementById('settings-panel');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const allMediaBtn = document.getElementById('all-media-btn');
    const photosBtn = document.getElementById('photos-btn');
    const videosBtn = document.getElementById('videos-btn');
    const navigationContainer = document.getElementById('navigation-container');
    
    const videoProgressContainer = document.createElement('div');
    videoProgressContainer.className = 'video-progress-container absolute bottom-[90px] left-1/2 transform -translate-x-1/2 w-11/12 max-w-[570px] h-5 bg-black bg-opacity-80 backdrop-blur-md rounded-lg overflow-hidden z-[19] hidden';
    
    const videoProgressBar = document.createElement('div');
    videoProgressBar.className = 'video-progress-bar h-full w-0 bg-white rounded-lg transition-all duration-100 ease-linear';
    
    videoProgressContainer.appendChild(videoProgressBar);
    document.querySelector('.media-container').appendChild(videoProgressContainer);

    let lastWindowHeight = window.innerHeight;
    let isBottomBarVisible = false;
    
    function handleIOSBottomBar() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (!isIOS) return;
        
        const currentWindowHeight = window.innerHeight;
        
        if (currentWindowHeight < lastWindowHeight - 50) {
            isBottomBarVisible = true;
            navigationContainer.classList.add('bottom-30');
            navigationContainer.classList.remove('bottom-6');
            
            if (!videoProgressContainer.classList.contains('hidden')) {
                videoProgressContainer.classList.add('bottom-[150px]');
                videoProgressContainer.classList.remove('bottom-[90px]');
            }
        } else if (currentWindowHeight >= lastWindowHeight - 10 || currentWindowHeight > lastWindowHeight) {
            isBottomBarVisible = false;
            navigationContainer.classList.remove('bottom-30');
            navigationContainer.classList.add('bottom-6');
            
            if (!videoProgressContainer.classList.contains('hidden')) {
                videoProgressContainer.classList.remove('bottom-[150px]');
                videoProgressContainer.classList.add('bottom-[90px]');
            }
        }
        
        lastWindowHeight = currentWindowHeight;
    }
    
    window.addEventListener('resize', handleIOSBottomBar);
    window.addEventListener('scroll', handleIOSBottomBar);
    window.addEventListener('orientationchange', () => {
        setTimeout(handleIOSBottomBar, 300);
    });

    let mediaFiles = [];
    let currentIndex = 0;
    let currentMediaType = 'all';
    let preloadedMedia = new Map();
    let isTransitioning = false;

    let startY = 0;
    let currentY = 0;
    let startX = 0;
    let currentX = 0;
    let isScrolling = false;
    let touchStartTime = 0;

    prevButton.classList.add('hidden');
    nextButton.classList.add('hidden');

    async function handleRescan() {
        try {
            showLoading('Rescanning directory...');
            const response = await fetch('/rescan-directory', {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to rescan directory');
            }

            const data = await response.json();
            console.log(data.message);
            
            console.log(`Applying current media type filter: ${currentMediaType}`);
            await handleMediaTypeChange(currentMediaType);
        } catch (error) {
            showError(`Rescan failed: ${error.message}`);
        } finally {
            hideLoading(); 
        }
    }
    
    async function handleMediaTypeChange(mediaType) {
        console.log(`Changing media type from ${currentMediaType} to ${mediaType}`);
        
        if (mediaType === currentMediaType) {
            console.log('Media type unchanged, skipping');
            return;
        }
        
        [allMediaBtn, photosBtn, videosBtn].forEach(btn => {
            btn.classList.remove('bg-black-shades-700', 'font-bold');
            btn.classList.add('bg-black-shades-800');
        });
        
        switch (mediaType) {
            case 'photos':
                photosBtn.classList.remove('bg-black-shades-800');
                photosBtn.classList.add('bg-black-shades-700', 'font-bold');
                break;
            case 'videos':
                videosBtn.classList.remove('bg-black-shades-800');
                videosBtn.classList.add('bg-black-shades-700', 'font-bold');
                break;
            default:
                allMediaBtn.classList.remove('bg-black-shades-800');
                allMediaBtn.classList.add('bg-black-shades-700', 'font-bold');
                mediaType = 'all';
                break;
        }
        
        currentMediaType = mediaType;
        
        try {
            showLoading(`Loading ${mediaType} files...`);
            
            const response = await fetch(`/filter-media?type=${mediaType}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to filter ${mediaType}`);
            }
            
            const data = await response.json();
            console.log(`Filter response: ${data.message}`);
            
            if (!data.files || data.files.length === 0) {
                showError(`No ${mediaType} files found in the specified directory`);
                return;
            }
            
            mediaFiles = shuffleArray(data.files);
            currentIndex = 0;
            preloadedMedia.clear();
            loadMediaFile(currentIndex);
            settingsPanel.classList.add('hidden');
        } catch (error) {
            showError(`Failed to load ${mediaType}: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    settingsButton.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
    
    prevButton.addEventListener('click', () => navigateMedia(-1));
    nextButton.addEventListener('click', () => navigateMedia(1));
    rescanButton.addEventListener('click', handleRescan);
    
    allMediaBtn.addEventListener('click', () => handleMediaTypeChange('all'));
    photosBtn.addEventListener('click', () => handleMediaTypeChange('photos'));
    videosBtn.addEventListener('click', () => handleMediaTypeChange('videos'));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            navigateMedia(-1);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            navigateMedia(1);
        }
    });

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    function handleTouchStart(e) {
        if (e.target.closest('.navigation') || e.target.closest('.settings-panel')) {
            return;
        }

        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        touchStartTime = Date.now();
        isScrolling = false;
    }

    function handleTouchMove(e) {
        if (!startY || !startX) return;

        if (e.target.closest('.navigation') || e.target.closest('.settings-panel')) {
            return;
        }

        currentY = e.touches[0].clientY;
        currentX = e.touches[0].clientX;
        
        const deltaY = startY - currentY;
        const deltaX = startX - currentX;
        
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isScrolling = true;
            e.preventDefault();
            
            const resistance = 0.4;
            const maxOffset = 100;
            const offset = Math.max(-maxOffset, Math.min(maxOffset, -deltaY * resistance));
            
            mediaWrapper.style.transform = `translateY(${offset}px)`;
            
            const progress = Math.min(Math.abs(deltaY) / 150, 0.3);
            mediaWrapper.style.opacity = 1 - progress;
        }
    }

    function handleTouchEnd(e) {
        if (!startY || !startX || !isScrolling) {
            startY = 0;
            startX = 0;
            currentY = 0;
            currentX = 0;
            return;
        }

        const deltaY = startY - currentY;
        const deltaX = startX - currentX;
        const touchDuration = Date.now() - touchStartTime;
        
        const swipeThreshold = 50;
        const quickSwipeThreshold = 30;
        const isQuickSwipe = touchDuration < 300;
        
        const effectiveThreshold = isQuickSwipe ? quickSwipeThreshold : swipeThreshold;
        
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > effectiveThreshold) {
            if (deltaY > 0) {
                navigateMedia(1);
            } else {
                navigateMedia(-1);
            }
        } else {
            mediaWrapper.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            mediaWrapper.style.transform = 'translateY(0)';
            mediaWrapper.style.opacity = '1';
            
            setTimeout(() => {
                mediaWrapper.style.transition = '';
            }, 400);
        }
        
        startY = 0;
        startX = 0;
        currentY = 0;
        currentX = 0;
        isScrolling = false;
    }

    function preloadMedia(indices) {
        indices.forEach(index => {
            if (index < 0 || index >= mediaFiles.length || preloadedMedia.has(index)) {
                return;
            }

            const mediaFile = mediaFiles[index];
            
            if (isImage(mediaFile)) {
                const img = new Image();
                img.src = `/media?path=${encodeURIComponent(mediaFile)}`;
                img.onload = () => {
                    preloadedMedia.set(index, img);
                    console.log(`Preloaded image at index ${index}`);
                };
                img.onerror = () => {
                    console.warn(`Failed to preload image at index ${index}`);
                };
            } else if (isVideo(mediaFile)) {
                const video = document.createElement('video');
                video.src = `/media?path=${encodeURIComponent(mediaFile)}`;
                video.preload = 'metadata';
                video.setAttribute('playsinline', '');
                video.muted = true;
                video.onloadedmetadata = () => {
                    preloadedMedia.set(index, video);
                    console.log(`Preloaded video at index ${index}`);
                };
                video.onerror = () => {
                    console.warn(`Failed to preload video at index ${index}`);
                };
            }
        });
    }

    function cleanupPreloadedMedia() {
        const keepIndices = new Set([
            currentIndex - 2,
            currentIndex - 1,
            currentIndex,
            currentIndex + 1,
            currentIndex + 2
        ]);

        for (const [index, element] of preloadedMedia.entries()) {
            if (!keepIndices.has(index)) {
                if (element.tagName === 'VIDEO') {
                    element.src = '';
                    element.load();
                }
                preloadedMedia.delete(index);
                console.log(`Cleaned up preloaded media at index ${index}`);
            }
        }
    }

    fetchMediaFiles('all');

    async function fetchMediaFiles(mediaType = 'all') {
        console.log(`Fetching ${mediaType} media files...`);
        
        try {
            showLoading(`Loading ${mediaType} media...`);
            
            const response = await fetch(`/get-media-files?type=${mediaType}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to scan directory');
            }

            const data = await response.json();
            console.log(`Received ${data.files ? data.files.length : 0} files from server`);
            
            if (!data.files || data.files.length === 0) {
                showError(`No ${mediaType} files found in the specified directory`);
                return;
            }

            mediaFiles = shuffleArray(data.files);
            currentIndex = 0;
            preloadedMedia.clear();
            
            prevButton.classList.remove('hidden');
            nextButton.classList.remove('hidden');
            
            loadMediaFile(currentIndex);
        } catch (error) {
            showError(error.message);
        }
    }

    function loadMediaFile(index, direction = 0) {
        if (index < 0 || index >= mediaFiles.length || isTransitioning) return;

        console.log(`Loading media ${index} with direction ${direction} (${direction > 0 ? 'next/up' : direction < 0 ? 'prev/down' : 'initial'})`);
        
        isTransitioning = true;
        const mediaFile = mediaFiles[index];

        const loadingText = document.querySelector('.placeholder-message');
        if (loadingText) {
            loadingText.style.display = 'none';
        }

        const currentMediaItem = mediaWrapper.querySelector('.media-item');

        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0';

        mediaItem.style.opacity = '0';
        if (direction > 0) {
            mediaItem.style.transform = 'translateY(40%)';
        } else if (direction < 0) {
            mediaItem.style.transform = 'translateY(-40%)';
        } else {
            mediaItem.style.transform = 'translateY(20px)';
        }

        if (isImage(mediaFile)) {
            let img;
            
            if (preloadedMedia.has(index)) {
                const preloadedImg = preloadedMedia.get(index);
                img = document.createElement('img');
                img.src = preloadedImg.src;
                img.alt = 'Media content';
            } else {
                img = document.createElement('img');
                img.src = `/media?path=${encodeURIComponent(mediaFile)}`;
                img.alt = 'Media content';
            }
            
            img.classList.add('max-h-full', 'max-w-full', 'object-cover');
            mediaItem.appendChild(img);

            hideVideoProgressBar();
            fullscreenButton.classList.add('hidden');

            const startAnimation = () => {
                mediaWrapper.appendChild(mediaItem);
                mediaItem.offsetHeight;
                
                requestAnimationFrame(() => {
                    mediaItem.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    mediaItem.style.opacity = '1';
                    mediaItem.style.transform = 'translateY(0)';
                    
                    if (currentMediaItem && direction !== 0) {
                        currentMediaItem.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                        currentMediaItem.style.opacity = '0';
                        if (direction > 0) {
                            currentMediaItem.style.transform = 'translateY(-40%)';
                        } else {
                            currentMediaItem.style.transform = 'translateY(40%)';
                        }
                    }
                    
                    setTimeout(() => {
                        if (currentMediaItem && currentMediaItem.parentNode) {
                            currentMediaItem.remove();
                        }
                        isTransitioning = false;
                        mediaItem.style.transition = '';
                    }, 300);
                });
            };

            if (img.complete) {
                startAnimation();
            } else {
                img.onload = startAnimation;
                img.onerror = startAnimation;
            }

        } else if (isVideo(mediaFile)) {
            let video;
            
            if (preloadedMedia.has(index)) {
                const preloadedVideo = preloadedMedia.get(index);
                video = document.createElement('video');
                video.src = preloadedVideo.src;
            } else {
                video = document.createElement('video');
                video.src = `/media?path=${encodeURIComponent(mediaFile)}`;
            }
            
            video.controls = false;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.setAttribute('playsinline', '');
            video.classList.add('max-h-full', 'max-w-full', 'object-cover');
            mediaItem.appendChild(video);

            setupVideoControls(video, mediaItem);
            fullscreenButton.classList.remove('hidden');

            const startAnimation = () => {
                mediaWrapper.appendChild(mediaItem);
                mediaItem.offsetHeight;
                
                requestAnimationFrame(() => {
                    mediaItem.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    mediaItem.style.opacity = '1';
                    mediaItem.style.transform = 'translateY(0)';
                    
                    if (currentMediaItem && direction !== 0) {
                        currentMediaItem.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                        currentMediaItem.style.opacity = '0';
                        if (direction > 0) {
                            currentMediaItem.style.transform = 'translateY(-40%)';
                        } else {
                            currentMediaItem.style.transform = 'translateY(40%)';
                        }
                    }
                    
                    setTimeout(() => {
                        if (currentMediaItem && currentMediaItem.parentNode) {
                            currentMediaItem.remove();
                        }
                        isTransitioning = false;
                        mediaItem.style.transition = '';
                    }, 300);
                });
            };

            if (video.readyState >= 2) {
                startAnimation();
            } else {
                video.onloadeddata = startAnimation;
                video.onerror = startAnimation;
            }
        }

        setTimeout(() => {
            mediaWrapper.style.transform = '';
            mediaWrapper.style.opacity = '';
            mediaWrapper.style.transition = '';
        }, 50);

        const dirPath = mediaFile.split('/').slice(0, -1).pop();
        directoryNameElement.textContent = dirPath || 'Root';

        const preloadIndices = [
            (index + 1) % mediaFiles.length,
            (index + 2) % mediaFiles.length,
            (index - 1 + mediaFiles.length) % mediaFiles.length
        ];
        preloadMedia(preloadIndices);
        cleanupPreloadedMedia();
    }

    function navigateMedia(direction) {
        if (mediaFiles.length === 0 || isTransitioning) return;

        currentIndex = (currentIndex + direction + mediaFiles.length) % mediaFiles.length;
        loadMediaFile(currentIndex, direction);
    }

    function isImage(filePath) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        return imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    function isVideo(filePath) {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
        return videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    function showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorElement = document.createElement('div');
        errorElement.className = 'error-message text-red-500 p-2.5 text-center bg-red-500 bg-opacity-10 rounded mt-2.5';
        errorElement.textContent = message;

        mediaWrapper.appendChild(errorElement);

        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            mediaWrapper.innerHTML = '';
        }
    }

    function showLoading(message = 'Loading media files...') {
        const existingPlaceholder = document.querySelector('.placeholder-message');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
        
        const loadingElement = document.createElement('div');
        loadingElement.className = 'placeholder-message h-full w-full flex justify-center items-center text-gray-500 text-base text-center p-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse z-50';
        loadingElement.textContent = message;
        
        mediaWrapper.appendChild(loadingElement);
    }

    function hideLoading() {
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            placeholder.remove();
        }
    }

    function setupVideoControls(video, mediaItem) {
        const videoOverlay = document.createElement('div');
        videoOverlay.className = 'video-overlay absolute top-0 left-0 w-full h-full bg-black bg-opacity-30 flex justify-center items-center z-10 cursor-pointer';
        videoOverlay.style.display = 'none';

        const pauseIcon = document.createElement('div');
        pauseIcon.className = 'pause-icon text-6xl text-white text-opacity-80';
        pauseIcon.innerHTML = '&#9616;&#9616;';

        videoOverlay.appendChild(pauseIcon);
        mediaItem.appendChild(videoOverlay);

        const toggleOverlay = () => {
            if (video.paused) {
                videoOverlay.style.display = 'flex';
                video.classList.add('filter', 'brightness-50');
            } else {
                videoOverlay.style.display = 'none';
                video.classList.remove('filter', 'brightness-50');
            }
        };

        video.addEventListener('play', toggleOverlay);
        video.addEventListener('pause', toggleOverlay);

        videoOverlay.addEventListener('click', () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });

        videoProgressContainer.classList.remove('hidden');
        
        video.addEventListener('timeupdate', () => {
            const progress = (video.currentTime / video.duration) * 100;
            videoProgressBar.style.width = `${progress}%`;
        });
        
        video.addEventListener('click', (e) => {
            if (videoOverlay.style.display === 'flex' && e.target === video) {
                // Allow direct video clicks when overlay is shown
            } else if (videoOverlay.style.display === 'flex') {
                return;
            }

            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });
        
        videoProgressContainer.addEventListener('click', (e) => {
            const rect = videoProgressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });
        
        if (isBottomBarVisible) {
            videoProgressContainer.classList.add('bottom-[150px]');
            videoProgressContainer.classList.remove('bottom-[90px]');
        } else {
            videoProgressContainer.classList.remove('bottom-[150px]');
            videoProgressContainer.classList.add('bottom-[90px]');
        }
    }
    
    function hideVideoProgressBar() {
        videoProgressContainer.classList.add('hidden');
    }

    fullscreenButton.addEventListener('click', () => {
        const videoElement = mediaWrapper.querySelector('video');
        if (videoElement) {
            if (videoElement.requestFullscreen) {
                videoElement.requestFullscreen();
            } else if (videoElement.webkitRequestFullscreen) {
                videoElement.webkitRequestFullscreen();
            } else if (videoElement.msRequestFullscreen) {
                videoElement.msRequestFullscreen();
            } else if (videoElement.webkitEnterFullscreen) {
                videoElement.webkitEnterFullscreen();
            }
        }
    });
    
    document.addEventListener('touchend', () => {
        setTimeout(handleIOSBottomBar, 300);
    });

    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

setTimeout(() => {
    if (typeof handleIOSBottomBar === 'function') {
        handleIOSBottomBar();
    }
}, 500);