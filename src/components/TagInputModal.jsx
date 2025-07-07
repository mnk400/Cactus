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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-black bg-opacity-80 backdrop-blur-md p-6 rounded-lg max-w-md w-full relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white focus:outline-none transition-colors duration-200"
          aria-label="Close tag input"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <TagInput
          availableTags={tags}
          onAddTags={handleAddTags}
          onClose={onClose}
          placeholder="Add tags to this media..."
        />
      </div>
    </div>
  );
};

export default TagInputModal;
