import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  memo,
  useCallback,
} from "react";
import useTags from "../hooks/useTags";

const TagDisplay = memo(function TagDisplay({
  currentMediaFile,
  showTagInput,
  isVideoPlaying,
}) {
  const [mediaTags, setMediaTags] = useState([]);
  const { getMediaTags, removeTagFromMedia } = useTags();

  const tagRefs = useRef(new Map());
  const prevTagPositions = useRef(new Map());

  // Load tags for current media file
  useEffect(() => {
    const loadMediaTags = async () => {
      if (currentMediaFile) {
        try {
          const tags = await getMediaTags(currentMediaFile.file_path);
          setMediaTags(tags);
        } catch (error) {
          console.error("Failed to load media tags:", error);
          setMediaTags([]);
        }
      } else {
        setMediaTags([]);
      }
    };

    loadMediaTags();

    const handleTagsUpdated = () => loadMediaTags();
    window.addEventListener("tags-updated", handleTagsUpdated);

    return () => {
      window.removeEventListener("tags-updated", handleTagsUpdated);
    };
  }, [currentMediaFile, getMediaTags]);

  const handleRemoveTag = useCallback(
    async (tagId) => {
      if (currentMediaFile) {
        try {
          // We need the file hash for removal, let's get it from the API
          const response = await fetch(
            `/api/media-path/tags?path=${encodeURIComponent(
              currentMediaFile.file_path,
            )}`,
          );
          const data = await response.json();

          if (data.fileHash) {
            await removeTagFromMedia(data.fileHash, tagId);
            // Reload tags for current media
            const updatedTags = await getMediaTags(currentMediaFile.file_path);
            setMediaTags(updatedTags);
            window.dispatchEvent(new CustomEvent("tags-updated"));
          }
        } catch (error) {
          console.error("Failed to remove tag:", error);
        }
      }
    },
    [currentMediaFile, removeTagFromMedia, getMediaTags],
  );

  useLayoutEffect(() => {
    // Capture "first" positions before render
    const currentTags = Array.from(tagRefs.current.values()).filter(Boolean);
    currentTags.forEach((tagEl) => {
      prevTagPositions.current.set(
        tagEl.dataset.tagId,
        tagEl.getBoundingClientRect(),
      );
    });

    // Cleanup for next render
    return () => {
      tagRefs.current.clear();
    };
  }, [mediaTags]);

  useLayoutEffect(() => {
    // After render, calculate "last" and "invert", then animate
    mediaTags.forEach((tag) => {
      const tagEl = tagRefs.current.get(tag.id);
      const prevRect = prevTagPositions.current.get(tag.id);

      if (tagEl && prevRect) {
        const currentRect = tagEl.getBoundingClientRect();
        const dx = prevRect.left - currentRect.left;
        const dy = prevRect.top - currentRect.top;

        if (dx || dy) {
          // Invert: move to the "first" position
          tagEl.style.transform = `translate(${dx}px, ${dy}px)`;
          tagEl.style.transition = "transform 0s";

          // Force reflow
          tagEl.offsetWidth;

          // Play: animate to "last" position
          tagEl.style.transition = "transform 300ms ease-in-out";
          tagEl.style.transform = "";
        }
      }
    });
  }, [mediaTags]);

  // Don't show tags if tag input is open or if there are no tags
  if (mediaTags.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed pb-1 left-0 right-0 w-full z-10 pointer-events-none transition-all duration-300 ${isVideoPlaying ? "bottom-20" : "bottom-16"}`}
      style={{
        bottom: isVideoPlaying ? '84px' : '60px'
      }}
    >
      <div className="pb-3 pointer-events-auto px-4">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-1">
            {mediaTags
              .filter((tag) => tag.name !== "favorites")
              .map((tag) => (
                <span
                  key={tag.id}
                  data-tag-id={tag.id} // Use data attribute to store tag ID for ref lookup
                  ref={(el) => {
                    if (el) {
                      tagRefs.current.set(tag.id, el);
                    } else {
                      tagRefs.current.delete(tag.id); // Cleanup on unmount
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0 tag-animated"
                  style={{
                    backgroundColor: tag.color,
                  }}
                >
                  {tag.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(tag.id);
                    }}
                    className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-lg w-5 h-5 flex items-center justify-center text-lg leading-none"
                    aria-label={`Remove ${tag.name} tag`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default TagDisplay;
