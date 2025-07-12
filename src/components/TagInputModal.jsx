import React, { useState, useEffect } from "react";
import { CSSTransition } from "react-transition-group";
import TagInput from "./TagInput";
import useTags from "../hooks/useTags";
import { isImage, isVideo } from "../utils/helpers";
import { usePrediction } from "../hooks/usePrediction";

const TagInputModal = ({
  isOpen,
  onClose,
  currentMediaFile,
  onTagsUpdated,
}) => {
  const { tags, addTagsToMedia } = useTags();
  const [stagedTags, setStagedTags] = useState([]);
  const [predictEnabled, setPredictEnabled] = useState(false);
  const [predictApiUrl, setPredictApiUrl] = useState("");

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

  const { isPredicting, predictTags } = usePrediction(
    predictApiUrl,
    handleAddStagedTag,
  );

  useEffect(() => {
    if (!isOpen) {
      setStagedTags([]); // Clear staged tags when modal closes
    }
  }, [isOpen]);

  // Check if prediction is enabled
  useEffect(() => {
    const checkPredictEnabled = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const data = await response.json();
          setPredictEnabled(data.predictEnabled);
          setPredictApiUrl(data.predictApiUrl);
        }
      } catch (error) {
        console.error("Failed to check if prediction is enabled:", error);
      }
    };

    checkPredictEnabled();
  }, []);

  const handleRemoveStagedTag = (tagId) => {
    setStagedTags((prevTags) => prevTags.filter((tag) => tag.id !== tagId));
  };

  const handleConfirmAdd = async () => {
    if (currentMediaFile && stagedTags.length > 0) {
      try {
        const tagNames = stagedTags.map((tag) => tag.name);
        await addTagsToMedia(currentMediaFile.file_path, tagNames);
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

  const handlePredict = () => {
    predictTags(currentMediaFile.file_path);
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
                    className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium text-white shadow-sm whitespace-nowrap flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveStagedTag(tag.id)}
                      className="ml-2 text-white hover:text-gray-200 focus:outline-none transition-colors duration-150 hover:bg-white hover:bg-opacity-20 rounded-xl w-5 h-5 flex items-center justify-center text-lg leading-none"
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
            {predictEnabled &&
              (isImage(currentMediaFile?.file_path) ||
                isVideo(currentMediaFile?.file_path)) && (
                <button
                  onClick={handlePredict}
                  disabled={isPredicting}
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPredicting ? "Predicting..." : "Predict"}
                </button>
              )}
            <button
              onClick={handleConfirmAdd}
              disabled={stagedTags.length === 0}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
