const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Simple structured logging
const log = {
    info: (message, meta = {}) => console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() })),
    error: (message, meta = {}) => console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() })),
    warn: (message, meta = {}) => console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }))
};

class MediaDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the database connection and schema
     */
    initialize() {
        try {
            // Ensure the database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL'); // Better performance for concurrent reads
            this.db.pragma('synchronous = NORMAL'); // Good balance of safety and performance
            this.db.pragma('cache_size = 1000'); // Cache more pages in memory
            this.db.pragma('temp_store = memory'); // Store temp tables in memory
            
            this.initializeSchema();
            this.isInitialized = true;
            
            log.info('Database initialized successfully', { 
                dbPath: this.dbPath,
                version: this.getDatabaseVersion()
            });
        } catch (error) {
            log.error('Failed to initialize database', { 
                dbPath: this.dbPath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Create the database schema
     */
    initializeSchema() {
        const schema = `
            -- Media files table with content-based identification
            CREATE TABLE IF NOT EXISTS media_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash TEXT UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
                date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                date_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash);
            CREATE INDEX IF NOT EXISTS idx_media_files_path ON media_files(file_path);
            CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(media_type);
            CREATE INDEX IF NOT EXISTS idx_media_files_last_seen ON media_files(last_seen);

            -- Database metadata table
            CREATE TABLE IF NOT EXISTS database_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Insert database version
            INSERT OR REPLACE INTO database_metadata (key, value) VALUES ('version', '1.0.0');
            INSERT OR REPLACE INTO database_metadata (key, value) VALUES ('created_at', datetime('now'));
        `;

        this.db.exec(schema);
    }

    /**
     * Generate a content-based hash for file identification
     * Uses first 64KB + last 64KB + file size for fast, unique identification
     */
    generateFileHash(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            if (fileSize === 0) {
                // Handle empty files
                return crypto.createHash('sha256').update(`empty-${path.basename(filePath)}-${fileSize}`).digest('hex');
            }

            const hash = crypto.createHash('sha256');
            hash.update(fileSize.toString());
            hash.update(path.basename(filePath)); // Include filename for additional uniqueness
            
            const fd = fs.openSync(filePath, 'r');
            
            try {
                // Read first chunk (up to 64KB)
                const firstChunkSize = Math.min(65536, fileSize);
                const firstChunk = Buffer.alloc(firstChunkSize);
                fs.readSync(fd, firstChunk, 0, firstChunkSize, 0);
                hash.update(firstChunk);
                
                // Read last chunk if file is large enough (and different from first chunk)
                if (fileSize > 65536) {
                    const lastChunk = Buffer.alloc(65536);
                    fs.readSync(fd, lastChunk, 0, 65536, fileSize - 65536);
                    hash.update(lastChunk);
                }
                
                return hash.digest('hex');
            } finally {
                fs.closeSync(fd);
            }
        } catch (error) {
            log.error('Failed to generate file hash', { filePath, error: error.message });
            // Fallback to path-based hash if file reading fails
            return crypto.createHash('sha256').update(filePath).digest('hex');
        }
    }

    /**
     * Add or update a media file in the database
     */
    upsertMediaFile(filePath, mediaType) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            const stats = fs.statSync(filePath);
            const fileHash = this.generateFileHash(filePath);
            const filename = path.basename(filePath);
            const fileSize = stats.size;
            const now = new Date().toISOString();

            const stmt = this.db.prepare(`
                INSERT INTO media_files (file_hash, file_path, filename, file_size, media_type, last_seen)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_hash) DO UPDATE SET
                    file_path = excluded.file_path,
                    filename = excluded.filename,
                    last_seen = excluded.last_seen,
                    date_modified = CASE 
                        WHEN file_size != excluded.file_size THEN excluded.last_seen 
                        ELSE date_modified 
                    END,
                    file_size = excluded.file_size
            `);

            const result = stmt.run(fileHash, filePath, filename, fileSize, mediaType, now);
            
            return {
                fileHash,
                filePath,
                filename,
                fileSize,
                mediaType,
                isNew: result.changes > 0 && result.lastInsertRowid > 0
            };
        } catch (error) {
            log.error('Failed to upsert media file', { filePath, error: error.message });
            throw error;
        }
    }

    /**
     * Get all media files, optionally filtered by type
     */
    getMediaFiles(mediaType = 'all') {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            let query = 'SELECT * FROM media_files ORDER BY date_added DESC';
            let params = [];

            if (mediaType !== 'all') {
                const dbMediaType = mediaType === 'photos' ? 'image' : mediaType === 'videos' ? 'video' : mediaType;
                query = 'SELECT * FROM media_files WHERE media_type = ? ORDER BY date_added DESC';
                params = [dbMediaType];
            }

            const stmt = this.db.prepare(query);
            const rows = stmt.all(...params);

            // Convert to the format expected by the frontend (array of file paths)
            return rows.map(row => row.file_path);
        } catch (error) {
            log.error('Failed to get media files', { mediaType, error: error.message });
            throw error;
        }
    }

    /**
     * Get media file by hash
     */
    getMediaFileByHash(fileHash) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            const stmt = this.db.prepare('SELECT * FROM media_files WHERE file_hash = ?');
            return stmt.get(fileHash);
        } catch (error) {
            log.error('Failed to get media file by hash', { fileHash, error: error.message });
            throw error;
        }
    }

    /**
     * Get media file by path
     */
    getMediaFileByPath(filePath) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            const stmt = this.db.prepare('SELECT * FROM media_files WHERE file_path = ?');
            return stmt.get(filePath);
        } catch (error) {
            log.error('Failed to get media file by path', { filePath, error: error.message });
            throw error;
        }
    }

    /**
     * Remove orphaned files (not seen in the last X days)
     */
    cleanupOrphanedFiles(daysOld = 30) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            const stmt = this.db.prepare(`
                DELETE FROM media_files 
                WHERE last_seen < ? AND datetime(last_seen) < datetime(?)
            `);
            
            const result = stmt.run(cutoffDate.toISOString(), cutoffDate.toISOString());
            
            if (result.changes > 0) {
                log.info('Cleaned up orphaned files', { 
                    removedCount: result.changes, 
                    olderThanDays: daysOld 
                });
            }
            
            return result.changes;
        } catch (error) {
            log.error('Failed to cleanup orphaned files', { error: error.message });
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    getStats() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM media_files');
            const imageStmt = this.db.prepare('SELECT COUNT(*) as count FROM media_files WHERE media_type = ?');
            const videoStmt = this.db.prepare('SELECT COUNT(*) as count FROM media_files WHERE media_type = ?');
            
            const total = totalStmt.get().count;
            const images = imageStmt.get('image').count;
            const videos = videoStmt.get('video').count;

            return {
                total,
                images,
                videos
            };
        } catch (error) {
            log.error('Failed to get database stats', { error: error.message });
            throw error;
        }
    }

    /**
     * Get database version
     */
    getDatabaseVersion() {
        if (!this.isInitialized) {
            return 'unknown';
        }

        try {
            const stmt = this.db.prepare('SELECT value FROM database_metadata WHERE key = ?');
            const result = stmt.get('version');
            return result ? result.value : 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            try {
                this.db.close();
                this.isInitialized = false;
                log.info('Database connection closed');
            } catch (error) {
                log.error('Error closing database', { error: error.message });
            }
        }
    }

    /**
     * Run database maintenance (cleanup + optimize)
     */
    maintenance() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        try {
            // Cleanup orphaned files
            const removedCount = this.cleanupOrphanedFiles();
            
            // Optimize database
            this.db.pragma('optimize');
            this.db.exec('VACUUM');
            
            log.info('Database maintenance completed', { removedOrphanedFiles: removedCount });
            
            return { removedOrphanedFiles: removedCount };
        } catch (error) {
            log.error('Database maintenance failed', { error: error.message });
            throw error;
        }
    }
}

module.exports = MediaDatabase;
