import React, { useState, useRef, useEffect, useMemo } from "react";

const TagInput = ({
  availableTags = [],
  onAddTags,
  onClose,
  placeholder = "Add tags...",
  className = "",
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prevInputValue, setPrevInputValue] = useState("");
  const inputRef = useRef(null);

  // Compute filtered tags from inputValue (no effect needed)
  const filteredTags = useMemo(() => {
    if (inputValue.trim()) {
      return availableTags.filter((tag) =>
        tag.name.toLowerCase().includes(inputValue.toLowerCase()),
      );
    }
    return [];
  }, [inputValue, availableTags]);

  // Update showSuggestions and selectedIndex when inputValue changes (during render, not in effect)
  if (inputValue !== prevInputValue) {
    setPrevInputValue(inputValue);
    setSelectedIndex(-1);
    setShowSuggestions(inputValue.trim().length > 0);
  }

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
      return;
    }

    if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredTags.length - 1,
      );
      return;
    }

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
        className="w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30 bg-black-shades-700 hover:bg-white hover:bg-opacity-10 text-gray-200 placeholder-gray-500 text-sm transition-colors duration-150"
      />

      {showSuggestions && filteredTags.length > 0 && (
        <div className="absolute z-50 w-full bottom-full mb-1 bg-black-shades-700 backdrop-blur-sm rounded-lg shadow-lg max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide">
            Tags
          </div>
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              onClick={() => handleSuggestionClick(tag.name)}
              className={`w-full px-3 py-2 text-left flex items-center text-gray-200 transition-colors duration-150 ${
                index === selectedIndex
                  ? "bg-white bg-opacity-15"
                  : "hover:bg-white hover:bg-opacity-10"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full mr-2 flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm">{tag.name}</span>
              {tag.usage_count > 0 && (
                <span className="text-gray-500 text-xs ml-auto">
                  {tag.usage_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
