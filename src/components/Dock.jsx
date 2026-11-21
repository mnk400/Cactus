import { memo } from "react";
import {
  useAudio,
  useCurrentMedia,
  useMediaData,
  useVideoElement,
} from "../context/MediaContext";
import { useMediaTags } from "../hooks/useMediaTags";
import { filterParts } from "../utils/filters";

const FAVORITE_TAG = "favorites";

// Shared icon wrapper — outline by default, filled when `fill` is set.
export function Icon({
  fill = false,
  className = "h-[18px] w-[18px]",
  children,
}) {
  return (
    <svg
      className={className}
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

// The one round button used by all floating chrome. It draws at 36px (or
// whatever `className` sizes it to) and its ::before stretches the touch
// target to 44. `activeClass` is "lit" for the open panel, "fav" for the heart.
export function IconButton({
  onClick,
  title,
  active,
  activeClass = "lit",
  badge,
  disabled,
  className = "h-9 w-9",
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`relative flex shrink-0 items-center justify-center rounded-full text-[color:var(--icon)] before:absolute before:-inset-1 before:content-[''] [&>svg]:transition-transform [&>svg]:duration-100 active:[&>svg]:scale-[0.88] disabled:pointer-events-none disabled:opacity-25 ${
        active ? activeClass : "hover:text-white"
      } ${className}`}
    >
      {children}
      {badge > 0 && !disabled && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">
          {badge}
        </span>
      )}
    </button>
  );
}

const HEART =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

// A video's own buttons, one at each end of the dock. They are always there,
// folded to nothing unless the item is a video; both ends are the same size
// and the dock is centered along its length, so the buttons between them
// never move as the ends open or fold (index.css, .dock-end).
function DockEnd({ open, children }) {
  return (
    <div
      className={`dock-end${open ? " open" : ""}`}
      inert={open ? undefined : ""}
    >
      <div>{children}</div>
    </div>
  );
}

const enterFullscreen = (video) =>
  (
    video.requestFullscreen ||
    video.webkitRequestFullscreen ||
    video.webkitEnterFullscreen
  )?.call(video);

// The icon row of the sheet (see Sheet.jsx): it is the dock when the sheet is
// closed and stays in place under the panel when it is open. Its buttons
// never come or go, so each one keeps its spot under your thumb; item actions
// just dim in the gallery, where there is no one item. The one exception is
// a video's sound and fullscreen, which grow out of the dock's two ends.
const Dock = memo(function Dock({ panel, onPanel }) {
  const { currentMediaFile } = useCurrentMedia();
  const { toggleGallery, navigate, settings } = useMediaData();
  const { isMuted, toggleMute } = useAudio();
  const { videoElement } = useVideoElement();
  const { galleryView } = settings;

  const showItem = !galleryView && !!currentMediaFile;
  const isVideo = showItem && currentMediaFile.media_type === "video";
  const { tags, add, remove } = useMediaTags(
    showItem ? currentMediaFile.file_path : null,
  );
  const favorite = tags.find((tag) => tag.name === FAVORITE_TAG);

  const filterCount = filterParts(settings).length;

  return (
    <>
      <DockEnd open={isVideo}>
        <IconButton onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
          <Icon>
            {isMuted ? (
              <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8.5 8.5 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </Icon>
        </IconButton>
        <span aria-hidden="true" className="dock-sep" />
      </DockEnd>

      <IconButton
        onClick={() => (favorite ? remove(favorite.id) : add([FAVORITE_TAG]))}
        active={!!favorite}
        activeClass="fav"
        disabled={!showItem}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Icon>
          <defs>
            <linearGradient id="heart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffa3b1" />
              <stop offset=".45" stopColor="#ff5470" />
              <stop offset="1" stopColor="#d02848" />
            </linearGradient>
          </defs>
          <path d={HEART} />
        </Icon>
      </IconButton>

      <IconButton
        onClick={() => onPanel("tags")}
        active={panel === "tags"}
        disabled={!showItem}
        badge={tags.length - (favorite ? 1 : 0)}
        title="Tags"
      >
        <Icon>
          <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path d="M6 6h.008v.008H6V6z" />
        </Icon>
      </IconButton>

      <span aria-hidden="true" className="dock-sep" />

      <IconButton
        onClick={toggleGallery}
        active={galleryView}
        // A mode, not a panel: raised grey, so the blue orb only ever marks
        // the open panel.
        activeClass="thumb"
        title="Gallery view"
      >
        <Icon>
          <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </Icon>
      </IconButton>

      <IconButton
        onClick={() => onPanel("filters")}
        active={panel === "filters"}
        badge={filterCount}
        title="Search & filters"
      >
        <Icon>
          <path d="M3 6h18M6 12h12M10 18h4" />
        </Icon>
      </IconButton>

      <IconButton
        onClick={() => onPanel("settings")}
        active={panel === "settings"}
        title="Settings"
      >
        <Icon>
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </Icon>
      </IconButton>

      <span aria-hidden="true" className="dock-sep mouse-only" />
      <IconButton
        onClick={() => navigate(-1)}
        title="Previous (↑)"
        disabled={!showItem}
        className="mouse-only dock-step"
      >
        <Icon>
          <path d="M5 15.5l7-7 7 7" />
        </Icon>
      </IconButton>
      <IconButton
        onClick={() => navigate(1)}
        title="Next (↓)"
        disabled={!showItem}
        className="mouse-only dock-step"
      >
        <Icon>
          <path d="M19 8.5l-7 7-7-7" />
        </Icon>
      </IconButton>

      <DockEnd open={isVideo}>
        <span aria-hidden="true" className="dock-sep" />
        <IconButton
          onClick={() => videoElement && enterFullscreen(videoElement)}
          title="Fullscreen"
          disabled={!videoElement}
        >
          <Icon>
            <path d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </Icon>
        </IconButton>
      </DockEnd>
    </>
  );
});

export default Dock;
