/**
 * MediaSourceProvider Interface
 *
 * This abstract class defines the interface that all media source providers must implement.
 * It serves as a contract for both LocalMediaProvider and sbMediaProvider.
 */
class MediaSourceProvider {
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
   * Get media filtered by path substring
   * @param {string} substring - Substring to match in file paths
   * @param {string} mediaType - Type of media to retrieve ('image', 'video', or 'all')
   * @param {Object} sortBy - Sorting parameters
   * @returns {Promise<Array>} Array of filtered media items
   */
  async getMediaByPathSubstring(substring, mediaType, sortBy) {
    throw new Error(
      "Method getMediaByPathSubstring() must be implemented by subclass",
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
}

module.exports = MediaSourceProvider;
