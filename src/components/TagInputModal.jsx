import React from 'react';
import { CSSTransition } from 'react-transition-group';
import TagInput from './TagInput';
import useTags from '../hooks/useTags';

const TagInputModal = ({ isOpen, onClose, currentMediaFile, onTagsUpdated }) => {
  const { tags, addTagsToMedia } = useTags();

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

  // Close modal when clicking the background overlay
  const handleOverlayClick = (e) => {
    // Only close if the direct parent of the click is the overlay
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <CSSTransition
      in={isOpen}
      timeout={300}
      classNames="slide"
      unmountOnExit
    >
      <div 
        className="fixed inset-0 z-50"
        onClick={handleOverlayClick}
      >
        <div 
          className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black-shades-1000 p-4 rounded-2xl w-11/12 max-w-xl"
        >
          <TagInput
            availableTags={tags}
            onAddTags={handleAddTags}
            onClose={onClose}
            placeholder="Add tags to this media..."
          />
          <p className="text-gray-400 text-sm mt-2">Press Enter to attach tag</p>
        </div>
      </div>
    </CSSTransition>
  );
};

export default TagInputModal;
