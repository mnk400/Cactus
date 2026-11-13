import {
  useAudio,
  useCurrentMedia,
  useVideoElement,
} from "../context/MediaContext";
import { Icon, IconButton } from "./Dock";
import VideoProgressBar from "./VideoProgressBar";

// Video-only chrome: sound and fullscreen top right, scrubber along the
// stage's bottom edge. Kept out of the dock so the dock never changes as you
// swipe between photos and videos.
function VideoControls() {
  const { videoElement } = useVideoElement();
  const { isMuted, toggleMute } = useAudio();
  const { currentMediaFile } = useCurrentMedia();

  if (currentMediaFile?.media_type !== "video") return null;

  const enterFullscreen = () =>
    videoElement &&
    (
      videoElement.requestFullscreen ||
      videoElement.webkitRequestFullscreen ||
      videoElement.webkitEnterFullscreen
    )?.call(videoElement);

  return (
    <>
      <div
        className="absolute right-2.5 z-20 flex gap-1.5"
        style={{
          top: "max(0.625rem, env(safe-area-inset-top, 0.625rem))",
          viewTransitionName: "chrome-video",
        }}
      >
        <IconButton
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className="surface h-8 w-8"
        >
          <Icon className="h-4 w-4">
            {isMuted ? (
              <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8.5 8.5 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </Icon>
        </IconButton>
        <IconButton
          onClick={enterFullscreen}
          title="Fullscreen"
          disabled={!videoElement}
          className="surface h-8 w-8"
        >
          <Icon className="h-4 w-4">
            <path d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </Icon>
        </IconButton>
      </div>
      <div
        className="absolute inset-x-0 z-20"
        // Clear of the iPhone home indicator, so scrubbing doesn't trigger it.
        style={{
          bottom: "env(safe-area-inset-bottom, 0px)",
          viewTransitionName: "chrome-scrub",
        }}
      >
        <VideoProgressBar />
      </div>
    </>
  );
}

export default VideoControls;
