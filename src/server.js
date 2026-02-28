const express = require("express");
const compression = require("compression");
const session = require("express-session");
const crypto = require("crypto");
const NodeCache = require("node-cache");
const path = require("path");
const fs = require("fs");
const os = require("os");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const { ProviderFactory } = require("./providers");
const AutoTagService = require("./services/AutoTagService");
const minimist = require("minimist");

// Bun has built-in fetch support

const app = express();

// Enable compression for all responses
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

const argv = minimist(process.argv.slice(2));

const PORT = argv.p || process.env.PORT || 3000;
const providerType = argv.provider || process.env.PROVIDER || "local";
// Authentication configuration
const keyphrase = argv.keyphrase || process.env.CACTUS_KEYPHRASE || null;
const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

// Provider factory and media provider instance
const providerFactory = new ProviderFactory();
let mediaProvider;

// Auto-tag service (external llama-server container)
const autoTagService = new AutoTagService({
  baseUrl: process.env.AUTOTAG_URL || "http://127.0.0.1:7209",
});

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

// Validate provider configuration
const validation = providerFactory.validateProviderConfig(providerType, argv);
if (!validation.success) {
  log.error("Provider configuration validation failed", {
    provider: providerType,
    error: validation.error,
    validProviders: providerFactory.getAvailableProviders(),
    usage: validation.usage,
  });

  // Show usage information for all providers
  const usageInfo = providerFactory.generateUsageInfo();
  log.info("Available providers and usage", { providers: usageInfo });

  process.exit(1);
}

// Serve React build from dist directory
const reactBuildPath = path.join(__dirname, "..", "dist");
if (!fs.existsSync(reactBuildPath)) {
  log.error('React build not found. Please run "npm run build" first.');
  process.exit(1);
}

// ===== SESSION AND AUTHENTICATION =====

// Session middleware (always enabled for consistent behavior)
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== AUTH API ENDPOINTS =====

// Get auth status - always allowed
app.get("/api/auth/status", (req, res) => {
  res.json({
    authRequired: !!keyphrase,
    authenticated: !keyphrase || !!req.session.authenticated,
  });
});

// Login endpoint
app.post("/api/auth/login", (req, res) => {
  if (!keyphrase) {
    return res.json({ success: true });
  }

  const { keyphrase: inputKeyphrase } = req.body;

  if (inputKeyphrase === keyphrase) {
    req.session.authenticated = true;
    log.info("User authenticated successfully");
    res.json({ success: true });
  } else {
    log.warn("Failed authentication attempt");
    res.status(401).json({ error: "Invalid keyphrase" });
  }
});

// Logout endpoint
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      log.error("Failed to destroy session", { error: err.message });
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.json({ success: true });
  });
});

// Authentication middleware - protects API and media routes
const authMiddleware = (req, res, next) => {
  // If no keyphrase configured, skip auth
  if (!keyphrase) {
    return next();
  }

  // Always allow auth endpoints
  if (req.path.startsWith("/api/auth/")) {
    return next();
  }

  // Check if authenticated
  if (req.session.authenticated) {
    return next();
  }

  // Return 401 for protected API/media routes
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/media") ||
    req.path.startsWith("/thumbnails")
  ) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Allow static files (React app) to load - auth check happens in React
  next();
};

app.use(authMiddleware);

// Serve static files after auth check
app.use(express.static(reactBuildPath));

if (keyphrase) {
  log.info("Authentication enabled - keyphrase required to access");
} else {
  log.info("Authentication disabled - no keyphrase configured");
}

// ===== PERFORMANCE OPTIMIZATIONS =====

const requestCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  maxKeys: 200,
  useClones: false,
});

// Cache event listeners for monitoring
requestCache.on("expired", (key, value) => {
  log.info("Cache entry expired", { key });
});

requestCache.on("flush", () => {
  log.info("Cache flushed");
});

