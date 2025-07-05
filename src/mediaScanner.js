const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

// Simple structured logging
const log = {
    info: (message, meta = {}) => console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() })),
    error: (message, meta = {}) => console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() })),
    warn: (message, meta = {}) => console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }))
};

// Get directory path from command line arguments
let directoryPath;

// Cache file path - generate a unique name based on the directory path
// Used to create a unique cache file for input directory to decrease
// server startup time
let cacheFileName;
let CACHE_FILE_PATH;

// Lock file path for preventing concurrent scans
let LOCK_FILE_PATH;

// Define media type extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.MP4', '.webm', '.mov', '.avi', '.mkv', '.ogg'];

function initializeScanner(dirPath) {
    directoryPath = dirPath;
    cacheFileName = `.${crypto.createHash('md5').update(directoryPath).digest('hex')}_media_cache.json`;
    CACHE_FILE_PATH = path.join(process.cwd(), 'configuration', cacheFileName);
    
    // Initialize lock file path
    const lockFileName = `.${crypto.createHash('md5').update(directoryPath).digest('hex')}_scan.lock`;
    LOCK_FILE_PATH = path.join(process.cwd(), 'configuration', lockFileName);
    
    log.info('Media scanner initialized', { 
        directory: directoryPath,
        cacheFile: cacheFileName,
        cachePath: CACHE_FILE_PATH,
        lockFile: lockFileName,
        lockPath: LOCK_FILE_PATH
    });
}

// Function to check if a file is an image
function isImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

// Function to check if a file is a video
function isVideo(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

// Lock management functions
function createLockFile() {
    try {
        const lockData = {
            pid: process.pid,
            timestamp: new Date().toISOString(),
            directory: directoryPath
        };
        fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(lockData, null, 2));
        log.info('Scan lock file created', { 
            lockFile: path.basename(LOCK_FILE_PATH),
            lockPath: LOCK_FILE_PATH,
            pid: process.pid
        });
        return true;
    } catch (error) {
        log.error('Failed to create scan lock file', { 
            lockFile: path.basename(LOCK_FILE_PATH),
            lockPath: LOCK_FILE_PATH,
            error: error.message 
        });
        return false;
    }
}

function removeLockFile() {
    try {
        if (fs.existsSync(LOCK_FILE_PATH)) {
            fs.unlinkSync(LOCK_FILE_PATH);
            log.info('Scan lock file removed', { 
                lockFile: path.basename(LOCK_FILE_PATH),
                lockPath: LOCK_FILE_PATH
            });
        }
    } catch (error) {
        log.error('Failed to remove scan lock file', { 
            lockFile: path.basename(LOCK_FILE_PATH),
            lockPath: LOCK_FILE_PATH,
            error: error.message 
        });
    }
}

function isLocked() {
    if (!fs.existsSync(LOCK_FILE_PATH)) {
        return false;
    }
    
    try {
        const lockData = JSON.parse(fs.readFileSync(LOCK_FILE_PATH, 'utf-8'));
        
        // Check if the lock is stale (older than 5 minutes)
        const lockTime = new Date(lockData.timestamp);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        if (lockTime < fiveMinutesAgo) {
            log.warn('Removing stale scan lock file', { 
                lockFile: path.basename(LOCK_FILE_PATH),
                lockPath: LOCK_FILE_PATH,
                lockAge: Math.round((now - lockTime) / 1000) + 's',
                lockedByPid: lockData.pid
            });
            removeLockFile();
            return false;
        }
        
        log.info('Scan currently locked', {
            lockFile: path.basename(LOCK_FILE_PATH),
            lockPath: LOCK_FILE_PATH,
            lockedByPid: lockData.pid,
            lockedSince: lockData.timestamp
        });
        return true;
    } catch (error) {
        log.warn('Corrupted scan lock file detected, removing', { 
            lockFile: path.basename(LOCK_FILE_PATH),
            lockPath: LOCK_FILE_PATH,
            error: error.message 
        });
        removeLockFile();
        return false;
    }
}

// Function to recursively scan directory for media files
async function scanDirectory(directoryPath) {
    const mediaFiles = [];
    const supportedExtensions = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

    async function scan(dir) {
        try {
            const files = await readdir(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const fileStat = await stat(filePath);
                
                if (fileStat.isDirectory()) {
                    // recursively scan subdirectories
                    await scan(filePath);
                } else if (fileStat.isFile()) {
                    // match an extension
                    const ext = path.extname(file).toLowerCase();
                    if (supportedExtensions.includes(ext)) {
                        mediaFiles.push(filePath);
                    }
                }
            }
        } catch (error) {
            log.error('Failed to scan directory', { directory: dir, error: error.message });
        }
    }

    await scan(directoryPath);
    return mediaFiles;
}

let scannedMediaFiles = [];
let allMediaFiles = []; // Store all media files before filtering

