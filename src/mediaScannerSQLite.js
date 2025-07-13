const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const crypto = require("crypto");
const MediaDatabase = require("./database");

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

// Get directory path from command line arguments
let directoryPath;
let mediaDatabase;

// Lock file path for preventing concurrent scans
let LOCK_FILE_PATH;
let THUMBNAIL_DIR;

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

async function initializeScanner(dirPath) {
  directoryPath = dirPath;

  // Create database path based on directory hash for unique database per directory
  const dirHash = crypto.createHash("md5").update(directoryPath).digest("hex");
  const dbFileName = `.${dirHash}_media.db`;
  const dbPath = path.join(directoryPath, dbFileName);

  // Initialize database
  mediaDatabase = new MediaDatabase(dbPath);
  mediaDatabase.initialize();

  // Initialize lock file path
  const lockFileName = `.${dirHash}_scan.lock`;
  LOCK_FILE_PATH = path.join(directoryPath, lockFileName);

  // Initialize thumbnail directory
  THUMBNAIL_DIR = path.join(directoryPath, ".cactus_thumbnails");
  try {
    await access(THUMBNAIL_DIR);
  } catch {
    await fs.promises.mkdir(THUMBNAIL_DIR, { recursive: true });
  }

  log.info("SQLite media scanner initialized", {
    directory: directoryPath,
    database: dbFileName,
    dbPath: dbPath,
    lockFile: lockFileName,
    lockPath: LOCK_FILE_PATH,
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

// Function to get media type from file path
function getMediaType(filePath) {
  if (isImage(filePath)) return "image";
  if (isVideo(filePath)) return "video";
  return null;
}

// Function to generate thumbnail for an image
async function generateImageThumbnail(filePath, fileHash) {
  const thumbnailPath = path.join(THUMBNAIL_DIR, `${fileHash}.webp`);
  try {
    await sharp(filePath)
      .resize(250, 250, { fit: sharp.fit.inside, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);
    log.info("Generated image thumbnail", { filePath, thumbnailPath });
    return thumbnailPath;
  } catch (error) {
    log.error("Failed to generate image thumbnail", {
      filePath,
      error: error.message,
    });
    return null;
  }
}

// Function to generate thumbnail for a video
async function generateVideoThumbnail(filePath, fileHash) {
  const thumbnailPath = path.join(THUMBNAIL_DIR, `${fileHash}.webp`);
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
          folder: THUMBNAIL_DIR,
          size: `${newWidth}x${newHeight}`,
        })
        .on("end", () => {
          log.info("Generated video thumbnail", {
            filePath,
            thumbnailPath,
            size: `${newWidth}x${newHeight}`,
          });
          resolve(thumbnailPath);
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

// Lock management functions (same as before)
async function createLockFile() {
  try {
    const lockData = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      directory: directoryPath,
    };
    await fs.promises.writeFile(
      LOCK_FILE_PATH,
      JSON.stringify(lockData, null, 2),
    );
    log.info("Scan lock file created", {
      lockFile: path.basename(LOCK_FILE_PATH),
      lockPath: LOCK_FILE_PATH,
      pid: process.pid,
    });
    return true;
  } catch (error) {
    log.error("Failed to create scan lock file", {
      lockFile: path.basename(LOCK_FILE_PATH),
      lockPath: LOCK_FILE_PATH,
      error: error.message,
    });
    return false;
  }
}

async function removeLockFile() {
  try {
    await access(LOCK_FILE_PATH);
    await fs.promises.unlink(LOCK_FILE_PATH);
    log.info("Scan lock file removed", {
      lockFile: path.basename(LOCK_FILE_PATH),
      lockPath: LOCK_FILE_PATH,
    });
  } catch (error) {
    log.error("Failed to remove scan lock file", {
      lockFile: path.basename(LOCK_FILE_PATH),
      lockPath: LOCK_FILE_PATH,
      error: error.message,
    });
  }
}

async function isLocked() {
  try {
    await access(LOCK_FILE_PATH);
  } catch {
    return false;
  }

  try {
    const lockData = JSON.parse(fs.readFileSync(LOCK_FILE_PATH, "utf-8"));

    // Check if the lock is stale (older than 5 minutes)
    const lockTime = new Date(lockData.timestamp);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (lockTime < fiveMinutesAgo) {
      log.warn("Removing stale scan lock file", {
        lockFile: path.basename(LOCK_FILE_PATH),
        lockPath: LOCK_FILE_PATH,
        lockAge: Math.round((now - lockTime) / 1000) + "s",
        lockedByPid: lockData.pid,
      });
      await removeLockFile();
      return false;
    }

    log.info("Scan currently locked", {
      lockFile: path.basename(LOCK_FILE_PATH),
      lockPath: LOCK_FILE_PATH,
      lockedByPid: lockData.pid,
      lockedSince: lockData.timestamp,
    });
    return true;
  } catch (error) {
    log.warn("Corrupted scan lock file detected, removing", {
      lockFile: path.basename(LOCK_FILE_PATH),
      lockPath: LOCK_FILE_PATH,
      error: error.message,
    });
    await removeLockFile();
    return false;
  }
}

// Function to recursively scan directory for media files
async function scanDirectory(directoryPath) {
  const mediaFiles = [];
  const supportedExtensions = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];
  const processedFiles = new Set(); // Track processed files to avoid duplicates

  async function scan(dir) {
    try {
      const files = await readdir(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);

        // Skip if we've already processed this file (shouldn't happen, but safety check)
        if (processedFiles.has(filePath)) {
          continue;
        }

        // Skip if path contains the thumbnail directory
        if (filePath.includes(THUMBNAIL_DIR)) {
          log.info("Skipping thumbnail directory", { directory: filePath });
          continue;
        }

        try {
          const fileStat = await stat(filePath);

          if (fileStat.isDirectory()) {
            // Recursively scan subdirectories
            await scan(filePath);
          } else if (fileStat.isFile()) {
            // Check if it's a supported media file
            const ext = path.extname(file).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              const mediaType = getMediaType(filePath);
              if (mediaType) {
                try {
                  const fileHash = mediaDatabase.generateFileHash(filePath);
                  const existingMediaFile =
                    mediaDatabase.getMediaFileByHash(fileHash);

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
                    const result = mediaDatabase.insertMediaFile(
                      filePath,
                      mediaType,
                      fileHash,
                      null,
                      fileStat.birthtime,
                    );
                    let thumbnailPath = null;
                    if (mediaType === "image") {
                      thumbnailPath = await generateImageThumbnail(
                        filePath,
                        fileHash,
                      );
                    } else if (mediaType === "video") {
                      thumbnailPath = await generateVideoThumbnail(
                        filePath,
                        fileHash,
                      );
                    }
                    if (thumbnailPath) {
                      mediaDatabase.updateMediaFileThumbnail(
                        fileHash,
                        thumbnailPath,
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

  await scan(directoryPath);
  return mediaFiles;
}

// Function to load media files from database or scan directory
async function loadMediaFiles() {
  if (!directoryPath || !mediaDatabase) {
    log.error("Media scanner not initialized");
    return [];
  }

  try {
    // First, try to get files from database
    const dbFiles = mediaDatabase.getMediaFiles("all");

    if (dbFiles.length > 0) {
      // Verify that some of the files still exist
      const sampleSize = Math.min(5, dbFiles.length);
      const sampleFiles = dbFiles.slice(0, sampleSize);
      const existingFiles = await Promise.all(
        sampleFiles.map(async (filePath) => {
          try {
            await access(filePath);
            return true;
          } catch {
            return false;
          }
        }),
      ).then((results) => sampleFiles.filter((_, i) => results[i]));

      // If most sample files exist, use database
      if (existingFiles.length >= sampleSize * 0.8) {
        const stats = mediaDatabase.getStats();
        log.info("Media files loaded from database", {
          total: stats.total,
          images: stats.images,
          videos: stats.videos,
          dbVersion: mediaDatabase.getDatabaseVersion(),
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
  log.info("Scanning directory for media files", { directory: directoryPath });
  const scannedFiles = await scanDirectory(directoryPath);

  const stats = mediaDatabase.getStats();
  log.info("Media scan completed", {
    total: stats.total,
    images: stats.images,
    videos: stats.videos,
    scannedFiles: scannedFiles.length,
  });

  return scannedFiles;
}

// Function to filter media files by type
function filterMediaByType(mediaType, sortBy = "random") {
  if (!mediaDatabase) {
    log.warn("Database not initialized for filtering");
    return [];
  }

  try {
    const filteredFiles = mediaDatabase.getAllMedia(sortBy, mediaType);
    log.info("Media files filtered", {
      mediaType,
      sortBy,
      count: filteredFiles.length,
    });
    return filteredFiles;
  } catch (error) {
    log.error("Failed to filter media files", {
      mediaType,
      sortBy,
      error: error.message,
    });
    return [];
  }
}

// Function to trigger a rescan of the directory
async function rescanDirectory() {
  if (!directoryPath || !mediaDatabase) {
    log.error("Media scanner not initialized");
    throw new Error("Media scanner not initialized");
  }

  // Check if a scan is already in progress
  if (await isLocked()) {
    throw new Error("Scan already in progress");
  }

  // Create lock file
  if (!(await createLockFile())) {
    throw new Error("Failed to create lock file");
  }

  try {
    log.info("Starting directory rescan", { directory: directoryPath });

    // Perform the scan
    const files = await scanDirectory(directoryPath);

    // Run database maintenance (cleanup orphaned files)
    const maintenanceResult = mediaDatabase.maintenance();

    const stats = mediaDatabase.getStats();
    log.info("Directory rescan completed", {
      scannedFiles: files.length,
      totalInDb: stats.total,
      images: stats.images,
      videos: stats.videos,
      orphanedFilesRemovedByDate: maintenanceResult.removedOrphanedFilesByDate,
      nonExistentFilesRemoved: maintenanceResult.removedNonExistentFiles,
    });

    return files;
  } catch (error) {
    log.error("Directory rescan failed", { error: error.message });
    throw new Error("Failed to rescan directory");
  } finally {
    removeLockFile();
  }
}

// Get database statistics
function getStats() {
  if (!mediaDatabase) {
    return { total: 0, images: 0, videos: 0 };
  }

  try {
    return mediaDatabase.getStats();
  } catch (error) {
    log.error("Failed to get stats", { error: error.message });
    return { total: 0, images: 0, videos: 0 };
  }
}

// Get database instance (for future extensions)
function getDatabase() {
  return mediaDatabase;
}

// Function to regenerate thumbnails for all media files
async function regenerateThumbnails() {
  if (!directoryPath || !mediaDatabase) {
    log.error("Media scanner not initialized");
    throw new Error("Media scanner not initialized");
  }

  // Check if a scan is already in progress
  if (await isLocked()) {
    throw new Error("Scan already in progress");
  }

  // Create lock file
  if (!(await createLockFile())) {
    throw new Error("Failed to create lock file");
  }

  try {
    log.info("Starting thumbnail regeneration");
    const mediaFiles = mediaDatabase.getMediaFiles("all");
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

        const mediaType = getMediaType(filePath);
        if (!mediaType) {
          log.warn("Unknown media type, skipping thumbnail regeneration", {
            filePath,
          });
          continue;
        }

        const fileHash = mediaDatabase.generateFileHash(filePath);
        let thumbnailPath = null;

        if (mediaType === "image") {
          thumbnailPath = await generateImageThumbnail(filePath, fileHash);
        } else if (mediaType === "video") {
          thumbnailPath = await generateVideoThumbnail(filePath, fileHash);
        }

        if (thumbnailPath) {
          mediaDatabase.updateMediaFileThumbnail(fileHash, thumbnailPath);
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
    removeLockFile();
  }
}

module.exports = {
  initializeScanner,
  loadMediaFiles,
  rescanDirectory,
  filterMediaByType,
  getStats,
  getDatabase,
  regenerateThumbnails,
  // Backward compatibility
  get scannedMediaFiles() {
    try {
      return mediaDatabase ? mediaDatabase.getMediaFiles("all") : [];
    } catch (error) {
      log.error("Failed to get scanned media files", { error: error.message });
      return [];
    }
  },
};

// Cleanup lock file and close database on process exit
process.on("exit", async () => {
  if (LOCK_FILE_PATH) {
    await removeLockFile();
  }
  if (mediaDatabase) {
    await mediaDatabase.close();
  }
});

process.on("SIGINT", async () => {
  if (LOCK_FILE_PATH) {
    await removeLockFile();
  }
  if (mediaDatabase) {
    await mediaDatabase.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (LOCK_FILE_PATH) {
    await removeLockFile();
  }
  if (mediaDatabase) {
    await mediaDatabase.close();
  }
  process.exit(0);
});
