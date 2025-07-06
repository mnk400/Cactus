import React, { useState, useRef, useEffect } from 'react';

const TagInput = ({ 
    availableTags = [], 
    onAddTags, 
    onClose, 
    placeholder = "Add tags...",
    className = '' 
}) => {
    const [inputValue, setInputValue] = useState('');
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
            const filtered = availableTags.filter(tag =>
                tag.name.toLowerCase().includes(inputValue.toLowerCase())
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
        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key === 'Enter') {
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

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => 
                prev < filteredTags.length - 1 ? prev + 1 : prev
            );
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
            return;
        }

        if (e.key === 'Tab' || e.key === ',') {
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
            setInputValue('');
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            />
            
            {showSuggestions && filteredTags.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredTags.map((tag, index) => (
                        <button
                            key={tag.id}
                            onClick={() => handleSuggestionClick(tag.name)}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 ${
                                index === selectedIndex ? 'bg-blue-100' : ''
                            }`}
                        >
                            <span
                                className="inline-block w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                            ></span>
                            {tag.name}
                            {tag.usage_count > 0 && (
                                <span className="text-gray-500 text-sm ml-2">
                                    ({tag.usage_count})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
            
            <div className="mt-2 text-xs text-gray-500">
                Press Enter or Tab to add • Escape to close • ↑↓ to navigate
            </div>
        </div>
    );
};

export default TagInput;
