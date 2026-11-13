import React, { useState, useRef, useEffect, useMemo } from "react";
import { FIELD } from "./ui/Panel";

const TagInput = ({
  availableTags = [],
  onAddTags,
  onClose,
  placeholder = "add a tag",
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
      // First Escape closes the suggestions; the next one closes the sheet.
      if (showSuggestions && filteredTags.length > 0) {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
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
        className={`${FIELD} w-full`}
      />

      {showSuggestions && filteredTags.length > 0 && (
        <div className="well mt-1.5 max-h-48 w-full overflow-y-auto rounded-2xl py-1">
          <div className="px-3.5 py-1 text-xs text-white/40">tags</div>
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              onClick={() => handleSuggestionClick(tag.name)}
              className={`flex h-9 w-full items-center px-3.5 text-left text-gray-100 ${
                index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <span
                className="mr-2 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
              {tag.usage_count > 0 && (
                <span className="ml-auto text-xs text-white/40">
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
