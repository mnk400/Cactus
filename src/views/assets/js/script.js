document.addEventListener('DOMContentLoaded', () => {
    const mediaWrapper = document.getElementById('media-wrapper');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const rescanButton = document.getElementById('rescan-button');
    const directoryNameElement = document.getElementById('directory-name');
    const settingsButton = document.getElementById('settings-button');
    const settingsPanel = document.getElementById('settings-panel');
    
    // Create video progress bar elements
    const videoProgressContainer = document.createElement('div');
    videoProgressContainer.className = 'video-progress-container';
    videoProgressContainer.style.display = 'none';
    
    const videoProgressBar = document.createElement('div');
    videoProgressBar.className = 'video-progress-bar';
    
    videoProgressContainer.appendChild(videoProgressBar);
    document.querySelector('.media-container').appendChild(videoProgressContainer);

    let mediaFiles = [];
    let currentIndex = 0;

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
            await fetchMediaFiles(); 
        } catch (error) {
            showError(`Rescan failed: ${error.message}`);
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

    fetchMediaFiles();

    async function fetchMediaFiles() {
        try {
            showLoading();
            
            const response = await fetch('/get-media-files');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to scan directory');
            }

            const data = await response.json();
            
            if (!data.files || data.files.length === 0) {
                showError('No media files found in the specified directory');
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
        mediaItem.className = 'media-item';

        if (isImage(mediaFile)) {
            const img = document.createElement('img');
            img.src = `/media?path=${encodeURIComponent(mediaFile)}`;
            img.alt = 'Media content';
            mediaItem.appendChild(img);
            
            // Hide video progress bar when showing images
            hideVideoProgressBar();
        } else if (isVideo(mediaFile)) {
            const video = document.createElement('video');
            video.src = `/media?path=${encodeURIComponent(mediaFile)}`;
            video.controls = false; // Disable default controls
            video.autoplay = true;
            video.loop = true;
            video.setAttribute('playsinline', ''); // Prevent fullscreen on iOS
            mediaItem.appendChild(video);
            
            // Setup custom video controls
            setupVideoControls(video, mediaItem);
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
        errorElement.className = 'error-message';
        errorElement.textContent = message;

        const inputSection = document.querySelector('.input-section');
        inputSection.appendChild(errorElement);

        // Clear placeholder if it exists
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            mediaWrapper.innerHTML = '';
        }
    }

    function showLoading(message = 'Loading media files...') {
        mediaWrapper.innerHTML = `<div class="placeholder-message">${message}</div>`;
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
        videoOverlay.className = 'video-overlay';
        videoOverlay.style.display = 'none'; // Initially hidden

        const pauseIcon = document.createElement('div');
        pauseIcon.className = 'pause-icon';
        // You can use an SVG or a character for the pause icon
        pauseIcon.innerHTML = '&#9616;&#9616;'; // Unicode for pause symbol

        videoOverlay.appendChild(pauseIcon);
        mediaItem.appendChild(videoOverlay); // Add overlay to mediaItem for positioning

        // Function to toggle overlay visibility
        const toggleOverlay = () => {
            if (video.paused) {
                videoOverlay.style.display = 'flex';
                video.classList.add('video-paused'); // For dimming effect via CSS
            } else {
                videoOverlay.style.display = 'none';
                video.classList.remove('video-paused');
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
    }
    
    function hideVideoProgressBar() {
        videoProgressContainer.style.display = 'none';
    }

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