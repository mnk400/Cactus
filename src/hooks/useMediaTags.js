import { useState, useEffect } from "react";

// Fetches the tags applied to a single media file (by path) and keeps them in
// sync with the global "tags-updated" event. Extracted from Navigation so the
// ActionRail (tag-count badge) and FilterPanel (item-tags section) can share it.
export function useMediaTags(filePath) {
  const [mediaTags, setMediaTags] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!filePath) {
        if (mounted) setMediaTags([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/media-path/tags?path=${encodeURIComponent(filePath)}`,
        );
        if (!res.ok) throw new Error("Failed to fetch media tags");
        const data = await res.json();
        if (mounted) setMediaTags(data.tags || []);
      } catch (err) {
        console.error("Error fetching media tags:", err);
        if (mounted) setMediaTags([]);
      }
    };

    load();
    const onUpdated = () => load();
    window.addEventListener("tags-updated", onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("tags-updated", onUpdated);
    };
  }, [filePath]);

  return mediaTags;
}
