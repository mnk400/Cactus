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

// Unified API endpoint to get media files with optional filtering
app.get('/api/media', (req, res) => {
    const mediaType = req.query.type || 'all';
    const tags = req.query.tags;
    const excludeTags = req.query['exclude-tags'];
    
    // Validate media type
    if (!['all', 'photos', 'videos'].includes(mediaType)) {
        return res.status(400).json({ 
            error: 'Invalid media type. Use "all", "photos", or "videos".' 
        });
    }
    
    try {
        let files;
        
        if (tags || excludeTags) {
            const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
            const excludeTagList = excludeTags ? excludeTags.split(',').map(t => t.trim()).filter(t => t) : [];
            files = mediaScanner.getDatabase().getMediaByTagsAndType(tagList, excludeTagList, mediaType);
        } else {
            files = mediaScanner.filterMediaByType(mediaType);
        }
        
        res.json({ 
            files: files,
            count: files.length,
            type: mediaType,
            filters: { 
                tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
                excludeTags: excludeTags ? excludeTags.split(',').map(t => t.trim()).filter(t => t) : []
            }
        });
    } catch (error) {
        log.error('Failed to retrieve media files', { mediaType, tags, excludeTags, error: error.message });
        res.status(500).json({ error: 'Failed to get media files' });
    }
});

// ===== TAG MANAGEMENT API ENDPOINTS =====

// Get all tags
app.get('/api/tags', (req, res) => {
    try {
        const database = mediaScanner.getDatabase();
        const tags = database.getAllTags();
        res.json({ tags });
    } catch (error) {
        log.error('Failed to get tags', { error: error.message });
        res.status(500).json({ error: 'Failed to get tags' });
    }
});

// Create a new tag
app.post('/api/tags', (req, res) => {
    const { name, color } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Tag name is required' });
    }
    
    try {
        const database = mediaScanner.getDatabase();
        const tag = database.createTag(name, color);
        log.info('Tag created', { tagId: tag.id, name: tag.name });
        res.json({ tag });
    } catch (error) {
        if (error.message === 'Tag already exists') {
            res.status(409).json({ error: 'Tag already exists' });
        } else {
            log.error('Failed to create tag', { name, error: error.message });
            res.status(500).json({ error: 'Failed to create tag' });
        }
    }
});

// Update a tag
app.put('/api/tags/:id', (req, res) => {
    const { id } = req.params;
    const { name, color } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Tag name is required' });
    }
    
    try {
        const database = mediaScanner.getDatabase();
        const tag = database.updateTag(parseInt(id), name, color);
        log.info('Tag updated', { tagId: id, name: tag.name });
        res.json({ tag });
    } catch (error) {
        if (error.message === 'Tag not found') {
            res.status(404).json({ error: 'Tag not found' });
        } else if (error.message === 'Tag name already exists') {
            res.status(409).json({ error: 'Tag name already exists' });
        } else {
            log.error('Failed to update tag', { id, name, error: error.message });
            res.status(500).json({ error: 'Failed to update tag' });
        }
    }
});

// Delete a tag
app.delete('/api/tags/:id', (req, res) => {
    const { id } = req.params;
    
    try {
        const database = mediaScanner.getDatabase();
        const deleted = database.deleteTag(parseInt(id));
        log.info('Tag deleted', { tagId: id });
        res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
        if (error.message === 'Tag not found') {
            res.status(404).json({ error: 'Tag not found' });
        } else {
            log.error('Failed to delete tag', { id, error: error.message });
            res.status(500).json({ error: 'Failed to delete tag' });
        }
    }
});

// ===== MEDIA TAGGING API ENDPOINTS =====

// Get tags for a specific media file
app.get('/api/media/:fileHash/tags', (req, res) => {
    const { fileHash } = req.params;
    
    try {
        const database = mediaScanner.getDatabase();
        const tags = database.getMediaTags(fileHash);
        res.json({ tags });
    } catch (error) {
        log.error('Failed to get media tags', { fileHash, error: error.message });
        res.status(500).json({ error: 'Failed to get media tags' });
    }
});

