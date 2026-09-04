import { useState, useEffect } from "react";

// Fetches the tags applied to a single media file (by path) and keeps them in
// sync with the global "tags-updated" event so the control rail and filter
// panel share one source of item-tag state.
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
