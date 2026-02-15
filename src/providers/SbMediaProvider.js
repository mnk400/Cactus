/**
 * sbMediaProvider
 *
 * Implementation of MediaSourceProvider for sb GraphQL API.
 * This provider fetches media from a sb server via GraphQL.
 */

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
    this.mediaCache = [];
    this.lastFetchTime = null;
    this.cacheTimeout = 5 * 60 * 1000;
    this.tagsCache = null;
    this.tagsCacheTime = null;
    this.thumbnailMap = new Map();
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

  async getAllMedia(mediaType = "all", sortBy = "random") {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    try {
      const now = Date.now();
      if (
        this.mediaCache.length > 0 &&
        this.lastFetchTime &&
        now - this.lastFetchTime < this.cacheTimeout
      ) {
        return this.filterAndSortMedia(this.mediaCache, mediaType, sortBy);
      }

      log.info("Fetching media from sb server", { mediaType, sortBy });
      const media = await this.fetchAndTransformMedia(sortBy);

      this.mediaCache = media;
      this.lastFetchTime = now;
      this.rebuildThumbnailMap();

      return this.filterAndSortMedia(media, mediaType, sortBy);
    } catch (error) {
      log.error("Failed to get media from sb", {
        mediaType,
        sortBy,
        error: error.message,
      });
      throw error;
    }
  }

  async getMediaByTags(includeTags, excludeTags, mediaType, sortBy) {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    if (
      (!includeTags || includeTags.length === 0) &&
      (!excludeTags || excludeTags.length === 0)
    ) {
      return this.getAllMedia(mediaType, sortBy);
    }

    try {
      log.info("Filtering media by tags in sb", {
        includeTags,
        excludeTags,
        mediaType,
      });

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

      const imageFilter = buildTagFilter();
      const markerFilter = buildTagFilter();

      const media = await this.fetchAndTransformMedia(
        sortBy,
        imageFilter,
        markerFilter,
      );

      log.info("Tag filtering completed for sb", {
        includeTags,
        excludeTags,
        resultCount: media.length,
      });
      return this.filterAndSortMedia(media, mediaType, sortBy);
    } catch (error) {
      log.error("Failed to filter media by tags in sb", {
        includeTags,
        excludeTags,
        mediaType,
        error: error.message,
      });
      throw error;
    }
  }

  async getMediaByGeneralFilter(substring, mediaType, sortBy) {
    const allMedia = await this.getAllMedia(mediaType, sortBy);
    const term = substring.toLowerCase();

    const filteredMedia = allMedia.filter((item) => {
      const searchText = this.buildSearchText(item);
      return searchText.includes(term);
    });

    log.info("Path substring filtering completed", {
      substring,
      totalMedia: allMedia.length,
      filteredCount: filteredMedia.length,
    });
    return filteredMedia;
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

    if (sortBy === "random") {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    } else if (sortBy === "date_added") {
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

  rebuildThumbnailMap() {
    this.thumbnailMap.clear();
    for (const item of this.mediaCache) {
      if (item.thumbnail_path) {
        this.thumbnailMap.set(item.file_hash, item.thumbnail_path);
      }
    }
  }

  invalidateCache() {
    this.mediaCache = [];
    this.lastFetchTime = null;
    this.tagsCache = null;
    this.tagsCacheTime = null;
    this.thumbnailMap.clear();
  }

  // ── Tags ───────────────────────────────────────────────────────────

  async getAllTags() {
    if (!this.isInitialized) throw new Error("Provider not initialized");

    const now = Date.now();
    if (
      this.tagsCache &&
      this.tagsCacheTime &&
      now - this.tagsCacheTime < this.cacheTimeout
    ) {
      return this.tagsCache;
    }

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

      this.tagsCache = response.data.findTags.tags.map((tag) => ({
        id: parseInt(tag.id),
        name: tag.name,
        color: "#3B82F6",
        created_at: new Date().toISOString(),
        image_count: tag.image_count || 0,
      }));
      this.tagsCacheTime = now;
      return this.tagsCache;
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
      this.tagsCache = null;
      this.tagsCacheTime = null;
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

  async updateTag(id, name, color) {
    throw new Error(
      "Tag updates not supported by sbMediaProvider - use sb interface to manage tags",
    );
  }

  async deleteTag(id) {
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

      this.invalidateCache();
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

      this.invalidateCache();
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
      const allMedia = await this.getAllMedia("all");
      const images = allMedia.filter((item) => item.media_type === "image");
      const videos = allMedia.filter((item) => item.media_type === "video");
      return {
        totalFiles: allMedia.length,
        totalImages: images.length,
        totalVideos: videos.length,
        totalSize: allMedia.reduce(
          (sum, item) => sum + (item.file_size || 0),
          0,
        ),
        provider: "sb",
        sbUrl: this.sbUrl,
        lastFetch: this.lastFetchTime
          ? new Date(this.lastFetchTime).toISOString()
          : null,
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

  async proxyFetch(url, res, errorLabel = "media") {
    const headers = this.apiKey ? { ApiKey: this.apiKey } : {};
    const response = await fetch(url, { headers });
    if (!response.ok) {
      log.error(`Server returned error for ${errorLabel}`, {
        url,
        status: response.status,
      });
      return res.status(404).send(`${errorLabel} not found on server`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType) res.set("Content-Type", contentType);
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  }

  async serveMedia(filePath, res) {
    try {
      if (!filePath.startsWith("http"))
        return res.status(400).send("Invalid media path for provider");
      await this.proxyFetch(filePath, res, "Media");
    } catch (error) {
      log.error("Failed to serve media file", {
        filePath,
        error: error.message,
      });
      res.status(500).send("Failed to serve media file");
    }
  }

  async serveThumbnail(fileHash, res) {
    try {
      const thumbnailPath = this.thumbnailMap.get(fileHash);
      if (!thumbnailPath) {
        // Fallback: try refreshing cache if map is empty
        if (this.thumbnailMap.size === 0 && this.mediaCache.length === 0) {
          await this.getAllMedia("all");
          const retryPath = this.thumbnailMap.get(fileHash);
          if (!retryPath) return res.status(404).send("Thumbnail not found");
          return this.proxyFetch(retryPath, res, "Thumbnail");
        }
        return res.status(404).send("Thumbnail not found");
      }
      await this.proxyFetch(thumbnailPath, res, "Thumbnail");
    } catch (error) {
      log.error("Failed to serve thumbnail file", {
        fileHash,
        error: error.message,
      });
      res.status(500).send("Failed to serve thumbnail file");
    }
  }

  // ── Unsupported operations ─────────────────────────────────────────

  async rescanDirectory() {
    throw new Error(
      "Directory rescan not supported by sbMediaProvider. Use getAllMedia() to refresh data from sb server.",
    );
  }

  async regenerateThumbnails() {
    throw new Error(
      "Thumbnail regeneration not supported by sbMediaProvider. Thumbnails are managed by sb server.",
    );
  }

  // ── UI Config ──────────────────────────────────────────────────────

  getCapabilities() {
    return {
      canRescan: false,
      canRegenerateThumbnails: false,
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

  computeDisplayName(mediaFile, directoryPath) {
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
    this.mediaCache = [];
    this.lastFetchTime = null;
    this.tagsCache = null;
    this.tagsCacheTime = null;
    this.thumbnailMap.clear();
    await super.close();
    log.info("sbMediaProvider closed");
  }
}

module.exports = SbMediaProvider;
