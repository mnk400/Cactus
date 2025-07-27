/**
 * sbMediaProvider
 * 
 * Implementation of MediaSourceProvider for sb GraphQL API.
 * This provider fetches media from a sb server via GraphQL.
 */

const MediaSourceProvider = require("./MediaSourceProvider");

// Import fetch for Node.js (if not available globally)
const fetch = globalThis.fetch || require('node-fetch');

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

class SbMediaProvider extends MediaSourceProvider {
    constructor(sbUrl = "http://192.168.0.23:9999/graphql") {
        super();
        this.sbUrl = sbUrl;
        this.isInitialized = false;
        this.mediaCache = [];
        this.lastFetchTime = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Initialize the media provider
     * @returns {Promise<Object>} Result of initialization with success status
     */
    async initialize() {
        try {
            // Test connection to sb server
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

    /**
     * Test the connection to the sb server
     * @returns {Promise<Object>} Connection test result with success status
     */
    async testConnection() {
        try {
            const response = await this.makeGraphQLRequest(`
        query {
          version {
            version
          }
        }
      `);

            if (response.data && response.data.version) {
                log.info("sb server connection successful", {
                    version: response.data.version.version,
                });
                return { success: true, version: response.data.version.version };
            } else {
                return { success: false, error: "Invalid response from sb server" };
            }
        } catch (error) {
            log.error("sb server connection failed", {
                sbUrl: this.sbUrl,
                error: error.message,
            });
            return { success: false, error: error.message };
        }
    }
    /**
       * Make a GraphQL request to the sb server
       * @param {string} query - GraphQL query string
       * @param {Object} variables - GraphQL variables
       * @returns {Promise<Object>} GraphQL response
       */
    async makeGraphQLRequest(query, variables = {}) {
        try {
            const response = await fetch(this.sbUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query,
                    variables,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.errors) {
                throw new Error(`GraphQL error: ${data.errors.map(e => e.message).join(', ')}`);
            }

            return data;
        } catch (error) {
            log.error("GraphQL request failed", {
                query: query.substring(0, 100) + "...",
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Fetch images from sb server
     * @param {Object} filter - Filter parameters
     * @returns {Promise<Array>} Array of image data
     */
    async fetchImages(filter = {}) {
        const query = `
      query FindImages($filter: FindFilterType, $image_filter: ImageFilterType) {
        findImages(filter: $filter, image_filter: $image_filter) {
          count
          images {
            id
            title
            code
            date
            rating100
            organized
            o_counter
            created_at
            updated_at
            paths {
              thumbnail
              preview
              image
            }
            visual_files {
              ... on ImageFile {
                id
                path
                size
                mod_time
                width
                height
                fingerprints {
                  type
                  value
                }
              }
              ... on VideoFile {
                id
                path
                size
                mod_time
                duration
                video_codec
                audio_codec
                width
                height
                frame_rate
                bit_rate
                fingerprints {
                  type
                  value
                }
              }
            }
            tags {
              id
              name
            }
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

    /**
     * Fetch scene markers from sb server
     * @param {Object} filter - Filter parameters
     * @returns {Promise<Array>} Array of marker data
     */
    async fetchMarkers(filter = {}) {
        const query = `
      query FindMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
        findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
          count
          scene_markers {
            id
            title
            seconds
            end_seconds
            created_at
            updated_at
            
            # Essential media URLs
            stream
            preview
            screenshot
            
            # Basic scene info
            scene {
              id
              title
              date
              files {
                duration
                width
                height
                size
              }
            }
            
            # Tags for filtering/categorization
            primary_tag {
              id
              name
            }
            
            tags {
              id
              name
            }
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
     * Transform sb image data to local format
     * @param {Object} sbImage - sb image object
     * @returns {Object} Transformed media object
     */
    transformsbImageToLocal(sbImage) {
        // Use the first visual file for basic info
        const visualFile = sbImage.visual_files?.[0];
        const isVideo = visualFile && visualFile.duration !== undefined;

        // Generate a hash-like ID from the sb ID
        const fileHash = `sb_${sbImage.id}`;

        return {
            id: parseInt(sbImage.id),
            file_hash: fileHash,
            file_path: sbImage.paths?.image || visualFile?.path || `sb://image/${sbImage.id}`,
            filename: sbImage.title || `Image ${sbImage.id}`,
            file_size: visualFile?.size || 0,
            media_type: isVideo ? "video" : "image",
            thumbnail_path: sbImage.paths?.thumbnail,
            date_added: sbImage.created_at,
            date_created: sbImage.date || sbImage.created_at,
            date_modified: sbImage.updated_at,
            last_seen: new Date().toISOString(),
            // Additional sb-specific fields
            sb_id: sbImage.id,
            sb_paths: sbImage.paths,
            rating: sbImage.rating100,
            organized: sbImage.organized,
            o_counter: sbImage.o_counter,
            width: visualFile?.width,
            height: visualFile?.height,
            duration: visualFile?.duration,
        };
    }

    /**
     * Transform sb scene marker data to local format
     * @param {Object} sbMarker - sb scene marker object
     * @returns {Object} Transformed media object
     */
    transformsbMarkerToLocal(sbMarker) {
        // Generate a hash-like ID from the sb marker ID
        const fileHash = `sb_marker_${sbMarker.id}`;

        // Calculate duration from seconds and end_seconds
        const duration = sbMarker.end_seconds
            ? sbMarker.end_seconds - sbMarker.seconds
            : null;

        // Use scene file info if available
        const sceneFile = sbMarker.scene?.files?.[0];

        return {
            id: parseInt(sbMarker.id),
            file_hash: fileHash,
            file_path: sbMarker.stream, // Direct stream URL
            filename: sbMarker.title || `Marker ${sbMarker.id}`,
            file_size: sceneFile?.size || 0,
            media_type: "video", // Markers are always video clips
            thumbnail_path: sbMarker.preview || sbMarker.screenshot,
            date_added: sbMarker.created_at,
            date_created: sbMarker.scene?.date || sbMarker.created_at,
            date_modified: sbMarker.updated_at,
            last_seen: new Date().toISOString(),
            // Additional sb-specific fields
            sb_id: sbMarker.id,
            sb_type: "marker", // Distinguish from regular images/videos
            sb_marker_start: sbMarker.seconds,
            sb_marker_end: sbMarker.end_seconds,
            sb_scene_id: sbMarker.scene?.id,
            sb_scene_title: sbMarker.scene?.title,
            sb_primary_tag: sbMarker.primary_tag,
            sb_tags: sbMarker.tags,
            width: sceneFile?.width,
            height: sceneFile?.height,
            duration: duration,
        };
    }

    /**
     * Get all media from sb
     * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
     * @param {string} sortBy - Sorting parameters
     * @returns {Promise<Array>} Array of media items
     */
    async getAllMedia(mediaType = "all", sortBy = "random") {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            // Check cache first
            const now = Date.now();
            if (this.mediaCache.length > 0 && this.lastFetchTime && (now - this.lastFetchTime) < this.cacheTimeout) {
                return this.filterAndSortMedia(this.mediaCache, mediaType, sortBy);
            }

            log.info("Fetching media from sb server", { mediaType, sortBy });

            // Fetch both images and markers in parallel
            const [imagesResult, markersResult] = await Promise.all([
                this.fetchImages({
                    sort: this.mapSortBy(sortBy),
                    per_page: 10000,
                }),
                this.fetchMarkers({
                    sort: this.mapSortBy(sortBy),
                    per_page: 10000,
                })
            ]);

            // Transform sb data to local format
            const transformedMedia = [];

            // Transform regular images/videos
            for (const sbImage of imagesResult.images) {
                const transformed = this.transformsbImageToLocal(sbImage);
                if (transformed) {
                    transformedMedia.push(transformed);
                }
            }

            // Transform scene markers
            for (const sbMarker of markersResult.scene_markers) {
                const transformed = this.transformsbMarkerToLocal(sbMarker);
                if (transformed) {
                    transformedMedia.push(transformed);
                }
            }

            // Update cache
            this.mediaCache = transformedMedia;
            this.lastFetchTime = now;

            log.info("Media fetched from sb", {
                totalImages: imagesResult.count,
                totalMarkers: markersResult.count,
                transformedCount: transformedMedia.length,
                mediaType,
            });

            return this.filterAndSortMedia(transformedMedia, mediaType, sortBy);
        } catch (error) {
            log.error("Failed to get media from sb", {
                mediaType,
                sortBy,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Filter and sort media based on parameters
     * @param {Array} media - Media array
     * @param {string} mediaType - Type filter
     * @param {string} sortBy - Sort parameter
     * @returns {Array} Filtered and sorted media
     */
    filterAndSortMedia(media, mediaType, sortBy) {
        let filtered = media;

        // Filter by media type
        if (mediaType !== "all") {
            const targetType = mediaType === "photos" ? "image" : mediaType === "videos" ? "video" : mediaType;
            filtered = media.filter(item => item.media_type === targetType);
        }

        // Sort (sb handles most sorting, but we can do local sorting for cached data)
        if (sortBy === "random") {
            filtered = [...filtered].sort(() => Math.random() - 0.5);
        } else if (sortBy === "date_added") {
            filtered = [...filtered].sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
        } else if (sortBy === "date_created") {
            filtered = [...filtered].sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
        }

        return filtered;
    }

    /**
     * Map local sort parameters to sb sort parameters
     * @param {string} sortBy - Local sort parameter
     * @returns {string} sb sort parameter
     */
    mapSortBy(sortBy) {
        switch (sortBy) {
            case "date_added":
                return "created_at";
            case "date_created":
                return "date";
            case "random":
            default:
                return "random";
        }
    }
    /**
     * Get media filtered by tags
     * @param {Array} includeTags - Tag names that must be present
     * @param {Array} excludeTags - Tag names that must not be present
     * @param {string} mediaType - Type of media to retrieve
     * @param {string} sortBy - Sorting parameters
     * @returns {Promise<Array>} Array of filtered media items
     */
    async getMediaByTags(includeTags, excludeTags, mediaType, sortBy) {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            // If no tag filters, return all media
            if ((!includeTags || includeTags.length === 0) && (!excludeTags || excludeTags.length === 0)) {
                return this.getAllMedia(mediaType, sortBy);
            }

            log.info("Filtering media by tags in sb", { includeTags, excludeTags, mediaType });

            // Build image filter for tags
            const imageFilter = {};

            if (includeTags && includeTags.length > 0) {
                // Get tag IDs for include tags
                const allTags = await this.getAllTags();
                const includeTagIds = [];

                for (const tagName of includeTags) {
                    const tag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    if (tag) {
                        includeTagIds.push(tag.id.toString());
                    }
                }

                if (includeTagIds.length > 0) {
                    imageFilter.tags = {
                        value: includeTagIds,
                        modifier: "INCLUDES_ALL", // All specified tags must be present
                    };
                }
            }

            if (excludeTags && excludeTags.length > 0) {
                // Get tag IDs for exclude tags
                const allTags = await this.getAllTags();
                const excludeTagIds = [];

                for (const tagName of excludeTags) {
                    const tag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    if (tag) {
                        excludeTagIds.push(tag.id.toString());
                    }
                }

                if (excludeTagIds.length > 0) {
                    imageFilter.tags = {
                        ...imageFilter.tags,
                        excludes: excludeTagIds,
                    };
                }
            }

            // Build marker filter for tags (similar structure)
            const markerFilter = {};
            if (includeTags && includeTags.length > 0) {
                const allTags = await this.getAllTags();
                const includeTagIds = [];

                for (const tagName of includeTags) {
                    const tag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    if (tag) {
                        includeTagIds.push(tag.id.toString());
                    }
                }

                if (includeTagIds.length > 0) {
                    markerFilter.tags = {
                        value: includeTagIds,
                        modifier: "INCLUDES_ALL",
                    };
                }
            }

            // Fetch filtered images and markers in parallel
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
                })
            ]);

            // Transform sb data to local format
            const transformedMedia = [];

            // Transform regular images/videos
            for (const sbImage of imagesResult.images) {
                const transformed = this.transformsbImageToLocal(sbImage);
                if (transformed) {
                    transformedMedia.push(transformed);
                }
            }

            // Transform scene markers
            for (const sbMarker of markersResult.scene_markers) {
                const transformed = this.transformsbMarkerToLocal(sbMarker);
                if (transformed) {
                    transformedMedia.push(transformed);
                }
            }

            log.info("Tag filtering completed for sb", {
                includeTags,
                excludeTags,
                totalImages: imagesResult.count,
                totalMarkers: markersResult.count,
                resultCount: transformedMedia.length,
            });

            return this.filterAndSortMedia(transformedMedia, mediaType, sortBy);
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

    /**
     * Get media filtered by path substring (stub implementation)
     * @param {string} substring - Substring to match in file paths
     * @param {string} mediaType - Type of media to retrieve
     * @param {string} sortBy - Sorting parameters
     * @returns {Promise<Array>} Array of filtered media items
     */
    async getMediaByPathSubstring(substring, mediaType, sortBy) {
        const allMedia = await this.getAllMedia(mediaType, sortBy);
        return allMedia.filter(item =>
            item.file_path.toLowerCase().includes(substring.toLowerCase()) ||
            item.filename.toLowerCase().includes(substring.toLowerCase())
        );
    }

    /**
     * Get all tags from sb
     * @returns {Promise<Array>} Array of tags
     */
    async getAllTags() {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            const query = `
        query FindTags($filter: FindFilterType) {
          findTags(filter: $filter) {
            count
            tags {
              id
              name
              image_count
            }
          }
        }
      `;

            const variables = {
                filter: {
                    per_page: 10000,
                    sort: "name",
                    direction: "ASC",
                },
            };

            const response = await this.makeGraphQLRequest(query, variables);
            const sbTags = response.data.findTags.tags;

            // Transform to local format
            return sbTags.map(tag => ({
                id: parseInt(tag.id),
                name: tag.name,
                color: "#3B82F6", // Default color since sb doesn't have tag colors
                created_at: new Date().toISOString(),
                image_count: tag.image_count || 0,
            }));
        } catch (error) {
            log.error("Failed to get tags from sb", { error: error.message });
            throw error;
        }
    }

    /**
     * Create a new tag in sb
     * @param {string} name - Tag name
     * @param {string} color - Tag color (ignored for sb)
     * @returns {Promise<Object>} Created tag
     */
    async createTag(name, color = "#3B82F6") {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            const query = `
        mutation TagCreate($input: TagCreateInput!) {
          tagCreate(input: $input) {
            id
            name
            image_count
          }
        }
      `;

            const variables = {
                input: {
                    name: name.trim(),
                },
            };

            const response = await this.makeGraphQLRequest(query, variables);
            const sbTag = response.data.tagCreate;

            // Transform to local format
            const tag = {
                id: parseInt(sbTag.id),
                name: sbTag.name,
                color: color, // Store the color locally even though sb doesn't use it
                created_at: new Date().toISOString(),
                image_count: sbTag.image_count || 0,
            };

            log.info("Tag created in sb", { tagId: tag.id, name: tag.name });
            return tag;
        } catch (error) {
            if (error.message.includes("already exists") || error.message.includes("duplicate")) {
                throw new Error("Tag already exists");
            }
            log.error("Failed to create tag in sb", { name, error: error.message });
            throw error;
        }
    }

    /**
     * Update an existing tag (not supported for sb)
     * @param {string|number} id - Tag ID
     * @param {string} name - New tag name
     * @param {string} color - New tag color
     * @returns {Promise<Object>} Updated tag
     */
    async updateTag(id, name, color) {
        throw new Error("Tag updates not supported by sbMediaProvider - use sb interface to manage tags");
    }

    /**
     * Delete a tag (not supported for sb)
     * @param {string|number} id - Tag ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteTag(id) {
        throw new Error("Tag deletion not supported by sbMediaProvider - use sb interface to manage tags");
    }

    /**
     * Get all tags associated with a media item
     * @param {string|number} mediaId - Media item ID (file_hash for sb)
     * @returns {Promise<Array>} Array of tags
     */
    async getMediaTags(mediaId) {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            // Extract sb ID and type from file hash
            const sbInfo = this.extractsbIdFromHash(mediaId);
            if (!sbInfo) {
                log.warn("Cannot extract valid ID from media hash, skipping tag retrieval", { mediaId });
                return [];
            }

            let query, variables, responseData;

            if (sbInfo.type === 'marker') {
                query = `
          query FindSceneMarker($id: ID!) {
            findSceneMarkers(ids: [$id]) {
              scene_markers {
                id
                primary_tag {
                  id
                  name
                }
                tags {
                  id
                  name
                }
              }
            }
          }
        `;
                variables = { id: sbInfo.id };
                const response = await this.makeGraphQLRequest(query, variables);
                const marker = response.data.findSceneMarkers?.scene_markers?.[0];

                if (!marker) {
                    return [];
                }

                // Combine primary tag and additional tags
                const allTags = [];
                if (marker.primary_tag) {
                    allTags.push(marker.primary_tag);
                }
                if (marker.tags) {
                    allTags.push(...marker.tags);
                }
                responseData = allTags;
            } else {
                query = `
          query FindImage($id: ID!) {
            findImage(id: $id) {
              id
              tags {
                id
                name
              }
            }
          }
        `;
                variables = { id: sbInfo.id };
                const response = await this.makeGraphQLRequest(query, variables);

                if (!response.data.findImage) {
                    return [];
                }

                responseData = response.data.findImage.tags || [];
            }

            const sbTags = responseData;

            // Transform to local format
            return sbTags.map(tag => ({
                id: parseInt(tag.id),
                name: tag.name,
                color: "#3B82F6", // Default color
                created_at: new Date().toISOString(),
            }));
        } catch (error) {
            log.error("Failed to get media tags from sb", { mediaId, error: error.message });
            return [];
        }
    }

    /**
     * Add a tag to a media item
     * @param {string|number} mediaId - Media item ID (file_hash for sb)
     * @param {string|number} tagId - Tag ID
     * @returns {Promise<boolean>} Success status
     */
    async addTagToMedia(mediaId, tagId) {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            // Extract sb ID and type from file hash
            const sbInfo = this.extractsbIdFromHash(mediaId);
            if (!sbInfo) {
                log.warn("Cannot extract valid ID from media hash, skipping tag addition", { mediaId, tagId });
                return false;
            }

            // First get current tags
            const currentTags = await this.getMediaTags(mediaId);
            const currentTagIds = currentTags.map(tag => tag.id.toString());

            // Check if tag is already added
            if (currentTagIds.includes(tagId.toString())) {
                return false; // Tag already exists
            }

            if (sbInfo.type === 'marker') {
                // For markers, we can only add to the additional tags (not primary_tag)
                // Get current marker data to preserve primary_tag
                const markerQuery = `
          query FindSceneMarker($id: ID!) {
            findSceneMarkers(ids: [$id]) {
              scene_markers {
                id
                primary_tag {
                  id
                }
                tags {
                  id
                }
              }
            }
          }
        `;

                const markerResponse = await this.makeGraphQLRequest(markerQuery, { id: sbInfo.id });
                const marker = markerResponse.data.findSceneMarkers?.scene_markers?.[0];

                if (!marker) {
                    throw new Error("Marker not found");
                }

                // Get current additional tag IDs (excluding primary tag)
                const currentAdditionalTagIds = marker.tags?.map(tag => tag.id.toString()) || [];
                const updatedTagIds = [...currentAdditionalTagIds, tagId.toString()];

                const updateQuery = `
          mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
            sceneMarkerUpdate(input: $input) {
              id
              primary_tag {
                id
                name
              }
              tags {
                id
                name
              }
            }
          }
        `;

                const variables = {
                    input: {
                        id: sbInfo.id,
                        tag_ids: updatedTagIds,
                    },
                };

                await this.makeGraphQLRequest(updateQuery, variables);
            } else {
                // For regular images, add to tag_ids
                const updatedTagIds = [...currentTagIds, tagId.toString()];

                const query = `
          mutation ImageUpdate($input: ImageUpdateInput!) {
            imageUpdate(input: $input) {
              id
              tags {
                id
                name
              }
            }
          }
        `;

                const variables = {
                    input: {
                        id: sbInfo.id,
                        tag_ids: updatedTagIds,
                    },
                };

                await this.makeGraphQLRequest(query, variables);
            }

            // Clear cache to force refresh
            this.mediaCache = [];
            this.lastFetchTime = null;

            log.info("Tag added to media in sb", { mediaId, tagId, sbId: sbInfo.id, type: sbInfo.type });
            return true;
        } catch (error) {
            log.error("Failed to add tag to media in sb", { mediaId, tagId, error: error.message });
            throw error;
        }
    }

    /**
     * Remove a tag from a media item
     * @param {string|number} mediaId - Media item ID (file_hash for sb)
     * @param {string|number} tagId - Tag ID
     * @returns {Promise<boolean>} Success status
     */
    async removeTagFromMedia(mediaId, tagId) {
        if (!this.isInitialized) {
            throw new Error("Provider not initialized");
        }

        try {
            // Extract sb ID and type from file hash
            const sbInfo = this.extractsbIdFromHash(mediaId);
            if (!sbInfo) {
                log.warn("Cannot extract valid ID from media hash, skipping tag removal", { mediaId, tagId });
                return false;
            }

            // First get current tags
            const currentTags = await this.getMediaTags(mediaId);
            const currentTagIds = currentTags.map(tag => tag.id.toString());

            // Check if tag exists
            if (!currentTagIds.includes(tagId.toString())) {
                return false; // Tag doesn't exist
            }

            if (sbInfo.type === 'marker') {
                // For markers, we can only remove from additional tags (not primary_tag)
                const markerQuery = `
          query FindSceneMarker($id: ID!) {
            findSceneMarkers(ids: [$id]) {
              scene_markers {
                id
                primary_tag {
                  id
                }
                tags {
                  id
                }
              }
            }
          }
        `;

                const markerResponse = await this.makeGraphQLRequest(markerQuery, { id: sbInfo.id });
                const marker = markerResponse.data.findSceneMarkers?.scene_markers?.[0];

                if (!marker) {
                    throw new Error("Marker not found");
                }

                // Check if trying to remove primary tag
                if (marker.primary_tag && marker.primary_tag.id.toString() === tagId.toString()) {
                    throw new Error("Cannot remove primary tag from marker");
                }

                // Remove from additional tags only
                const currentAdditionalTagIds = marker.tags?.map(tag => tag.id.toString()) || [];
                const updatedTagIds = currentAdditionalTagIds.filter(id => id !== tagId.toString());

                const updateQuery = `
          mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
            sceneMarkerUpdate(input: $input) {
              id
              primary_tag {
                id
                name
              }
              tags {
                id
                name
              }
            }
          }
        `;

                const variables = {
                    input: {
                        id: sbInfo.id,
                        tag_ids: updatedTagIds,
                    },
                };

                await this.makeGraphQLRequest(updateQuery, variables);
            } else {
                // For regular images, remove from tag_ids
                const updatedTagIds = currentTagIds.filter(id => id !== tagId.toString());

                const query = `
          mutation ImageUpdate($input: ImageUpdateInput!) {
            imageUpdate(input: $input) {
              id
              tags {
                id
                name
              }
            }
          }
        `;

                const variables = {
                    input: {
                        id: sbInfo.id,
                        tag_ids: updatedTagIds,
                    },
                };

                await this.makeGraphQLRequest(query, variables);
            }

            // Clear cache to force refresh
            this.mediaCache = [];
            this.lastFetchTime = null;

            log.info("Tag removed from media in sb", { mediaId, tagId, sbId: sbInfo.id, type: sbInfo.type });
            return true;
        } catch (error) {
            log.error("Failed to remove tag from media in sb", { mediaId, tagId, error: error.message });
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
            const allMedia = await this.getAllMedia("all");
            const images = allMedia.filter(item => item.media_type === "image");
            const videos = allMedia.filter(item => item.media_type === "video");

            return {
                totalFiles: allMedia.length,
                totalImages: images.length,
                totalVideos: videos.length,
                totalSize: allMedia.reduce((sum, item) => sum + (item.file_size || 0), 0),
                provider: "sb",
                sbUrl: this.sbUrl,
                lastFetch: this.lastFetchTime ? new Date(this.lastFetchTime).toISOString() : null,
            };
        } catch (error) {
            log.error("Failed to get stats from sb", { error: error.message });
            throw error;
        }
    }

    /**
     * Get file hash for a given path
     * @param {string} filePath - File path
     * @returns {string} File hash
     */
    getFileHashForPath(filePath) {
        // For sb, we'll try to extract the ID from the path

        // Check for marker stream URLs - correct pattern based on logs
        const markerMatch = filePath.match(/scene\/(\d+)\/scene_marker\/(\d+)\/stream/);
        if (markerMatch) {
            return `sb_marker_${markerMatch[2]}`;
        }

        // Check for regular image URLs
        const imageMatch = filePath.match(/image\/(\d+)/);
        if (imageMatch) {
            return `sb_${imageMatch[1]}`;
        }

        // Fallback: create hash from path
        return `sb_path_${Buffer.from(filePath).toString('base64').slice(0, 16)}`;
    }

    /**
     * Extract sb ID from file hash
     * @param {string} fileHash - File hash (e.g., "sb_123" or "sb_marker_456")
     * @returns {Object|null} Object with id and type, or null if invalid
     */
    extractsbIdFromHash(fileHash) {
        if (typeof fileHash === 'string') {
            if (fileHash.startsWith('sb_marker_')) {
                return {
                    id: fileHash.replace('sb_marker_', ''),
                    type: 'marker'
                };
            } else if (fileHash.startsWith('sb_scene_')) {
                return {
                    id: fileHash.replace('sb_scene_', ''),
                    type: 'scene'
                };
            } else if (fileHash.startsWith('sb_path_')) {
                // This is a fallback hash, we can't extract a valid ID
                return null;
            } else if (fileHash.startsWith('sb_')) {
                return {
                    id: fileHash.replace('sb_', ''),
                    type: 'image'
                };
            }
        }
        return null;
    }

    /**
     * Rescan directory (not applicable for sb)
     * @returns {Promise<Array>} Array of media items
     */
    async rescanDirectory() {
        throw new Error("Directory rescan not supported by sbMediaProvider. Use getAllMedia() to refresh data from sb server.");
    }

    /**
     * Regenerate thumbnails (not applicable for sb)
     * @returns {Promise<number>} Number of regenerated thumbnails
     */
    async regenerateThumbnails() {
        throw new Error("Thumbnail regeneration not supported by sbMediaProvider. Thumbnails are managed by sb server.");
    }

    /**
     * Close the provider (cleanup)
     * @returns {Promise<void>}
     */
    async close() {
        this.isInitialized = false;
        this.mediaCache = [];
        this.lastFetchTime = null;
        log.info("sbMediaProvider closed");
    }
}

module.exports = SbMediaProvider;