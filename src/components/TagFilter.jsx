import React, { useState, useRef, useEffect } from "react";
import TagList from "./TagList";

const TagFilter = ({
  tags = [],
  selectedTags = [],
  excludedTags = [],
  onTagsChange,
  onExcludedTagsChange,
}) => {
  const [showIncludeDropdown, setShowIncludeDropdown] = useState(false);
  const [includeSearchTerm, setIncludeSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showIncludeDropdown) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowIncludeDropdown(false);
        setIncludeSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showIncludeDropdown]);

  const handleIncludeTag = (tag) => {
    if (!selectedTags.find((t) => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag]);
    }
    setShowIncludeDropdown(false);
    setIncludeSearchTerm("");
  };

  const handleRemoveIncludeTag = (tagId) => {
    onTagsChange(selectedTags.filter((t) => t.id !== tagId));
  };

  const availableIncludeTags = tags.filter(
    (tag) =>
      !selectedTags.find((t) => t.id === tag.id) &&
      !excludedTags.find((t) => t.id === tag.id) &&
      tag.name.toLowerCase().includes(includeSearchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div>
          <TagList
            tags={selectedTags}
            showRemove={true}
            onRemoveTag={handleRemoveIncludeTag}
          />
        </div>
      )}

      {/* Add Tag Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowIncludeDropdown(!showIncludeDropdown)}
          className="w-full px-3 py-1 text-left bg-black-shades-700 hover:bg-white hover:bg-opacity-20 text-gray-400 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
          disabled={
            availableIncludeTags.length === 0 && includeSearchTerm === ""
          }
        >
          {availableIncludeTags.length > 0 || includeSearchTerm !== ""
            ? "Add tag..."
            : "No more tags available"}
        </button>

        {showIncludeDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-black-shades-700 backdrop-blur-sm rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <input
              type="text"
              placeholder="Search tags..."
              className="w-full px-3 py-1 bg-black-shades-800 text-gray-200 rounded-t-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
              value={includeSearchTerm}
              onChange={(e) => setIncludeSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {availableIncludeTags.length > 0 ? (
              availableIncludeTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleIncludeTag(tag)}
                  className="w-full px-3 py-2 text-left hover:bg-white hover:bg-opacity-20 focus:outline-none focus:bg-white focus:bg-opacity-20 flex items-center text-gray-200 transition-all duration-200"
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  ></span>
                  {tag.name}
                  <span className="text-gray-400 text-sm ml-auto">
                    ({tag.usage_count})
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-gray-400">No matching tags found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagFilter;
