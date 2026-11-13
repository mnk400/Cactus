import { useState, useRef, useEffect, useMemo } from "react";

const UnifiedSearchBar = ({
  tags = [],
  selectedTags = [],
  excludedTags = [],
  search = "",
  onTagsChange,
  onExcludedChange,
  onSearchChange,
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

  // A leading minus excludes: "-screens" offers tags to leave out.
  const excluding = inputValue.startsWith("-");
  const query = inputValue
    .slice(excluding ? 1 : 0)
    .trim()
    .toLowerCase();

  const matchingTags = useMemo(() => {
    if (!query) return [];
    return tags.filter(
      (tag) =>
        !selectedTags.find((t) => t.id === tag.id) &&
        !excludedTags.find((t) => t.id === tag.id) &&
        tag.name.toLowerCase().includes(query),
    );
  }, [query, tags, selectedTags, excludedTags]);

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
    if (excluding) onExcludedChange([...excludedTags, tag]);
    else onTagsChange([...selectedTags, tag]);
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
      const match =
        matchingTags[highlightedIndex] ||
        (excluding && matchingTags.find((t) => t.name.toLowerCase() === query));
      if (match) {
        addTag(match);
      } else if (!excluding) {
        onSearchChange(inputValue.trim());
        setShowDropdown(false);
      }
      return;
    }

    if (e.key === "Escape" && showDropdown) {
      // First Escape closes the suggestions; the next one closes the sheet.
      e.preventDefault();
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
        className="well flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-[18px] px-3.5 py-1 focus-within:ring-1 focus-within:ring-white/25"
      >
        {/* Search icon */}
        <svg
          className="pointer-events-none h-[15px] w-[15px] flex-shrink-0 text-white/40"
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
            className="pill-on inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full pl-2.5 pr-1.5 font-medium"
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.id);
              }}
              className="leading-none opacity-60 hover:opacity-100 focus:outline-none"
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
              ? "search name, folder or tag"
              : ""
          }
          className="h-7 min-w-[80px] flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
        />

        {/* Clear all button */}
        {hasContent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll();
            }}
            className="flex-shrink-0 text-white/40 hover:text-white"
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
        <div className="well mt-1.5 max-h-48 w-full overflow-y-auto rounded-2xl py-1">
          <div className="px-3.5 py-1 text-xs text-white/40">
            {excluding ? "exclude tag" : "tags"}
          </div>
          {matchingTags.map((tag, index) => (
            <button
              key={tag.id}
              onClick={() => addTag(tag)}
              className={`flex h-9 w-full items-center px-3.5 text-left text-gray-100 ${
                index === highlightedIndex ? "bg-white/10" : "hover:bg-white/5"
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

export default UnifiedSearchBar;
