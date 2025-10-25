import { useMemo } from "react";

/**
 * Hook to get display name from media file
 * Display names are computed server-side using provider-specific logic
 * and included in the media file data, eliminating the need for
 * explicit provider checks or additional API calls
 */
function useDisplayName(currentMediaFile, directoryPath) {
  const displayName = useMemo(() => {
    if (!currentMediaFile) return "";

    // Display name is computed server-side and included in media file
    return currentMediaFile.displayName || "";
  }, [currentMediaFile]);

  return { displayName };
}

export default useDisplayName;