function cacheMiddleware(req, res, next) {
  if (req.method !== "GET" || !req.originalUrl.startsWith("/api/")) {
    return next();
  }

  if (req.query.sortBy === "random") {
    return next();
  }

  const key = req.originalUrl;
  const cached = requestCache.get(key);

  if (cached) {
    const stats = requestCache.getStats();
    log.info("Serving cached API response", {
      url: key,
      hitRate:
        ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) + "%",
    });
    return res.json(cached);
  }

  const originalJson = res.json;
  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      requestCache.set(key, data);
    }
    return originalJson.call(this, data);
  };

  next();
}

app.use("/api", cacheMiddleware);

// Caching headers
app.use("/media", (req, res, next) => {
  res.set({
    "Cache-Control": "public, max-age=31536000, immutable",
    Vary: "Accept-Encoding",
    "X-Content-Type-Options": "nosniff",
  });
  next();
});

app.use("/thumbnails", (req, res, next) => {
  res.set({
    "Cache-Control": "public, max-age=604800",
    Vary: "Accept-Encoding",
    "X-Content-Type-Options": "nosniff",
  });
  next();
});

app.use("/api", (req, res, next) => {
  if (req.method === "GET") {
    res.set({
      "Cache-Control": "public, max-age=300",
      Vary: "Accept-Encoding",
    });
  }
  next();
});

app.use("/assets", (req, res, next) => {
  res.set({
    "Cache-Control": "public, max-age=31536000, immutable",
    Vary: "Accept-Encoding",
  });
  next();
});

app.get("/api/cache-status", (req, res) => {
  const stats = requestCache.getStats();
  res.json({
    requestCache: {
      size: requestCache.keys().length,
      maxKeys: 200,
      stats: stats,
      hitRate:
        stats.hits + stats.misses > 0
          ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) + "%"
          : "0%",
    },
    cacheDuration: 30, // seconds
    uptime: process.uptime(),
  });
});

log.info("Performance optimizations enabled", {
  caching: "aggressive",
  requestDeduplication: "30s",
  compression: "level 6",
  cacheDuration: {
    media: "1 year",
    thumbnails: "1 week",
    api: "5 minutes",
    tags: "10 minutes",
    config: "1 hour",
    assets: "1 year",
  },
});

// Unified API endpoint to get media files with optional filtering
app.get("/api/media", async (req, res) => {
  const mediaType = req.query.type || "all";
  const tags = req.query.tags;
  const excludeTags = req.query["exclude-tags"];
  const pathSubstring = req.query.pathSubstring;
  const sortBy = req.query.sortBy || "random";

  // Validate media type
  if (!["all", "photos", "videos"].includes(mediaType)) {
    return res.status(400).json({
      error: 'Invalid media type. Use "all", "photos", or "videos".',
    });
  }

  try {
    let files;

    if (pathSubstring) {
      log.info("Filtering media by general filter", { pathSubstring });
      files = await mediaProvider.getMediaByGeneralFilter(
        pathSubstring,
        mediaType,
        sortBy,
      );
    } else if (tags || excludeTags) {
      const tagList = tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t)
        : [];
      const excludeTagList = excludeTags
        ? excludeTags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t)
        : [];

      log.info("Filtering media by tags", {
        mediaType,
        includeTags: tagList,
        excludeTags: excludeTagList,
      });

      files = await mediaProvider.getMediaByTags(
        tagList,
        excludeTagList,
        mediaType,
        sortBy,
      );

      log.info("Tag filtering completed", {
        mediaType,
        includeTags: tagList,
        excludeTags: excludeTagList,
        resultCount: files.length,
      });
    } else {
      files = await mediaProvider.getAllMedia(mediaType, sortBy);
    }

    // Add display names to each media file using provider-specific logic
    const filesWithDisplayNames = files.map((file) => {
      const directoryPath = file.file_path
        ? file.file_path.split("/").slice(0, -1).join("/")
        : "";

      return {
        ...file,
        displayName: mediaProvider.computeDisplayName(file, directoryPath),
      };
    });

    res.json({
      files: filesWithDisplayNames,
      count: filesWithDisplayNames.length,
      type: mediaType,
      filters: {
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : [],
        excludeTags: excludeTags
          ? excludeTags
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : [],
        pathSubstring,
      },
    });
  } catch (error) {
    log.error("Failed to retrieve media files", {
      mediaType,
      tags,
      excludeTags,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get media files" });
  }
});

