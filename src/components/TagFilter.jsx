import React, { useState } from 'react';
import TagList from './TagList';

const TagFilter = ({ 
    tags = [], 
    selectedTags = [], 
    excludedTags = [], 
    onTagsChange,
    onExcludedTagsChange 
}) => {
    const [showIncludeDropdown, setShowIncludeDropdown] = useState(false);
    const [showExcludeDropdown, setShowExcludeDropdown] = useState(false);

    const handleIncludeTag = (tag) => {
        if (!selectedTags.find(t => t.id === tag.id)) {
            onTagsChange([...selectedTags, tag]);
        }
        setShowIncludeDropdown(false);
    };

    const handleExcludeTag = (tag) => {
        if (!excludedTags.find(t => t.id === tag.id)) {
            onExcludedTagsChange([...excludedTags, tag]);
        }
        setShowExcludeDropdown(false);
    };

    const handleRemoveIncludeTag = (tagId) => {
        onTagsChange(selectedTags.filter(t => t.id !== tagId));
    };

    const handleRemoveExcludeTag = (tagId) => {
        onExcludedTagsChange(excludedTags.filter(t => t.id !== tagId));
    };

    const availableIncludeTags = tags.filter(tag => 
        !selectedTags.find(t => t.id === tag.id) && 
        !excludedTags.find(t => t.id === tag.id)
    );

    const availableExcludeTags = tags.filter(tag => 
        !excludedTags.find(t => t.id === tag.id) && 
        !selectedTags.find(t => t.id === tag.id)
    );

    return (
        <div className="space-y-4">
            {/* Include Tags */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={availableIncludeTags.length === 0}
                    >
                        {availableIncludeTags.length > 0 ? 'Add tag to include...' : 'No more tags available'}
                    </button>

                    {showIncludeDropdown && availableIncludeTags.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {availableIncludeTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => handleIncludeTag(tag)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center"
                                >
                                    <span
                                        className="inline-block w-3 h-3 rounded-full mr-2"
                                        style={{ backgroundColor: tag.color }}
                                    ></span>
                                    {tag.name}
                                    <span className="text-gray-500 text-sm ml-auto">
                                        ({tag.usage_count})
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Exclude Tags */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={availableExcludeTags.length === 0}
                    >
                        {availableExcludeTags.length > 0 ? 'Add tag to exclude...' : 'No more tags available'}
                    </button>

                    {showExcludeDropdown && availableExcludeTags.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {availableExcludeTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => handleExcludeTag(tag)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center"
                                >
                                    <span
                                        className="inline-block w-3 h-3 rounded-full mr-2"
                                        style={{ backgroundColor: tag.color }}
                                    ></span>
                                    {tag.name}
                                    <span className="text-gray-500 text-sm ml-auto">
                                        ({tag.usage_count})
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Clear All */}
            {(selectedTags.length > 0 || excludedTags.length > 0) && (
                <button
                    onClick={() => {
                        onTagsChange([]);
                        onExcludedTagsChange([]);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Clear All Filters
                </button>
            )}
        </div>
    );
};

export default TagFilter;
