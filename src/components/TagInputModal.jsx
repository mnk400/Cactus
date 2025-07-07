import React from 'react';
import TagInput from './TagInput';
import useTags from '../hooks/useTags';

const TagInputModal = ({ isOpen, onClose, currentMediaFile, onTagsUpdated }) => {
  const { tags, addTagsToMedia, getMediaTags } = useTags();

  const handleAddTags = async (tagNames) => {
    if (currentMediaFile) {
      try {
        await addTagsToMedia(currentMediaFile, tagNames);
        // Notify parent that tags were updated
        window.dispatchEvent(new CustomEvent('tags-updated'));
        if (onTagsUpdated) {
          onTagsUpdated();
        }
      } catch (error) {
        console.error('Failed to add tags:', error);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-black-shades-800 p-6 rounded-lg max-w-md w-full relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 px-3 py-1 bg-red-400 text-white text-sm rounded-md hover:bg-red-500 transition-colors duration-200"
          aria-label="Close tag input"
        >
          Close
        </button>
        
        <TagInput
          availableTags={tags}
          onAddTags={handleAddTags}
          onClose={onClose}
          placeholder="Add tags to this media..."
        />
        <p className="text-gray-400 text-sm mt-2">Press Enter to attach tag</p>
      </div>
    </div>
  );
};

export default TagInputModal;
