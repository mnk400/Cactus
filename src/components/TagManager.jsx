import { useState } from "react";
import { FIELD as FIELD_CLASS, PanelButton, PanelSection } from "./ui/Panel";

const SWATCH =
  "h-9 w-9 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0";

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
      <PanelSection title="new tag">
        <form className="flex items-center gap-2" onSubmit={createTag}>
          <input
            data-panel-autofocus
            type="text"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="tag name"
            aria-label="Tag name"
            className={`${FIELD_CLASS} flex-1`}
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(event) => setNewTagColor(event.target.value)}
            aria-label="Tag color"
            className={SWATCH}
          />
          <PanelButton type="submit" variant="primary">
            create
          </PanelButton>
        </form>
      </PanelSection>

      <PanelSection title={`${tags.length} tags`}>
        {tags.length === 0 ? (
          <p className="m-0 py-4 text-center text-white/45">no tags yet</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {tags.map((tag) =>
              editingTag === tag.id ? (
                <form
                  key={tag.id}
                  className="space-y-2 py-2 first:pt-0 last:pb-0"
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
                      className={SWATCH}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <PanelButton onClick={stopEditing}>cancel</PanelButton>
                    <PanelButton type="submit" variant="primary">
                      save
                    </PanelButton>
                  </div>
                </form>
              ) : (
                <div
                  key={tag.id}
                  className="flex items-center gap-2.5 py-1.5 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white">
                      {tag.name}
                    </div>
                    <div className="text-xs text-white/40">
                      {tag.usage_count || 0} items
                    </div>
                  </div>
                  <PanelButton
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => startEditing(tag)}
                  >
                    edit
                  </PanelButton>
                  <PanelButton
                    variant="dangerGhost"
                    className="h-7 px-2"
                    onClick={() => deleteTag(tag.id)}
                  >
                    delete
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
