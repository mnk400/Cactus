const express = require("express");
const path = require("path");
const fs = require("fs");
const { LocalMediaProvider, SbMediaProvider } = require("./providers");
const minimist = require("minimist");

// Import fetch for Node.js (if not available globally)
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const argv = minimist(process.argv.slice(2));

const PORT = argv.p || process.env.PORT || 3000;
const directoryPath = argv.d;
const providerType = argv.provider || process.env.PROVIDER || "local";
const sbUrl = argv["sb-url"] || process.env.sb_URL || "http://localhost";
const THUMBNAIL_DIR = directoryPath ? path.join(directoryPath, ".cactus_thumbnails") : null;
const enablePredict =
  argv["experimental-prediction-test"] ||
  process.env.EXPERIMENTAL_PREDICTION_TEST === "true" ||
  false; // Flag to enable extremely experimental prediction functionality
const predictApiUrl =
  argv["predict-api-url"] || process.env.PREDICT_API_URL || "http://localhost"; // Prediction API URL super WIP
  
// Media provider instance
let mediaProvider;

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

// Validate provider type
if (!["local", "sb"].includes(providerType)) {
  log.error("Invalid provider type", {
    provider: providerType,
    validProviders: ["local", "sb"],
    usage: "node server.js --provider local -d /path/to/media -p 3000 OR node server.js --provider sb --sb-url http://192.168.0.23:9999/graphql -p 3000",
  });
  process.exit(1);
}

// Validate arguments based on provider type
if (providerType === "local") {
  if (!directoryPath) {
    log.error("Directory path is required for local provider", {
      usage: "node server.js --provider local -d /path/to/media -p 3000",
    });
    process.exit(1);
  }

  try {
    const dirStat = fs.statSync(directoryPath);
    if (!dirStat.isDirectory()) {
      log.error("Provided path is not a directory", { path: directoryPath });
      process.exit(1);
    }
  } catch (error) {
    log.error("Directory does not exist or is not accessible", {
      path: directoryPath,
      error: error.message,
    });
    process.exit(1);
  }
} else if (providerType === "sb") {
  if (!sbUrl) {
    log.error("sb URL is required for sb provider", {
      usage: "node server.js --provider sb --sb-url http://192.168.0.23:9999/graphql -p 3000",
    });
    process.exit(1);
  }
}

// Serve React build from dist directory
const reactBuildPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(reactBuildPath)) {
  app.use(express.static(reactBuildPath));
  log.info("Serving React application from dist directory");
} else {
  log.error('React build not found. Please run "npm run build" first.');
  process.exit(1);
}

app.use(express.json());