// ===== TAG MANAGEMENT API ENDPOINTS =====

// Get all tags
app.get(
  "/api/tags",
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=600");
    next();
  },
  async (req, res) => {
    try {
      const tags = await mediaProvider.getAllTags();
      res.json({ tags });
    } catch (error) {
      log.error("Failed to get tags", { error: error.message });
      res.status(500).json({ error: "Failed to get tags" });
    }
  },
);

// Create a new tag
app.post("/api/tags", async (req, res) => {
  const { name, color } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Tag name is required" });
  }

  try {
    const tag = await mediaProvider.createTag(name, color);
    log.info("Tag created", { tagId: tag.id, name: tag.name });
    res.json({ tag });
  } catch (error) {
    if (error.message === "Tag already exists") {
      res.status(409).json({ error: "Tag already exists" });
    } else {
      log.error("Failed to create tag", { name, error: error.message });
      res.status(500).json({ error: "Failed to create tag" });
    }
  }
});

// Update a tag
app.put("/api/tags/:id", async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Tag name is required" });
  }

  try {
    const tag = await mediaProvider.updateTag(id, name, color);
    log.info("Tag updated", { tagId: id, name: tag.name });
    res.json({ tag });
  } catch (error) {
    if (error.message === "Tag not found") {
      res.status(404).json({ error: "Tag not found" });
    } else if (error.message === "Tag name already exists") {
      res.status(409).json({ error: "Tag name already exists" });
    } else {
      log.error("Failed to update tag", { id, name, error: error.message });
      res.status(500).json({ error: "Failed to update tag" });
    }
  }
});

// Delete a tag
app.delete("/api/tags/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await mediaProvider.deleteTag(id);
    log.info("Tag deleted", { tagId: id });
    res.json({ message: "Tag deleted successfully" });
  } catch (error) {
    if (error.message === "Tag not found") {
      res.status(404).json({ error: "Tag not found" });
    } else {
      log.error("Failed to delete tag", { id, error: error.message });
      res.status(500).json({ error: "Failed to delete tag" });
    }
  }
});

// ===== MEDIA TAGGING API ENDPOINTS =====

// Get tags for a specific media file
app.get("/api/media/:fileHash/tags", async (req, res) => {
  const { fileHash } = req.params;

  try {
    const tags = await mediaProvider.getMediaTags(fileHash);
    res.json({ tags });
  } catch (error) {
    log.error("Failed to get media tags", { fileHash, error: error.message });
    res.status(500).json({ error: "Failed to get media tags" });
  }
});

// Add tag(s) to a media file
app.post("/api/media/:fileHash/tags", async (req, res) => {
  const { fileHash } = req.params;
  const { tagIds, tagNames } = req.body;

  if (
    (!tagIds || !Array.isArray(tagIds)) &&
    (!tagNames || !Array.isArray(tagNames))
  ) {
    return res
      .status(400)
      .json({ error: "tagIds or tagNames array is required" });
  }

  try {
    const results = [];

    // Handle tag IDs
    if (tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        const added = await mediaProvider.addTagToMedia(fileHash, tagId);
        results.push({ tagId: parseInt(tagId), added });
      }
    }

    // Handle tag names (create if they don't exist)
    if (tagNames && Array.isArray(tagNames)) {
      const allTags = await mediaProvider.getAllTags();
      const tagsByName = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));

      for (const tagName of tagNames) {
        const trimmed = String(tagName).trim();
        if (!trimmed) continue;

        let tag = tagsByName.get(trimmed.toLowerCase());
        const created = !tag;

        if (!tag) {
          try {
            tag = await mediaProvider.createTag(trimmed);
          } catch (createErr) {
            const refreshed = await mediaProvider.getAllTags();
            tag = refreshed.find(
              (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
            );
            if (!tag) throw createErr;
          }
          tagsByName.set(trimmed.toLowerCase(), tag);
        }

        const added = await mediaProvider.addTagToMedia(fileHash, tag.id);
        results.push({
          tagId: tag.id,
          tagName: tag.name,
          added,
          created,
        });
      }
    }

    // Invalidate cache for tags and media endpoints
    const cacheKeys = requestCache.keys();
    for (const key of cacheKeys) {
      if (key.includes("/api/tags") || key.includes("/api/media")) {
        requestCache.del(key);
      }
    }

    log.info("Tags added to media", { fileHash, results });
    res.json({ results });
  } catch (error) {
    log.error("Failed to add tags to media", {
      fileHash,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to add tags to media" });
  }
});

