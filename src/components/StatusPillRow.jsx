import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import StatusPill from "./StatusPill";
import VideoProgressBar from "./VideoProgressBar";

const FILTER_COLORS = {
  include: "#2563eb",
  exclude: "#4b5563",
  search: "#ef4444",
  sort: "#1e293b",
  mediaType: "#7c3aed",
  video: "#202020",
};

function findActiveVideoFallback() {
  const activeCard = document.querySelector(
    ".unified-feed-item.is-active .unified-feed-card",
  );
  const activeVideo = activeCard?.querySelector("video");
  if (activeVideo) return activeVideo;

  const cards = document.querySelectorAll(".unified-feed-card");
  const viewportHeight = window.innerHeight;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.top <= viewportHeight / 2 && rect.bottom >= viewportHeight / 2) {
      const video = card.querySelector("video");
      if (video) return video;
    }
  }

  return null;
}

const StatusPillRow = memo(function StatusPillRow({
  currentMediaFile,
  settings,
  setFilters,
  fetchTags,
  videoElement,
  isMuted,
  onToggleMute,
  showMediaTags = true,
  showVideoControls = true,
}) {
  const [mediaTags, setMediaTags] = useState([]);

  const {
    search,
    selectedTags = [],
    excludedTags = [],
    mediaType = "all",
    sortBy = "random",
  } = settings;

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

  useEffect(() => {
    let isMounted = true;

    const loadMediaTags = async () => {
      if (!showMediaTags || !currentMediaFile?.file_path) {
        if (isMounted) setMediaTags([]);
        return;
      }

      const tags = await fetchMediaTags(currentMediaFile.file_path);
      if (isMounted) setMediaTags(tags);
    };

    loadMediaTags();

    const handleTagsUpdated = () => loadMediaTags();
    window.addEventListener("tags-updated", handleTagsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener("tags-updated", handleTagsUpdated);
    };
  }, [currentMediaFile?.file_path, fetchMediaTags, showMediaTags]);

  const removeMediaTag = useCallback(
    async (tagId) => {
      if (!currentMediaFile?.file_path) return;

      try {
        const res = await fetch(
          `/api/media-path/tags/${tagId}?path=${encodeURIComponent(currentMediaFile.file_path)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Failed to remove tag");

        const [updatedTags] = await Promise.all([
          fetchMediaTags(currentMediaFile.file_path),
          fetchTags?.(),
        ]);

        setMediaTags(updatedTags);
        window.dispatchEvent(new CustomEvent("tags-updated"));
      } catch (error) {
        console.error("Failed to remove tag:", error);
      }
    },
    [currentMediaFile?.file_path, fetchMediaTags, fetchTags],
  );

  const filterPills = useMemo(() => {
    const pills = [];

    selectedTags.forEach((tag) => {
      pills.push({
        id: `include:${tag.id}`,
        label: `Tag: ${tag.name}`,
        color: tag.color || FILTER_COLORS.include,
        remove: () =>
          setFilters({
            selectedTags: selectedTags.filter((item) => item.id !== tag.id),
          }),
      });
    });

    excludedTags.forEach((tag) => {
      pills.push({
        id: `exclude:${tag.id}`,
        label: `Not: ${tag.name}`,
        color: FILTER_COLORS.exclude,
        remove: () =>
          setFilters({
            excludedTags: excludedTags.filter((item) => item.id !== tag.id),
          }),
      });
    });

    if (search?.trim()) {
      pills.push({
        id: "search",
        label: `Search: ${search.trim()}`,
        color: FILTER_COLORS.search,
        remove: () => setFilters({ search: "" }),
      });
    }

    if (mediaType !== "all") {
      pills.push({
        id: "mediaType",
        label: mediaType === "photos" ? "Photos only" : "Videos only",
        color: FILTER_COLORS.mediaType,
        remove: () => setFilters({ mediaType: "all" }),
      });
    }

    if (sortBy !== "random") {
      pills.push({
        id: "sortBy",
        label: `Sort: ${sortBy === "date_added" ? "Date Added" : "Date Created"}`,
        color: FILTER_COLORS.sort,
        remove: () => setFilters({ sortBy: "random" }),
      });
    }

    return pills;
  }, [excludedTags, mediaType, search, selectedTags, setFilters, sortBy]);

  const handleFullscreen = useCallback(() => {
    const activeVideo = videoElement || findActiveVideoFallback();
    if (!activeVideo) return;

    if (activeVideo.requestFullscreen) {
      activeVideo.requestFullscreen();
    } else if (activeVideo.webkitRequestFullscreen) {
      activeVideo.webkitRequestFullscreen();
    } else if (activeVideo.msRequestFullscreen) {
      activeVideo.msRequestFullscreen();
    } else if (activeVideo.webkitEnterFullscreen) {
      activeVideo.webkitEnterFullscreen();
    }
  }, [videoElement]);

  const visibleMediaTags = showMediaTags
    ? mediaTags.filter((tag) => tag.name !== "favorites")
    : [];
  const hasVideoProgress =
    showVideoControls && currentMediaFile?.media_type === "video";
  const hasVideoButtons = hasVideoProgress && onToggleMute;
  const hasPillContent =
    visibleMediaTags.length > 0 || filterPills.length > 0 || hasVideoButtons;
  const hasContent =
    visibleMediaTags.length > 0 ||
    filterPills.length > 0 ||
    hasVideoProgress ||
    hasVideoButtons;

  if (!hasContent) return null;

  return (
    <div className="w-full px-4 pb-2">
      {hasVideoProgress && (
        <div className={`w-full ${hasPillContent ? "pb-2" : ""}`}>
          <VideoProgressBar videoElement={videoElement} variant="pill" />
        </div>
      )}

      {hasPillContent && (
        <div className="scrollbar-hide flex w-full items-center gap-2 overflow-x-auto overscroll-x-contain">
          {hasVideoButtons && (
            <>
              <StatusPill
                color={FILTER_COLORS.video}
                onClick={onToggleMute}
                title={isMuted ? "Unmute video" : "Mute video"}
              >
                {isMuted ? "Unmute" : "Mute"}
              </StatusPill>
              <StatusPill
                color={FILTER_COLORS.video}
                onClick={handleFullscreen}
                title="Fullscreen"
              >
                Fullscreen
              </StatusPill>
            </>
          )}

          {visibleMediaTags.map((tag) => (
            <StatusPill
              key={`media:${tag.id}`}
              color={tag.color || FILTER_COLORS.include}
              onRemove={() => removeMediaTag(tag.id)}
              removeLabel={`Remove ${tag.name} tag`}
              title={`Current media tag: ${tag.name}`}
            >
              {tag.name}
            </StatusPill>
          ))}

          {filterPills.map((pill) => (
            <StatusPill
              key={pill.id}
              color={pill.color}
              onRemove={pill.remove}
              removeLabel={`Remove ${pill.label}`}
              title={pill.label}
            >
              {pill.label}
            </StatusPill>
          ))}
        </div>
      )}
    </div>
  );
});

export default StatusPillRow;