// Function to load media files from cache or scan directory
async function loadMediaFiles() {
    if (!directoryPath) {
        log.error('Media scanner not initialized');
        return [];
    }

    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            log.info('Cache file found, attempting to load', {
                cacheFile: path.basename(CACHE_FILE_PATH),
                cachePath: CACHE_FILE_PATH
            });
            
            const cachedData = JSON.parse(await readFile(CACHE_FILE_PATH, 'utf-8'));
            // check if the cached directory path matches the current one
            if (cachedData.directoryPath === directoryPath) {
                allMediaFiles = cachedData.files;
                scannedMediaFiles = [...allMediaFiles];
                
                const imageCount = allMediaFiles.filter(file => isImage(file)).length;
                const videoCount = allMediaFiles.filter(file => isVideo(file)).length;
                log.info('Media files loaded from cache', { 
                    cacheFile: path.basename(CACHE_FILE_PATH),
                    total: allMediaFiles.length, 
                    images: imageCount, 
                    videos: videoCount 
                });
                
                return scannedMediaFiles;
            }
            log.info('Cache directory mismatch, performing fresh scan', {
                cacheFile: path.basename(CACHE_FILE_PATH),
                cachedDirectory: cachedData.directoryPath,
                currentDirectory: directoryPath
            });
        } else {
            log.info('No cache file found, performing fresh scan', {
                expectedCacheFile: path.basename(CACHE_FILE_PATH),
                expectedCachePath: CACHE_FILE_PATH
            });
        }
    } catch (error) {
        log.warn('Cache file invalid, performing fresh scan', { 
            cacheFile: path.basename(CACHE_FILE_PATH),
            cachePath: CACHE_FILE_PATH,
            error: error.message 
        });
    }

    log.info('Scanning directory for media files', { directory: directoryPath });
    allMediaFiles = await scanDirectory(directoryPath);
    scannedMediaFiles = [...allMediaFiles];
    
    const imageCount = allMediaFiles.filter(file => isImage(file)).length;
    const videoCount = allMediaFiles.filter(file => isVideo(file)).length;
    log.info('Media scan completed', { 
        total: allMediaFiles.length, 
        images: imageCount, 
        videos: videoCount 
    });
    
    try {
        await writeFile(CACHE_FILE_PATH, JSON.stringify({ directoryPath, files: allMediaFiles }, null, 2));
        log.info('Media cache saved successfully', {
            cacheFile: path.basename(CACHE_FILE_PATH),
            cachePath: CACHE_FILE_PATH,
            fileCount: allMediaFiles.length
        });
    } catch (error) {
        log.error('Failed to save media cache', { 
            cacheFile: path.basename(CACHE_FILE_PATH),
            cachePath: CACHE_FILE_PATH,
            error: error.message 
        });
    }
    
    return scannedMediaFiles;
}

// Function to filter media files by type
function filterMediaByType(mediaType) {
    if (!allMediaFiles || allMediaFiles.length === 0) {
        log.warn('No media files available for filtering');
        return [];
    }
    
    let filteredFiles;
    
    switch (mediaType) {
        case 'photos':
            filteredFiles = allMediaFiles.filter(file => isImage(file));
            break;
        case 'videos':
            filteredFiles = allMediaFiles.filter(file => isVideo(file));
            break;
        case 'all':
        default:
            filteredFiles = [...allMediaFiles];
            break;
    }
    
    scannedMediaFiles = filteredFiles;
    return scannedMediaFiles;
}

// Function to trigger a rescan of the directory
async function rescanDirectory() {
    if (!directoryPath) {
        log.error('Media scanner not initialized');
        throw new Error('Media scanner not initialized');
    }
    
    // Check if a scan is already in progress
    if (isLocked()) {
        throw new Error('Scan already in progress');
    }
    
    // Create lock file
    if (!createLockFile()) {
        throw new Error('Failed to create lock file');
    }
    
    try {
        // Clear existing cache file if it exists
        if (fs.existsSync(CACHE_FILE_PATH)) {
            try {
                fs.unlinkSync(CACHE_FILE_PATH);
                log.info('Cache file cleared for rescan', {
                    cacheFile: path.basename(CACHE_FILE_PATH),
                    cachePath: CACHE_FILE_PATH
                });
            } catch (unlinkError) {
                log.warn('Failed to clear cache file', { 
                    cacheFile: path.basename(CACHE_FILE_PATH),
                    cachePath: CACHE_FILE_PATH,
                    error: unlinkError.message 
                });
            }
        } else {
            log.info('No cache file to clear for rescan', {
                expectedCacheFile: path.basename(CACHE_FILE_PATH),
                expectedCachePath: CACHE_FILE_PATH
            });
        }
        
        const files = await loadMediaFiles();
        return files;
    } catch (error) {
        log.error('Directory rescan failed', { error: error.message });
        throw new Error('Failed to rescan directory');
    } finally {
        removeLockFile();
    }
}

module.exports = {
    initializeScanner,
    loadMediaFiles,
    rescanDirectory,
    filterMediaByType,
    get scannedMediaFiles() { return scannedMediaFiles; }
};

// Cleanup lock file on process exit
process.on('exit', () => {
    if (LOCK_FILE_PATH) {
        removeLockFile();
    }
});

process.on('SIGINT', () => {
    if (LOCK_FILE_PATH) {
        removeLockFile();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (LOCK_FILE_PATH) {
        removeLockFile();
    }
    process.exit(0);
});