// Remove tag from media file
app.delete("/api/media/:fileHash/tags/:tagId", async (req, res) => {
  const { fileHash, tagId } = req.params;

  try {
    const removed = await mediaProvider.removeTagFromMedia(fileHash, tagId);

    if (removed) {
      log.info("Tag removed from media", { fileHash, tagId });
      res.json({ message: "Tag removed successfully" });
    } else {
      res.status(404).json({ error: "Tag assignment not found" });
    }
  } catch (error) {
    log.error("Failed to remove tag from media", {
      fileHash,
      tagId,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to remove tag from media" });
  }
});

// Get detailed media info for a specific media item
app.get("/api/media/:fileHash/info", async (req, res) => {
  const { fileHash } = req.params;

  try {
    // Find the media item from the provider's data
    const allMedia = await mediaProvider.getAllMedia("all", "random");
    const mediaFile = allMedia.find((item) => item.file_hash === fileHash);

    if (!mediaFile) {
      return res.status(404).json({ error: "Media not found" });
    }

    const info = mediaProvider.getMediaInfo(mediaFile);
    res.json(info);
  } catch (error) {
    log.error("Failed to get media info", {
      fileHash,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get media info" });
  }
});

// Convenience endpoint: Get tags for media by file path
app.get("/api/media-path/tags", async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  try {
    const fileHash = mediaProvider.getFileHashForPath(filePath);
    const tags = await mediaProvider.getMediaTags(fileHash);
    res.json({ tags, fileHash });
  } catch (error) {
    log.error("Failed to get media tags by path", {
      filePath,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get media tags" });
  }
});

// Convenience endpoint: Add tags to media by file path
app.post("/api/media-path/tags", async (req, res) => {
  const { path: filePath } = req.query;
  const { tagIds, tagNames } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  if (
    (!tagIds || !Array.isArray(tagIds)) &&
    (!tagNames || !Array.isArray(tagNames))
  ) {
    return res
      .status(400)
      .json({ error: "tagIds or tagNames array is required" });
  }

  try {
    const fileHash = mediaProvider.getFileHashForPath(filePath);
    const results = [];

    // Handle tag IDs
    if (tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        const added = await mediaProvider.addTagToMedia(fileHash, tagId);
        results.push({ tagId: parseInt(tagId), added });
      }
    }

    // Handle tag names (create if they don't exist)
    if (tagNames && Array.isArray(tagNames)) {
      const allTags = await mediaProvider.getAllTags();
      const tagsByName = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));

      for (const tagName of tagNames) {
        const trimmedTagName = String(tagName).trim();
        if (!trimmedTagName) continue;

        let tag = tagsByName.get(trimmedTagName.toLowerCase());

        if (!tag) {
          try {
            tag = await mediaProvider.createTag(trimmedTagName);
          } catch (createErr) {
            // Tag was created concurrently — refetch and find it
            const refreshed = await mediaProvider.getAllTags();
            tag = refreshed.find(
              (t) => t.name.toLowerCase() === trimmedTagName.toLowerCase(),
            );
            if (!tag) throw createErr;
          }
          tagsByName.set(trimmedTagName.toLowerCase(), tag);
        }

        const added = await mediaProvider.addTagToMedia(fileHash, tag.id);
        results.push({ tagId: tag.id, tagName: tag.name, added });
      }
    }

    // Invalidate cache for tags and media endpoints
    const cacheKeys = requestCache.keys();
    for (const key of cacheKeys) {
      if (key.includes("/api/tags") || key.includes("/api/media")) {
        requestCache.del(key);
      }
    }

    log.info("Tags added to media by path", { filePath, fileHash, results });
    res.json({ results, fileHash });
  } catch (error) {
    log.error("Failed to add tags to media by path", {
      filePath,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to add tags to media" });
  }
});

// Convenience endpoint: Remove tag from media by file path
app.delete("/api/media-path/tags/:tagId", async (req, res) => {
  const { path: filePath } = req.query;
  const { tagId } = req.params;

  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  try {
    const fileHash = mediaProvider.getFileHashForPath(filePath);
    const removed = await mediaProvider.removeTagFromMedia(fileHash, tagId);

    // Invalidate cache for tags and media endpoints
    const cacheKeys = requestCache.keys();
    for (const key of cacheKeys) {
      if (key.includes("/api/tags") || key.includes("/api/media")) {
        requestCache.del(key);
      }
    }

    if (removed) {
      log.info("Tag removed from media by path", { filePath, fileHash, tagId });
      res.json({ message: "Tag removed successfully", fileHash });
    } else {
      res.status(404).json({ error: "Tag assignment not found" });
    }
  } catch (error) {
    log.error("Failed to remove tag from media by path", {
      filePath,
      tagId,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to remove tag from media" });
  }
});

// ===== AUTO-TAG API ENDPOINTS =====

// Get auto-tag service status
app.get("/api/auto-tag/status", (req, res) => {
  res.json({ ready: autoTagService.ready });
});

// ---- Video frame extraction helpers ----

// Determine how many frames to extract based on video duration.
// Each image uses ~729 fixed tokens in the vision encoder regardless of
// resolution. With 8192 context: 729×3 + ~33 text + 256 output = ~2476.
const MAX_FRAMES = 3;
const FRAME_TIERS = [
  { maxDuration: 4, timestamps: ["25%"] },
  { maxDuration: 10, timestamps: ["20%", "60%"] },
  { maxDuration: Infinity, timestamps: ["15%", "45%", "75%"] },
];

function getFrameTimestamps(durationSeconds) {
  for (const tier of FRAME_TIERS) {
    if (durationSeconds <= tier.maxDuration) {
      return tier.timestamps;
    }
  }
  return FRAME_TIERS[FRAME_TIERS.length - 1].timestamps;
}

// Extract frames from a video file on disk, returns array of JPEG buffers
function extractVideoFrames(videoPath, timestamps) {
  const tmpDir = os.tmpdir();
  const id = crypto.randomBytes(6).toString("hex");

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(new Error("ffprobe failed: " + err.message));

      const duration = metadata.format.duration || 0;

      // Convert percentage timestamps to seconds for ffmpeg
      const absTimestamps = timestamps.map((t) => {
        if (typeof t === "string" && t.endsWith("%")) {
          return (parseFloat(t) / 100) * duration;
        }
        return parseFloat(t);
      });

      let completed = 0;
      const frameBuffers = new Array(timestamps.length);
      let hasErrored = false;

      timestamps.forEach((ts, i) => {
        const outFile = path.join(tmpDir, `cactus_frame_${id}_${i}.jpg`);

        ffmpeg(videoPath)
          .seekInput(absTimestamps[i])
          .frames(1)
          .outputOptions("-q:v", "2")
          .output(outFile)
          .on("end", () => {
            try {
              frameBuffers[i] = fs.readFileSync(outFile);
              fs.unlinkSync(outFile);
            } catch (readErr) {
              if (!hasErrored) {
                hasErrored = true;
                reject(readErr);
              }
              return;
            }
            completed++;
            if (completed === timestamps.length) {
              resolve(frameBuffers.filter(Boolean));
            }
          })
          .on("error", (ffErr) => {
            if (!hasErrored) {
              hasErrored = true;
              // Clean up any written frames
              timestamps.forEach((_, j) => {
                const f = path.join(tmpDir, `cactus_frame_${id}_${j}.jpg`);
                try {
                  fs.unlinkSync(f);
                } catch {}
              });
              reject(new Error("Frame extraction failed: " + ffErr.message));
            }
          })
          .run();
      });
    });
  });
}

// Detect if a file path points to a video (by extension or content-type probe)
function isVideoPath(filePath) {
  const videoExts = new Set([
    ".mp4",
    ".webm",
    ".mov",
    ".avi",
    ".mkv",
    ".ogg",
    ".m4v",
  ]);
  const ext = path.extname(filePath).toLowerCase().split("?")[0];
  return videoExts.has(ext);
}

// Generate auto-tags for a media file (preview only, does not apply)
app.post("/api/media-path/auto-tag/generate", async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  if (!autoTagService.ready) {
    return res.status(503).json({ error: "Auto-tag service is not ready" });
  }

  try {
    const isUrl =
      filePath.startsWith("http://") || filePath.startsWith("https://");

    // Determine if this is a video — check provider media type first, fall back to extension
    const allMedia = await mediaProvider.getAllMedia("all", "random");
    // Match by full URL or by the path portion for remote providers
    const mediaItem = allMedia.find(
      (m) =>
        m.file_path === filePath || (isUrl && filePath.endsWith(m.file_path)),
    );
    let isVideo = mediaItem
      ? mediaItem.media_type === "video"
      : isVideoPath(filePath);

    log.info("Auto-tag: media detection", {
      filePath,
      mediaItemFound: !!mediaItem,
      mediaItemType: mediaItem?.media_type || null,
      isVideoByExtension: isVideoPath(filePath),
      isVideo,
    });

    // For remote URLs, fetch the content and detect type from content-type header
    let fetchedBuffer = null;
    let fetchedContentType = null;

    if (isUrl) {
      const headers = mediaProvider.apiKey
        ? { ApiKey: mediaProvider.apiKey }
        : {};
      const fetchRes = await fetch(filePath, { headers });
      if (!fetchRes.ok) {
        throw new Error(
          `Failed to fetch media from provider: ${fetchRes.status}`,
        );
      }
      fetchedContentType = (fetchRes.headers.get("content-type") || "")
        .split(";")[0]
        .trim();
      fetchedBuffer = Buffer.from(await fetchRes.arrayBuffer());

      log.info("Auto-tag: remote fetch complete", {
        contentType: fetchedContentType,
        bufferSize: fetchedBuffer.length,
      });

      // Override video detection using content-type if we couldn't match from provider data
      if (!mediaItem) {
        isVideo = fetchedContentType.startsWith("video/");
        log.info("Auto-tag: content-type override", {
          isVideo,
          fetchedContentType,
        });
      }
    }

    if (isVideo) {
      // --- VIDEO: extract frames, send multi-image ---
      let videoPath;
      let tempVideoPath = null;

      if (isUrl) {
        // Write already-fetched buffer to temp file
        tempVideoPath = path.join(
          os.tmpdir(),
          `cactus_autotag_${crypto.randomBytes(6).toString("hex")}.mp4`,
        );
        fs.writeFileSync(tempVideoPath, fetchedBuffer);
        videoPath = tempVideoPath;
      } else {
        videoPath = mediaProvider.resolveFilePath
          ? mediaProvider.resolveFilePath(filePath)
          : path.join(mediaProvider.mediaDirectory, filePath);
      }

      try {
        log.info("Auto-tag: video path resolved", {
          videoPath,
          isTemp: !!tempVideoPath,
        });

        // Probe duration and pick timestamps
        const duration = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration || 0);
          });
        });

        const timestamps = getFrameTimestamps(duration);
        log.info("Auto-tag: extracting frames", {
          duration: Math.round(duration),
          frameCount: timestamps.length,
          timestamps,
        });

        const frameBuffers = await extractVideoFrames(videoPath, timestamps);
        log.info("Auto-tag: frames extracted", {
          extractedCount: frameBuffers.length,
          frameSizes: frameBuffers.map((b) => b.length),
        });

        // Normalize each frame with sharp
        const normalizedImages = await Promise.all(
          frameBuffers.map(async (buf) => ({
            buffer: await sharp(buf)
              .resize(1024, 1024, {
                fit: "inside",
                withoutEnlargement: true,
              })
              .jpeg({ quality: 85 })
              .toBuffer(),
            mime: "image/jpeg",
          })),
        );

        const tags =
          await autoTagService.generateTagsFromBuffers(normalizedImages);

        log.info("Auto-tags generated from video", {
          filePath,
          frameCount: normalizedImages.length,
          duration: Math.round(duration),
          tagCount: tags.length,
          tags,
        });

        res.json({ tags });
      } finally {
        // Clean up temp video file
        if (tempVideoPath) {
          try {
            fs.unlinkSync(tempVideoPath);
          } catch {}
        }
      }
    } else {
      // --- IMAGE: existing single-image flow ---
      let imageBuffer;

      if (isUrl) {
        // Reuse already-fetched buffer
        imageBuffer = fetchedBuffer;
      } else {
        const absolutePath = mediaProvider.resolveFilePath
          ? mediaProvider.resolveFilePath(filePath)
          : path.join(mediaProvider.mediaDirectory, filePath);
        imageBuffer = fs.readFileSync(absolutePath);
      }

      // Normalize image to JPEG ≤1024px for llama-server compatibility
      const normalizedBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const tags = await autoTagService.generateTagsFromBuffer(
        normalizedBuffer,
        "image/jpeg",
      );

      log.info("Auto-tags generated (preview)", {
        filePath,
        tagCount: tags.length,
        tags,
      });

      res.json({ tags });
    }
  } catch (error) {
    log.error("Auto-tag generate failed", { filePath, error: error.message });
    res.status(500).json({ error: "Auto-tag failed: " + error.message });
  }
});

