import React, { useState } from 'react';

const PathFilter = ({ onFilterChange }) => {
  const [substring, setSubstring] = useState('');

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
        className="w-full p-2 px-3 bg-black-shades-700 hover:bg-white hover:bg-opacity-20 rounded-xl placeholder-gray-400"
      />
      <button
        onClick={handleFilterClick}
        className="px-4 py-2 bg-blue-400 hover:bg-white hover:bg-opacity-20 text-white rounded-xl transition-colors duration-200"
      >
        Filter
      </button>
    </div>
  );
};

export default PathFilter;
