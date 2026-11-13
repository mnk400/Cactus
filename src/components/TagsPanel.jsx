import { memo, useMemo } from "react";
import InlineTagPanel from "./InlineTagPanel";
import { Chip } from "./ui/Panel";
import { useCurrentMedia, useMediaData } from "../context/MediaContext";
import { useMediaTags } from "../hooks/useMediaTags";

// The heart in the icon row already shows and toggles this one.
const FAVORITES = "favorites";

// Mostly-used tags first, so the common case is a tap rather than typing.
export const byUsage = (a, b) => (b.usage_count || 0) - (a.usage_count || 0);

// Tags for the current item. Stays open as you move through the feed.
const TagsPanel = memo(function TagsPanel({ onClose }) {
  const { currentMediaFile } = useCurrentMedia();
  const { tags: allTags } = useMediaData();
  const {
    tags: itemTags,
    add,
    remove,
  } = useMediaTags(currentMediaFile?.file_path);
  const tags = itemTags.filter((tag) => tag.name !== FAVORITES);

  const suggestions = useMemo(
    () =>
      allTags
        .filter(
          (tag) =>
            tag.name !== FAVORITES &&
            !itemTags.some((own) => own.name === tag.name),
        )
        .sort(byUsage)
        .slice(0, 12),
    [allTags, itemTags],
  );

  return (
    <div className="space-y-2.5">
      <InlineTagPanel
        currentMediaFile={currentMediaFile}
        onAddTags={add}
        onClose={onClose}
      />

      {tags.length > 0 && (
        <div className="chips">
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              color={tag.color}
              onRemove={() => remove(tag.id)}
              removeLabel={`Remove ${tag.name} tag`}
            >
              {tag.name}
            </Chip>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="chips">
          {suggestions.map((tag) => (
            <Chip
              key={tag.id}
              tone="add"
              onClick={() => add([tag.name])}
              title={`Add ${tag.name}`}
            >
              + {tag.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
});

export default TagsPanel;
