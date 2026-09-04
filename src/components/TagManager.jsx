import { useState } from "react";
import { PanelButton, PanelSection } from "./ui/Panel";

const FIELD_CLASS =
  "min-w-0 rounded-xl bg-black/35 px-3 py-2 text-sm text-white outline-none ring-white/30 placeholder:text-gray-500 focus:ring-2";

function TagManager({ tags = [], onCreateTag, onUpdateTag, onDeleteTag }) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [editingTag, setEditingTag] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");

  const createTag = async (event) => {
    event.preventDefault();
    const name = newTagName.trim();
    if (!name) return;

    try {
      await onCreateTag?.(name, newTagColor);
      setNewTagName("");
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const startEditing = (tag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || "#3b82f6");
  };

  const stopEditing = () => {
    setEditingTag(null);
    setEditName("");
  };

  const updateTag = async (event) => {
    event.preventDefault();
    const name = editName.trim();
    if (!name || !editingTag) return;

    try {
      await onUpdateTag?.(editingTag, name, editColor);
      stopEditing();
    } catch (error) {
      console.error("Failed to update tag:", error);
    }
  };

  const deleteTag = async (tagId) => {
    const confirmed = window.confirm(
      "Delete this tag from every media item? This cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await onDeleteTag?.(tagId);
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  return (
    <div className="space-y-4">
      <PanelSection title="Create a tag">
        <form className="flex items-center gap-2" onSubmit={createTag}>
          <input
            data-panel-autofocus
            type="text"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="Tag name"
            aria-label="Tag name"
            className={`${FIELD_CLASS} flex-1`}
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(event) => setNewTagColor(event.target.value)}
            aria-label="Tag color"
            className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
          />
          <PanelButton type="submit" variant="primary">
            Create
          </PanelButton>
        </form>
      </PanelSection>

      <PanelSection title={`Existing tags · ${tags.length}`}>
        {tags.length === 0 ? (
          <p className="m-0 py-6 text-center text-sm text-gray-500">
            No tags created yet
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {tags.map((tag) =>
              editingTag === tag.id ? (
                <form
                  key={tag.id}
                  className="space-y-2 py-3 first:pt-0 last:pb-0"
                  onSubmit={updateTag}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      aria-label={`Rename ${tag.name}`}
                      className={`${FIELD_CLASS} flex-1`}
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(event) => setEditColor(event.target.value)}
                      aria-label={`${tag.name} color`}
                      className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <PanelButton onClick={stopEditing}>Cancel</PanelButton>
                    <PanelButton type="submit" variant="primary">
                      Save
                    </PanelButton>
                  </div>
                </form>
              ) : (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">
                      {tag.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {tag.usage_count || 0} items
                    </div>
                  </div>
                  <PanelButton
                    variant="ghost"
                    onClick={() => startEditing(tag)}
                  >
                    Edit
                  </PanelButton>
                  <PanelButton
                    variant="danger"
                    onClick={() => deleteTag(tag.id)}
                  >
                    Delete
                  </PanelButton>
                </div>
              ),
            )}
          </div>
        )}
      </PanelSection>
    </div>
  );
}

export default TagManager;