// Apply selected auto-tags to a media file
app.post("/api/media-path/auto-tag/apply", async (req, res) => {
  const { path: filePath } = req.query;
  const { tags } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: "tags array is required" });
  }

  try {
    const fileHash = mediaProvider.getFileHashForPath(filePath);

    const allTags = await mediaProvider.getAllTags();
    const tagsByName = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));
    const results = [];

    for (const tagName of tags) {
      const trimmed = String(tagName).trim().toLowerCase();
      if (!trimmed) continue;

      let tag = tagsByName.get(trimmed);
      if (!tag) {
        try {
          tag = await mediaProvider.createTag(trimmed);
        } catch (createErr) {
          // Tag was created concurrently — refetch and find it
          const refreshed = await mediaProvider.getAllTags();
          tag = refreshed.find((t) => t.name.toLowerCase() === trimmed);
          if (!tag) throw createErr;
        }
        tagsByName.set(trimmed, tag);
      }
      const added = await mediaProvider.addTagToMedia(fileHash, tag.id);
      results.push({ tagId: tag.id, tagName: tag.name, added });
    }

    // Invalidate cache for tags and media endpoints
    const cacheKeys = requestCache.keys();
    for (const key of cacheKeys) {
      if (key.includes("/api/tags") || key.includes("/api/media")) {
        requestCache.del(key);
      }
    }

    log.info("Auto-tags applied", {
      filePath,
      fileHash,
      tagCount: tags.length,
      tags,
    });

    res.json({ tags, results, fileHash });
  } catch (error) {
    log.error("Auto-tag apply failed", { filePath, error: error.message });
    res.status(500).json({ error: "Failed to apply tags: " + error.message });
  }
});

