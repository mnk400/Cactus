import { memo, useState } from "react";
import TagManager from "./TagManager";
import {
  PanelButton,
  PanelSection,
  ResponsivePanel,
  SegmentedControl,
} from "./ui/Panel";
import { useMediaData, useSlideshowState } from "../context/MediaContext";

const SLIDESHOW_SPEEDS = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

const SettingsPanel = memo(function SettingsPanel({ isOpen, onClose }) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const { slideshowSpeed, startSlideshow, setSlideshowSpeed } =
    useSlideshowState();
  const {
    settings,
    allMediaFiles,
    isScanning,
    isRegeneratingThumbnails,
    setFilters,
    rescan,
    regenerateThumbnails,
    config,
    configLoading,
    canRescan,
    canRegenerateThumbnails,
    canManageTags,
    ui,
    tags,
    createTag,
    updateTag,
    deleteTag,
  } = useMediaData();

  const closeSettings = () => {
    setShowTagManager(false);
    onClose();
  };

  const handleDeleteTag = async (id) => {
    await deleteTag(id);
    setFilters({
      selectedTags: settings.selectedTags.filter((tag) => tag.id !== id),
      excludedTags: settings.excludedTags.filter((tag) => tag.id !== id),
    });
  };

  const totalFiles = allMediaFiles.length;
  const totalPhotos = allMediaFiles.filter(
    (file) => file.media_type === "image",
  ).length;
  const totalVideos = allMediaFiles.filter(
    (file) => file.media_type === "video",
  ).length;
  const photoPercentage = totalFiles
    ? Math.round((totalPhotos / totalFiles) * 100)
    : 0;
  const videoPercentage = totalFiles
    ? Math.round((totalVideos / totalFiles) * 100)
    : 0;
  const sourceName =
    config?.provider?.config?.directoryPath ||
    config?.provider?.config?.sbUrl ||
    "";

  const title = showTagManager ? "Manage tags" : "Settings";

  return (
    <ResponsivePanel
      isOpen={isOpen}
      onClose={closeSettings}
      onBack={showTagManager ? () => setShowTagManager(false) : undefined}
      title={title}
    >
      {showTagManager ? (
        <TagManager
          tags={tags}
          onCreateTag={createTag}
          onUpdateTag={updateTag}
          onDeleteTag={handleDeleteTag}
        />
      ) : (
        <div className="space-y-4">
          <PanelSection
            title="Library overview"
            actions={
              <button
                type="button"
                aria-expanded={showLibrary}
                aria-label={
                  showLibrary
                    ? "Collapse library overview"
                    : "Expand library overview"
                }
                onClick={() => setShowLibrary((visible) => !visible)}
                className="-m-2 flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${showLibrary ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="m19 9-7 7-7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            }
          >
            {showLibrary ? (
              <div className="space-y-3">
                {ui.showDirectoryInfo && sourceName && (
                  <div className="rounded-xl bg-black/30 p-3">
                    <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                      {ui.directoryLabel || "Source"}
                    </div>
                    <div className="break-all font-mono text-xs leading-5 text-gray-300">
                      {sourceName}
                    </div>
                    {ui.showConnectionStatus && (
                      <div className="mt-1 text-xs text-green-400">
                        Connected
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Total", totalFiles],
                    ["Photos", totalPhotos],
                    ["Videos", totalVideos],
                  ].map(([label, count]) => (
                    <div key={label} className="rounded-xl bg-black/30 p-2.5">
                      <div className="text-base font-semibold text-white">
                        {count}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {totalFiles > 0 && (
                  <div>
                    <div
                      className="flex h-1.5 overflow-hidden rounded-full bg-black/40"
                      aria-label={`${photoPercentage}% photos and ${videoPercentage}% videos`}
                    >
                      <div
                        className="bg-white/60"
                        style={{ width: `${photoPercentage}%` }}
                      />
                      <div
                        className="bg-white/20"
                        style={{ width: `${videoPercentage}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>Photos {photoPercentage}%</span>
                      <span>Videos {videoPercentage}%</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="m-0 text-sm text-gray-500">
                {totalFiles} items in this library
              </p>
            )}
          </PanelSection>

          <PanelSection title="Slideshow">
            <div className="space-y-3">
              <SegmentedControl
                ariaLabel="Slideshow speed"
                value={slideshowSpeed}
                options={SLIDESHOW_SPEEDS}
                onChange={setSlideshowSpeed}
              />
              <PanelButton
                variant="primary"
                className="w-full"
                onClick={() => {
                  closeSettings();
                  startSlideshow();
                }}
              >
                Start slideshow
              </PanelButton>
              <p className="m-0 text-center text-xs text-gray-500">
                Press S to toggle slideshow
              </p>
            </div>
          </PanelSection>

          {!configLoading &&
            (canManageTags || canRescan || canRegenerateThumbnails) && (
              <PanelSection title="Library actions">
                <div className="space-y-2">
                  {canManageTags && (
                    <PanelButton
                      className="w-full"
                      onClick={() => setShowTagManager(true)}
                    >
                      Manage tags
                    </PanelButton>
                  )}
                  {canRescan && (
                    <PanelButton
                      className="w-full"
                      disabled={isScanning}
                      onClick={rescan}
                    >
                      {isScanning ? "Scanning…" : "Rescan directory"}
                    </PanelButton>
                  )}
                  {canRegenerateThumbnails && (
                    <PanelButton
                      className="w-full"
                      disabled={isRegeneratingThumbnails}
                      onClick={regenerateThumbnails}
                    >
                      {isRegeneratingThumbnails
                        ? "Generating…"
                        : "Regenerate thumbnails"}
                    </PanelButton>
                  )}
                </div>
              </PanelSection>
            )}
        </div>
      )}
    </ResponsivePanel>
  );
});

export default SettingsPanel;
