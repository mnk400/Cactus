import React, { useState } from "react";
import TagList from "./TagList";

const TagFilter = ({
  tags = [],
  selectedTags = [],
  excludedTags = [],
  onTagsChange,
  onExcludedTagsChange,
}) => {
  const [showIncludeDropdown, setShowIncludeDropdown] = useState(false);
  const [showExcludeDropdown, setShowExcludeDropdown] = useState(false);
  const [includeSearchTerm, setIncludeSearchTerm] = useState("");

  const handleIncludeTag = (tag) => {
    if (!selectedTags.find((t) => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag]);
    }
    setShowIncludeDropdown(false);
  };

  const handleExcludeTag = (tag) => {
    if (!excludedTags.find((t) => t.id === tag.id)) {
      onExcludedTagsChange([...excludedTags, tag]);
    }
    setShowExcludeDropdown(false);
  };

  const handleRemoveIncludeTag = (tagId) => {
    onTagsChange(selectedTags.filter((t) => t.id !== tagId));
  };

  const handleRemoveExcludeTag = (tagId) => {
    onExcludedTagsChange(excludedTags.filter((t) => t.id !== tagId));
  };

  const availableIncludeTags = tags.filter(
    (tag) =>
      !selectedTags.find((t) => t.id === tag.id) &&
      !excludedTags.find((t) => t.id === tag.id) &&
      tag.name.toLowerCase().includes(includeSearchTerm.toLowerCase()),
  );

  const availableExcludeTags = tags.filter(
    (tag) =>
      !excludedTags.find((t) => t.id === tag.id) &&
      !selectedTags.find((t) => t.id === tag.id),
  );

  return (
    <div className="space-y-4">
      {/* Include Tags */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Include Tags (show media with these tags)
        </label>

        {selectedTags.length > 0 && (
          <div className="mb-2">
            <TagList
              tags={selectedTags}
              showRemove={true}
              onRemoveTag={handleRemoveIncludeTag}
            />
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowIncludeDropdown(!showIncludeDropdown)}
            className="w-full px-3 py-2 text-left bg-black-shades-700 hover:bg-white hover:bg-opacity-20 text-gray-400 rounded-xl transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
            disabled={
              availableIncludeTags.length === 0 && includeSearchTerm === ""
            }
          >
            {availableIncludeTags.length > 0 || includeSearchTerm !== ""
              ? "Add tag to include..."
              : "No more tags available"}
          </button>

          {showIncludeDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-black-shades-700 backdrop-blur-sm rounded-xl shadow-lg max-h-48 overflow-y-auto">
              <input
                type="text"
                placeholder="Search tags..."
                className="w-full px-3 py-2 bg-black-shades-800 text-gray-200 rounded-t-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                value={includeSearchTerm}
                onChange={(e) => setIncludeSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()} // Prevent dropdown from closing when clicking input
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
                <p className="px-3 py-2 text-gray-400">
                  No matching tags found.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exclude Tags */}
      {/* <div>
                <label className="block text-sm font-medium text-white mb-2">
                    Exclude Tags (hide media with these tags)
                </label>
                
                {excludedTags.length > 0 && (
                    <div className="mb-2">
                        <TagList 
                            tags={excludedTags} 
                            showRemove={true}
                            onRemoveTag={handleRemoveExcludeTag}
                        />
                    </div>
                )}

                <div className="relative">
                    <button
                        onClick={() => setShowExcludeDropdown(!showExcludeDropdown)}
                        className="w-full px-3 py-2 text-left bg-black bg-opacity-50 hover:bg-white hover:bg-opacity-20 text-gray-200 rounded-xl transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                        disabled={availableExcludeTags.length === 0}
                    >
                        {availableExcludeTags.length > 0 ? 'Add tag to exclude...' : 'No more tags available'}
                    </button>

                    {showExcludeDropdown && availableExcludeTags.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-black bg-opacity-80 backdrop-blur-sm border border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {availableExcludeTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => handleExcludeTag(tag)}
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
                            ))}
                        </div>
                    )}
                </div>
            </div> */}

      {/* Clear All */}
      {(selectedTags.length > 0 || excludedTags.length > 0) && (
        <button
          onClick={() => {
            onTagsChange([]);
            onExcludedTagsChange([]);
          }}
          className="w-full px-3 py-2 text-sm bg-black-shades-700 hover:bg-white hover:bg-opacity-20 text-gray-200 rounded-xl transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
};

export default TagFilter;
