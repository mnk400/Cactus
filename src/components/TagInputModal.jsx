import React, { useState, useEffect } from "react";
import { CSSTransition } from "react-transition-group";
import TagInput from "./TagInput";
import useTags from "../hooks/useTags";
import { isImage } from "../utils/helpers";

const TagInputModal = ({
  isOpen,
  onClose,
  currentMediaFile,
  onTagsUpdated,
}) => {
  const { tags, addTagsToMedia } = useTags();
  const [stagedTags, setStagedTags] = useState([]);
  const [predictEnabled, setPredictEnabled] = useState(false);
  const [predictApiUrl, setPredictApiUrl] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStagedTags([]); // Clear staged tags when modal closes
    }
  }, [isOpen]);

  // Check if prediction is enabled
  useEffect(() => {
    const checkPredictEnabled = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          setPredictEnabled(data.predictEnabled);
          setPredictApiUrl(data.predictApiUrl);
        }
      } catch (error) {
        console.error('Failed to check if prediction is enabled:', error);
      }
    };
    
    checkPredictEnabled();
  }, []);

  const handleAddStagedTag = (tagNames) => {
    // Prevent adding duplicate tags
    tagNames.forEach((tagName) => {
      if (!stagedTags.some((tag) => tag.name === tagName)) {
        setStagedTags((prevTags) => [
          ...prevTags,
          { name: tagName, id: tagName, color: "#60a5fa" },
        ]); // Assign a temporary ID and color
      }
    });
  };

  const handleRemoveStagedTag = (tagId) => {
    setStagedTags((prevTags) => prevTags.filter((tag) => tag.id !== tagId));
  };

  const handleConfirmAdd = async () => {
    if (currentMediaFile && stagedTags.length > 0) {
      try {
        const tagNames = stagedTags.map((tag) => tag.name);
        await addTagsToMedia(currentMediaFile, tagNames);
        window.dispatchEvent(new CustomEvent("tags-updated"));
        if (onTagsUpdated) {
          onTagsUpdated();
        }
        setStagedTags([]); // Clear staged tags after successful addition
        onClose(); // Close modal after confirming
      } catch (error) {
        console.error("Failed to add tags:", error);
      }
    }
  };

  const handlePredict = async () => {
    if (!currentMediaFile || !isImage(currentMediaFile) || !predictEnabled) {
      return;
    }

    setIsPredicting(true);
    try {
      const formData = new FormData();

      const image = await fetch(`/media?path=${encodeURIComponent(currentMediaFile)}`);
      if (!image.ok) {
        throw new Error(`Failed to fetch image: ${image.status}`);
      }
      
      const imageBlob = await image.blob();
      formData.append('image', imageBlob, 'media.jpeg');
      
      // Make the prediction request
      const predictResponse = await fetch(predictApiUrl, {
        method: 'POST',
        body: formData,
      });
      
      if (!predictResponse.ok) {
        throw new Error(`Prediction failed with status: ${predictResponse.status}`);
      }
      
      const data = await predictResponse.json();
      
      if (data.tags) {
        // Split the tags string and add them to staged tags
        const predictedTags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        handleAddStagedTag(predictedTags);
      }
    } catch (error) {
      console.error('Failed to predict tags:', error);
    } finally {
      setIsPredicting(false);
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
    <CSSTransition in={isOpen} timeout={300} classNames="slide" unmountOnExit>
      <div className="fixed inset-0 z-50" onClick={handleOverlayClick}>
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black-shades-1000 p-4 rounded-2xl w-11/12 max-w-xl max-h-[78vh] flex flex-col">
          <TagInput
            availableTags={tags}
            onAddTags={handleAddStagedTag}
            onClose={onClose}
            placeholder="Add tags to this media..."
          />
          <p className="text-gray-400 text-sm mt-2">
            Press Enter to attach tag
          </p>
          <div className="flex-grow overflow-y-auto">
            {stagedTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {stagedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveStagedTag(tag.id)}
                    className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-full w-5 h-5 flex items-center justify-center text-lg leading-none"
                    aria-label={`Remove ${tag.name} tag`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          </div>
          <div className="flex justify-between mt-4">
            {predictEnabled && isImage(currentMediaFile) && (
              <button
                onClick={handlePredict}
                disabled={isPredicting}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPredicting ? 'Predicting...' : 'Predict'}
              </button>
            )}
            <button
              onClick={handleConfirmAdd}
              disabled={stagedTags.length === 0}
              className="px-3 py-1.5 text-sm bg-red-400 text-white rounded-md hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm ({stagedTags.length})
            </button>
          </div>
        </div>
      </div>
    </CSSTransition>
  );
};

export default TagInputModal;
