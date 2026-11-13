import { useState, useEffect, useCallback } from "react";
import { useMediaData } from "../context/MediaContext";

const tagsUrl = (filePath, tagId = "") =>
  `/api/media-path/tags${tagId && `/${tagId}`}?path=${encodeURIComponent(filePath)}`;

// The tags on one media file, plus add/remove. Every instance reloads on the
// global "tags-updated" event, so the dock and the tags panel stay in step.
export function useMediaTags(filePath) {
  const { fetchTags } = useMediaData();
  const [tags, setTags] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!filePath) {
        if (mounted) setTags([]);
        return;
      }
      try {
        const res = await fetch(tagsUrl(filePath));
        if (!res.ok) throw new Error("Failed to fetch media tags");
        const data = await res.json();
        if (mounted) setTags(data.tags || []);
      } catch (err) {
        console.error("Error fetching media tags:", err);
        if (mounted) setTags([]);
      }
    };

    load();
    window.addEventListener("tags-updated", load);
    return () => {
      mounted = false;
      window.removeEventListener("tags-updated", load);
    };
  }, [filePath]);

  // Apply the change locally first so the UI answers the tap, then let the
  // reload (success or failure) settle on what the server says.
  const send = useCallback(
    async (optimistic, tagId, init) => {
      if (!filePath) return;
      setTags(optimistic);
      try {
        const res = await fetch(tagsUrl(filePath, tagId), init);
        if (!res.ok) throw new Error("Failed to update media tags");
        fetchTags(); // usage counts changed
      } catch (err) {
        console.error("Error updating media tags:", err);
      } finally {
        window.dispatchEvent(new CustomEvent("tags-updated"));
      }
    },
    [filePath, fetchTags],
  );

  const add = useCallback(
    (tagNames) =>
      send(
        // Optimistic until the reload brings the real id.
        (prev) => [
          ...prev,
          ...tagNames.map((name) => ({ id: `pending:${name}`, name })),
        ],
        "",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagNames }),
        },
      ),
    [send],
  );

  const remove = useCallback(
    (tagId) => {
      // A tag still being added has no server id yet; it is gone on the next
      // reload anyway if the add failed, so ignore the tap until then.
      if (String(tagId).startsWith("pending:")) return;
      return send((prev) => prev.filter((tag) => tag.id !== tagId), tagId, {
        method: "DELETE",
      });
    },
    [send],
  );

  return { tags, add, remove };
}
