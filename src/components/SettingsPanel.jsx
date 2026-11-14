import { memo, useEffect, useState } from "react";
import TagManager from "./TagManager";
import { PanelButton, PanelSection, SegmentedControl } from "./ui/Panel";
import { useMediaData } from "../context/MediaContext";
import { skin, videoProgress } from "../utils/prefs";

const FINISHES = [
  { value: "soft", label: "soft" },
  { value: "matte", label: "matte" },
];
const PROGRESS = [
  { value: "shown", label: "show" },
  { value: "hidden", label: "hide" },
];

// A display preference: its name, and a segmented control that saves it.
function PrefRow({ label, pref, options }) {
  const [value, setValue] = useState(pref.get);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate px-1 text-white/80">{label}</span>
      <SegmentedControl
        ariaLabel={label}
        className="w-36 shrink-0"
        value={value}
        options={options}
        onChange={(next) => {
          pref.set(next);
          setValue(next);
        }}
      />
    </div>
  );
}

// Library upkeep, display preferences, and what the library holds.
const SettingsPanel = memo(function SettingsPanel() {
  const [showTagManager, setShowTagManager] = useState(false);
  const {
    settings,
    isScanning,
    isRegeneratingThumbnails,
    setFilters,
    rescan,
    regenerateThumbnails,
    config,
    canRescan,
    canRegenerateThumbnails,
    canManageTags,
    ui,
    tags,
    createTag,
    updateTag,
    deleteTag,
  } = useMediaData();

  // What the library holds, asked for whenever the panel opens and again
  // after a rescan, so it is never older than the panel.
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (isScanning) return;
    let live = true;
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => live && setStats(data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isScanning]);

  const handleDeleteTag = async (id) => {
    await deleteTag(id);
    setFilters({
      selectedTags: settings.selectedTags.filter((tag) => tag.id !== id),
      excludedTags: settings.excludedTags.filter((tag) => tag.id !== id),
    });
  };

  if (showTagManager) {
    return (
      <div className="space-y-2.5">
        <PanelButton
          variant="ghost"
          className="-ml-2 h-7 px-2"
          onClick={() => setShowTagManager(false)}
        >
          ‹ settings
        </PanelButton>
        <TagManager
          tags={tags}
          onCreateTag={createTag}
          onUpdateTag={updateTag}
          onDeleteTag={handleDeleteTag}
        />
      </div>
    );
  }

  const sourceName =
    config?.provider?.config?.directoryPath ||
    config?.provider?.config?.sbUrl ||
    "";

  const hasLibrary = canManageTags || canRescan || canRegenerateThumbnails;

  return (
    <div className="space-y-4">
      {hasLibrary && (
        <PanelSection title="library">
          {canManageTags && (
            <PanelButton
              className="flex w-full items-center justify-between"
              onClick={() => setShowTagManager(true)}
            >
              manage tags <span aria-hidden="true">›</span>
            </PanelButton>
          )}
          {canRescan && (
            <PanelButton
              className="w-full text-left"
              disabled={isScanning}
              onClick={rescan}
            >
              {isScanning ? "scanning…" : "rescan library"}
            </PanelButton>
          )}
          {canRegenerateThumbnails && (
            <PanelButton
              className="w-full text-left"
              disabled={isRegeneratingThumbnails}
              onClick={regenerateThumbnails}
            >
              {isRegeneratingThumbnails
                ? "generating…"
                : "regenerate thumbnails"}
            </PanelButton>
          )}
        </PanelSection>
      )}

      <PanelSection title="ui">
        <PrefRow label="finish" pref={skin} options={FINISHES} />
        <PrefRow
          label="video progress"
          pref={videoProgress}
          options={PROGRESS}
        />
      </PanelSection>

      <div className="space-y-1">
        {stats && (
          <p className="m-0 px-1 text-xs text-white/45">
            {stats.total.toLocaleString()} items ·{" "}
            {stats.images.toLocaleString()} photos ·{" "}
            {stats.videos.toLocaleString()} videos
          </p>
        )}
        {ui.showDirectoryInfo && sourceName && (
          <p className="m-0 break-all px-1 font-mono text-[11px] normal-case text-white/30">
            {sourceName}
          </p>
        )}
      </div>
    </div>
  );
});

export default SettingsPanel;
