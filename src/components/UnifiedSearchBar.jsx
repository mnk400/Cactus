import { useState, useRef, useEffect, useMemo } from "react";

const UnifiedSearchBar = ({
  tags = [],
  selectedTags = [],
  excludedTags = [],
  search = "",
  onTagsChange,
  onSearchChange,
  dropdownPosition = "bottom", // "bottom" | "top"
}) => {
  const [inputValue, setInputValue] = useState(search);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync inputValue when search prop changes externally (URL sync, clear all)
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  const matchingTags = useMemo(() => {
    if (!inputValue.trim()) return [];
    return tags.filter(
      (tag) =>
        !selectedTags.find((t) => t.id === tag.id) &&
        !excludedTags.find((t) => t.id === tag.id) &&
        tag.name.toLowerCase().includes(inputValue.toLowerCase()),
    );
  }, [inputValue, tags, selectedTags, excludedTags]);

  // Update dropdown visibility when matches change
  useEffect(() => {
    setShowDropdown(matchingTags.length > 0);
    setHighlightedIndex(-1);
  }, [matchingTags.length]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const addTag = (tag) => {
    onTagsChange([...selectedTags, tag]);
    setInputValue("");
    setShowDropdown(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const removeTag = (tagId) => {
    onTagsChange(selectedTags.filter((t) => t.id !== tagId));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Backspace" && inputValue === "" && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id);
      return;
    }

    if (e.key === "ArrowDown" && showDropdown) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < matchingTags.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (e.key === "ArrowUp" && showDropdown) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : matchingTags.length - 1,
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && matchingTags[highlightedIndex]) {
        addTag(matchingTags[highlightedIndex]);
      } else {
        onSearchChange(inputValue.trim());
        setShowDropdown(false);
      }
      return;
    }

    if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  const handleClearAll = () => {
    setInputValue("");
    onSearchChange("");
    onTagsChange([]);
    inputRef.current?.focus();
  };

  const isSearchActive = search && search.length > 0;
  const hasContent = isSearchActive || selectedTags.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-2 w-full px-3 py-2 bg-black-shades-700 hover:bg-white hover:bg-opacity-10 rounded-xl cursor-text focus-within:ring-2 focus-within:ring-white focus-within:ring-opacity-30"
      >
        {/* Search icon */}
        <svg
          className="w-4 h-4 text-gray-500 pointer-events-none flex-shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>

        {/* Tag chips */}
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-white whitespace-nowrap"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.id);
              }}
              className="text-white hover:text-gray-200 focus:outline-none leading-none"
              aria-label={`Remove ${tag.name} tag`}
            >
              &times;
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedTags.length === 0 && !isSearchActive
              ? "Search by name, folder, or tag..."
              : ""
          }
          className="flex-1 min-w-[80px] bg-transparent text-gray-200 text-sm focus:outline-none placeholder-gray-500"
        />

        {/* Clear all button */}
        {hasContent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll();
            }}
            className="text-gray-400 hover:text-white transition-colors duration-150 flex-shrink-0"
            aria-label="Clear all filters"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Tag suggestions dropdown */}
      {showDropdown && (
        <div
          className={`absolute z-50 w-full bg-black-shades-700 backdrop-blur-sm rounded-lg shadow-lg max-h-48 overflow-y-auto ${
            dropdownPosition === "top" ? "bottom-full mb-1" : "mt-1"
          }`}
        >
          <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide">
            Tags
          </div>
          {matchingTags.map((tag, index) => (
            <button
              key={tag.id}
              onClick={() => addTag(tag)}
              className={`w-full px-3 py-2 text-left flex items-center text-gray-200 transition-colors duration-150 ${
                index === highlightedIndex
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

export default UnifiedSearchBar;
