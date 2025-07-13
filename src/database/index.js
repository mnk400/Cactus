const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Simple structured logging
const log = {
  info: (message, meta = {}) =>
    console.log(
      JSON.stringify({
        level: "info",
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    ),
  error: (message, meta = {}) =>
    console.error(
      JSON.stringify({
        level: "error",
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    ),
  warn: (message, meta = {}) =>
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    ),
  debug: (message, meta = {}) =>
    console.log(
      JSON.stringify({
        level: "debug",
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    ),
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
      this.db.pragma("journal_mode = WAL"); // Better performance for concurrent reads
      this.db.pragma("synchronous = NORMAL"); // Good balance of safety and performance
      this.db.pragma("cache_size = 1000"); // Cache more pages in memory
      this.db.pragma("temp_store = memory"); // Store temp tables in memory

      this.initializeSchema();
      this.isInitialized = true;

      log.info("Database initialized successfully", {
        dbPath: this.dbPath,
        version: this.getDatabaseVersion(),
      });
    } catch (error) {
      log.error("Failed to initialize database", {
        dbPath: this.dbPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create the database schema
   */
  initializeSchema() {
    const schema = `
            CREATE TABLE IF NOT EXISTS media_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash TEXT UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
                thumbnail_path TEXT,
                date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                date_created DATETIME,
                date_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#3B82F6',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS media_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_hash) REFERENCES media_files(file_hash) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                UNIQUE(file_hash, tag_id)
            );

            CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash);
            CREATE INDEX IF NOT EXISTS idx_media_files_path ON media_files(file_path);
            CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(media_type);
            CREATE INDEX IF NOT EXISTS idx_media_files_last_seen ON media_files(last_seen);
            CREATE INDEX IF NOT EXISTS idx_media_tags_file_hash ON media_tags(file_hash);
            CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON media_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

            CREATE TABLE IF NOT EXISTS database_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            INSERT OR REPLACE INTO database_metadata (key, value) VALUES ('version', '1.2.0');
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
        return crypto
          .createHash("sha256")
          .update(`empty-${path.basename(filePath)}-${fileSize}`)
          .digest("hex");
      }

      const hash = crypto.createHash("sha256");
      const filename = path.basename(filePath);

      hash.update(fileSize.toString());
      hash.update(filename);

      const fd = fs.openSync(filePath, "r");

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

        const generatedHash = hash.digest("hex");
        return generatedHash;
      } finally {
        fs.closeSync(fd);
      }
    } catch (error) {
      log.error("Failed to generate file hash", {
        filePath,
        error: error.message,
      });
      // Fallback to path-based hash if file reading fails
      return crypto.createHash("sha256").update(filePath).digest("hex");
    }
  }

  /**
   * Insert a new media file into the database
   */
  insertMediaFile(
    filePath,
    mediaType,
    fileHash,
    thumbnailPath = null,
    dateCreated = null,
  ) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stats = fs.statSync(filePath);
      const filename = path.basename(filePath);
      const fileSize = stats.size;
      const now = new Date().toISOString();
      const fileCreationTime = dateCreated
        ? new Date(dateCreated).toISOString()
        : now;

      const stmt = this.db.prepare(`
                INSERT INTO media_files (file_hash, file_path, filename, file_size, media_type, thumbnail_path, date_added, date_created, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

      const result = stmt.run(
        fileHash,
        filePath,
        filename,
        fileSize,
        mediaType,
        thumbnailPath,
        now,
        fileCreationTime,
        now,
      );

      return {
        id: result.lastInsertRowid,
        fileHash,
        filePath,
        filename,
        fileSize,
        mediaType,
        thumbnailPath,
      };
    } catch (error) {
      log.error("Failed to insert media file", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add or update a media file in the database
   */
  upsertMediaFile(filePath, mediaType, thumbnailPath = null) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stats = fs.statSync(filePath);
      const fileHash = this.generateFileHash(filePath);
      const filename = path.basename(filePath);
      const fileSize = stats.size;
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
                INSERT INTO media_files (file_hash, file_path, filename, file_size, media_type, thumbnail_path, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_hash) DO UPDATE SET
                    file_path = excluded.file_path,
                    filename = excluded.filename,
                    thumbnail_path = excluded.thumbnail_path,
                    last_seen = excluded.last_seen,
                    date_modified = CASE 
                        WHEN file_size != excluded.file_size THEN excluded.last_seen 
                        ELSE date_modified 
                    END,
                    file_size = excluded.file_size
            `);

      const result = stmt.run(
        fileHash,
        filePath,
        filename,
        fileSize,
        mediaType,
        thumbnailPath,
        now,
      );

      return {
        fileHash,
        filePath,
        filename,
        fileSize,
        mediaType,
        thumbnailPath,
        isNew: result.changes > 0 && result.lastInsertRowid > 0,
      };
    } catch (error) {
      log.error("Failed to upsert media file", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all media files, optionally filtered by type
   */
  getAllMedia(sortBy = "random", mediaType = "all") {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      let orderByClause;
      switch (sortBy) {
        case "date_created":
          orderByClause = "ORDER BY date_created DESC";
          break;
        case "date_added":
          orderByClause = "ORDER BY date_added DESC";
          break;
        default:
          orderByClause = "ORDER BY RANDOM()";
          break;
      }

      let query = `SELECT * FROM media_files ${orderByClause}`;
      let params = [];

      if (mediaType !== "all") {
        const dbMediaType =
          mediaType === "photos"
            ? "image"
            : mediaType === "videos"
            ? "video"
            : mediaType;
        query = `SELECT * FROM media_files WHERE media_type = ? ${orderByClause}`;
        params = [dbMediaType];
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      return rows;
    } catch (error) {
      log.error("Failed to get all media", {
        sortBy,
        mediaType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media file by hash
   */
  getMediaFileByHash(fileHash) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(
        "SELECT * FROM media_files WHERE file_hash = ?",
      );
      return stmt.get(fileHash);
    } catch (error) {
      log.error("Failed to get media file by hash", {
        fileHash,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media file by path
   */
  getMediaFileByPath(filePath) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(
        "SELECT * FROM media_files WHERE file_path = ?",
      );
      return stmt.get(filePath);
    } catch (error) {
      log.error("Failed to get media file by path", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media files by path substring.
   */
  getMediaByPathSubstring(substring) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(
        "SELECT * FROM media_files WHERE file_path LIKE ?",
      );
      const rows = stmt.all(`%${substring}%`);
      return rows;
    } catch (error) {
      log.error("Failed to get media by path substring", {
        substring,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get file hash for a given file path (generates if not in database)
   */
  getFileHashForPath(filePath) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      // First try to get from database
      const mediaFile = this.getMediaFileByPath(filePath);
      if (mediaFile) {
        return mediaFile.file_hash;
      }

      // If not in database, generate hash
      return this.generateFileHash(filePath);
    } catch (error) {
      log.error("Failed to get file hash for path", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove orphaned files (not seen in the last X days)
   */
  cleanupOrphanedFiles(daysOld = 30) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const stmt = this.db.prepare(`
                DELETE FROM media_files 
                WHERE last_seen < ? AND datetime(last_seen) < datetime(?)
            `);

      const result = stmt.run(
        cutoffDate.toISOString(),
        cutoffDate.toISOString(),
      );

      if (result.changes > 0) {
        log.info("Cleaned up orphaned files", {
          removedCount: result.changes,
          olderThanDays: daysOld,
        });
      }

      return result.changes;
    } catch (error) {
      log.error("Failed to cleanup orphaned files", { error: error.message });
      throw error;
    }
  }

  /**
   * Remove entries for files that no longer exist on the filesystem.
   */
  cleanupNonExistentFiles() {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    let removedCount = 0;
    try {
      const allFiles = this.db
        .prepare("SELECT file_hash, file_path FROM media_files")
        .all();

      this.db.transaction(() => {
        for (const file of allFiles) {
          if (!fs.existsSync(file.file_path)) {
            const stmt = this.db.prepare(
              "DELETE FROM media_files WHERE file_hash = ?",
            );
            const result = stmt.run(file.file_hash);
            if (result.changes > 0) {
              removedCount += result.changes;
              log.info("Removed non-existent file from database", {
                filePath: file.file_path,
                fileHash: file.file_hash,
              });
            }
          }
        }
      })();

      if (removedCount > 0) {
        log.info("Cleaned up non-existent files", { removedCount });
      }

      return removedCount;
    } catch (error) {
      log.error("Failed to cleanup non-existent files", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const totalStmt = this.db.prepare(
        "SELECT COUNT(*) as count FROM media_files",
      );
      const imageStmt = this.db.prepare(
        "SELECT COUNT(*) as count FROM media_files WHERE media_type = ?",
      );
      const videoStmt = this.db.prepare(
        "SELECT COUNT(*) as count FROM media_files WHERE media_type = ?",
      );

      const total = totalStmt.get().count;
      const images = imageStmt.get("image").count;
      const videos = videoStmt.get("video").count;

      return {
        total,
        images,
        videos,
      };
    } catch (error) {
      log.error("Failed to get database stats", { error: error.message });
      throw error;
    }
  }

  /**
   * Get database version
   */
  getDatabaseVersion() {
    if (!this.isInitialized) {
      return "unknown";
    }

    try {
      const stmt = this.db.prepare(
        "SELECT value FROM database_metadata WHERE key = ?",
      );
      const result = stmt.get("version");
      return result ? result.value : "unknown";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      log.info("Database connection closed.", { dbPath: this.dbPath });
    }
  }

  /**
   * Run database maintenance (cleanup + optimize)
   */
  maintenance() {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      // Cleanup orphaned files (not seen in the last X days)
      const removedOrphanedByDate = this.cleanupOrphanedFiles();

      // Cleanup files that no longer exist on the filesystem
      const removedNonExistentFiles = this.cleanupNonExistentFiles();

      // Cleanup orphaned tags
      const removedTags = this.cleanupOrphanedTags();

      // Optimize database
      this.db.pragma("optimize");
      this.db.exec("VACUUM");

      log.info("Database maintenance completed", {
        removedOrphanedFilesByDate: removedOrphanedByDate,
        removedNonExistentFiles: removedNonExistentFiles,
        removedOrphanedTags: removedTags,
      });

      return {
        removedOrphanedFilesByDate: removedOrphanedByDate,
        removedNonExistentFiles: removedNonExistentFiles,
        removedOrphanedTags: removedTags,
      };
    } catch (error) {
      log.error("Database maintenance failed", { error: error.message });
      throw error;
    }
  }

  // ===== TAG MANAGEMENT METHODS =====

  /**
   * Create a new tag
   */
  createTag(name, color = "#3B82F6") {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                INSERT INTO tags (name, color) VALUES (?, ?)
            `);

      const result = stmt.run(name.trim(), color);

      return {
        id: result.lastInsertRowid,
        name: name.trim(),
        color: color,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error("Tag already exists");
      }
      log.error("Failed to create tag", { name, error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing tag
   */
  updateTag(id, name, color) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                UPDATE tags SET name = ?, color = ? WHERE id = ?
            `);

      const result = stmt.run(name.trim(), color, id);

      if (result.changes === 0) {
        throw new Error("Tag not found");
      }

      return this.getTagById(id);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error("Tag name already exists");
      }
      log.error("Failed to update tag", { id, name, error: error.message });
      throw error;
    }
  }

  /**
   * Update thumbnail path for a media file
   */
  updateMediaFileThumbnail(fileHash, thumbnailPath) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                UPDATE media_files SET thumbnail_path = ? WHERE file_hash = ?
            `);
      const result = stmt.run(thumbnailPath, fileHash);
      return result.changes > 0;
    } catch (error) {
      log.error("Failed to update media file thumbnail", {
        fileHash,
        thumbnailPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a tag (removes from all media)
   */
  deleteTag(id) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare("DELETE FROM tags WHERE id = ?");
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new Error("Tag not found");
      }

      return result.changes;
    } catch (error) {
      log.error("Failed to delete tag", { id, error: error.message });
      throw error;
    }
  }

  /**
   * Get all tags with usage counts
   */
  getAllTags() {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                SELECT t.*, COUNT(mt.tag_id) as usage_count
                FROM tags t
                LEFT JOIN media_tags mt ON t.id = mt.tag_id
                GROUP BY t.id
                ORDER BY t.name
            `);

      return stmt.all();
    } catch (error) {
      log.error("Failed to get all tags", { error: error.message });
      throw error;
    }
  }

  /**
   * Get tag by ID
   */
  getTagById(id) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare("SELECT * FROM tags WHERE id = ?");
      return stmt.get(id);
    } catch (error) {
      log.error("Failed to get tag by ID", { id, error: error.message });
      throw error;
    }
  }

  /**
   * Get tag by name
   */
  getTagByName(name) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare("SELECT * FROM tags WHERE name = ?");
      return stmt.get(name.trim());
    } catch (error) {
      log.error("Failed to get tag by name", { name, error: error.message });
      throw error;
    }
  }

  /**
   * Add tag to media file
   */
  addTagToMedia(fileHash, tagId) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                INSERT INTO media_tags (file_hash, tag_id) VALUES (?, ?)
            `);

      const result = stmt.run(fileHash, tagId);
      return result.changes > 0;
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        // Tag already assigned to this media file
        return false;
      }
      log.error("Failed to add tag to media", {
        fileHash,
        tagId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove tag from media file
   */
  removeTagFromMedia(fileHash, tagId) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                DELETE FROM media_tags WHERE file_hash = ? AND tag_id = ?
            `);

      const result = stmt.run(fileHash, tagId);
      return result.changes > 0;
    } catch (error) {
      log.error("Failed to remove tag from media", {
        fileHash,
        tagId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all tags for a media file
   */
  getMediaTags(fileHash) {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                SELECT t.* FROM tags t
                JOIN media_tags mt ON t.id = mt.tag_id
                WHERE mt.file_hash = ?
                ORDER BY mt.created_at
            `);
      return stmt.all(fileHash);
    } catch (error) {
      log.error("Failed to get media tags", { fileHash, error: error.message });
      throw error;
    }
  }

  /**
   * Get media files filtered by tags and type
   */
  getMediaByTagsAndType(includeTags = [], excludeTags = [], mediaType = "all") {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      log.info("Starting tag-based media filtering", {
        includeTags,
        excludeTags,
        mediaType,
        includeCount: includeTags.length,
        excludeCount: excludeTags.length,
      });

      let query = `SELECT DISTINCT mf.* FROM media_files mf`;
      let params = [];
      let whereConditions = [];

      // Handle media type filtering
      if (mediaType !== "all") {
        const dbMediaType =
          mediaType === "photos"
            ? "image"
            : mediaType === "videos"
              ? "video"
              : mediaType;
        whereConditions.push("mf.media_type = ?");
        params.push(dbMediaType);
        log.debug("Added media type filter", { mediaType, dbMediaType });
      }

      // Handle include tags (AND logic - media must have ALL specified tags)
      if (includeTags.length > 0) {
        const tagPlaceholders = includeTags.map(() => "?").join(",");
        query += `
                    JOIN media_tags mt_include ON mf.file_hash = mt_include.file_hash
                    JOIN tags t_include ON mt_include.tag_id = t_include.id
                `;
        whereConditions.push(`t_include.name IN (${tagPlaceholders})`);
        params.push(...includeTags);
        log.debug("Added include tags filter", {
          includeTags,
          tagPlaceholders,
        });
      }

      // Handle exclude tags
      if (excludeTags.length > 0) {
        const tagPlaceholders = excludeTags.map(() => "?").join(",");
        whereConditions.push(`
                    mf.file_hash NOT IN (
                        SELECT mt_exclude.file_hash 
                        FROM media_tags mt_exclude
                        JOIN tags t_exclude ON mt_exclude.tag_id = t_exclude.id
                        WHERE t_exclude.name IN (${tagPlaceholders})
                    )
                `);
        params.push(...excludeTags);
        log.debug("Added exclude tags filter", {
          excludeTags,
          tagPlaceholders,
        });
      }

      // Add WHERE clause if we have conditions
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      // Handle grouping for include tags (ensure all tags are present)
      if (includeTags.length > 0) {
        query += ` GROUP BY mf.file_hash HAVING COUNT(DISTINCT t_include.id) = ?`;
        params.push(includeTags.length);
        log.debug("Added grouping for include tags", {
          requiredTagCount: includeTags.length,
        });
      }

      // Add ordering
      query += ` ORDER BY mf.date_added DESC`;

      log.debug("Executing tag filter query", {
        query: query.replace(/\s+/g, " ").trim(),
        paramCount: params.length,
      });

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      const result = rows;

      log.info("Tag filtering query completed", {
        includeTags,
        excludeTags,
        mediaType,
        resultCount: result.length,
        executionTime: "completed",
      });

      return result;
    } catch (error) {
      log.error("Failed to get media by tags and type", {
        includeTags,
        excludeTags,
        mediaType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove tags that are not assigned to any media files
   */
  cleanupOrphanedTags() {
    if (!this.isInitialized) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
                DELETE FROM tags 
                WHERE id NOT IN (
                    SELECT DISTINCT tag_id FROM media_tags
                )
            `);

      const result = stmt.run();

      if (result.changes > 0) {
        log.info("Cleaned up orphaned tags", { removedCount: result.changes });
      }

      return result.changes;
    } catch (error) {
      log.error("Failed to cleanup orphaned tags", { error: error.message });
      throw error;
    }
  }
}

module.exports = MediaDatabase;
