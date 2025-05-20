const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

// Get directory path from command line arguments
let directoryPath = process.argv[2];

// Cache file path - generate a unique name based on the directory path
// Used to create a unique cache file for input directory to decrease
// server startup time
let cacheFileName;
let CACHE_FILE_PATH;

// Define media type extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.MP4', '.webm', '.mov', '.avi', '.mkv', '.ogg'];

function initializeScanner(dirPath) {
    directoryPath = dirPath;
    cacheFileName = `.${crypto.createHash('md5').update(directoryPath).digest('hex')}_media_cache.json`;
    CACHE_FILE_PATH = path.join(process.cwd(), 'configuration', cacheFileName);
    console.log(`Initialized media scanner for directory: ${directoryPath}`);
    console.log(`Cache file name and path: ${CACHE_FILE_PATH}`);
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
                    } else {
                        // console.log(`Skipping unsupported file: ${filePath}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
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
        console.error('Media scanner not initialized. Call initializeScanner first.');
        return [];
    }

    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            console.log(`Reading from cache: ${CACHE_FILE_PATH}`);
            const cachedData = JSON.parse(await readFile(CACHE_FILE_PATH, 'utf-8'));
            // check if the cached directory path matches the current one
            // if not, scan the new directory
            if (cachedData.directoryPath === directoryPath) {
                allMediaFiles = cachedData.files;
                scannedMediaFiles = [...allMediaFiles]; // Create a fresh copy to avoid reference issues
                
                // Log media type counts
                const imageCount = allMediaFiles.filter(file => isImage(file)).length;
                const videoCount = allMediaFiles.filter(file => isVideo(file)).length;
                console.log(`Loaded ${allMediaFiles.length} media files from cache (${imageCount} images, ${videoCount} videos).`);
                
                return scannedMediaFiles;
            }
            console.log('Cache is for a different directory. Re-scanning.');
        }
    } catch (error) {
        console.error('Error reading cache file, re-scanning:', error);
        // If cache is invalid or unreadable, proceed to scan
    }

    console.log(`Scanning directory: ${directoryPath}`);
    allMediaFiles = await scanDirectory(directoryPath);
    scannedMediaFiles = [...allMediaFiles]; // Create a fresh copy to avoid reference issues
    
    // Log media type counts
    const imageCount = allMediaFiles.filter(file => isImage(file)).length;
    const videoCount = allMediaFiles.filter(file => isVideo(file)).length;
    console.log(`Found ${allMediaFiles.length} media files after scan.`);
    try {
        await writeFile(CACHE_FILE_PATH, JSON.stringify({ directoryPath, files: allMediaFiles }, null, 2));
        console.log(`Cache saved to ${CACHE_FILE_PATH}`);
    } catch (error) {
        console.error('Error writing to cache file:', error);
    }
    return scannedMediaFiles;
}

// Function to filter media files by type
function filterMediaByType(mediaType) {
    if (!allMediaFiles || allMediaFiles.length === 0) {
        console.error('No media files loaded to filter');
        return [];
    }

    console.log(`Filtering media by type: ${mediaType}`);
    console.log(`Total media files before filtering: ${allMediaFiles.length}`);
    
    const imageCount = allMediaFiles.filter(file => isImage(file)).length;
    const videoCount = allMediaFiles.filter(file => isVideo(file)).length;
    console.log(`Available media: ${imageCount} images, ${videoCount} videos`);
    
    let filteredFiles;
    
    switch (mediaType) {
        case 'photos':
            filteredFiles = allMediaFiles.filter(file => isImage(file));
            console.log(`Selected ${filteredFiles.length} photos`);
            break;
        case 'videos':
            filteredFiles = allMediaFiles.filter(file => isVideo(file));
            console.log(`Selected ${filteredFiles.length} videos`);
            break;
        case 'all':
        default:
            // Create a fresh copy of all media files
            filteredFiles = [...allMediaFiles];
            console.log(`Selected all ${filteredFiles.length} media files`);
            break;
    }
    
    scannedMediaFiles = filteredFiles;
    return scannedMediaFiles;
}

// Function to trigger a rescan of the directory
// deletes the existing cache file and scans the directory again
// using the loadMediaFiles function
async function rescanDirectory() {
    console.log('Rescan request received.');
    if (!directoryPath) {
        console.error('Media scanner not initialized. Call initializeScanner first.');
        return [];
    }
    try {
        // Clear existing cache file if it exists
        if (fs.existsSync(CACHE_FILE_PATH)) {
            try {
                fs.unlinkSync(CACHE_FILE_PATH);
                console.log(`Cleared cache file: ${CACHE_FILE_PATH}`);
            } catch (unlinkError) {
                console.error(`Error clearing cache file ${CACHE_FILE_PATH}:`, unlinkError);
                // Continue with scan even if cache deletion fails
            }
        }
        
        const files = await loadMediaFiles();
        return files;
    } catch (error) {
        console.error('Error during rescan:', error);
        throw new Error('Failed to rescan directory');
    }
}

module.exports = {
    initializeScanner,
    loadMediaFiles,
    rescanDirectory,
    filterMediaByType,
    get scannedMediaFiles() { return scannedMediaFiles; }
};