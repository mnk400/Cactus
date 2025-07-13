import React, { useState } from "react";

const PathFilter = ({ onFilterChange }) => {
  const [substring, setSubstring] = useState("");

  const handleFilterClick = () => {
    onFilterChange(substring);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Filter by path..."
        value={substring}
        onChange={(e) => setSubstring(e.target.value)}
        className="w-full px-3 py-1 bg-black-shades-700 hover:bg-white hover:bg-opacity-20 rounded-lg placeholder-gray-400"
      />
      <button
        onClick={handleFilterClick}
        className="px-4 py-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg transition-colors duration-200"
      >
        Filter
      </button>
    </div>
  );
};

export default PathFilter;
