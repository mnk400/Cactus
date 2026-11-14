/**
 * sbMediaProvider
 *
 * Implementation of MediaSourceProvider for sb GraphQL API.
 * This provider fetches media from a sb server via GraphQL.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const MediaSourceProvider = require("./MediaSourceProvider");

const fetch = globalThis.fetch || require("node-fetch");

const mkLog =
  (level, fn) =>
  (message, meta = {}) =>
    fn(
      JSON.stringify({
        level,
        message,
        ...meta,
        timestamp: new Date().toISOString(),
      }),
    );
const log = {
  info: mkLog("info", console.log),
  error: mkLog("error", console.error),
  warn: mkLog("warn", console.warn),
};

class SbMediaProvider extends MediaSourceProvider {
  constructor(sbUrl = "http://192.168.0.23:9999/graphql", apiKey = null) {
    super();
    this.providerType = "sb";
    this.sbUrl = sbUrl;
    this.apiKey = apiKey;
    this.isInitialized = false;
    // Thumbnails fetched from sb (or made from a video with ffmpeg) are kept
    // on disk: the only cache this provider has. Regenerating thumbnails
    // empties it. Everything else is asked of sb each time.
    this.diskCacheDir = path.join(process.cwd(), ".cactus-cache", "thumbs");
    // Not a cache: concurrent requests for one thumbnail share one fetch.
    this.inflightThumbnails = new Map(); // fileHash -> Promise<{buffer, contentType}>
  }

  static getConfigSchema() {
    return {
      description: "S GraphQL API media provider",
      example:
        "node server.js --provider sb --sb-url http://192.168.0.23:9999/graphql --sb-api-key YOUR_API_KEY -p 3000",
      requiredArgs: [
        {
          name: "sbUrl",
          flag: "--sb-url",
          description: "URL to the S GraphQL endpoint",
          type: "string",
          env: "SB_URL",
        },
      ],
      optionalArgs: [
        {
          name: "sbApiKey",
          flag: "--sb-api-key",
          description: "API key for S server authentication",
          type: "string",
          env: "SB_API_KEY",
        },
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

  static validateConfig(args) {
    const sbUrl = args["sb-url"] || process.env.SB_URL;
    const sbApiKey = args["sb-api-key"] || process.env.SB_API_KEY || null;

    if (!sbUrl) {
      return {
        success: false,
        error: "Server URL is required for sb provider",
        usage:
          "node server.js --provider sb --sb-url http://192.168.0.23:9999/graphql --sb-api-key YOUR_API_KEY -p 3000",
      };
    }

    try {
      new URL(sbUrl);
    } catch (error) {
      return {
        success: false,
        error: "Invalid URL format",
        url: sbUrl,
        details: error.message,
      };
    }

    return {
      success: true,
      constructorArgs: [sbUrl, sbApiKey],
      config: {
        sbUrl,
        sbApiKey: sbApiKey ? "***" : null,
        port: args.p || 3000,
      },
    };
  }

  async initialize() {
    try {
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        return {
          success: false,
          error: `Failed to connect to sb server: ${connectionTest.error}`,
        };
      }
      await fs.promises.mkdir(this.diskCacheDir, { recursive: true });
      this.isInitialized = true;
      log.info("sbMediaProvider initialized successfully", {
        sbUrl: this.sbUrl,
        authEnabled: !!this.apiKey,
      });
      return { success: true };
    } catch (error) {
      log.error("Failed to initialize sbMediaProvider", {
        sbUrl: this.sbUrl,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async testConnection() {
    try {
      const response = await this.makeGraphQLRequest(
        `query { version { version } }`,
      );
      if (response.data?.version) {
        log.info("sb server connection successful", {
          version: response.data.version.version,
        });
        return { success: true, version: response.data.version.version };
      }
      return { success: false, error: "Invalid response from sb server" };
    } catch (error) {
      log.error("sb server connection failed", {
        sbUrl: this.sbUrl,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async makeGraphQLRequest(query, variables = {}) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (this.apiKey) headers["ApiKey"] = this.apiKey;

      const response = await fetch(this.sbUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.errors)
        throw new Error(
          `GraphQL error: ${data.errors.map((e) => e.message).join(", ")}`,
        );
      return data;
    } catch (error) {
      log.error("GraphQL request failed", {
        query: query.substring(0, 100) + "...",
        error: error.message,
      });
      throw error;
    }
  }

  // ── Fetch & Transform ──────────────────────────────────────────────

  async fetchImages(filter = {}) {
    const query = `
      query FindImages($filter: FindFilterType, $image_filter: ImageFilterType) {
        findImages(filter: $filter, image_filter: $image_filter) {
          count
          images {
            id title code date rating100 organized o_counter created_at updated_at
            paths { thumbnail preview image }
            visual_files {
              ... on ImageFile { id path size mod_time width height fingerprints { type value } }
              ... on VideoFile { id path size mod_time duration video_codec audio_codec width height frame_rate bit_rate fingerprints { type value } }
            }
            tags { id name }
            studio { id name }
            performers { id name }
          }
        }
      }
    `;
    const variables = {
      filter: {
        per_page: filter.per_page || 10000,
        sort: filter.sort || "random",
        direction: filter.direction || "DESC",
      },
      image_filter: filter.image_filter || {},
    };
    const response = await this.makeGraphQLRequest(query, variables);
    return response.data.findImages;
  }

  async fetchMarkers(filter = {}) {
    const query = `
      query FindMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
        findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
          count
          scene_markers {
            id title seconds end_seconds created_at updated_at
            stream preview screenshot
            scene {
              id title date code
              files { path duration width height size }
              studio { id name }
              performers { id name }
              tags { id name }
            }
            primary_tag { id name }
            tags { id name }
          }
        }
      }
    `;
    const variables = {
      filter: {
        per_page: filter.per_page || 10000,
        sort: filter.sort || "random",
        direction: filter.direction || "DESC",
      },
      scene_marker_filter: filter.scene_marker_filter || {},
    };
    const response = await this.makeGraphQLRequest(query, variables);
    return response.data.findSceneMarkers;
  }

  /**
   * Fetch images + markers in parallel, transform, and return combined array.
   */
  async fetchAndTransformMedia(sortBy, imageFilter = {}, markerFilter = {}) {
    const [imagesResult, markersResult] = await Promise.all([
      this.fetchImages({
        sort: this.mapSortBy(sortBy),
        per_page: 10000,
        image_filter: imageFilter,
      }),
      this.fetchMarkers({
        sort: this.mapSortBy(sortBy),
        per_page: 10000,
        scene_marker_filter: markerFilter,
      }),
    ]);

    const media = [
      ...imagesResult.images.map((img) => this.transformsbImageToLocal(img)),
      ...markersResult.scene_markers.map((m) =>
        this.transformsbMarkerToLocal(m),
      ),
    ].filter(Boolean);

    log.info("Media fetched from sb", {
      totalImages: imagesResult.count,
      totalMarkers: markersResult.count,
      transformedCount: media.length,
    });

    return media;
  }

  transformsbImageToLocal(sbImage) {
    const visualFile = sbImage.visual_files?.[0];
    const filename = visualFile?.path || sbImage.title || `Image ${sbImage.id}`;
    const isGif = filename.toLowerCase().includes(".gif");
    const isVideo = !isGif && visualFile?.duration !== undefined;

    return {
      id: parseInt(sbImage.id),
      file_hash: `sb_${sbImage.id}`,
      file_path:
        sbImage.paths?.image || visualFile?.path || `sb://image/${sbImage.id}`,
      filename,
      file_size: visualFile?.size || 0,
      media_type: isVideo ? "video" : "image",
      thumbnail_path: sbImage.paths?.thumbnail,
      date_added: sbImage.created_at,
      date_created: sbImage.date || sbImage.created_at,
      date_modified: sbImage.updated_at,
      last_seen: new Date().toISOString(),
      sb_id: sbImage.id,
      sb_paths: sbImage.paths,
      sb_code: sbImage.code,
      sb_studio: sbImage.studio,
      sb_performers: sbImage.performers,
      sb_tags: sbImage.tags,
      sb_visual_files: sbImage.visual_files,
      rating: sbImage.rating100,
      organized: sbImage.organized,
      o_counter: sbImage.o_counter,
      width: visualFile?.width,
      height: visualFile?.height,
      duration: visualFile?.duration,
    };
  }

  transformsbMarkerToLocal(sbMarker) {
    const sceneFile = sbMarker.scene?.files?.[0];
    return {
      id: parseInt(sbMarker.id),
      file_hash: `sb_marker_${sbMarker.id}`,
      file_path: sbMarker.stream,
      filename: sbMarker.title || `Marker ${sbMarker.id}`,
      file_size: sceneFile?.size || 0,
      media_type: "video",
      thumbnail_path: sbMarker.screenshot,
      date_added: sbMarker.created_at,
      date_created: sbMarker.scene?.date || sbMarker.created_at,
      date_modified: sbMarker.updated_at,
      last_seen: new Date().toISOString(),
      sb_id: sbMarker.id,
      sb_type: "marker",
      sb_marker_start: sbMarker.seconds,
      sb_marker_end: sbMarker.end_seconds,
      sb_scene_id: sbMarker.scene?.id,
      sb_scene_title: sbMarker.scene?.title,
      sb_scene_code: sbMarker.scene?.code,
      sb_scene_studio: sbMarker.scene?.studio,
      sb_scene_performers: sbMarker.scene?.performers,
      sb_scene_tags: sbMarker.scene?.tags,
      sb_scene_files: sbMarker.scene?.files,
      sb_primary_tag: sbMarker.primary_tag,
      sb_tags: sbMarker.tags,
      width: sceneFile?.width,
      height: sceneFile?.height,
      duration: sbMarker.end_seconds
        ? sbMarker.end_seconds - sbMarker.seconds
        : null,
    };
  }

  // ── Media Retrieval ────────────────────────────────────────────────

  async getMedia(filters = {}) {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    const {
      mediaType = "all",
      sortBy = "random",
      includeTags = [],
      excludeTags = [],
      search = "",
    } = filters;

    try {
      let media;
      const hasTags = includeTags.length > 0 || excludeTags.length > 0;

      if (hasTags) {
        // Use GraphQL tag filtering
        const allTags = await this.getAllTags();
        const includeIds = this.resolveTagNamesToIds(includeTags, allTags);
        const excludeIds = this.resolveTagNamesToIds(excludeTags, allTags);

        const buildTagFilter = () => {
          const filter = {};
          if (includeIds.length > 0)
            filter.tags = { value: includeIds, modifier: "INCLUDES_ALL" };
          if (excludeIds.length > 0)
            filter.tags = { ...filter.tags, excludes: excludeIds };
          return filter;
        };

        media = await this.fetchAndTransformMedia(
          sortBy,
          buildTagFilter(),
          buildTagFilter(),
        );
      } else {
        media = await this.fetchAndTransformMedia(sortBy);
      }

      // Client-side search (SB API doesn't support server-side text search)
      if (search) {
        const term = search.toLowerCase();
        media = media.filter((item) =>
          this.buildSearchText(item).includes(term),
        );
      }

      return this.filterAndSortMedia(media, mediaType, sortBy);
    } catch (error) {
      log.error("Failed to get media from sb", {
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Build a single lowercase search string from all searchable fields of a media item.
   */
  buildSearchText(item) {
    const parts = [
      item.file_path,
      item.filename,
      item.sb_code,
      item.sb_id?.toString(),
      item.id?.toString(),
      item.sb_studio?.name,
      item.sb_scene_title,
      item.sb_scene_code,
      item.sb_scene_id?.toString(),
      item.sb_scene_studio?.name,
      item.sb_primary_tag?.name,
      item.sb_paths?.image,
      item.sb_paths?.thumbnail,
      item.sb_paths?.preview,
    ];

    const arrayFields = [
      [item.sb_performers, "name"],
      [item.sb_tags, "name"],
      [item.sb_visual_files, "path"],
      [item.sb_scene_performers, "name"],
      [item.sb_scene_tags, "name"],
      [item.sb_scene_files, "path"],
    ];

    for (const [arr, key] of arrayFields) {
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          if (entry[key]) parts.push(entry[key]);
        }
      }
    }

    return parts.filter(Boolean).join("\n").toLowerCase();
  }

  // ── Helpers ────────────────────────────────────────────────────────

  resolveTagNamesToIds(tagNames, allTags) {
    if (!tagNames || tagNames.length === 0) return [];
    return tagNames
      .map((name) => {
        const tag = allTags.find(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );
        return tag?.id.toString();
      })
      .filter(Boolean);
  }

  filterAndSortMedia(media, mediaType, sortBy) {
    let filtered = media;

    if (mediaType !== "all") {
      const targetType =
        mediaType === "photos"
          ? "image"
          : mediaType === "videos"
            ? "video"
            : mediaType;
      filtered = media.filter((item) => item.media_type === targetType);
    }

    // "random" is left as is: the server shuffles with a seed.
    if (sortBy === "date_added") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.date_added) - new Date(a.date_added),
      );
    } else if (sortBy === "date_created") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.date_created) - new Date(a.date_created),
      );
    }

    return filtered;
  }

  mapSortBy(sortBy) {
    const map = { date_added: "created_at", date_created: "date" };
    return map[sortBy] || "random";
  }

  // ── Tags ───────────────────────────────────────────────────────────

  async getAllTags() {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    try {
      const query = `
        query FindTags($filter: FindFilterType) {
          findTags(filter: $filter) { count tags { id name image_count } }
        }
      `;
      const variables = {
        filter: { per_page: 10000, sort: "name", direction: "ASC" },
      };
      const response = await this.makeGraphQLRequest(query, variables);

      return response.data.findTags.tags.map((tag) => ({
        id: parseInt(tag.id),
        name: tag.name,
        color: "#3B82F6",
        created_at: new Date().toISOString(),
        image_count: tag.image_count || 0,
      }));
    } catch (error) {
      log.error("Failed to get tags from sb", { error: error.message });
      throw error;
    }
  }

  async createTag(name, color = "#3B82F6") {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    try {
      const query = `
        mutation TagCreate($input: TagCreateInput!) {
          tagCreate(input: $input) { id name image_count }
        }
      `;
      const response = await this.makeGraphQLRequest(query, {
        input: { name: name.trim() },
      });
      const sbTag = response.data.tagCreate;
      const tag = {
        id: parseInt(sbTag.id),
        name: sbTag.name,
        color,
        created_at: new Date().toISOString(),
        image_count: sbTag.image_count || 0,
      };
      log.info("Tag created in sb", { tagId: tag.id, name: tag.name });
      return tag;
    } catch (error) {
      if (
        error.message.includes("already exists") ||
        error.message.includes("duplicate")
      ) {
        throw new Error("Tag already exists");
      }
      log.error("Failed to create tag in sb", { name, error: error.message });
      throw error;
    }
  }

  async updateTag(_id, _name, _color) {
    throw new Error(
      "Tag updates not supported by sbMediaProvider - use sb interface to manage tags",
    );
  }

  async deleteTag(_id) {
    throw new Error(
      "Tag deletion not supported by sbMediaProvider - use sb interface to manage tags",
    );
  }

  async getMediaTags(mediaId) {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    try {
      const sbInfo = this.extractsbIdFromHash(mediaId);
      if (!sbInfo) {
        log.warn(
          "Cannot extract valid ID from media hash, skipping tag retrieval",
          { mediaId },
        );
        return [];
      }

      let sbTags;

      if (sbInfo.type === "marker") {
        const query = `
          query FindSceneMarker($id: ID!) {
            findSceneMarkers(ids: [$id]) {
              scene_markers { id primary_tag { id name } tags { id name } }
            }
          }
        `;
        const response = await this.makeGraphQLRequest(query, {
          id: sbInfo.id,
        });
        const marker = response.data.findSceneMarkers?.scene_markers?.[0];
        if (!marker) return [];
        sbTags = [
          ...(marker.primary_tag ? [marker.primary_tag] : []),
          ...(marker.tags || []),
        ];
      } else {
        const query = `
          query FindImage($id: ID!) {
            findImage(id: $id) { id tags { id name } }
          }
        `;
        const response = await this.makeGraphQLRequest(query, {
          id: sbInfo.id,
        });
        if (!response.data.findImage) return [];
        sbTags = response.data.findImage.tags || [];
      }

      return sbTags.map((tag) => ({
        id: parseInt(tag.id),
        name: tag.name,
        color: "#3B82F6",
        created_at: new Date().toISOString(),
      }));
    } catch (error) {
      log.error("Failed to get media tags from sb", {
        mediaId,
        error: error.message,
      });
      return [];
    }
  }

  async addTagToMedia(mediaId, tagId) {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    try {
      const sbInfo = this.extractsbIdFromHash(mediaId);
      if (!sbInfo) {
        log.warn(
          "Cannot extract valid ID from media hash, skipping tag addition",
          { mediaId, tagId },
        );
        return false;
      }

      const currentTags = await this.getMediaTags(mediaId);
      const currentTagIds = currentTags.map((t) => t.id.toString());
      if (currentTagIds.includes(tagId.toString())) return false;

      if (sbInfo.type === "marker") {
        const markerTags = await this.getMarkerAdditionalTagIds(sbInfo.id);
        await this.updateMarkerTags(sbInfo.id, [
          ...markerTags,
          tagId.toString(),
        ]);
      } else {
        await this.updateImageTags(sbInfo.id, [
          ...currentTagIds,
          tagId.toString(),
        ]);
      }

      log.info("Tag added to media in sb", {
        mediaId,
        tagId,
        sbId: sbInfo.id,
        type: sbInfo.type,
      });
      return true;
    } catch (error) {
      log.error("Failed to add tag to media in sb", {
        mediaId,
        tagId,
        error: error.message,
      });
      throw error;
    }
  }

  async removeTagFromMedia(mediaId, tagId) {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    try {
      const sbInfo = this.extractsbIdFromHash(mediaId);
      if (!sbInfo) {
        log.warn(
          "Cannot extract valid ID from media hash, skipping tag removal",
          { mediaId, tagId },
        );
        return false;
      }

      const currentTags = await this.getMediaTags(mediaId);
      const currentTagIds = currentTags.map((t) => t.id.toString());
      if (!currentTagIds.includes(tagId.toString())) return false;

      if (sbInfo.type === "marker") {
        const markerData = await this.getMarkerData(sbInfo.id);
        if (!markerData) throw new Error("Marker not found");
        if (markerData.primary_tag?.id.toString() === tagId.toString()) {
          throw new Error("Cannot remove primary tag from marker");
        }
        const additionalTagIds = (markerData.tags || []).map((t) =>
          t.id.toString(),
        );
        await this.updateMarkerTags(
          sbInfo.id,
          additionalTagIds.filter((id) => id !== tagId.toString()),
        );
      } else {
        await this.updateImageTags(
          sbInfo.id,
          currentTagIds.filter((id) => id !== tagId.toString()),
        );
      }

      log.info("Tag removed from media in sb", {
        mediaId,
        tagId,
        sbId: sbInfo.id,
        type: sbInfo.type,
      });
      return true;
    } catch (error) {
      log.error("Failed to remove tag from media in sb", {
        mediaId,
        tagId,
        error: error.message,
      });
      throw error;
    }
  }

  // ── Tag mutation helpers ───────────────────────────────────────────

  async getMarkerData(markerId) {
    const query = `
      query FindSceneMarker($id: ID!) {
        findSceneMarkers(ids: [$id]) {
          scene_markers { id primary_tag { id } tags { id } }
        }
      }
    `;
    const response = await this.makeGraphQLRequest(query, { id: markerId });
    return response.data.findSceneMarkers?.scene_markers?.[0] || null;
  }

  async getMarkerAdditionalTagIds(markerId) {
    const marker = await this.getMarkerData(markerId);
    if (!marker) throw new Error("Marker not found");
    return (marker.tags || []).map((t) => t.id.toString());
  }

  async updateMarkerTags(markerId, tagIds) {
    const query = `
      mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
        sceneMarkerUpdate(input: $input) { id primary_tag { id name } tags { id name } }
      }
    `;
    await this.makeGraphQLRequest(query, {
      input: { id: markerId, tag_ids: tagIds },
    });
  }

  async updateImageTags(imageId, tagIds) {
    const query = `
      mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) { id tags { id name } }
      }
    `;
    await this.makeGraphQLRequest(query, {
      input: { id: imageId, tag_ids: tagIds },
    });
  }

  // ── Stats & IDs ────────────────────────────────────────────────────

  async getStats() {
    if (!this.isInitialized) throw new Error("Provider not initialized");
    try {
      const allMedia = await this.getMedia({});
      const images = allMedia.filter((item) => item.media_type === "image");
      return {
        total: allMedia.length,
        images: images.length,
        videos: allMedia.length - images.length,
        totalSize: allMedia.reduce(
          (sum, item) => sum + (item.file_size || 0),
          0,
        ),
        provider: "sb",
        sbUrl: this.sbUrl,
      };
    } catch (error) {
      log.error("Failed to get stats from sb", { error: error.message });
      throw error;
    }
  }

  getFileHashForPath(filePath) {
    const markerMatch = filePath.match(
      /scene\/(\d+)\/scene_marker\/(\d+)\/stream/,
    );
    if (markerMatch) return `sb_marker_${markerMatch[2]}`;
    const imageMatch = filePath.match(/image\/(\d+)/);
    if (imageMatch) return `sb_${imageMatch[1]}`;
    return `sb_path_${Buffer.from(filePath).toString("base64").slice(0, 16)}`;
  }

  extractsbIdFromHash(fileHash) {
    if (typeof fileHash !== "string") return null;
    if (fileHash.startsWith("sb_marker_"))
      return { id: fileHash.replace("sb_marker_", ""), type: "marker" };
    if (fileHash.startsWith("sb_scene_"))
      return { id: fileHash.replace("sb_scene_", ""), type: "scene" };
    if (fileHash.startsWith("sb_path_")) return null;
    if (fileHash.startsWith("sb_"))
      return { id: fileHash.replace("sb_", ""), type: "image" };
    return null;
  }

  // ── Serving (proxy) ────────────────────────────────────────────────

  /**
   * Probe the content-type of a URL using Node's http module.
   * Reads only the response headers, then destroys the socket immediately.
   * This avoids Bun's fetch which can hang on large binary responses.
   */
  probeContentType(url) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const mod =
        parsedUrl.protocol === "https:" ? require("https") : require("http");
      const reqHeaders = {};
      if (this.apiKey) reqHeaders["ApiKey"] = this.apiKey;

      const req = mod.get(
        url,
        { headers: reqHeaders, timeout: 10000 },
        (res) => {
          // We only need the headers — destroy the socket immediately
          res.destroy();
          if (res.statusCode >= 400) {
            return reject(new Error(`Upstream returned ${res.statusCode}`));
          }
          resolve(res.headers["content-type"] || "");
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Content-type probe timed out"));
      });
    });
  }

  async serveMedia(filePath, req, res) {
    try {
      if (!filePath.startsWith("http"))
        return res.status(400).send("Invalid media path for provider");

      const headers = this.apiKey ? { ApiKey: this.apiKey } : {};

      // Forward Range header for seeking support
      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const response = await fetch(filePath, { headers });
      if (!response.ok && response.status !== 206) {
        log.error("Server returned error for media", {
          url: filePath,
          status: response.status,
        });
        return res.status(404).send("Media not found on server");
      }

      // Forward relevant headers from upstream
      const contentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      const contentRange = response.headers.get("content-range");
      const acceptRanges = response.headers.get("accept-ranges");

      if (contentType) res.set("Content-Type", contentType);
      if (contentLength) res.set("Content-Length", contentLength);
      if (contentRange) res.set("Content-Range", contentRange);
      if (acceptRanges) res.set("Accept-Ranges", acceptRanges);

      // Set status code (206 for partial content, otherwise upstream status)
      res.status(response.status);

      // Stream the response body directly to the client
      const { Readable } = require("stream");
      const readable = Readable.fromWeb(response.body);
      readable.pipe(res);
    } catch (error) {
      log.error("Failed to serve media file", {
        filePath,
        error: error.message,
      });
      if (!res.headersSent) {
        res.status(500).send("Failed to serve media file");
      }
    }
  }

  async serveThumbnail(fileHash, res) {
    try {
      const data = await this.getThumbnailData(fileHash);
      if (!data) return res.status(404).send("Thumbnail not found");
      if (data.contentType) res.set("Content-Type", data.contentType);
      res.send(data.buffer);
    } catch (error) {
      log.error("Failed to serve thumbnail file", {
        fileHash,
        error: error.message,
      });
      if (!res.headersSent)
        res.status(500).send("Failed to serve thumbnail file");
    }
  }

  async getThumbnailData(fileHash) {
    const fromDisk = await this.readDiskCache(fileHash);
    if (fromDisk) return fromDisk;

    // One ffmpeg/proxy job per thumbnail, however many requests pile up.
    const inflight = this.inflightThumbnails.get(fileHash);
    if (inflight) return inflight;

    const promise = this.fetchThumbnailData(fileHash);
    this.inflightThumbnails.set(fileHash, promise);
    try {
      return await promise;
    } finally {
      this.inflightThumbnails.delete(fileHash);
    }
  }

  // Where sb keeps an item's thumbnail, asked for that one item.
  async lookupThumbnailUrl(fileHash) {
    const info = this.extractsbIdFromHash(fileHash);
    if (info?.type === "image") {
      const response = await this.makeGraphQLRequest(
        `query FindImage($id: ID!) { findImage(id: $id) { paths { thumbnail } } }`,
        { id: info.id },
      );
      return response.data.findImage?.paths?.thumbnail || null;
    }
    if (info?.type === "marker") {
      const response = await this.makeGraphQLRequest(
        `query FindMarker($id: ID!) { findSceneMarkers(ids: [$id]) { scene_markers { screenshot } } }`,
        { id: info.id },
      );
      return (
        response.data.findSceneMarkers?.scene_markers?.[0]?.screenshot || null
      );
    }
    return null;
  }

  async fetchThumbnailData(fileHash) {
    const thumbnailUrl = await this.lookupThumbnailUrl(fileHash);
    if (!thumbnailUrl) return null;

    // Video: generate thumb via ffmpeg
    const contentType = await this.probeContentType(thumbnailUrl);
    if (contentType.startsWith("video/")) {
      log.info(
        "Upstream returned video instead of thumbnail, generating locally",
        { fileHash, contentType },
      );

      const thumbBuffer = await this.generateThumbnailFromVideo(
        thumbnailUrl,
        fileHash,
      );
      if (thumbBuffer) {
        await this.writeDiskCache(fileHash, thumbBuffer, "image/jpeg");
        return { buffer: thumbBuffer, contentType: "image/jpeg" };
      }
      // ffmpeg failed — proxy the raw upstream bytes but don't persist them
      // (could be the entire video file; pointless to keep as a thumbnail).
      return this.fetchBuffer(thumbnailUrl);
    }

    // Image: fetch and keep
    const result = await this.fetchBuffer(thumbnailUrl);
    if (!result) return null;
    await this.writeDiskCache(fileHash, result.buffer, result.contentType);
    return result;
  }

  async fetchBuffer(url) {
    const headers = this.apiKey ? { ApiKey: this.apiKey } : {};
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type");
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  }

  // ── Disk cache ─────────────────────────────────────────────────────

  // A thumbnail on disk is named <hash>.<ext>, the extension recording its
  // type. Looked up on disk each time, so files removed by hand are simply
  // fetched again.
  async readDiskCache(fileHash) {
    for (const ext of ["jpg", "png", "webp", "gif", "avif", "bin"]) {
      try {
        const filePath = path.join(this.diskCacheDir, `${fileHash}.${ext}`);
        const buffer = await fs.promises.readFile(filePath);
        return { buffer, contentType: this.contentTypeFromExt(ext) };
      } catch {
        // not this extension
      }
    }
    return null;
  }

  async writeDiskCache(fileHash, buffer, contentType) {
    const ext = this.extFromContentType(contentType);
    const filePath = path.join(this.diskCacheDir, `${fileHash}.${ext}`);
    try {
      await fs.promises.writeFile(filePath, buffer);
    } catch (err) {
      log.warn("Failed to write disk thumbnail cache", {
        fileHash,
        error: err.message,
      });
    }
  }

  extFromContentType(ct) {
    if (!ct) return "bin";
    const t = ct.toLowerCase();
    if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
    if (t.includes("png")) return "png";
    if (t.includes("webp")) return "webp";
    if (t.includes("gif")) return "gif";
    if (t.includes("avif")) return "avif";
    return "bin";
  }

  contentTypeFromExt(ext) {
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "webp":
        return "image/webp";
      case "gif":
        return "image/gif";
      case "avif":
        return "image/avif";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Generate a thumbnail from a video URL using ffmpeg.
   * Downloads the video, writes to a temp file for ffmpeg.
   * @param {string} videoUrl - The upstream video URL
   * @param {string} fileHash - Used for temp filenames and caching
   * @returns {Promise<Buffer|null>} JPEG thumbnail buffer, or null on failure
   */
  async generateThumbnailFromVideo(videoUrl, fileHash) {
    const tmpDir = os.tmpdir();
    const tempVideoPath = path.join(tmpDir, `cactus_${fileHash}_in.mp4`);
    const tempThumbPath = path.join(tmpDir, `cactus_${fileHash}_out.jpg`);

    try {
      const headers = this.apiKey ? { ApiKey: this.apiKey } : {};
      const response = await fetch(videoUrl, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(tempVideoPath, videoBuffer);
    } catch (err) {
      log.error("Failed to download video for thumbnail", {
        fileHash,
        error: err.message,
      });
      return null;
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        fs.rmSync(tempVideoPath, { force: true });
        fs.rmSync(tempThumbPath, { force: true });
      };

      ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
        if (err) {
          log.error("Failed to probe video for thumbnail generation", {
            fileHash,
            error: err.message,
          });
          cleanup();
          return resolve(null);
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video",
        );
        if (!videoStream) {
          log.error("No video stream found for thumbnail generation", {
            fileHash,
          });
          cleanup();
          return resolve(null);
        }

        const maxDim = 500;
        const { width: origW, height: origH } = videoStream;
        let newWidth, newHeight;
        if (origW > origH) {
          newWidth = maxDim;
          newHeight = Math.round((origH / origW) * maxDim);
        } else {
          newHeight = maxDim;
          newWidth = Math.round((origW / origH) * maxDim);
        }

        ffmpeg(tempVideoPath)
          .screenshots({
            timestamps: ["0%"],
            filename: `cactus_${fileHash}_out.jpg`,
            folder: tmpDir,
            size: `${newWidth}x${newHeight}`,
          })
          .on("end", () => {
            log.info("Generated thumbnail from upstream video", {
              fileHash,
              size: `${newWidth}x${newHeight}`,
            });
            try {
              const thumbBuffer = fs.readFileSync(tempThumbPath);
              cleanup();
              resolve(thumbBuffer);
            } catch (readErr) {
              log.error("Failed to read generated thumbnail", {
                fileHash,
                error: readErr.message,
              });
              cleanup();
              resolve(null);
            }
          })
          .on("error", (err) => {
            log.error("Failed to generate thumbnail from video", {
              fileHash,
              error: err.message,
            });
            cleanup();
            resolve(null);
          });
      });
    });
  }

  // ── Unsupported operations ─────────────────────────────────────────

  async rescanDirectory() {
    throw new Error(
      "Directory rescan not supported by sbMediaProvider. Use getAllMedia() to refresh data from sb server.",
    );
  }

  // Empties the thumbnail folder; each thumbnail is fetched from sb again the
  // next time it is shown.
  async regenerateThumbnails() {
    const files = await fs.promises.readdir(this.diskCacheDir);
    await Promise.all(
      files.map((file) =>
        fs.promises.rm(path.join(this.diskCacheDir, file), { force: true }),
      ),
    );
    log.info("Thumbnail folder emptied", { removed: files.length });
    return files.length;
  }

  // ── UI Config ──────────────────────────────────────────────────────

  getCapabilities() {
    return {
      canRescan: false,
      canRegenerateThumbnails: true,
      canManageTags: false,
      canGetFileHashForPath: false,
      supportsLocalFiles: false,
      supportsRemoteFiles: true,
    };
  }

  getUIConfig() {
    const capabilities = this.getCapabilities();
    return {
      showDirectoryInfo: true,
      directoryLabel: "Server",
      showConnectionStatus: true,
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

  computeDisplayName(mediaFile, _directoryPath) {
    if (!mediaFile) return "";

    if (mediaFile.sb_type === "marker") {
      if (mediaFile.sb_scene_performers?.length > 0) {
        const performers = mediaFile.sb_scene_performers
          .map((p) => p.name)
          .join(", ");
        return performers.length > 30
          ? performers.substring(0, 27) + "..."
          : performers;
      }
      if (mediaFile.sb_scene_title) {
        return mediaFile.sb_scene_title.length > 30
          ? mediaFile.sb_scene_title.substring(0, 27) + "..."
          : mediaFile.sb_scene_title;
      }
      if (mediaFile.sb_scene_studio?.name)
        return mediaFile.sb_scene_studio.name;
    } else {
      if (mediaFile.sb_performers?.length > 0) {
        const performers = mediaFile.sb_performers
          .map((p) => p.name)
          .join(", ");
        return performers.length > 30
          ? performers.substring(0, 27) + "..."
          : performers;
      }
      if (mediaFile.filename) {
        const pathParts = mediaFile.filename.split("/");
        if (pathParts.length >= 2) return pathParts[pathParts.length - 2];
      }
      if (mediaFile.sb_id) return `Image #${mediaFile.sb_id}`;
    }

    return "S Server";
  }

  // ── Media Info ─────────────────────────────────────────────────────

  getMediaInfo(mediaFile) {
    const result = super.getMediaInfo(mediaFile);
    if (!mediaFile) return result;

    // Source info
    const sourceFields = [];
    if (mediaFile.sb_studio?.name)
      sourceFields.push({
        label: "Studio",
        value: mediaFile.sb_studio.name,
        type: "text",
      });
    if (mediaFile.sb_code)
      sourceFields.push({
        label: "Code",
        value: mediaFile.sb_code,
        type: "text",
      });
    if (mediaFile.rating != null && mediaFile.rating > 0)
      sourceFields.push({
        label: "Rating",
        value: mediaFile.rating,
        type: "rating",
      });
    if (sourceFields.length > 0)
      result.sections.push({ title: "Source", fields: sourceFields });

    // Performers
    const performers =
      mediaFile.sb_type === "marker"
        ? mediaFile.sb_scene_performers
        : mediaFile.sb_performers;
    if (performers?.length > 0) {
      result.sections.push({
        title: "People",
        fields: [
          {
            label: "People",
            value: performers.map((p) => p.name),
            type: "tags",
          },
        ],
      });
    }

    // Tags
    if (mediaFile.sb_tags?.length > 0) {
      result.sections.push({
        title: "Tags",
        fields: [
          {
            label: "Tags",
            value: mediaFile.sb_tags.map((t) => t.name),
            type: "tags",
          },
        ],
      });
    }

    // File details from visual_files
    const visualFile = mediaFile.sb_visual_files?.[0];
    if (visualFile) {
      const fileFields = [];
      if (visualFile.video_codec)
        fileFields.push({
          label: "Video Codec",
          value: visualFile.video_codec,
          type: "text",
        });
      if (visualFile.audio_codec)
        fileFields.push({
          label: "Audio Codec",
          value: visualFile.audio_codec,
          type: "text",
        });
      if (visualFile.frame_rate)
        fileFields.push({
          label: "Frame Rate",
          value: `${visualFile.frame_rate} fps`,
          type: "text",
        });
      if (visualFile.bit_rate)
        fileFields.push({
          label: "Bit Rate",
          value: `${(visualFile.bit_rate / 1000000).toFixed(1)} Mbps`,
          type: "text",
        });
      if (visualFile.path)
        fileFields.push({
          label: "File Path",
          value: visualFile.path,
          type: "text",
        });
      if (visualFile.fingerprints?.length > 0) {
        for (const fp of visualFile.fingerprints) {
          fileFields.push({
            label: fp.type.toUpperCase(),
            value: fp.value,
            type: "text",
          });
        }
      }
      if (fileFields.length > 0)
        result.sections.push({ title: "File Details", fields: fileFields });
    }

    // Scene info for markers
    if (mediaFile.sb_type === "marker") {
      const sceneFields = [];
      if (mediaFile.sb_scene_title)
        sceneFields.push({
          label: "Scene Title",
          value: mediaFile.sb_scene_title,
          type: "text",
        });
      if (mediaFile.sb_scene_code)
        sceneFields.push({
          label: "Scene Code",
          value: mediaFile.sb_scene_code,
          type: "text",
        });
      if (mediaFile.sb_scene_studio?.name)
        sceneFields.push({
          label: "Scene Studio",
          value: mediaFile.sb_scene_studio.name,
          type: "text",
        });
      if (mediaFile.sb_marker_start != null)
        sceneFields.push({
          label: "Marker Start",
          value: this.formatDuration(mediaFile.sb_marker_start),
          type: "text",
        });
      if (mediaFile.sb_marker_end != null)
        sceneFields.push({
          label: "Marker End",
          value: this.formatDuration(mediaFile.sb_marker_end),
          type: "text",
        });
      if (mediaFile.sb_primary_tag?.name)
        sceneFields.push({
          label: "Primary Tag",
          value: mediaFile.sb_primary_tag.name,
          type: "text",
        });
      const sceneFile = mediaFile.sb_scene_files?.[0];
      if (sceneFile?.duration)
        sceneFields.push({
          label: "Scene Duration",
          value: this.formatDuration(sceneFile.duration),
          type: "text",
        });
      if (sceneFile?.path)
        sceneFields.push({
          label: "Scene File",
          value: sceneFile.path,
          type: "text",
        });
      if (sceneFields.length > 0)
        result.sections.push({ title: "Scene Info", fields: sceneFields });

      if (mediaFile.sb_scene_tags?.length > 0) {
        result.sections.push({
          title: "Scene Tags",
          fields: [
            {
              label: "Tags",
              value: mediaFile.sb_scene_tags.map((t) => t.name),
              type: "tags",
            },
          ],
        });
      }
    }

    return result;
  }

  async close() {
    this.isInitialized = false;
    this.inflightThumbnails.clear();
    await super.close();
    log.info("sbMediaProvider closed");
  }
}

module.exports = SbMediaProvider;
