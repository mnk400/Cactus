/**
 * LocalMediaProvider
 *
 * Implementation of MediaSourceProvider for local file system media.
 * This provider uses the existing SQLite database for media management.
 */

const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const crypto = require("crypto");
const MediaDatabase = require("../database");
const MediaSourceProvider = require("./MediaSourceProvider");

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

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
};

// Define media type extensions
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const VIDEO_EXTENSIONS = [
  ".mp4",
  ".MP4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".ogg",
];

class LocalMediaProvider extends MediaSourceProvider {
  constructor(directoryPath) {
    super();
    this.providerType = "local";
    this.directoryPath = directoryPath;
    this.mediaDatabase = null;
    this.isInitialized = false;
    this.LOCK_FILE_PATH = null;
    this.THUMBNAIL_DIR = null;
  }

  /**
   * Get provider configuration requirements
   * @returns {Object} Configuration schema
   */
  static getConfigSchema() {
    return {
      description: "Local file system media provider",
      example: "node server.js --provider local -d /path/to/media -p 3000",
      requiredArgs: [
        {
          name: "directoryPath",
          flag: "-d",
          description: "Path to the media directory",
          type: "string",
        },
      ],
      optionalArgs: [
        {
          name: "port",
          flag: "-p",
          description: "Server port",
          type: "number",
          default: 3000,
        },
      ],
    };
  }

