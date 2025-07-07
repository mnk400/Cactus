import React from "react";

const TagList = ({
  tags = [],
  onRemoveTag,
  showRemove = false,
  className = "",
}) => {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white shadow-sm"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          {showRemove && onRemoveTag && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(tag.id);
              }}
              className="ml-1 text-white hover:text-gray-200 focus:outline-none"
              aria-label={`Remove ${tag.name} tag`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
};

export default TagList;
