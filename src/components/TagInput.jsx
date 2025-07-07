import React, { useState, useRef, useEffect } from "react";

const TagInput = ({
  availableTags = [],
  onAddTags,
  onClose,
  placeholder = "Add tags...",
  className = "",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [filteredTags, setFilteredTags] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = availableTags.filter((tag) =>
        tag.name.toLowerCase().includes(inputValue.toLowerCase()),
      );
      setFilteredTags(filtered);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setFilteredTags([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  }, [inputValue, availableTags]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredTags[selectedIndex]) {
        // Select from suggestions
        addTag(filteredTags[selectedIndex].name);
      } else if (inputValue.trim()) {
        // Add new tag
        addTag(inputValue.trim());
      }
      return;
    }

    if (e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
      return;
    }
  };

  const addTag = (tagName) => {
    if (tagName && onAddTags) {
      onAddTags([tagName]);
      setInputValue("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (tagName) => {
    addTag(tagName);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Header with title and close hint */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white">Add Tags</h3>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay hiding suggestions to allow clicks
          setTimeout(() => setShowSuggestions(false), 150);
        }}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-black-shades-700 text-white placeholder-gray-400 text-base"
      />

      {showSuggestions && filteredTags.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-black-shades-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              onClick={() => handleSuggestionClick(tag.name)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-700 focus:outline-none focus:bg-gray-700 transition-colors ${
                index === selectedIndex ? "bg-blue-600" : ""
              }`}
            >
              <div className="flex items-center">
                <span
                  className="inline-block w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: tag.color }}
                ></span>
                <span className="text-white">{tag.name}</span>
                {tag.usage_count > 0 && (
                  <span className="text-gray-400 text-sm ml-auto">
                    ({tag.usage_count})
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