  /**
   * Validate configuration arguments
   * @param {Object} args - Command line arguments
   * @returns {Object} Validation result
   */
  static validateConfig(args) {
    const fs = require("fs");

    if (!args.d) {
      return {
        success: false,
        error: "Directory path is required for local provider",
        usage: "node server.js --provider local -d /path/to/media -p 3000",
      };
    }

    const directoryPath = args.d;

    try {
      const dirStat = fs.statSync(directoryPath);
      if (!dirStat.isDirectory()) {
        return {
          success: false,
          error: "Provided path is not a directory",
          path: directoryPath,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Directory does not exist or is not accessible",
        path: directoryPath,
        details: error.message,
      };
    }

    return {
      success: true,
      constructorArgs: [directoryPath],
      config: {
        directoryPath,
        port: args.p || 3000,
      },
    };
  }

  /**
   * Initialize the media provider
   * @returns {Promise<Object>} Result of initialization with success status
   */
  async initialize() {
    try {
      // Create database path based on directory hash for unique database per directory
      const dirHash = crypto
        .createHash("md5")
        .update(this.directoryPath)
        .digest("hex");
      const dbFileName = `.${dirHash}_media.db`;
      const dbPath = path.join(this.directoryPath, dbFileName);

      // Initialize database
      this.mediaDatabase = new MediaDatabase(dbPath);
      this.mediaDatabase.initialize();

      // Initialize lock file path
      const lockFileName = `.${dirHash}_scan.lock`;
      this.LOCK_FILE_PATH = path.join(this.directoryPath, lockFileName);

      // Initialize thumbnail directory
      this.THUMBNAIL_DIR = path.join(this.directoryPath, ".cactus_thumbnails");
      try {
        await access(this.THUMBNAIL_DIR);
      } catch {
        await fs.promises.mkdir(this.THUMBNAIL_DIR, { recursive: true });
      }

      log.info("LocalMediaProvider initialized", {
        directory: this.directoryPath,
        database: dbFileName,
        dbPath: dbPath,
        lockFile: lockFileName,
        lockPath: this.LOCK_FILE_PATH,
      });

      this.isInitialized = true;

      // Load media files
      await this.loadMediaFiles();

      return { success: true };
    } catch (error) {
      log.error("Failed to initialize LocalMediaProvider", {
        directory: this.directoryPath,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Test the connection to the media source
   * @returns {Promise<Object>} Connection test result with success status
   */
  async testConnection() {
    try {
      if (!this.isInitialized) {
        return { success: false, error: "Provider not initialized" };
      }

      // Check if directory exists and is accessible
      await access(this.directoryPath);

      // Check if database is accessible
      const stats = this.mediaDatabase.getStats();

      return {
        success: true,
        data: {
          directory: this.directoryPath,
          stats: stats,
          dbVersion: this.mediaDatabase.getDatabaseVersion(),
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all media from the source
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {string} sortBy - Sorting parameter ('random', 'date_added', 'date_created')
   * @returns {Promise<Array>} Array of media items
   */
  async getAllMedia(mediaType = "all", sortBy = "random") {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const files = this.mediaDatabase.getAllMedia(sortBy, mediaType);
      log.info("Media files retrieved", {
        mediaType,
        sortBy,
        count: files.length,
      });
      return files;
    } catch (error) {
      log.error("Failed to get all media", {
        mediaType,
        sortBy,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media filtered by tags
   * @param {Array} includeTags - Tags that must be present
   * @param {Array} excludeTags - Tags that must not be present
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {string} sortBy - Sorting parameter ('random', 'date_added', 'date_created')
   * @returns {Promise<Array>} Array of filtered media items
   */
  async getMediaByTags(
    includeTags = [],
    excludeTags = [],
    mediaType = "all",
    sortBy = "random",
  ) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const files = this.mediaDatabase.getMediaByTagsAndType(
        includeTags,
        excludeTags,
        mediaType,
      );
      log.info("Media files filtered by tags", {
        includeTags,
        excludeTags,
        mediaType,
        count: files.length,
      });
      return files;
    } catch (error) {
      log.error("Failed to get media by tags", {
        includeTags,
        excludeTags,
        mediaType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media filtered by general filter substring
   * @param {string} substring - Substring to match in file paths
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {string} sortBy - Sorting parameter ('random', 'date_added', 'date_created')
   * @returns {Promise<Array>} Array of filtered media items
   */
  async getMediaByGeneralFilter(
    substring,
    mediaType = "all",
    sortBy = "random",
  ) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const files = this.mediaDatabase.getMediaByGeneralFilter(substring);
      log.info("Media files filtered by general filter", {
        substring,
        count: files.length,
      });
      return files;
    } catch (error) {
      log.error("Failed to get media by general filter", {
        substring,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all tags from the media source
   * @returns {Promise<Array>} Array of tags
   */
  async getAllTags() {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const tags = this.mediaDatabase.getAllTags();
      return tags;
    } catch (error) {
      log.error("Failed to get all tags", { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new tag
   * @param {string} name - Tag name
   * @param {string} color - Tag color (hex code)
   * @returns {Promise<Object>} Created tag
   */
  async createTag(name, color = "#3B82F6") {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const tag = this.mediaDatabase.createTag(name, color);
      log.info("Tag created", { tagId: tag.id, name: tag.name });
      return tag;
    } catch (error) {
      log.error("Failed to create tag", { name, error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing tag
   * @param {string|number} id - Tag ID
   * @param {string} name - New tag name
   * @param {string} color - New tag color (hex code)
   * @returns {Promise<Object>} Updated tag
   */
  async updateTag(id, name, color) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const tag = this.mediaDatabase.updateTag(parseInt(id), name, color);
      log.info("Tag updated", { tagId: id, name: tag.name });
      return tag;
    } catch (error) {
      log.error("Failed to update tag", { id, name, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a tag
   * @param {string|number} id - Tag ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTag(id) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const deleted = this.mediaDatabase.deleteTag(parseInt(id));
      log.info("Tag deleted", { tagId: id });
      return deleted > 0;
    } catch (error) {
      log.error("Failed to delete tag", { id, error: error.message });
      throw error;
    }
  }

  /**
   * Get all tags associated with a media item
   * @param {string} mediaId - Media item ID (file hash)
   * @returns {Promise<Array>} Array of tags
   */
  async getMediaTags(mediaId) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const tags = this.mediaDatabase.getMediaTags(mediaId);
      return tags;
    } catch (error) {
      log.error("Failed to get media tags", { mediaId, error: error.message });
      throw error;
    }
  }

  /**
   * Add a tag to a media item
   * @param {string} mediaId - Media item ID (file hash)
   * @param {string|number} tagId - Tag ID
   * @returns {Promise<boolean>} Success status
   */
  async addTagToMedia(mediaId, tagId) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const added = this.mediaDatabase.addTagToMedia(mediaId, parseInt(tagId));
      return added;
    } catch (error) {
      log.error("Failed to add tag to media", {
        mediaId,
        tagId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove a tag from a media item
   * @param {string} mediaId - Media item ID (file hash)
   * @param {string|number} tagId - Tag ID
   * @returns {Promise<boolean>} Success status
   */
  async removeTagFromMedia(mediaId, tagId) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const removed = this.mediaDatabase.removeTagFromMedia(
        mediaId,
        parseInt(tagId),
      );
      return removed;
    } catch (error) {
      log.error("Failed to remove tag from media", {
        mediaId,
        tagId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get statistics about the media collection
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const stats = this.mediaDatabase.getStats();
      return stats;
    } catch (error) {
      log.error("Failed to get stats", { error: error.message });
      throw error;
    }
  }

  /**
   * Function to check if a file is an image
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if the file is an image
   */
  isImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Function to check if a file is a video
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if the file is a video
   */
  isVideo(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  /**
   * Function to get media type from file path
   * @param {string} filePath - Path to the file
   * @returns {string|null} Media type ('image', 'video', or null)
   */
  getMediaType(filePath) {
    if (this.isImage(filePath)) return "image";
    if (this.isVideo(filePath)) return "video";
    return null;
  }

  /**
   * Generate thumbnail for an image
   * @param {string} filePath - Path to the image file
   * @param {string} fileHash - Hash of the file
   * @returns {Promise<{path: string, width: number, height: number}|null>} Thumbnail info or null if failed
   */
  async generateImageThumbnail(filePath, fileHash) {
    const thumbnailPath = path.join(this.THUMBNAIL_DIR, `${fileHash}.webp`);
    try {
      const result = await sharp(filePath)
        .resize(250, 250, { fit: sharp.fit.inside, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);

      log.info("Generated image thumbnail", {
        filePath,
        thumbnailPath,
        width: result.width,
        height: result.height,
      });
      return {
        path: thumbnailPath,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      log.error("Failed to generate image thumbnail", {
        filePath,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Generate thumbnail for a video
   * @param {string} filePath - Path to the video file
   * @param {string} fileHash - Hash of the file
   * @returns {Promise<{path: string, width: number, height: number}|null>} Thumbnail info or null if failed
   */
  async generateVideoThumbnail(filePath, fileHash) {
    const thumbnailPath = path.join(this.THUMBNAIL_DIR, `${fileHash}.webp`);
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          log.error("Failed to probe video for dimensions", {
            filePath,
            error: err.message,
          });
          return resolve(null);
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video",
        );
        if (!videoStream) {
          log.error("No video stream found", { filePath });
          return resolve(null);
        }

        const originalWidth = videoStream.width;
        const originalHeight = videoStream.height;
        const maxDim = 250;

        let newWidth, newHeight;

        if (originalWidth > originalHeight) {
          newWidth = maxDim;
          newHeight = Math.round((originalHeight / originalWidth) * maxDim);
        } else {
          newHeight = maxDim;
          newWidth = Math.round((originalWidth / originalHeight) * maxDim);
        }

        ffmpeg(filePath)
          .screenshots({
            timestamps: ["0%"],
            filename: `${fileHash}.webp`,
            folder: this.THUMBNAIL_DIR,
            size: `${newWidth}x${newHeight}`,
          })
          .on("end", () => {
            log.info("Generated video thumbnail", {
              filePath,
              thumbnailPath,
              size: `${newWidth}x${newHeight}`,
            });
            resolve({
              path: thumbnailPath,
              width: newWidth,
              height: newHeight,
            });
          })
          .on("error", (err) => {
            log.error("Failed to generate video thumbnail", {
              filePath,
              error: err.message,
            });
            resolve(null);
          });
      });
    });
  }

  /**
   * Lock management functions
   */
  async createLockFile() {
    try {
      const lockData = {
        pid: process.pid,
        timestamp: new Date().toISOString(),
        directory: this.directoryPath,
      };
      await fs.promises.writeFile(
        this.LOCK_FILE_PATH,
        JSON.stringify(lockData, null, 2),
      );
      log.info("Scan lock file created", {
        lockFile: path.basename(this.LOCK_FILE_PATH),
        lockPath: this.LOCK_FILE_PATH,
        pid: process.pid,
      });
      return true;
    } catch (error) {
      log.error("Failed to create scan lock file", {
        lockFile: path.basename(this.LOCK_FILE_PATH),
        lockPath: this.LOCK_FILE_PATH,
        error: error.message,
      });
      return false;
    }
  }

  async removeLockFile() {
    try {
      await access(this.LOCK_FILE_PATH);
      await fs.promises.unlink(this.LOCK_FILE_PATH);
      log.info("Scan lock file removed", {
        lockFile: path.basename(this.LOCK_FILE_PATH),
        lockPath: this.LOCK_FILE_PATH,
      });
    } catch (error) {
      log.error("Failed to remove scan lock file", {
        lockFile: path.basename(this.LOCK_FILE_PATH),
        lockPath: this.LOCK_FILE_PATH,
        error: error.message,
      });
    }
  }

  async isLocked() {
    try {
      await access(this.LOCK_FILE_PATH);
    } catch {
      return false;
    }

    try {
      const lockData = JSON.parse(
        fs.readFileSync(this.LOCK_FILE_PATH, "utf-8"),
      );

      // Check if the lock is stale (older than 5 minutes)
      const lockTime = new Date(lockData.timestamp);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      if (lockTime < fiveMinutesAgo) {
        log.warn("Removing stale scan lock file", {
          lockFile: path.basename(this.LOCK_FILE_PATH),
          lockPath: this.LOCK_FILE_PATH,
          lockAge: Math.round((now - lockTime) / 1000) + "s",
          lockedByPid: lockData.pid,
        });
        await this.removeLockFile();
        return false;
      }

      log.info("Scan currently locked", {
        lockFile: path.basename(this.LOCK_FILE_PATH),
        lockPath: this.LOCK_FILE_PATH,
        lockedByPid: lockData.pid,
        lockedSince: lockData.timestamp,
      });
      return true;
    } catch (error) {
      log.warn("Corrupted scan lock file detected, removing", {
        lockFile: path.basename(this.LOCK_FILE_PATH),
        lockPath: this.LOCK_FILE_PATH,
        error: error.message,
      });
      await this.removeLockFile();
      return false;
    }
  }

  /**
   * Function to recursively scan directory for media files
   * @returns {Promise<Array>} Array of media file paths
   */
  async scanDirectory() {
    const mediaFiles = [];
    const supportedExtensions = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];
    const processedFiles = new Set(); // Track processed files to avoid duplicates

    async function scan(dir, provider) {
      try {
        const files = await readdir(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);

          // Skip if we've already processed this file (shouldn't happen, but safety check)
          if (processedFiles.has(filePath)) {
            continue;
          }

          // Skip if path contains the thumbnail directory
          if (filePath.includes(provider.THUMBNAIL_DIR)) {
            log.info("Skipping thumbnail directory", { directory: filePath });
            continue;
          }

          try {
            const fileStat = await stat(filePath);

            if (fileStat.isDirectory()) {
              // Recursively scan subdirectories
              await scan(filePath, provider);
            } else if (fileStat.isFile()) {
              // Check if it's a supported media file
              const ext = path.extname(file).toLowerCase();
              if (supportedExtensions.includes(ext)) {
                const mediaType = provider.getMediaType(filePath);
                if (mediaType) {
                  try {
                    const fileHash =
                      provider.mediaDatabase.generateFileHash(filePath);
                    const existingMediaFile =
                      provider.mediaDatabase.getMediaFileByHash(fileHash);

                    if (existingMediaFile) {
                      log.info(
                        "Media file already exists, skipping thumbnail generation",
                        {
                          filePath,
                          mediaType,
                          fileHash,
                        },
                      );
                    } else {
                      // New file, insert and generate thumbnail
                      const result = provider.mediaDatabase.insertMediaFile(
                        filePath,
                        mediaType,
                        fileHash,
                        null,
                        fileStat.birthtime,
                      );
                      let thumbnailResult = null;
                      if (mediaType === "image") {
                        thumbnailResult = await provider.generateImageThumbnail(
                          filePath,
                          fileHash,
                        );
                      } else if (mediaType === "video") {
                        thumbnailResult = await provider.generateVideoThumbnail(
                          filePath,
                          fileHash,
                        );
                      }
                      if (thumbnailResult) {
                        provider.mediaDatabase.updateMediaFileThumbnailWithDimensions(
                          fileHash,
                          thumbnailResult.path,
                          thumbnailResult.width,
                          thumbnailResult.height,
                        );
                      }
                      log.info(
                        "New media file discovered and thumbnail generated",
                        {
                          filePath,
                          mediaType,
                          fileHash,
                        },
                      );
                    }
                    mediaFiles.push(filePath);
                    processedFiles.add(filePath);
                  } catch (dbError) {
                    log.error("Failed to process media file", {
                      filePath,
                      error: dbError.message,
                    });
                    // Still add to array for backward compatibility
                    mediaFiles.push(filePath);
                  }
                }
              }
            }
          } catch (statError) {
            log.warn("Failed to stat file, skipping", {
              filePath,
              error: statError.message,
            });
          }
        }
      } catch (error) {
        log.error("Failed to scan directory", {
          directory: dir,
          error: error.message,
        });
      }
    }

    await scan(this.directoryPath, this);
    return mediaFiles;
  }

  /**
   * Function to load media files from database or scan directory
   * @returns {Promise<Array>} Array of media files
   */
  async loadMediaFiles() {
    if (!this.isInitialized) {
      log.error("LocalMediaProvider not initialized");
      return [];
    }

    try {
      // First, try to get files from database
      const dbFiles = this.mediaDatabase.getAllMedia("all");

      if (dbFiles.length > 0) {
        // Verify that some of the files still exist
        const sampleSize = Math.min(5, dbFiles.length);
        const sampleFiles = dbFiles.slice(0, sampleSize);
        const existingFiles = await Promise.all(
          sampleFiles.map(async (mediaFile) => {
            try {
              await access(mediaFile.file_path);
              return true;
            } catch {
              return false;
            }
          }),
        ).then((results) => sampleFiles.filter((_, i) => results[i]));

        // If most sample files exist, use database
        if (existingFiles.length >= sampleSize * 0.8) {
          const stats = this.mediaDatabase.getStats();
          log.info("Media files loaded from database", {
            total: stats.total,
            images: stats.images,
            videos: stats.videos,
            dbVersion: this.mediaDatabase.getDatabaseVersion(),
          });
          return dbFiles;
        } else {
          log.info("Database files seem outdated, performing fresh scan");
        }
      } else {
        log.info("No files in database, performing fresh scan");
      }
    } catch (error) {
      log.warn("Failed to load from database, performing fresh scan", {
        error: error.message,
      });
    }

    // Perform fresh scan
    log.info("Scanning directory for media files", {
      directory: this.directoryPath,
    });
    const scannedFiles = await this.scanDirectory();

    const stats = this.mediaDatabase.getStats();
    log.info("Media scan completed", {
      total: stats.total,
      images: stats.images,
      videos: stats.videos,
      scannedFiles: scannedFiles.length,
    });

    // Return all media from the database, ensuring a consistent return type
    return this.mediaDatabase.getAllMedia("all");
  }

  /**
   * Function to trigger a rescan of the directory
   * @returns {Promise<Array>} Array of media file paths
   */
  async rescanDirectory() {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    // Check if a scan is already in progress
    if (await this.isLocked()) {
      throw new Error("Scan already in progress");
    }

    // Create lock file
    if (!(await this.createLockFile())) {
      throw new Error("Failed to create lock file");
    }

    try {
      log.info("Starting directory rescan", { directory: this.directoryPath });

      // Perform the scan
      const files = await this.scanDirectory();

      // Run database maintenance (cleanup orphaned files)
      const maintenanceResult = this.mediaDatabase.maintenance();

      const stats = this.mediaDatabase.getStats();
      log.info("Directory rescan completed", {
        scannedFiles: files.length,
        totalInDb: stats.total,
        images: stats.images,
        videos: stats.videos,
        orphanedFilesRemovedByDate:
          maintenanceResult.removedOrphanedFilesByDate,
        nonExistentFilesRemoved: maintenanceResult.removedNonExistentFiles,
      });

      return files;
    } catch (error) {
      log.error("Directory rescan failed", { error: error.message });
      throw new Error("Failed to rescan directory");
    } finally {
      this.removeLockFile();
    }
  }

  /**
   * Function to regenerate thumbnails for all media files
   * @returns {Promise<number>} Number of regenerated thumbnails
   */
  async regenerateThumbnails() {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    // Check if a scan is already in progress
    if (await this.isLocked()) {
      throw new Error("Scan already in progress");
    }

    // Create lock file
    if (!(await this.createLockFile())) {
      throw new Error("Failed to create lock file");
    }

    try {
      log.info("Starting thumbnail regeneration");
      const mediaFiles = this.mediaDatabase.getAllMedia("all");
      let regeneratedCount = 0;

      log.info(
        `Found ${mediaFiles.length} files to process for thumbnail regeneration.`,
      );

      for (const mediaFile of mediaFiles) {
        const filePath = mediaFile.file_path;
        try {
          try {
            await access(filePath);
          } catch {
            log.warn("File not accessible, skipping thumbnail regeneration", {
              filePath,
            });
            continue;
          }

          const mediaType = this.getMediaType(filePath);
          if (!mediaType) {
            log.warn("Unknown media type, skipping thumbnail regeneration", {
              filePath,
            });
            continue;
          }

          const fileHash = this.mediaDatabase.generateFileHash(filePath);
          let thumbnailResult = null;

          if (mediaType === "image") {
            thumbnailResult = await this.generateImageThumbnail(
              filePath,
              fileHash,
            );
          } else if (mediaType === "video") {
            thumbnailResult = await this.generateVideoThumbnail(
              filePath,
              fileHash,
            );
          }

          if (thumbnailResult) {
            this.mediaDatabase.updateMediaFileThumbnailWithDimensions(
              fileHash,
              thumbnailResult.path,
              thumbnailResult.width,
              thumbnailResult.height,
            );
            regeneratedCount++;
            log.info("Successfully regenerated thumbnail", { filePath });
          } else {
            log.warn("Thumbnail generation returned null, skipping update", {
              filePath,
            });
          }
        } catch (error) {
          log.error("Failed to regenerate thumbnail for a specific file", {
            filePath,
            error: error.message,
          });
        }
      }

      log.info("Thumbnail regeneration completed", { regeneratedCount });
      return regeneratedCount;
    } catch (error) {
      log.error("Thumbnail regeneration failed", { error: error.message });
      throw new Error("Failed to regenerate thumbnails");
    } finally {
      this.removeLockFile();
    }
  }

  /**
   * Get file hash for a given file path
   * @param {string} filePath - Path to the file
   * @returns {string} File hash
   */
  getFileHashForPath(filePath) {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    return this.mediaDatabase.getFileHashForPath(filePath);
  }

  /**
   * Get provider capabilities for UI configuration
   * @returns {Object} Provider capabilities object
   */
  getCapabilities() {
    return {
      canRescan: true,
      canRegenerateThumbnails: true,
      canManageTags: true,
      canGetFileHashForPath: true,
      supportsLocalFiles: true,
      supportsRemoteFiles: false,
    };
  }

  /**
   * Get UI configuration for this provider
   * @returns {Object} UI configuration object
   */
  getUIConfig() {
    const capabilities = this.getCapabilities();
    return {
      showDirectoryInfo: true,
      directoryLabel: "Directory Path",
      showConnectionStatus: false,
      showRescanButton: capabilities.canRescan,
      showRegenerateThumbnailsButton: capabilities.canRegenerateThumbnails,
      showTagManager: capabilities.canManageTags,
      availableActions: [
        ...(capabilities.canManageTags ? ["manage-tags"] : []),
        ...(capabilities.canRescan ? ["rescan-directory"] : []),
        ...(capabilities.canRegenerateThumbnails
          ? ["regenerate-thumbnails"]
          : []),
      ],
    };
  }

  /**
   * Compute display name for local media files
   * @param {Object} mediaFile - Media file object
   * @param {string} directoryPath - Directory path context
   * @returns {string} Display name
   */
  computeDisplayName(mediaFile, directoryPath) {
    if (!mediaFile) return "";

    // For local provider media, extract directory name from path
    if (directoryPath) {
      return (
        directoryPath.split("/").pop() ||
        directoryPath.split("/").slice(-2, -1)[0] ||
        "Root"
      );
    }

    // Final fallback: try to extract from file path
    if (mediaFile.file_path) {
      const pathParts = mediaFile.file_path.split("/");
      return pathParts[pathParts.length - 2] || "Unknown";
    }

    return "";
  }

  /**
   * Serve media file
   * @param {string} filePath - Path to the media file
   * @param {Object} res - Express response object
   */
  async serveMedia(filePath, req, res) {
    const path = require("path");
    const fs = require("fs");

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).send("File not found");
      }

      res.sendFile(absolutePath);
    } catch (error) {
      log.error("Failed to serve media file", {
        filePath,
        error: error.message,
      });
      res.status(500).send("Failed to serve media file");
    }
  }

  /**
   * Serve thumbnail file
   * @param {string} fileHash - File hash identifier
   * @param {Object} res - Express response object
   */
  async serveThumbnail(fileHash, res) {
    const path = require("path");
    const fs = require("fs");

    try {
      if (!this.THUMBNAIL_DIR) {
        return res.status(500).send("Thumbnail directory not configured");
      }

      const thumbnailPath = path.join(this.THUMBNAIL_DIR, `${fileHash}.webp`);

      if (!fs.existsSync(thumbnailPath)) {
        return res.status(404).send("Thumbnail not found");
      }

      res.sendFile(thumbnailPath);
    } catch (error) {
      log.error("Failed to serve thumbnail file", {
        fileHash,
        error: error.message,
      });
      res.status(500).send("Failed to serve thumbnail file");
    }
  }

  /**
   * Get detailed media info with local file-specific metadata
   * @param {Object} mediaFile - The full media file object
   * @returns {Object} { sections: [{ title, fields }] }
   */
  getMediaInfo(mediaFile) {
    const result = super.getMediaInfo(mediaFile);

    if (!mediaFile) return result;

    const fileFields = [];
    if (mediaFile.file_path) {
      fileFields.push({
        label: "Path",
        value: mediaFile.file_path,
        type: "text",
      });
    }
    if (mediaFile.file_hash) {
      fileFields.push({
        label: "Hash",
        value: mediaFile.file_hash,
        type: "text",
      });
    }
    if (fileFields.length > 0) {
      result.sections.push({ title: "File Info", fields: fileFields });
    }

    return result;
  }

  /**
   * Close the provider and release resources
   */
  async close() {
    if (this.mediaDatabase) {
      await this.mediaDatabase.close();
      this.mediaDatabase = null;
    }

    if (this.LOCK_FILE_PATH) {
      await this.removeLockFile();
      this.LOCK_FILE_PATH = null;
    }

    await super.close();
    log.info("LocalMediaProvider closed");
  }
}

module.exports = LocalMediaProvider;
