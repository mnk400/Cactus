import { useState, useEffect } from "react";

const GeneralFilter = ({
  onFilterChange,
  initialValue = "",
  placeholder = "Search...",
}) => {
  const [value, setValue] = useState(initialValue);

  const isFilterActive = initialValue !== "" && initialValue.length > 0;

  // Update local state when initialValue changes (from URL)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleApply = () => {
    if (value.trim()) {
      onFilterChange(value.trim());
    }
  };

  const handleClear = () => {
    setValue("");
    onFilterChange("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (isFilterActive) {
        handleClear();
      } else if (value.trim()) {
        handleApply();
      }
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full pl-8 pr-3 py-2 bg-black-shades-700 hover:bg-white hover:bg-opacity-10 rounded-xl placeholder-gray-500 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30"
      />
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
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
      {isFilterActive && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-150"
          aria-label="Clear search"
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
      {!isFilterActive && value.trim() && (
        <button
          onClick={handleApply}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white transition-colors duration-150"
        >
          Enter
        </button>
      )}
    </div>
  );
};

export default GeneralFilter;
