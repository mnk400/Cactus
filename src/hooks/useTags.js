import { useState, useEffect, useCallback } from "react";

const useTags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all tags
  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching tags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new tag
  const createTag = useCallback(async (name, color = "#3B82F6") => {
    setError(null);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create tag");
      }

      const data = await response.json();
      setTags((prev) => [...prev, { ...data.tag, usage_count: 0 }]);
      return data.tag;
    } catch (err) {
      setError(err.message);
      console.error("Error creating tag:", err);
      throw err;
    }
  }, []);

  // Update an existing tag
  const updateTag = useCallback(async (id, name, color) => {
    setError(null);
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update tag");
      }

      const data = await response.json();
      setTags((prev) =>
        prev.map((tag) => (tag.id === id ? { ...tag, ...data.tag } : tag)),
      );
      return data.tag;
    } catch (err) {
      setError(err.message);
      console.error("Error updating tag:", err);
      throw err;
    }
  }, []);

  // Delete a tag
  const deleteTag = useCallback(async (id) => {
    setError(null);
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete tag");
      }

      setTags((prev) => prev.filter((tag) => tag.id !== id));
    } catch (err) {
      setError(err.message);
      console.error("Error deleting tag:", err);
      throw err;
    }
  }, []);

  // Get tags for a specific media file
  const getMediaTags = useCallback(async (filePath) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/media-path/tags?path=${encodeURIComponent(filePath)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch media tags");
      }
      const data = await response.json();
      return data.tags || [];
    } catch (err) {
      setError(err.message);
      console.error("Error fetching media tags:", err);
      return [];
    }
  }, []);

  // Add tags to a media file
  const addTagsToMedia = useCallback(
    async (filePath, tagNames) => {
      setError(null);
      try {
        const response = await fetch(
          `/api/media-path/tags?path=${encodeURIComponent(filePath)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tagNames }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to add tags to media");
        }

        const data = await response.json();

        // Refresh tags to update usage counts
        await fetchTags();

        return data.results || [];
      } catch (err) {
        setError(err.message);
        console.error("Error adding tags to media:", err);
        throw err;
      }
    },
    [fetchTags],
  );

  // Remove tag from media file
  const removeTagFromMedia = useCallback(
    async (fileHash, tagId) => {
      setError(null);
      try {
        const response = await fetch(`/api/media/${fileHash}/tags/${tagId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to remove tag from media");
        }

        // Refresh tags to update usage counts
        await fetchTags();
      } catch (err) {
        setError(err.message);
        console.error("Error removing tag from media:", err);
        throw err;
      }
    },
    [fetchTags],
  );

  // Initialize tags on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    loading,
    error,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    getMediaTags,
    addTagsToMedia,
    removeTagFromMedia,
  };
};

export default useTags;
