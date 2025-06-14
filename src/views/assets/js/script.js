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
    
    // Create video progress bar elements
    const videoProgressContainer = document.createElement('div');
    videoProgressContainer.className = 'video-progress-container absolute bottom-[90px] left-1/2 transform -translate-x-1/2 w-11/12 max-w-[570px] h-5 bg-black-shades-900 bg-opacity-80 backdrop-blur-md rounded-lg overflow-hidden z-[19] backdrop-blur-md';
    videoProgressContainer.style.display = 'none';
    
    const videoProgressBar = document.createElement('div');
    videoProgressBar.className = 'video-progress-bar h-full w-0 bg-white rounded-lg transition-width duration-100 linear';
    
    videoProgressContainer.appendChild(videoProgressBar);
    document.querySelector('.media-container').appendChild(videoProgressContainer);

    // iOS Safari bottom bar detection
    let lastWindowHeight = window.innerHeight;
    let isBottomBarVisible = false;
    
    // Function to handle iOS Safari bottom bar
    function handleIOSBottomBar() {
        // Only apply this on iOS devices
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (!isIOS) return;
        
        const currentWindowHeight = window.innerHeight;
        
        // If the window height decreased significantly, the bottom bar is likely showing
        if (currentWindowHeight < lastWindowHeight - 50) {
            isBottomBarVisible = true;
            navigationContainer.classList.add('bottom-30'); // Move navigation up
            navigationContainer.classList.remove('bottom-6');
            
            // Also adjust video progress bar if it's visible
            if (videoProgressContainer.style.display !== 'none') {
                videoProgressContainer.classList.add('bottom-[150px]');
                videoProgressContainer.classList.remove('bottom-[90px]');
            }
        } else if (currentWindowHeight >= lastWindowHeight - 10 || currentWindowHeight > lastWindowHeight) {
            isBottomBarVisible = false;
            navigationContainer.classList.remove('bottom-20');
            navigationContainer.classList.add('bottom-6');
            
            // Reset video progress bar position
            if (videoProgressContainer.style.display !== 'none') {
                videoProgressContainer.classList.remove('bottom-[150px]');
                videoProgressContainer.classList.add('bottom-[90px]');
            }
        }
        
        lastWindowHeight = currentWindowHeight;
    }
    
    // Listen for resize and scroll events to detect iOS bottom bar
    window.addEventListener('resize', handleIOSBottomBar);
    window.addEventListener('scroll', handleIOSBottomBar);
    
    // Also check when orientation changes
    window.addEventListener('orientationchange', () => {
        // Wait for the orientation change to complete
        setTimeout(handleIOSBottomBar, 300);
    });

    let mediaFiles = [];
    let currentIndex = 0;
    let currentMediaType = 'all'; // Default media type

    prevButton.style.display = 'none';
    nextButton.style.display = 'none';

    // function to handle the rescan button click
    // by default we read the cached media files
    // rescanning deletes the old cache and rescan the directory
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
    
    // Function to handle media type selection
    async function handleMediaTypeChange(mediaType) {
        console.log(`Changing media type from ${currentMediaType} to ${mediaType}`);
        
        if (mediaType === currentMediaType) {
            console.log('Media type unchanged, skipping');
            return;
        }
        
        // Update active button styling
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
                mediaType = 'all'; // Ensure we use 'all' as the value
                break;
        }
        
        // Update the current media type AFTER validation
        currentMediaType = mediaType;
        
        try {
            showLoading(`Loading ${mediaType} files...`);
            
            // Make a direct API call to filter media
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
            
            // Update media files and reset index
            mediaFiles = shuffleArray(data.files);
            currentIndex = 0;
            
            // Load the first media file
            loadMediaFile(currentIndex);
            
            // Close the settings panel after selection
            settingsPanel.style.display = 'none';
        } catch (error) {
            showError(`Failed to load ${mediaType}: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    ////////////////////
    // Event listeners
    ////////////////////

    settingsButton.addEventListener('click', () => {
        const isHidden = settingsPanel.style.display === 'none' || settingsPanel.style.display === '';
        settingsPanel.style.display = isHidden ? 'flex' : 'none';
    });
    
    prevButton.addEventListener('click', () => {navigateMedia(-1)});
    nextButton.addEventListener('click', () => {navigateMedia(1)});
    rescanButton.addEventListener('click', handleRescan);
    
    allMediaBtn.addEventListener('click', () => handleMediaTypeChange('all'));
    photosBtn.addEventListener('click', () => handleMediaTypeChange('photos'));
    videosBtn.addEventListener('click', () => handleMediaTypeChange('videos'));

    // keyboard navigation support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            navigateMedia(-1);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            navigateMedia(1);
        }
    });

    ///////////////////////////////
    // Media management functions
    ///////////////////////////////

    fetchMediaFiles('all'); // Start with all media types

    async function fetchMediaFiles(mediaType = 'all') {
        console.log(`Fetching ${mediaType} media files...`);
        
        try {
            showLoading(`Loading ${mediaType} media...`);
            
            // Always specify the media type in the request
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
            
            // Show navigation buttons
            prevButton.style.display = 'block';
            nextButton.style.display = 'block';
            
            // Load the first media file
            loadMediaFile(currentIndex);
        } catch (error) {
            showError(error.message);
        }
    }

    function loadMediaFile(index) {
        if (index < 0 || index >= mediaFiles.length) return;

        const mediaFile = mediaFiles[index];
        mediaWrapper.innerHTML = '';

        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item relative h-full w-full flex justify-center items-center absolute top-0 left-0';

        if (isImage(mediaFile)) {
            const img = document.createElement('img');
            img.src = `/media?path=${encodeURIComponent(mediaFile)}`;
            img.alt = 'Media content';
            img.classList.add('max-h-full', 'max-w-full', 'object-fill');
            mediaItem.appendChild(img);

            // Hide video progress bar when showing images
            hideVideoProgressBar();
            // Hide fullscreen button for images
            fullscreenButton.style.display = 'none';
        } else if (isVideo(mediaFile)) {
            const video = document.createElement('video');
            video.src = `/media?path=${encodeURIComponent(mediaFile)}`;
            video.controls = false; // Disable default controls
            video.autoplay = true;
            video.loop = true;
            video.setAttribute('playsinline', ''); // Prevent fullscreen on iOS
            video.classList.add('max-h-full', 'max-w-full', 'object-fill');
            mediaItem.appendChild(video);

            // Setup custom video controls
            setupVideoControls(video, mediaItem);
            // Show fullscreen button for videos
            fullscreenButton.style.display = 'block';
        }

        mediaWrapper.appendChild(mediaItem);

        // extract and display the last directory name in the nav bar
        const dirPath = mediaFile.split('/').slice(0, -1).pop();
        directoryNameElement.textContent = dirPath || 'Root';
    }

    function navigateMedia(direction) {
        if (mediaFiles.length === 0) return;

        currentIndex = (currentIndex + direction + mediaFiles.length) % mediaFiles.length;
        loadMediaFile(currentIndex);
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
        // Remove any existing error message
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorElement = document.createElement('div');
        errorElement.className = 'error-message text-red-500 p-2.5 text-center bg-red-500 bg-opacity-10 rounded mt-2.5';
        errorElement.textContent = message;

        // Assuming mediaWrapper is the correct parent for error messages as inputSection is not in the HTML
        mediaWrapper.appendChild(errorElement);

        // Clear placeholder if it exists
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            mediaWrapper.innerHTML = '';
        }
    }

    function showLoading(message = 'Loading media files...') {
        mediaWrapper.innerHTML = `<div class="placeholder-message h-full w-full flex justify-center items-center text-gray-500 text-base text-center p-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">${message}</div>`;
    }

    function hideLoading() {
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            placeholder.remove();
        }
    }

    // Video controls functions
    function setupVideoControls(video, mediaItem) {
        const videoOverlay = document.createElement('div');
        videoOverlay.className = 'video-overlay absolute top-0 left-0 w-full h-full bg-black bg-opacity-30 flex justify-center items-center z-10 cursor-pointer';
        videoOverlay.style.display = 'none'; // Initially hidden

        const pauseIcon = document.createElement('div');
        pauseIcon.className = 'pause-icon text-6xl text-white text-opacity-80 text-shadow'; // text-shadow can be a custom utility or a plugin
        // You can use an SVG or a character for the pause icon
        pauseIcon.innerHTML = '&#9616;&#9616;'; // Unicode for pause symbol

        videoOverlay.appendChild(pauseIcon);
        mediaItem.appendChild(videoOverlay); // Add overlay to mediaItem for positioning

        // Function to toggle overlay visibility
        const toggleOverlay = () => {
            if (video.paused) {
                videoOverlay.style.display = 'flex';
                video.classList.add('filter', 'brightness-50'); // For dimming effect via CSS
            } else {
                videoOverlay.style.display = 'none';
                video.classList.remove('filter', 'brightness-50');
            }
        };

        // Show/hide overlay on play/pause events
        video.addEventListener('play', toggleOverlay);
        video.addEventListener('pause', toggleOverlay);

        // Click on overlay to toggle play/pause
        videoOverlay.addEventListener('click', () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });

        // Show the progress bar container
        videoProgressContainer.style.display = 'block';
        
        // Update progress bar as video plays
        video.addEventListener('timeupdate', () => {
            const progress = (video.currentTime / video.duration) * 100;
            videoProgressBar.style.width = `${progress}%`;
        });
        
        // Add click event to video for play/pause (original functionality)
        // We keep this so clicking the video itself (not the overlay) also works
        video.addEventListener('click', (e) => {
            // Prevent click event from bubbling up to the overlay if it's visible
            if (videoOverlay.style.display === 'flex' && e.target === video) {
                 // Allow click if it's directly on the video and overlay is shown (e.g. to play)
            } else if (videoOverlay.style.display === 'flex') {
                return; // If overlay is shown and click is not on video, let overlay handle it
            }

            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });
        
        // Add click event to progress bar for seeking
        videoProgressContainer.addEventListener('click', (e) => {
            const rect = videoProgressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });
        
        // Apply the correct position based on iOS bottom bar state
        if (isBottomBarVisible) {
            videoProgressContainer.classList.add('bottom-[150px]');
            videoProgressContainer.classList.remove('bottom-[90px]');
        } else {
            videoProgressContainer.classList.remove('bottom-[150px]');
            videoProgressContainer.classList.add('bottom-[90px]');
        }
    }
    
    function hideVideoProgressBar() {
        videoProgressContainer.style.display = 'none';
    }

    // Add event listener for fullscreen button
    fullscreenButton.addEventListener('click', () => {
        const videoElement = mediaWrapper.querySelector('video');
        if (videoElement) {
            if (videoElement.requestFullscreen) {
                videoElement.requestFullscreen();
            } else if (videoElement.webkitRequestFullscreen) { /* Safari */
                videoElement.webkitRequestFullscreen();
            } else if (videoElement.msRequestFullscreen) { /* IE11 */
                videoElement.msRequestFullscreen();
            } else if (videoElement.webkitEnterFullscreen) { /* iOS Safari fallback */
                videoElement.webkitEnterFullscreen();
            }
        }
    });
    
    // Check for iOS bottom bar visibility when user taps on screen
    document.addEventListener('touchend', () => {
        // Delay check to allow iOS UI to show/hide
        setTimeout(handleIOSBottomBar, 300);
    });

    // fisher-yates shuffle algorithm to randomize media files
    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
});

// service worker for PWA
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

// Initial check for iOS bottom bar on page load
setTimeout(() => {
  if (typeof handleIOSBottomBar === 'function') {
    handleIOSBottomBar();
  }
}, 500);