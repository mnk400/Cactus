/**
 * MediaSourceProvider Interface
 *
 * This abstract class defines the interface that all media source providers must implement.
 * It serves as a contract for both LocalMediaProvider and sbMediaProvider.
 */
class MediaSourceProvider {
  constructor() {
    this.providerType = "unknown";
    this.isInitialized = false;
  }

  /**
   * Get provider configuration requirements
   * @returns {Object} Configuration schema with required arguments and validation
   */
  static getConfigSchema() {
    throw new Error("Method getConfigSchema() must be implemented by subclass");
  }

  /**
   * Validate configuration arguments
   * @param {Object} args - Command line arguments
   * @returns {Object} Validation result with success status and error message
   */
  static validateConfig(args) {
    throw new Error("Method validateConfig() must be implemented by subclass");
  }

  /**
   * Get provider type identifier
   * @returns {string} Provider type
   */
  getProviderType() {
    return this.providerType;
  }
  /**
   * Initialize the media provider
   * @returns {Promise<Object>} Result of initialization with success status
   */
  async initialize() {
    throw new Error("Method initialize() must be implemented by subclass");
  }

  /**
   * Test the connection to the media source
   * @returns {Promise<Object>} Connection test result with success status
   */
  async testConnection() {
    throw new Error("Method testConnection() must be implemented by subclass");
  }

  /**
   * Get all media from the source
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {Object} sortBy - Sorting parameters
   * @returns {Promise<Array>} Array of media items
   */
  async getAllMedia(mediaType, sortBy) {
    throw new Error("Method getAllMedia() must be implemented by subclass");
  }

  /**
   * Get media filtered by tags
   * @param {Array} includeTags - Tags that must be present
   * @param {Array} excludeTags - Tags that must not be present
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {Object} sortBy - Sorting parameters
   * @returns {Promise<Array>} Array of filtered media items
   */
  async getMediaByTags(includeTags, excludeTags, mediaType, sortBy) {
    throw new Error("Method getMediaByTags() must be implemented by subclass");
  }

  /**
   * Get media filtered by general filter substring
   * @param {string} substring - Substring to match in file paths
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {Object} sortBy - Sorting parameters
   * @returns {Promise<Array>} Array of filtered media items
   */
  async getMediaByGeneralFilter(substring, mediaType, sortBy) {
    throw new Error(
      "Method getMediaByGeneralFilter() must be implemented by subclass",
    );
  }

  /**
   * Get all tags from the media source
   * @returns {Promise<Array>} Array of tags
   */
  async getAllTags() {
    throw new Error("Method getAllTags() must be implemented by subclass");
  }

  /**
   * Create a new tag
   * @param {string} name - Tag name
   * @param {string} color - Tag color (hex code)
   * @returns {Promise<Object>} Created tag
   */
  async createTag(name, color) {
    throw new Error("Method createTag() must be implemented by subclass");
  }

  /**
   * Update an existing tag
   * @param {string|number} id - Tag ID
   * @param {string} name - New tag name
   * @param {string} color - New tag color (hex code)
   * @returns {Promise<Object>} Updated tag
   */
  async updateTag(id, name, color) {
    throw new Error("Method updateTag() must be implemented by subclass");
  }

  /**
   * Delete a tag
   * @param {string|number} id - Tag ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTag(id) {
    throw new Error("Method deleteTag() must be implemented by subclass");
  }

  /**
   * Get all tags associated with a media item
   * @param {string|number} mediaId - Media item ID
   * @returns {Promise<Array>} Array of tags
   */
  async getMediaTags(mediaId) {
    throw new Error("Method getMediaTags() must be implemented by subclass");
  }

  /**
   * Add a tag to a media item
   * @param {string|number} mediaId - Media item ID
   * @param {string|number} tagId - Tag ID
   * @returns {Promise<boolean>} Success status
   */
  async addTagToMedia(mediaId, tagId) {
    throw new Error("Method addTagToMedia() must be implemented by subclass");
  }

  /**
   * Remove a tag from a media item
   * @param {string|number} mediaId - Media item ID
   * @param {string|number} tagId - Tag ID
   * @returns {Promise<boolean>} Success status
   */
  async removeTagFromMedia(mediaId, tagId) {
    throw new Error(
      "Method removeTagFromMedia() must be implemented by subclass",
    );
  }