// API endpoint to trigger a rescan of the directory
app.post("/rescan-directory", async (req, res) => {
  try {
    const files = await mediaProvider.rescanDirectory();
    log.info("Directory rescan completed", { fileCount: files.length });
    res.json({
      files: files,
      message: `Rescan complete. Found ${files.length} files.`,
    });
  } catch (error) {
    log.error("Directory rescan failed", { error: error.message });

    if (error.message.includes("not supported")) {
      res.status(400).json({
        error: error.message,
      });
    } else if (error.message === "Scan already in progress") {
      res.status(409).json({
        error:
          "Scan already in progress. Please wait for the current scan to complete.",
      });
    } else {
      res
        .status(500)
        .json({ error: error.message || "Failed to rescan directory" });
    }
  }
});

// API endpoint to serve media files
app.get("/media", async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).send("File path is required");
    }

    await mediaProvider.serveMedia(filePath, req, res);
  } catch (error) {
    log.error("Failed to serve media file", {
      filePath: req.query.path,
      error: error.message,
    });
    res.status(500).send("Failed to serve media file");
  }
});

// API endpoint to serve thumbnails
app.get("/thumbnails", async (req, res) => {
  try {
    const { hash: fileHash } = req.query;

    if (!fileHash) {
      return res.status(400).send("File hash is required");
    }

    await mediaProvider.serveThumbnail(fileHash, res);
  } catch (error) {
    log.error("Failed to serve thumbnail file", {
      fileHash: req.query.hash,
      error: error.message,
    });
    res.status(500).send("Failed to serve thumbnail file");
  }
});