// Initialize and load media files on server startup
(async () => {
  // Initialize the appropriate media provider
  if (providerType === "local") {
    mediaProvider = new LocalMediaProvider(directoryPath);
  } else if (providerType === "sb") {
    mediaProvider = new SbMediaProvider(sbUrl);
  }
  
  const initResult = await mediaProvider.initialize();
  
  if (!initResult.success) {
    log.error("Failed to initialize media provider", {
      provider: providerType,
      error: initResult.error,
    });
    process.exit(1);
  }

  log.info("Media provider initialized successfully", {
    provider: providerType,
    ...(providerType === "local" ? { directory: directoryPath } : { sbUrl }),
  });
})();

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
      log.info("Filtering media by path substring", { pathSubstring });
      files = await mediaProvider.getMediaByPathSubstring(pathSubstring, mediaType, sortBy);
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

      files = await mediaProvider.getMediaByTags(tagList, excludeTagList, mediaType, sortBy);

      log.info("Tag filtering completed", {
        mediaType,
        includeTags: tagList,
        excludeTags: excludeTagList,
        resultCount: files.length,
      });
    } else {
      files = await mediaProvider.getAllMedia(mediaType, sortBy);
    }

    res.json({
      files: files,
      count: files.length,
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
app.get("/api/tags", async (req, res) => {
  try {
    const tags = await mediaProvider.getAllTags();
    res.json({ tags });
  } catch (error) {
    log.error("Failed to get tags", { error: error.message });
    res.status(500).json({ error: "Failed to get tags" });
  }
});

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
      for (const tagName of tagNames) {
        // Get all tags to find by name
        const allTags = await mediaProvider.getAllTags();
        let tag = allTags.find(t => t.name === tagName);
        
        if (!tag) {
          tag = await mediaProvider.createTag(tagName);
        }
        
        const added = await mediaProvider.addTagToMedia(fileHash, tag.id);
        results.push({
          tagId: tag.id,
          tagName: tag.name,
          added,
          created: !allTags.find(t => t.name === tagName),
        });
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
      for (const tagName of tagNames) {
        const trimmedTagName = String(tagName).trim(); // Ensure it's a string and trim it
        if (!trimmedTagName) continue; // Skip empty tag names after trimming

        // Get all tags to find by name
        const allTags = await mediaProvider.getAllTags();
        let tag = allTags.find(t => t.name === trimmedTagName);
        
        if (!tag) {
          tag = await mediaProvider.createTag(trimmedTagName);
        }
        
        const added = await mediaProvider.addTagToMedia(fileHash, tag.id);
        results.push({ tagId: tag.id, tagName: tag.name, added });
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

// API endpoint to trigger a rescan of the directory
app.post("/rescan-directory", async (req, res) => {
  if (providerType === "sb") {
    return res.status(400).json({
      error: "Directory rescan not supported for sb provider. Media is fetched dynamically from sb server.",
    });
  }

  try {
    const files = await mediaProvider.rescanDirectory();
    log.info("Directory rescan completed", { fileCount: files.length });
    res.json({
      files: files,
      message: `Rescan complete. Found ${files.length} files.`,
    });
  } catch (error) {
    log.error("Directory rescan failed", { error: error.message });

    if (error.message === "Scan already in progress") {
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

    // Handle sb URLs
    if (filePath.startsWith("sb://") || (providerType === "sb" && filePath.startsWith("http"))) {
      // For sb, proxy the image request
      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          log.error("sb server returned error", {
            filePath,
            status: response.status,
            statusText: response.statusText,
          });
          return res.status(404).send("Media not found on sb server");
        }
        
        // Set appropriate headers
        const contentType = response.headers.get('content-type');
        if (contentType) {
          res.set('Content-Type', contentType);
        }
        
        // Get the response as a buffer and send it
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      } catch (fetchError) {
        log.error("Failed to fetch media from sb", {
          filePath,
          error: fetchError.message,
          stack: fetchError.stack,
        });
        return res.status(500).send("Failed to fetch media from sb server");
      }
    } else {
      // Handle local files (existing logic)
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).send("File not found");
      }

      res.sendFile(absolutePath);
    }
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

    if (providerType === "sb") {
      // For sb, we need to get the thumbnail URL from the media data
      try {
        const allMedia = await mediaProvider.getAllMedia("all");
        const mediaItem = allMedia.find(item => item.file_hash === fileHash);
        
        if (!mediaItem || !mediaItem.thumbnail_path) {
          return res.status(404).send("Thumbnail not found");
        }

        // Proxy the thumbnail from sb
        const response = await fetch(mediaItem.thumbnail_path);
        if (!response.ok) {
          log.error("sb server returned error for thumbnail", {
            thumbnailPath: mediaItem.thumbnail_path,
            status: response.status,
            statusText: response.statusText,
          });
          return res.status(404).send("Thumbnail not found on sb server");
        }
        
        // Set appropriate headers
        const contentType = response.headers.get('content-type');
        if (contentType) {
          res.set('Content-Type', contentType);
        }
        
        // Get the response as a buffer and send it
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      } catch (fetchError) {
        log.error("Failed to fetch thumbnail from sb", {
          fileHash,
          error: fetchError.message,
        });
        return res.status(500).send("Failed to fetch thumbnail from sb server");
      }
    } else {
      // Handle local thumbnails (existing logic)
      if (!THUMBNAIL_DIR) {
        return res.status(500).send("Thumbnail directory not configured");
      }
      
      const thumbnailPath = path.join(THUMBNAIL_DIR, `${fileHash}.webp`);

      if (!fs.existsSync(thumbnailPath)) {
        return res.status(404).send("Thumbnail not found");
      }

      res.sendFile(thumbnailPath);
    }
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
        type: providerType,
        ...(providerType === "local" ? { directory: directoryPath } : { sbUrl })
      }
    });
  } catch (error) {
    log.error("Failed to get database statistics", { error: error.message });
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// API endpoint to regenerate thumbnails
app.post("/regenerate-thumbnails", async (req, res) => {
  if (providerType === "sb") {
    return res.status(400).json({
      error: "Thumbnail regeneration not supported for sb provider. Thumbnails are managed by sb server.",
    });
  }

  try {
    const regeneratedCount = await mediaProvider.regenerateThumbnails();
    log.info("Thumbnail regeneration completed", { regeneratedCount });
    res.json({
      message: `Thumbnail regeneration complete. Regenerated ${regeneratedCount} thumbnails.`,
      regeneratedCount,
    });
  } catch (error) {
    log.error("Thumbnail regeneration failed", { error: error.message });

    if (error.message === "Scan already in progress") {
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

// API endpoint to check if prediction is enabled
app.get("/api/config", (req, res) => {
  res.json({
    predictEnabled: enablePredict,
    predictApiUrl: predictApiUrl,
    provider: {
      type: providerType,
      ...(providerType === "local" ? { directory: directoryPath } : { sbUrl })
    }
  });
});

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

app.listen(PORT, () => {
  log.info("Cactus media server started", {
    port: PORT,
    version: "React + Provider Architecture",
    provider: providerType === "local" ? "LocalMediaProvider" : "sbMediaProvider",
    storage: providerType === "local" ? "SQLite Database" : "sb GraphQL API",
    ...(providerType === "local" ? { directory: directoryPath } : { sbUrl }),
    predictEnabled: enablePredict,
  });
});

// Cleanup on process exit
process.on("exit", async () => {
  if (mediaProvider) {
    await mediaProvider.close();
  }
});

process.on("SIGINT", async () => {
  if (mediaProvider) {
    await mediaProvider.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (mediaProvider) {
    await mediaProvider.close();
  }
  process.exit(0);
});
