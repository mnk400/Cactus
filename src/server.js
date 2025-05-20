const express = require('express');
const path = require('path');
const fs = require('fs');
const mediaScanner = require('./mediaScanner');
const minimist = require('minimist');

const app = express();
const argv = minimist(process.argv.slice(2));

const PORT = argv.p || process.env.PORT || 3000;
const directoryPath = argv.d;

if (!directoryPath) {
    console.error('Error: Directory path is required');
    process.exit(1);
}

try {
    const dirStat = fs.statSync(directoryPath);
    if (!dirStat.isDirectory()) {
        console.error('Error: The provided path is not a directory');
        process.exit(1);
    }
} catch (error) {
    console.error('Error: Directory does not exist' + error);
    process.exit(1);
}

app.use(express.static(path.join(__dirname, 'views')));
app.use(express.json());

// Function to recursively scan directory for media files
// Initialize and load media files on server startup
(async () => {
    mediaScanner.initializeScanner(directoryPath);
    await mediaScanner.loadMediaFiles();
})();

// API endpoint to get media files
app.get('/get-media-files', (req, res) => {
    const mediaType = req.query.type || 'all';
    console.log(`GET /get-media-files - Requested media type: ${mediaType}`);
    
    try {
        // Always explicitly filter by the requested type
        const files = mediaScanner.filterMediaByType(mediaType);
        console.log(`Returning ${files.length} ${mediaType} files to client`);
        res.json({ files: files });
    } catch (error) {
        console.error('Error getting media files:', error);
        res.status(500).json({ error: 'Failed to get media files' });
    }
});

// API endpoint to filter media files by type
app.get('/filter-media', (req, res) => {
    const { type } = req.query;
    
    if (!type || !['all', 'photos', 'videos'].includes(type)) {
        return res.status(400).json({ error: 'Invalid media type. Use "all", "photos", or "videos".' });
    }
    
    try {
        const filteredFiles = mediaScanner.filterMediaByType(type);
        res.json({ 
            files: filteredFiles, 
            message: `Filtered to ${filteredFiles.length} ${type} files.` 
        });
    } catch (error) {
        console.error('Error filtering media:', error);
        res.status(500).json({ error: 'Failed to filter media files' });
    }
});

// API endpoint to trigger a rescan of the directory
app.post('/rescan-directory', async (req, res) => {
    console.log('Rescan request received.');
    try {
        const files = await mediaScanner.rescanDirectory();
        res.json({ files: files, message: `Rescan complete. Found ${files.length} files.` });
    } catch (error) {
        console.error('Error during rescan:', error);
        res.status(500).json({ error: 'Failed to rescan directory' });
    }
});

// API endpoint to serve media files
app.get('/media', (req, res) => {
    try {
        const { path: filePath } = req.query;
        
        if (!filePath) {
            return res.status(400).send('File path is required');
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).send('File not found');
        }

        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving media file:', error);
        res.status(500).send('Failed to serve media file');
    }
});

// Simply serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});