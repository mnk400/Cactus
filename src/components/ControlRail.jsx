import { memo, useCallback, useMemo } from "react";
import {
  useMediaData,
  useCurrentMedia,
  useAudio,
  useVideoElement,
} from "../context/MediaContext";
import { useFavorite } from "../hooks/useFavorite";
import { useMediaTags } from "../hooks/useMediaTags";

// Shared icon wrapper — outline by default, filled when `fill` is set.
function Icon({ fill = false, children }) {
  return (
    <svg
      className="h-5 w-5"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

// Shared button for the whole rail. Chromeless by default (the rail surface is
// the ground), lifts on hover, and carries an active state plus an optional
// corner count badge. `activeClass` lets the favorite button tint red while
// mode buttons fill.
function RailButton({
  onClick,
  title,
  active,
  activeClass = "bg-white/20 text-white",
  badge,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 active:scale-95 ${
        active ? activeClass : "text-white/90 hover:bg-white/10"
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// Hairline separator between button clusters (vertical rail only).
function RailDivider() {
  return <div aria-hidden="true" className="my-0.5 h-px w-6 bg-white/10" />;
}

// App-level modes: gallery / filter / settings. Always present — this is how
// you move around the app, independent of any single item.
function AppZone({
  vertical,
  onOpenFilter,
  onOpenSettings,
  isFilterOpen,
  isSettingsOpen,
}) {
  const { toggleGallery, settings } = useMediaData();
  const { galleryView, search, selectedTags, excludedTags, mediaType, sortBy } =
    settings;

  const filterCount = useMemo(() => {
    let n = selectedTags.length + excludedTags.length;
    if (search && search.trim()) n += 1;
    if (mediaType !== "all") n += 1;
    if (sortBy !== "random") n += 1;
    return n;
  }, [selectedTags, excludedTags, search, mediaType, sortBy]);

  return (
    <div
      className={`flex items-center gap-2 ${vertical ? "flex-col" : "flex-row"}`}
    >
      <RailButton
        onClick={toggleGallery}
        active={galleryView}
        title="Gallery view (G)"
      >
        <Icon>
          <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </Icon>
      </RailButton>

      <RailButton
        onClick={onOpenFilter}
        active={isFilterOpen}
        badge={filterCount}
        title="Search & filters"
      >
        <Icon>
          <path d="M3 4.5h18M6 10.5h12M10 16.5h4" />
        </Icon>
      </RailButton>

      <RailButton
        onClick={onOpenSettings}
        active={isSettingsOpen}
        title="Settings"
      >
        <Icon>
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </Icon>
      </RailButton>
    </div>
  );
}

// Item-level actions for the active media: favorite / tags / mute / fullscreen,
// plus prev/next on desktop (`showNavigation`). Renders nothing when no item is
// active (e.g. gallery/slideshow), so the app modes stand alone.
function ItemZone({ vertical, onOpenTags, showNavigation }) {
  const { currentMediaFile } = useCurrentMedia();
  const { navigate } = useMediaData();
  const { isFavorited, toggleFavorite } = useFavorite(
    currentMediaFile?.file_path,
  );
  const { isMuted, toggleMute } = useAudio();
  const { videoElement } = useVideoElement();

  const mediaTags = useMediaTags(currentMediaFile?.file_path);
  const tagCount = useMemo(
    () => mediaTags.filter((t) => t.name !== "favorites").length,
    [mediaTags],
  );

  const isVideo = !!videoElement;

  const handleFullscreen = useCallback(
    (e) => {
      e.stopPropagation();
      const v = videoElement;
      if (!v) return;
      if (v.requestFullscreen) v.requestFullscreen();
      else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      else if (v.msRequestFullscreen) v.msRequestFullscreen();
    },
    [videoElement],
  );

  const handleMute = useCallback(
    (e) => {
      e.stopPropagation();
      toggleMute();
    },
    [toggleMute],
  );

  if (!currentMediaFile) return null;

  return (
    <div
      className={`flex items-center gap-2 ${vertical ? "flex-col" : "flex-row"}`}
    >
      <RailButton
        onClick={toggleFavorite}
        active={isFavorited}
        activeClass="text-red-400"
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        {isFavorited ? (
          <Icon fill>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </Icon>
        ) : (
          <Icon>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </Icon>
        )}
      </RailButton>

      {onOpenTags && (
        <RailButton
          onClick={onOpenTags}
          title="Tags"
          badge={tagCount > 0 ? tagCount : undefined}
        >
          <Icon>
            <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path d="M6 6h.008v.008H6V6z" />
          </Icon>
        </RailButton>
      )}

      {isVideo && (
        <>
          <RailButton
            onClick={handleMute}
            title={isMuted ? "Unmute (M)" : "Mute (M)"}
          >
            {isMuted ? (
              <Icon>
                <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </Icon>
            ) : (
              <Icon>
                <path d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8.5 8.5 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </Icon>
            )}
          </RailButton>

          <RailButton onClick={handleFullscreen} title="Fullscreen (F)">
            <Icon>
              <path d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </Icon>
          </RailButton>
        </>
      )}

      {showNavigation && (
        <>
          <RailDivider />
          <RailButton onClick={() => navigate(-1)} title="Previous (↑)">
            <Icon>
              <path d="M5 15l7-7 7 7" />
            </Icon>
          </RailButton>
          <RailButton onClick={() => navigate(1)} title="Next (↓)">
            <Icon>
              <path d="M19 9l-7 7-7-7" />
            </Icon>
          </RailButton>
        </>
      )}
    </div>
  );
}

// The single control surface for the whole app. Two zones — app modes and
// per-item actions — kept visually distinct so it never reads as icon soup:
//   • desktop (vertical): modes anchor the top, item actions sink to the bottom
//   • mobile (horizontal): modes hug the left, item actions hug the right
// Replaces the former split AppNav + floating ActionRail; folding the item
// actions into the persistent nav is what sheds the TikTok overlay look.
const ControlRail = memo(function ControlRail({
  orientation = "horizontal",
  showItemActions = true,
  onOpenFilter,
  onOpenSettings,
  onOpenTags,
  isFilterOpen,
  isSettingsOpen,
}) {
  const vertical = orientation === "vertical";

  return (
    <div
      className={`flex ${
        vertical
          ? "h-full w-full flex-1 flex-col items-center"
          : "w-full flex-row items-center justify-between"
      }`}
    >
      <AppZone
        vertical={vertical}
        onOpenFilter={onOpenFilter}
        onOpenSettings={onOpenSettings}
        isFilterOpen={isFilterOpen}
        isSettingsOpen={isSettingsOpen}
      />

      {showItemActions && (
        <div className={vertical ? "mt-auto" : ""}>
          <ItemZone
            vertical={vertical}
            onOpenTags={onOpenTags}
            showNavigation={vertical}
          />
        </div>
      )}
    </div>
  );
});

export default ControlRail;
