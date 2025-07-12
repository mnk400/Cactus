import { useState, useEffect, useCallback } from "react";
import useTags from "./useTags";

const FAVORITE_TAG_NAME = "favorites";
const FAVORITE_TAG_COLOR = "#FF69B4"; // Pastel red/pink color

export const useFavorite = (currentMediaFile) => {
  const {
    tags,
    fetchTags,
    createTag,
    getMediaTags,
    addTagsToMedia,
    removeTagFromMedia,
  } = useTags();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteTagId, setFavoriteTagId] = useState(null);

  // Ensure the favorite tag exists and get its ID
  useEffect(() => {
    const ensureFavoriteTag = async () => {
      if (tags.length > 0) {
        let favTag = tags.find((tag) => tag.name === FAVORITE_TAG_NAME);
        if (!favTag) {
          try {
            favTag = await createTag(FAVORITE_TAG_NAME, FAVORITE_TAG_COLOR);
          } catch (error) {
            console.error("Failed to create favorite tag:", error);
            return;
          }
        }
        setFavoriteTagId(favTag.id);
      }
    };
    ensureFavoriteTag();
  }, [tags, createTag]);

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (currentMediaFile && favoriteTagId) {
        const response = await fetch(
          `/api/media-path/tags?path=${encodeURIComponent(currentMediaFile)}`
        );
        const data = await response.json();
        if (data.tags) {
          const favorited = data.tags.some((tag) => tag.id === favoriteTagId);
          setIsFavorited(favorited);
        }
      } else {
        setIsFavorited(false);
      }
    };
    checkFavoriteStatus();
  }, [currentMediaFile, favoriteTagId]);

  const toggleFavorite = useCallback(async () => {
    if (!currentMediaFile || !favoriteTagId) return;

    try {
      if (isFavorited) {
        // Remove favorite tag
        const response = await fetch(
          `/api/media-path/tags?path=${encodeURIComponent(currentMediaFile)}`
        );
        const data = await response.json();
        if (data.fileHash) {
          await removeTagFromMedia(data.fileHash, favoriteTagId);
          setIsFavorited(false);
        }
      } else {
        // Add favorite tag
        await addTagsToMedia(currentMediaFile, [FAVORITE_TAG_NAME]);
        setIsFavorited(true);
      }
      // Trigger a global event to notify other components (like TagDisplay) that tags have updated
      window.dispatchEvent(new CustomEvent("tags-updated"));
    } catch (error) {
      console.error("Failed to toggle favorite status:", error);
    }
  }, [
    currentMediaFile,
    favoriteTagId,
    isFavorited,
    addTagsToMedia,
    removeTagFromMedia,
  ]);

  return { isFavorited, toggleFavorite, FAVORITE_TAG_NAME };
};