// API endpoint to get database statistics
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await mediaProvider.getStats();

    res.json({
      ...stats,
      provider: {
        type: mediaProvider.getProviderType(),
        config: validation.config,
      },
    });
  } catch (error) {
    log.error("Failed to get database statistics", { error: error.message });
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// API endpoint to regenerate thumbnails
app.post("/regenerate-thumbnails", async (req, res) => {
  try {
    const regeneratedCount = await mediaProvider.regenerateThumbnails();
    log.info("Thumbnail regeneration completed", { regeneratedCount });
    res.json({
      message: `Thumbnail regeneration complete. Regenerated ${regeneratedCount} thumbnails.`,
      regeneratedCount,
    });
  } catch (error) {
    log.error("Thumbnail regeneration failed", { error: error.message });

    if (error.message.includes("not supported")) {
      res.status(400).json({
        error: error.message,
      });
    } else if (error.message === "Scan already in progress") {
      res.status(409).json({
        error: "Operation already in progress. Please wait for it to complete.",
      });
    } else {
      res
        .status(500)
        .json({ error: error.message || "Failed to regenerate thumbnails" });
    }
  }
});

// API endpoint to get server and provider configuration
app.get(
  "/api/config",
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=3600");
    next();
  },
  (req, res) => {
    try {
      // Get provider capabilities and UI config from the provider itself
      const providerType = mediaProvider.getProviderType();
      const capabilities = mediaProvider.getCapabilities();
      const uiConfig = mediaProvider.getUIConfig();

      // Get provider schema for UI hints
      const ProviderClass = providerFactory.providers.get(providerType);
      const providerSchema = ProviderClass
        ? ProviderClass.getConfigSchema()
        : null;

      res.json({
        // Server configuration
        // Provider information
        provider: {
          type: providerType,
          name: mediaProvider.constructor.name,
          config: validation.config,
          capabilities: capabilities,
          schema: providerSchema,
        },

        // UI configuration from provider
        ui: uiConfig,

        // Display name computation configuration
        displayName: {
          providerType: providerType,
        },

        // Available providers for potential switching
        availableProviders: providerFactory.getAvailableProviders(),
      });
    } catch (error) {
      log.error("Failed to get configuration", { error: error.message });
      res.status(500).json({ error: "Failed to get configuration" });
    }
  },
);