  /**
   * Get statistics about the media collection
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    throw new Error("Method getStats() must be implemented by subclass");
  }

  /**
   * Rescan/refresh media from source (optional operation)
   * @returns {Promise<Array>} Array of media files or throws error if not supported
   */
  async rescanDirectory() {
    throw new Error(
      `Rescan operation not supported for ${this.providerType} provider`,
    );
  }

  /**
   * Regenerate thumbnails (optional operation)
   * @returns {Promise<number>} Number of regenerated thumbnails or throws error if not supported
   */
  async regenerateThumbnails() {
    throw new Error(
      `Thumbnail regeneration not supported for ${this.providerType} provider`,
    );
  }

  /**
   * Get file hash for a given file path (optional operation)
   * @param {string} filePath - Path to the file
   * @returns {string} File hash or throws error if not supported
   */
  getFileHashForPath(filePath) {
    throw new Error(
      `File hash lookup not supported for ${this.providerType} provider`,
    );
  }

  /**
   * Serve media file (provider-specific logic)
   * @param {string} filePath - Path or URL to the media file
   * @param {Object} res - Express response object
   * @returns {Promise<void>} Handles the response
   */
  async serveMedia(filePath, res) {
    throw new Error("Method serveMedia() must be implemented by subclass");
  }

  /**
   * Serve thumbnail file (provider-specific logic)
   * @param {string} fileHash - File hash identifier
   * @param {Object} res - Express response object
   * @returns {Promise<void>} Handles the response
   */
  async serveThumbnail(fileHash, res) {
    throw new Error("Method serveThumbnail() must be implemented by subclass");
  }

  /**
   * Get provider capabilities for UI configuration
   * @returns {Object} Provider capabilities object
   */
  getCapabilities() {
    return {
      canRescan: false,
      canRegenerateThumbnails: false,
      canManageTags: true,
      canGetFileHashForPath: false,
      supportsLocalFiles: false,
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
      directoryLabel: "Directory",
      showConnectionStatus: false,
      showRescanButton: capabilities.canRescan,
      showRegenerateThumbnailsButton: capabilities.canRegenerateThumbnails,
      showTagManager: capabilities.canManageTags,
      availableActions: [],
    };
  }

  /**
   * Compute display name for a media file
   * @param {Object} mediaFile - Media file object
   * @param {string} directoryPath - Directory path context
   * @returns {string} Display name
   */
  computeDisplayName(mediaFile, directoryPath) {
    if (!mediaFile) return "";

    // Default implementation: extract directory name from path
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
   * Get detailed media info for display, structured as self-describing sections.
   * Providers should override this to add provider-specific metadata.
   * @param {Object} mediaFile - The full media file object from getAllMedia()
   * @returns {Object} { sections: [{ title, fields: [{ label, value, type }] }] }
   */
  getMediaInfo(mediaFile) {
    if (!mediaFile) return { sections: [] };

    const fields = [];

    if (mediaFile.filename) {
      fields.push({ label: "Filename", value: mediaFile.filename, type: "text" });
    }
    if (mediaFile.media_type) {
      fields.push({ label: "Type", value: mediaFile.media_type === "image" ? "Image" : "Video", type: "text" });
    }
    if (mediaFile.width && mediaFile.height) {
      fields.push({ label: "Resolution", value: `${mediaFile.width} × ${mediaFile.height}`, type: "text" });
    }
    if (mediaFile.file_size) {
      fields.push({ label: "File Size", value: this.formatFileSize(mediaFile.file_size), type: "text" });
    }
    if (mediaFile.duration) {
      fields.push({ label: "Duration", value: this.formatDuration(mediaFile.duration), type: "text" });
    }
    if (mediaFile.date_created) {
      fields.push({ label: "Date Created", value: new Date(mediaFile.date_created).toLocaleDateString(), type: "text" });
    }
    if (mediaFile.date_added) {
      fields.push({ label: "Date Added", value: new Date(mediaFile.date_added).toLocaleDateString(), type: "text" });
    }

    return {
      sections: fields.length > 0 ? [{ title: "General", fields }] : [],
    };
  }

  /**
   * Format file size in human-readable form
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  /**
   * Format duration in seconds to human-readable form
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /**
   * Close the provider and release resources
   * @returns {Promise<void>}
   */
  async close() {
    // Default implementation - can be overridden
    this.isInitialized = false;
  }
}

module.exports = MediaSourceProvider;
