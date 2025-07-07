import React, { useState, useEffect } from 'react';
import useTags from '../hooks/useTags';

const TagDisplay = ({ currentMediaFile, showTagInput }) => {
  const [mediaTags, setMediaTags] = useState([]);
  const { getMediaTags, removeTagFromMedia } = useTags();

  // Load tags for current media file
  useEffect(() => {
    const loadMediaTags = async () => {
      if (currentMediaFile) {
        try {
          const tags = await getMediaTags(currentMediaFile);
          setMediaTags(tags);
        } catch (error) {
          console.error('Failed to load media tags:', error);
          setMediaTags([]);
        }
      } else {
        setMediaTags([]);
      }
    };

    loadMediaTags();

    const handleTagsUpdated = () => loadMediaTags();
    window.addEventListener('tags-updated', handleTagsUpdated);

    return () => {
      window.removeEventListener('tags-updated', handleTagsUpdated);
    };
  }, [currentMediaFile, getMediaTags]);

  const handleRemoveTag = async (tagId) => {
    if (currentMediaFile) {
      try {
        // We need the file hash for removal, let's get it from the API
        const response = await fetch(`/api/media-path/tags?path=${encodeURIComponent(currentMediaFile)}`);
        const data = await response.json();
        
        if (data.fileHash) {
          await removeTagFromMedia(data.fileHash, tagId);
          // Reload tags for current media
          const updatedTags = await getMediaTags(currentMediaFile);
          setMediaTags(updatedTags);
          window.dispatchEvent(new CustomEvent('tags-updated'));
        }
      } catch (error) {
        console.error('Failed to remove tag:', error);
      }
    }
  };

  // Don't show tags if tag input is open or if there are no tags
  if (mediaTags.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-11/12 max-w-xl z-10 animate-fade-in pointer-events-none">
      <div className="pb-3 pointer-events-auto">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-1">
            {mediaTags.map((tag, index) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0 transition-all duration-200 hover:scale-105 animate-slide-in"
                style={{ 
                  backgroundColor: tag.color,
                  animationDelay: `${index * 100}ms`
                }}
              >
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag.id);
                  }}
                  className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-full w-5 h-5 flex items-center justify-center text-lg leading-none"
                  aria-label={`Remove ${tag.name} tag`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        {mediaTags.length > 3 && (
          <div className="text-center mt-1">
            <div className="text-xs text-gray-400 opacity-60">← Scroll to see all tags →</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagDisplay;
