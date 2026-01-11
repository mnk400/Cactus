import { useState, useCallback, useMemo, useEffect } from "react";
import MediaViewer from "./components/MediaViewer";
import Navigation from "./components/Navigation";
import SideNavigation from "./components/SideNavigation";
import SettingsPanel from "./components/SettingsPanel";
import TagDisplay from "./components/TagDisplay";
import TagInputModal from "./components/TagInputModal";
import LoadingMessage from "./components/LoadingMessage";
import ErrorMessage from "./components/ErrorMessage";
import DebugInfo from "./components/DebugInfo";
import GalleryView from "./components/GalleryView";
import ViewTransition from "./components/ViewTransition";
import LoginPage from "./components/LoginPage";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { useFavorite } from "./hooks/useFavorite";
import { useMedia } from "./context/MediaContext";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagUpdateTrigger, setTagUpdateTrigger] = useState(0);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [authState, setAuthState] = useState({
    checking: true,
    authRequired: false,
    authenticated: false,
    error: null,
  });

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/status");
        const data = await response.json();
        setAuthState({
          checking: false,
          authRequired: data.authRequired,
          authenticated: data.authenticated,
          error: null,
        });
      } catch (err) {
        setAuthState({
          checking: false,
          authRequired: false,
          authenticated: false,
          error: "Failed to connect to server",
        });
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setAuthState((prev) => ({ ...prev, authenticated: true }));
  }, []);

  const {
    mediaFiles,
    currentIndex,
    currentMediaFile,
    loading,
    error,
    settings,
    navigate,
  } = useMedia();

  const { pathFilter, galleryView: isGalleryView, debug: debugMode } = settings;

  const directoryPath = useMemo(
    () =>
      currentMediaFile
        ? currentMediaFile.file_path.split("/").slice(0, -1).join("/") || "/"
        : "",
    [currentMediaFile],
  );

  // Keyboard navigation
  useKeyboardNavigation(
    useCallback(
      (direction) => {
        if (mediaFiles.length > 0 && !showTagInput) {
          navigate(direction);
        }
      },
      [mediaFiles.length, showTagInput, navigate],
    ),
  );

  const handleToggleTagInput = (show) => {
    setShowTagInput(typeof show === "boolean" ? show : !showTagInput);
  };

  const handleTagsUpdated = () => {
    setTagUpdateTrigger((prev) => prev + 1);
  };

  const { isFavorited, toggleFavorite } = useFavorite(
    currentMediaFile?.file_path,
  );

  // Show loading while checking auth
  if (authState.checking) {
    return (
      <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
        <LoadingMessage message="Loading..." />
      </div>
    );
  }

  // Show error if auth check failed
  if (authState.error) {
    return (
      <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
        <ErrorMessage message={authState.error} />
      </div>
    );
  }

  // Show login page if auth required and not authenticated
  if (authState.authRequired && !authState.authenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
      <DebugInfo show={debugMode} />

      <div className="media-container flex-1 relative overflow-hidden bg-black pb-16">
        {loading && <LoadingMessage message={loading} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && mediaFiles.length > 0 && (
          <ViewTransition isGalleryView={isGalleryView}>
            <GalleryView
              scrollPosition={galleryScrollPosition}
              setScrollPosition={setGalleryScrollPosition}
            />
            <MediaViewer
              showTagInput={showTagInput}
              onToggleTagInput={handleToggleTagInput}
            />
          </ViewTransition>
        )}

        {!loading && !error && mediaFiles.length === 0 && (
          <div className="h-full w-full flex justify-center items-center text-gray-500 text-center p-5">
            <div>
              <p className="text-lg mb-2">No media files found</p>
              <p className="text-sm">
                Try adjusting your filters or check if the directory contains
                supported media files.
              </p>
            </div>
          </div>
        )}

        {!isSettingsOpen && !isGalleryView && <SideNavigation />}

        <ViewTransition isSettingsOpen={isSettingsOpen}>
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </ViewTransition>
      </div>

      {!isGalleryView && (
        <TagDisplay
          currentMediaFile={currentMediaFile}
          showTagInput={showTagInput}
          key={tagUpdateTrigger}
          isVideoPlaying={currentMediaFile?.media_type === "video"}
        />
      )}

      {!isSettingsOpen && (
        <Navigation
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
          onToggleTagInput={handleToggleTagInput}
          directoryName={directoryPath}
          isFavorited={isFavorited}
          onToggleFavorite={toggleFavorite}
        />
      )}

      <TagInputModal
        isOpen={showTagInput}
        onClose={() => handleToggleTagInput(false)}
        currentMediaFile={currentMediaFile}
        onTagsUpdated={handleTagsUpdated}
      />
    </div>
  );
}

export default App;
