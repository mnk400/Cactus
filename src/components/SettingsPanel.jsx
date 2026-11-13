import { memo, useState } from "react";
import TagManager from "./TagManager";
import { PanelButton, SegmentedControl } from "./ui/Panel";
import { useMediaData } from "../context/MediaContext";
import { getSkin, setSkin } from "../utils/skin";

const FINISHES = [
  { value: "soft", label: "soft" },
  { value: "matte", label: "matte" },
];

// Library upkeep, the finish, and what the library holds.
const SettingsPanel = memo(function SettingsPanel() {
  const [showTagManager, setShowTagManager] = useState(false);
  const [skin, setSkinState] = useState(getSkin);
  const {
    settings,
    allMediaFiles,
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

  const photos = allMediaFiles.filter((f) => f.media_type === "image").length;
  const videos = allMediaFiles.filter((f) => f.media_type === "video").length;
  const sourceName =
    config?.provider?.config?.directoryPath ||
    config?.provider?.config?.sbUrl ||
    "";

  return (
    <div className="space-y-2">
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
          {isRegeneratingThumbnails ? "generating…" : "regenerate thumbnails"}
        </PanelButton>
      )}

      <SegmentedControl
        ariaLabel="Finish"
        value={skin}
        options={FINISHES}
        onChange={(value) => {
          setSkin(value);
          setSkinState(value);
        }}
      />

      <p className="m-0 px-1 pt-1 text-xs text-white/45">
        {allMediaFiles.length.toLocaleString()} items ·{" "}
        {photos.toLocaleString()} photos · {videos.toLocaleString()} videos
      </p>
      {ui.showDirectoryInfo && sourceName && (
        <p className="m-0 break-all px-1 font-mono text-[11px] normal-case text-white/30">
          {sourceName}
        </p>
      )}
    </div>
  );
});

export default SettingsPanel;
