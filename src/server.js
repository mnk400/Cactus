const express = require('express');
const path = require('path');
const fs = require('fs');
const mediaScanner = require('./mediaScannerSQLite');
const minimist = require('minimist');

const app = express();
const argv = minimist(process.argv.slice(2));

const PORT = argv.p || process.env.PORT || 3000;
const directoryPath = argv.d;

// Simple structured logging
const log = {
    info: (message, meta = {}) => console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() })),
    error: (message, meta = {}) => console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() })),
    warn: (message, meta = {}) => console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }))
};

if (!directoryPath) {
    log.error('Directory path is required', { usage: 'node server.js -d /path/to/media -p 3000' });
    process.exit(1);
}

try {
    const dirStat = fs.statSync(directoryPath);
    if (!dirStat.isDirectory()) {
        log.error('Provided path is not a directory', { path: directoryPath });
        process.exit(1);
    }
} catch (error) {
    log.error('Directory does not exist or is not accessible', { path: directoryPath, error: error.message });
    process.exit(1);
}

// Serve React build from dist directory
const reactBuildPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(reactBuildPath)) {
    app.use(express.static(reactBuildPath));
    log.info('Serving React application from dist directory');
} else {
    log.error('React build not found. Please run "npm run build" first.');
    process.exit(1);
}

app.use(express.json());

// Initialize and load media files on server startup
(async () => {
    mediaScanner.initializeScanner(directoryPath);
    await mediaScanner.loadMediaFiles();
})();

// API endpoint to get media files
app.get('/get-media-files', (req, res) => {
    const mediaType = req.query.type || 'all';
    
    try {
        const files = mediaScanner.filterMediaByType(mediaType);
        res.json({ files: files });
    } catch (error) {
        log.error('Failed to retrieve media files', { mediaType, error: error.message });
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
        log.error('Failed to filter media files', { type, error: error.message });
        res.status(500).json({ error: 'Failed to filter media files' });
    }
});

// API endpoint to trigger a rescan of the directory
app.post('/rescan-directory', async (req, res) => {
    try {
        const files = await mediaScanner.rescanDirectory();
        log.info('Directory rescan completed', { fileCount: files.length });
        res.json({ files: files, message: `Rescan complete. Found ${files.length} files.` });
    } catch (error) {
        log.error('Directory rescan failed', { error: error.message });
        
        if (error.message === 'Scan already in progress') {
            res.status(409).json({ error: 'Scan already in progress. Please wait for the current scan to complete.' });
        } else {
            res.status(500).json({ error: error.message || 'Failed to rescan directory' });
        }
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
        log.error('Failed to serve media file', { filePath: req.query.path, error: error.message });
        res.status(500).send('Failed to serve media file');
    }
});

// API endpoint to get database statistics
app.get('/api/stats', (req, res) => {
    try {
        const stats = mediaScanner.getStats();
        const database = mediaScanner.getDatabase();
        
        res.json({
            ...stats,
            database: {
                version: database ? database.getDatabaseVersion() : 'unknown',
                path: database ? database.dbPath : 'unknown'
            }
        });
    } catch (error) {
        log.error('Failed to get database statistics', { error: error.message });
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Serve React app for all other routes (SPA routing)
app.get('*', (req, res) => {
    const indexPath = path.join(reactBuildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send('React build not found. Please run "npm run build" first.');
    }
});

app.listen(PORT, () => {
    log.info('Cactus media server started', { 
        port: PORT, 
        directory: directoryPath,
        version: 'React + SQLite',
        storage: 'SQLite Database'
    });
});