// Add tag(s) to a media file
app.post('/api/media/:fileHash/tags', (req, res) => {
    const { fileHash } = req.params;
    const { tagIds, tagNames } = req.body;
    
    if ((!tagIds || !Array.isArray(tagIds)) && (!tagNames || !Array.isArray(tagNames))) {
        return res.status(400).json({ error: 'tagIds or tagNames array is required' });
    }
    
    try {
        const database = mediaScanner.getDatabase();
        const results = [];
        
        // Handle tag IDs
        if (tagIds && Array.isArray(tagIds)) {
            for (const tagId of tagIds) {
                const added = database.addTagToMedia(fileHash, parseInt(tagId));
                results.push({ tagId: parseInt(tagId), added });
            }
        }
        
        // Handle tag names (create if they don't exist)
        if (tagNames && Array.isArray(tagNames)) {
            for (const tagName of tagNames) {
                let tag = database.getTagByName(tagName);
                if (!tag) {
                    tag = database.createTag(tagName);
                }
                const added = database.addTagToMedia(fileHash, tag.id);
                results.push({ tagId: tag.id, tagName: tag.name, added, created: !database.getTagByName(tagName) });
            }
        }
        
        log.info('Tags added to media', { fileHash, results });
        res.json({ results });
    } catch (error) {
        log.error('Failed to add tags to media', { fileHash, error: error.message });
        res.status(500).json({ error: 'Failed to add tags to media' });
    }
});

// Remove tag from media file
app.delete('/api/media/:fileHash/tags/:tagId', (req, res) => {
    const { fileHash, tagId } = req.params;
    
    try {
        const database = mediaScanner.getDatabase();
        const removed = database.removeTagFromMedia(fileHash, parseInt(tagId));
        
        if (removed) {
            log.info('Tag removed from media', { fileHash, tagId });
            res.json({ message: 'Tag removed successfully' });
        } else {
            res.status(404).json({ error: 'Tag assignment not found' });
        }
    } catch (error) {
        log.error('Failed to remove tag from media', { fileHash, tagId, error: error.message });
        res.status(500).json({ error: 'Failed to remove tag from media' });
    }
});

// Convenience endpoint: Get tags for media by file path
app.get('/api/media-path/tags', (req, res) => {
    const { path: filePath } = req.query;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    try {
        const database = mediaScanner.getDatabase();
        const fileHash = database.getFileHashForPath(filePath);
        const tags = database.getMediaTags(fileHash);
        res.json({ tags, fileHash });
    } catch (error) {
        log.error('Failed to get media tags by path', { filePath, error: error.message });
        res.status(500).json({ error: 'Failed to get media tags' });
    }
});

// Convenience endpoint: Add tags to media by file path
app.post('/api/media-path/tags', (req, res) => {
    const { path: filePath } = req.query;
    const { tagIds, tagNames } = req.body;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    if ((!tagIds || !Array.isArray(tagIds)) && (!tagNames || !Array.isArray(tagNames))) {
        return res.status(400).json({ error: 'tagIds or tagNames array is required' });
    }
    
    try {
        const database = mediaScanner.getDatabase();
        const fileHash = database.getFileHashForPath(filePath);
        
        // Forward to the hash-based endpoint logic
        req.params.fileHash = fileHash;
        
        const results = [];
        
        // Handle tag IDs
        if (tagIds && Array.isArray(tagIds)) {
            for (const tagId of tagIds) {
                const added = database.addTagToMedia(fileHash, parseInt(tagId));
                results.push({ tagId: parseInt(tagId), added });
            }
        }
        
        // Handle tag names (create if they don't exist)
        if (tagNames && Array.isArray(tagNames)) {
            for (const tagName of tagNames) {
                let tag = database.getTagByName(tagName);
                if (!tag) {
                    tag = database.createTag(tagName);
                }
                const added = database.addTagToMedia(fileHash, tag.id);
                results.push({ tagId: tag.id, tagName: tag.name, added });
            }
        }
        
        log.info('Tags added to media by path', { filePath, fileHash, results });
        res.json({ results, fileHash });
    } catch (error) {
        log.error('Failed to add tags to media by path', { filePath, error: error.message });
        res.status(500).json({ error: 'Failed to add tags to media' });
    }
});

// Backward compatibility endpoints (deprecated)
app.get('/get-media-files', (req, res) => {
    log.warn('Using deprecated endpoint /get-media-files, please use /api/media instead');
    const mediaType = req.query.type || 'all';
    
    try {
        const files = mediaScanner.filterMediaByType(mediaType);
        res.json({ files: files });
    } catch (error) {
        log.error('Failed to retrieve media files', { mediaType, error: error.message });
        res.status(500).json({ error: 'Failed to get media files' });
    }
});

app.get('/filter-media', (req, res) => {
    log.warn('Using deprecated endpoint /filter-media, please use /api/media instead');
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
