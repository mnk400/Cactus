import React, { useState } from "react";
import TagList from "./TagList";

const TagManager = ({
  tags = [],
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onClose,
}) => {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingTag, setEditingTag] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");

  const handleCreateTag = (e) => {
    e.preventDefault();
    if (newTagName.trim() && onCreateTag) {
      onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName("");
      setNewTagColor("#3B82F6");
    }
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleUpdateTag = (e) => {
    e.preventDefault();
    if (editName.trim() && onUpdateTag && editingTag) {
      onUpdateTag(editingTag, editName.trim(), editColor);
      setEditingTag(null);
      setEditName("");
      setEditColor("#3B82F6");
    }
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditName("");
    setEditColor("#3B82F6");
  };

  const handleDeleteTag = (tagId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this tag? It will be removed from all media files.",
      )
    ) {
      onDeleteTag(tagId);
    }
  };

  const colorOptions = [
    "#3B82F6", // Blue
    "#22C55E", // Green
    "#EF4444", // Red
    "#F59E0B", // Yellow
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#84CC16", // Lime
    "#F97316", // Orange
    "#6B7280", // Gray
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-black-shades-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Manage Tags</h2>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors duration-200"
            >
              Close
            </button>
          </div>

          {/* Create New Tag */}
          <div className="mb-6 p-4 bg-black bg-opacity-40 backdrop-blur-sm rounded-2xl">
            <h3 className="text-lg font-medium text-white mb-3">
              Create New Tag
            </h3>
            <form onSubmit={handleCreateTag} className="flex gap-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="flex-1 px-3 py-2 bg-black bg-opacity-50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
              />
              <select
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="px-3 py-2 bg-black bg-opacity-50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
              >
                {colorOptions.map((color) => (
                  <option key={color} value={color} className="bg-gray-800">
                    {color}
                  </option>
                ))}
              </select>
              <div
                className="w-10 h-10 rounded-xl"
                style={{ backgroundColor: newTagColor }}
              ></div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Create
              </button>
            </form>
          </div>

          {/* Existing Tags */}
          <div>
            <h3 className="text-lg font-medium text-white mb-3">
              Existing Tags ({tags.length})
            </h3>
            {tags.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No tags created yet
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-3 bg-black bg-opacity-30 backdrop-blur-sm rounded-xl"
                  >
                    {editingTag === tag.id ? (
                      <form
                        onSubmit={handleUpdateTag}
                        className="flex-1 flex gap-3"
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1 bg-black bg-opacity-50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                        />
                        <select
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="px-2 py-1 bg-black bg-opacity-50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                        >
                          {colorOptions.map((color) => (
                            <option
                              key={color}
                              value={color}
                              className="bg-gray-800"
                            >
                              {color}
                            </option>
                          ))}
                        </select>
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: editColor }}
                        ></div>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors duration-200 text-sm"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors duration-200 text-sm"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: tag.color }}
                          ></div>
                          <span className="font-medium text-white">
                            {tag.name}
                          </span>
                          <span className="text-sm text-gray-400">
                            ({tag.usage_count} files)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditTag(tag)}
                            className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300 focus:outline-none transition-colors duration-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.id)}
                            className="px-3 py-1 bg-red-400 hover:bg-red-500 text-white rounded-lg transition-colors duration-200 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagManager;
