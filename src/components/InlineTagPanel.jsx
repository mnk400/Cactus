import { useState, useEffect, useCallback, useRef, memo } from "react";
import TagInput from "./TagInput";
import { PanelButton } from "./ui/Panel";
import { useMediaData } from "../context/MediaContext";

const InlineTagPanel = memo(function InlineTagPanel({
  currentMediaFile,
  onAddTags,
  onClose,
}) {
  const { tags: allTags } = useMediaData();

  // AI auto-tag state
  const [aiState, setAiState] = useState("idle"); // idle | loading | confirm | applying | done | error
  const [serviceReady, setServiceReady] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  // The item the current suggestions belong to. The panel stays open while
  // you swipe, so a prediction can come back after you have moved on.
  const [suggestedFor, setSuggestedFor] = useState(null);
  const pathRef = useRef(currentMediaFile?.file_path);

  // Drop any pending suggestions when the item changes; the panel itself
  // stays open so you can tag and keep swiping.
  useEffect(() => {
    pathRef.current = currentMediaFile?.file_path;
    setAiState("idle");
    setSuggestedTags([]);
    setSelectedTags(new Set());
  }, [currentMediaFile?.file_path]);

  // Poll auto-tag service readiness while the panel is open (mounted)
  useEffect(() => {
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
  }, []);

  // AI: Generate tag suggestions
  const handleGenerate = useCallback(async () => {
    const path = currentMediaFile?.file_path;
    if (!path || aiState === "loading") return;

    setAiState("loading");
    try {
      const res = await fetch(
        `/api/media-path/auto-tag/generate?path=${encodeURIComponent(path)}`,
        { method: "POST" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      const data = await res.json();
      if (pathRef.current !== path) return; // swiped away; already reset
      setSuggestedFor(path);
      setSuggestedTags(data.tags || []);
      setSelectedTags(new Set(data.tags || []));
      setAiState("confirm");
    } catch (err) {
      console.error("Auto-tag generate failed:", err);
      if (pathRef.current !== path) return;
      setAiState("error");
      setTimeout(() => setAiState("idle"), 3000);
    }
  }, [currentMediaFile?.file_path, aiState]);

  // AI: Apply selected tags
  const handleApply = useCallback(async () => {
    if (selectedTags.size === 0 || !suggestedFor) return;

    setAiState("applying");
    try {
      const res = await fetch(
        `/api/media-path/auto-tag/apply?path=${encodeURIComponent(suggestedFor)}`,
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
  }, [suggestedFor, selectedTags]);

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

  // Panel content (animation handled by parent wrapper)
  return (
    <div className="w-full">
      <div className="space-y-2.5">
        {/* Tag input + sparkle button */}
        <div className="flex w-full items-center gap-2">
          <TagInput
            availableTags={allTags}
            onAddTags={onAddTags}
            onClose={onClose}
            placeholder="add a tag"
            className="flex-1"
          />

          {currentMediaFile && serviceReady && (
            <button
              onClick={handleGenerate}
              disabled={!serviceReady || busy}
              className={`pill flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 font-medium text-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                aiState === "done" ? "text-green-400" : ""
              } ${aiState === "error" ? "text-red-400" : ""}`}
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
                  className="h-[15px] w-[15px]"
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
              <span className="whitespace-nowrap">
                {busy ? "predicting…" : "predict"}
              </span>
            </button>
          )}
        </div>

        {/* AI suggestion chips (conditional) */}
        {aiState === "confirm" && (
          <div className="space-y-3">
            <div className="chips">
              {suggestedTags.map((tag) => {
                const isSelected = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`h-7 shrink-0 rounded-full px-3 font-medium ${
                      isSelected ? "pill-on" : "well text-white/45 line-through"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <PanelButton className="flex-1" onClick={handleCancelAi}>
                cancel
              </PanelButton>
              <PanelButton
                variant="primary"
                className="flex-1"
                onClick={handleApply}
                disabled={selectedTags.size === 0}
              >
                add {selectedTags.size} tag{selectedTags.size !== 1 ? "s" : ""}
              </PanelButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default InlineTagPanel;
