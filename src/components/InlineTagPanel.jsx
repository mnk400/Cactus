import { useState, useEffect, useCallback, memo, useRef } from "react";
import TagDisplay from "./TagDisplay";
import TagInput from "./TagInput";
import useTags from "../hooks/useTags";
import { useMediaData } from "../context/MediaContext";

const InlineTagPanel = memo(function InlineTagPanel({
  currentMediaFile,
  isExpanded,
  onToggleExpanded,
  mode = "display", // "display" = tag badges, "input" = input panel
}) {
  const [mediaTags, setMediaTags] = useState([]);
  const { tags: allTags, addTagsToMedia, fetchTags } = useTags();
  const { fetchTags: fetchContextTags } = useMediaData();

  // AI auto-tag state
  const [aiState, setAiState] = useState("idle"); // idle | loading | confirm | applying | done | error
  const [serviceReady, setServiceReady] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());

  // Fetch media tags for current file
  const fetchMediaTags = useCallback(async (filePath) => {
    try {
      const response = await fetch(
        `/api/media-path/tags?path=${encodeURIComponent(filePath)}`,
      );
      if (!response.ok) throw new Error("Failed to fetch media tags");
      const data = await response.json();
      return data.tags || [];
    } catch (err) {
      console.error("Error fetching media tags:", err);
      return [];
    }
  }, []);

  // Load tags when media changes or tags-updated event fires
  useEffect(() => {
    let isMounted = true;

    const loadMediaTags = async () => {
      if (currentMediaFile) {
        const tags = await fetchMediaTags(currentMediaFile.file_path);
        if (isMounted) setMediaTags(tags);
      } else {
        if (isMounted) setMediaTags([]);
      }
    };

    loadMediaTags();

    const handleTagsUpdated = () => loadMediaTags();
    window.addEventListener("tags-updated", handleTagsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener("tags-updated", handleTagsUpdated);
    };
  }, [currentMediaFile?.file_path, fetchMediaTags]);

  // Collapse panel when media changes (skip initial mount)
  const prevFilePathRef = useRef(currentMediaFile?.file_path);
  useEffect(() => {
    if (prevFilePathRef.current === currentMediaFile?.file_path) return;
    prevFilePathRef.current = currentMediaFile?.file_path;
    if (isExpanded) onToggleExpanded(false);
    setAiState("idle");
    setSuggestedTags([]);
    setSelectedTags(new Set());
  }, [currentMediaFile?.file_path]);

  // Poll auto-tag service readiness only when panel is expanded
  useEffect(() => {
    if (!isExpanded) return;

    let mounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/auto-tag/status");
        if (res.ok) {
          const data = await res.json();
          if (mounted) setServiceReady(data.ready);
        }
      } catch {
        // ignore
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isExpanded]);

  // Handle Escape to collapse
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        // Don't close if TagInput handles it (input is focused)
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
          return;
        e.preventDefault();
        onToggleExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, onToggleExpanded]);

  // Remove tag from current media
  const handleRemoveTag = useCallback(
    async (tagId) => {
      if (!currentMediaFile) return;
      try {
        const res = await fetch(
          `/api/media-path/tags/${tagId}?path=${encodeURIComponent(currentMediaFile.file_path)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Failed to remove tag");
        const [updatedTags] = await Promise.all([
          fetchMediaTags(currentMediaFile.file_path),
          fetchContextTags(),
        ]);
        setMediaTags(updatedTags);
        window.dispatchEvent(new CustomEvent("tags-updated"));
      } catch (error) {
        console.error("Failed to remove tag:", error);
      }
    },
    [currentMediaFile, fetchMediaTags, fetchContextTags],
  );

  // Add tags immediately (no staging)
  const handleAddTags = useCallback(
    async (tagNames) => {
      if (!currentMediaFile) return;
      try {
        await addTagsToMedia(currentMediaFile.file_path, tagNames);
        window.dispatchEvent(new CustomEvent("tags-updated"));
      } catch (error) {
        console.error("Failed to add tags:", error);
      }
    },
    [currentMediaFile, addTagsToMedia],
  );

  // AI: Generate tag suggestions
  const handleGenerate = useCallback(async () => {
    if (!currentMediaFile?.file_path || aiState === "loading") return;

    setAiState("loading");
    try {
      const res = await fetch(
        `/api/media-path/auto-tag/generate?path=${encodeURIComponent(currentMediaFile.file_path)}`,
        { method: "POST" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      const data = await res.json();
      setSuggestedTags(data.tags || []);
      setSelectedTags(new Set(data.tags || []));
      setAiState("confirm");
    } catch (err) {
      console.error("Auto-tag generate failed:", err);
      setAiState("error");
      setTimeout(() => setAiState("idle"), 3000);
    }
  }, [currentMediaFile?.file_path, aiState]);

  // AI: Apply selected tags
  const handleApply = useCallback(async () => {
    if (selectedTags.size === 0) return;

    setAiState("applying");
    try {
      const res = await fetch(
        `/api/media-path/auto-tag/apply?path=${encodeURIComponent(currentMediaFile.file_path)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: [...selectedTags] }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      setAiState("done");
      setSuggestedTags([]);
      setSelectedTags(new Set());
      window.dispatchEvent(new CustomEvent("tags-updated"));
      setTimeout(() => setAiState("idle"), 2000);
    } catch (err) {
      console.error("Auto-tag apply failed:", err);
      setAiState("error");
      setTimeout(() => setAiState("idle"), 3000);
    }
  }, [currentMediaFile?.file_path, selectedTags]);

  const handleCancelAi = useCallback(() => {
    setAiState("idle");
    setSuggestedTags([]);
    setSelectedTags(new Set());
  }, []);

  const toggleTag = useCallback((tag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const isLoading = aiState === "loading";
  const isApplying = aiState === "applying";
  const busy = isLoading || isApplying;

  // Sparkle button title
  let sparkleTitle = "Auto-tag with AI";
  if (!serviceReady) sparkleTitle = "Auto-tag service starting...";
  if (isLoading) sparkleTitle = "Generating tags...";
  if (aiState === "done") sparkleTitle = "Tags added!";
  if (aiState === "error") sparkleTitle = "Auto-tag failed";

  // Display mode: just show tag badges (floating glass)
  if (mode === "display") {
    return <TagDisplay tags={mediaTags} onRemoveTag={handleRemoveTag} />;
  }

  // Input mode: panel content (animation handled by parent wrapper)
  return (
    <div className="pointer-events-auto w-full bg-black-shades-1000 px-4 pt-3 pb-1 space-y-3">
      {/* Tag input + sparkle button */}
      <div className="flex items-start gap-2">
        <TagInput
          availableTags={allTags}
          onAddTags={handleAddTags}
          onClose={() => onToggleExpanded(false)}
          placeholder="Add tags..."
          className="flex-1"
          autoFocus={isExpanded}
        />

        {currentMediaFile && (
          <button
            onClick={handleGenerate}
            disabled={!serviceReady || busy}
            className={`flex-shrink-0 bg-black-shades-700 text-gray-200 border-none px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-white hover:bg-opacity-20 active:scale-95 flex items-center gap-2 ${
              !serviceReady || busy ? "opacity-50 cursor-not-allowed" : ""
            } ${aiState === "done" ? "text-green-400" : ""} ${aiState === "error" ? "text-red-400" : ""}`}
            title={sparkleTitle}
          >
            {busy ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
            )}
            <span className="text-sm font-medium whitespace-nowrap">
              {busy ? "Predicting..." : "Predict"}
            </span>
          </button>
        )}
      </div>

      {/* AI suggestion chips (conditional) */}
      {aiState === "confirm" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {suggestedTags.map((tag) => {
              const isSelected = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-black-shades-700 text-gray-400 line-through"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancelAi}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-gray-300 bg-black-shades-700 hover:bg-black-shades-600 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedTags.size === 0}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors duration-150 ${
                selectedTags.size === 0
                  ? "bg-blue-800 opacity-50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              Apply {selectedTags.size} tag
              {selectedTags.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default InlineTagPanel;