// Serve React app for all other routes (SPA routing)
app.get("*", (req, res) => {
  const indexPath = path.join(reactBuildPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(500)
      .send('React build not found. Please run "npm run build" first.');
  }
});

// Initialize and start server
(async () => {
  try {
    const providerResult = await providerFactory.createProvider(
      providerType,
      argv,
    );

    if (!providerResult.success) {
      log.error("Failed to create media provider", {
        provider: providerType,
        error: providerResult.error,
      });
      process.exit(1);
    }

    mediaProvider = providerResult.provider;

    log.info("Media provider initialized successfully", {
      provider: providerType,
      providerClass: mediaProvider.constructor.name,
      config: validation.config,
    });

    // Start polling external llama-server for readiness
    autoTagService.startPolling();

    // Start the server only after provider is initialized
    app.listen(PORT, () => {
      log.info("Cactus media server started", {
        port: PORT,
        version: "React + Provider Architecture v2",
        provider: mediaProvider.constructor.name,
        providerType: mediaProvider.getProviderType(),
        config: validation.config,
      });
    });
  } catch (error) {
    log.error("Failed to start server", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
})();

// Cleanup on process exit
process.on("exit", async () => {
  if (mediaProvider) {
    await mediaProvider.close();
  }
});

process.on("SIGINT", async () => {
  autoTagService.stopPolling();
  if (mediaProvider) {
    await mediaProvider.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  autoTagService.stopPolling();
  if (mediaProvider) {
    await mediaProvider.close();
  }
  process.exit(0);
});
