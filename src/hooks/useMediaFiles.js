import { useState, useCallback } from "react";
import { shuffleArray } from "../utils/helpers";

export function useMediaFiles() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [allMediaFiles, setAllMediaFiles] = useState([]); // Track all files for statistics
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const fetchMediaFiles = useCallback(
    async (
      mediaType = "all",
      includeTags = [],
      excludeTags = [],
      pathSubstring = "",
    ) => {
      console.log(`Fetching ${mediaType} media files...`, {
        includeTags,
        excludeTags,
        pathSubstring,
      });

      try {
        setLoading(`Loading ${mediaType} media...`);
        setError(null);

        // Build URL with filters
        let url = `/api/media?type=${mediaType}`;
        if (includeTags.length > 0) {
          url += `&tags=${includeTags.join(",")}`;
        }
        if (excludeTags.length > 0) {
          url += `&exclude-tags=${excludeTags.join(",")}`;
        }
        if (pathSubstring) {
          url += `&pathSubstring=${encodeURIComponent(pathSubstring)}`;
        }

        // Fetch the requested type
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get media files");
        }

        const data = await response.json();
        console.log(`Received ${data.count} ${mediaType} files from server`);

        // If we fetched 'all' with no filters, use it for statistics too
        if (
          mediaType === "all" &&
          includeTags.length === 0 &&
          excludeTags.length === 0 &&
          !pathSubstring
        ) {
          setAllMediaFiles(data.files);
        } else {
          // Otherwise, fetch all files for statistics (only if we don't have them)
          if (allMediaFiles.length === 0) {
            try {
              const allResponse = await fetch("/api/media?type=all");
              if (allResponse.ok) {
                const allData = await allResponse.json();
                setAllMediaFiles(allData.files);
              }
            } catch (error) {
              console.warn(
                "Failed to fetch all files for statistics:",
                error.message,
              );
            }
          }
        }

        if (!data.files || data.files.length === 0) {
          const hasFilters =
            includeTags.length > 0 ||
            excludeTags.length > 0 ||
            !!pathSubstring;
          const filterText = hasFilters ? " matching the current filters" : "";
          setError(`No ${mediaType} files found${filterText}`);
          setMediaFiles([]);
          return;
        }

        const shuffledFiles = shuffleArray(data.files);
        setMediaFiles(shuffledFiles);
      } catch (err) {
        setError(err.message);
        setMediaFiles([]);
      } finally {
        setLoading(null);
      }
    },
    [allMediaFiles.length],
  );

  const filterMedia = useCallback(
    async (mediaType, includeTags = [], excludeTags = [], pathSubstring = "") => {
      console.log(`Filtering media by type: ${mediaType}`, {
        includeTags,
        excludeTags,
        pathSubstring,
      });

      try {
        setLoading(`Loading ${mediaType} files...`);
        setError(null);

        // Build URL with filters
        let url = `/api/media?type=${mediaType}`;
        if (includeTags.length > 0) {
          url += `&tags=${includeTags.join(",")}`;
        }
        if (excludeTags.length > 0) {
          url += `&exclude-tags=${excludeTags.join(",")}`;
        }
        if (pathSubstring) {
          url += `&pathSubstring=${encodeURIComponent(pathSubstring)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to filter ${mediaType}`);
        }

        const data = await response.json();
        console.log(`Filter response: Found ${data.count} ${mediaType} files`);

        if (!data.files || data.files.length === 0) {
          const hasFilters =
            includeTags.length > 0 ||
            excludeTags.length > 0 ||
            !!pathSubstring;
          const filterText = hasFilters ? " matching the current filters" : "";
          setError(`No ${mediaType} files found${filterText}`);
          setMediaFiles([]);
          return;
        }

        const shuffledFiles = shuffleArray(data.files);
        setMediaFiles(shuffledFiles);
      } catch (err) {
        setError(`Failed to load ${mediaType}: ${err.message}`);
        setMediaFiles([]);
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  const rescanDirectory = useCallback(async () => {
    if (isScanning) {
      console.log("Scan already in progress, ignoring request");
      return;
    }

    try {
      setIsScanning(true);
      setLoading("Scanning...");
      setError(null);

      const response = await fetch("/rescan-directory", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (response.status === 409) {
          throw new Error(
            "Scan already in progress. Please wait for the current scan to complete.",
          );
        } else {
          throw new Error(errorData.error || "Failed to rescan directory");
        }
      }

      const data = await response.json();
      console.log(data.message);
    } catch (err) {
      setError(`Rescan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
      setLoading(null);
    }
  }, [isScanning]);

  return {
    mediaFiles,
    allMediaFiles,
    loading,
    error,
    isScanning,
    fetchMediaFiles,
    filterMedia,
    rescanDirectory,
  };
}
