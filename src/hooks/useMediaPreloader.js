import { useRef, useEffect, useCallback } from "react";

export function useMediaPreloader(mediaFiles, currentIndex) {
  const preloadedMedia = useRef(new Map());
  const loadingPromises = useRef(new Map());
  const abortControllers = useRef(new Map());

  const preloadMedia = useCallback(
    (indices) => {
      indices.forEach((index) => {
        if (
          index < 0 ||
          index >= mediaFiles.length ||
          preloadedMedia.current.has(index) ||
          loadingPromises.current.has(index)
        ) {
          return;
        }

        const mediaFile = mediaFiles[index];
        const abortController = new AbortController();
        abortControllers.current.set(index, abortController);

        if (mediaFile.media_type === "image") {
          const img = new Image();
          const loadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
              if (!abortController.signal.aborted) {
                preloadedMedia.current.set(index, img);
                loadingPromises.current.delete(index);
                abortControllers.current.delete(index);
                resolve(img);
              }
            };
            img.onerror = () => {
              loadingPromises.current.delete(index);
              abortControllers.current.delete(index);
              reject(new Error(`Failed to preload image at index ${index}`));
            };

            abortController.signal.addEventListener("abort", () => {
              img.src = "";
              loadingPromises.current.delete(index);
              abortControllers.current.delete(index);
              reject(new Error("Aborted"));
            });
          });

          loadingPromises.current.set(index, loadPromise);
          img.src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
        } else if (mediaFile.media_type === "video") {
          const video = document.createElement("video");
          const loadPromise = new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
              if (!abortController.signal.aborted) {
                preloadedMedia.current.set(index, video);
                loadingPromises.current.delete(index);
                abortControllers.current.delete(index);
                resolve(video);
              }
            };
            video.onerror = () => {
              loadingPromises.current.delete(index);
              abortControllers.current.delete(index);
              reject(new Error(`Failed to preload video at index ${index}`));
            };

            abortController.signal.addEventListener("abort", () => {
              video.src = "";
              video.load();
              loadingPromises.current.delete(index);
              abortControllers.current.delete(index);
              reject(new Error("Aborted"));
            });
          });

          loadingPromises.current.set(index, loadPromise);
          video.src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
          video.preload = "metadata";
          video.setAttribute("playsinline", "");
          video.muted = true;
        }
      });
    },
    [mediaFiles],
  );

  const cleanupPreloadedMedia = useCallback(() => {
    const keepIndices = new Set([
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
    ]);

    // Cancel loading promises for items we don't need
    for (const [index, abortController] of abortControllers.current.entries()) {
      if (!keepIndices.has(index)) {
        abortController.abort();
      }
    }

    // Clean up preloaded media
    for (const [index, element] of preloadedMedia.current.entries()) {
      if (!keepIndices.has(index)) {
        if (element.tagName === "VIDEO") {
          element.src = "";
          element.load();
        } else if (element.tagName === "IMG") {
          element.src = "";
        }
        preloadedMedia.current.delete(index);
      }
    }
  }, [currentIndex]);

  // Preload adjacent media when currentIndex changes
  useEffect(() => {
    if (mediaFiles.length === 0) return;

    const preloadIndices = [
      (currentIndex + 1) % mediaFiles.length,
      (currentIndex - 1 + mediaFiles.length) % mediaFiles.length,
    ];

    preloadMedia(preloadIndices);
    cleanupPreloadedMedia();
  }, [mediaFiles, currentIndex, preloadMedia, cleanupPreloadedMedia]);

  // Clear all preloaded media when mediaFiles change
  useEffect(() => {
    // Cancel all ongoing loads
    for (const abortController of abortControllers.current.values()) {
      abortController.abort();
    }

    // Clean up all media elements
    for (const [, element] of preloadedMedia.current.entries()) {
      if (element.tagName === "VIDEO") {
        element.src = "";
        element.load();
      } else if (element.tagName === "IMG") {
        element.src = "";
      }
    }

    preloadedMedia.current.clear();
    loadingPromises.current.clear();
    abortControllers.current.clear();
  }, [mediaFiles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const abortController of abortControllers.current.values()) {
        abortController.abort();
      }

      for (const [, element] of preloadedMedia.current.entries()) {
        if (element.tagName === "VIDEO") {
          element.src = "";
          element.load();
        } else if (element.tagName === "IMG") {
          element.src = "";
        }
      }
    };
  }, []);

  const getPreloadedMedia = useCallback((index) => {
    return preloadedMedia.current.get(index);
  }, []);

  return { getPreloadedMedia };
}
