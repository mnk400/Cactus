import { useRef, useEffect, useCallback } from "react";
import { useVideoSettings } from "./useVideoSettings";

export function useMediaPreloader(mediaFiles, currentIndex) {
  const preloadedMedia = useRef(new Map());
  const loadingPromises = useRef(new Map());
  const abortControllers = useRef(new Map());
  const { isMuted } = useVideoSettings();

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
          let isAborted = false;
          
          const loadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
              if (!isAborted) {
                preloadedMedia.current.set(index, img);
                loadingPromises.current.delete(index);
                abortControllers.current.delete(index);
                resolve(img);
              }
            };
            
            img.onerror = () => {
              if (!isAborted) {
                loadingPromises.current.delete(index);
                abortControllers.current.delete(index);
                reject(new Error(`Failed to preload image at index ${index}`));
              }
            };

            abortController.signal.addEventListener("abort", () => {
              isAborted = true;
              img.src = "";
              loadingPromises.current.delete(index);
              abortControllers.current.delete(index);
            });
          });

          loadingPromises.current.set(index, loadPromise);
          img.src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
        } else if (mediaFile.media_type === "video") {
          const video = document.createElement("video");
          let isAborted = false;
          
          const loadPromise = new Promise((resolve, reject) => {
            let hasResolved = false;

            // Use canplaythrough for better buffering - video can play without interruption
            const handleCanPlayThrough = () => {
              if (!isAborted && !hasResolved) {
                hasResolved = true;
                preloadedMedia.current.set(index, video);
                loadingPromises.current.delete(index);
                abortControllers.current.delete(index);
                resolve(video);
              }
            };

            // Fallback to loadeddata if canplaythrough takes too long
            const handleLoadedData = () => {
              if (!isAborted && !hasResolved) {
                // Wait a bit more for buffering, but don't wait forever
                setTimeout(() => {
                  if (!hasResolved && !isAborted) {
                    hasResolved = true;
                    preloadedMedia.current.set(index, video);
                    loadingPromises.current.delete(index);
                    abortControllers.current.delete(index);
                    resolve(video);
                  }
                }, 500); // 500ms timeout for additional buffering
              }
            };

            video.addEventListener("canplaythrough", handleCanPlayThrough);
            video.addEventListener("loadeddata", handleLoadedData);
            
            video.onerror = () => {
              if (!isAborted) {
                loadingPromises.current.delete(index);
                abortControllers.current.delete(index);
                reject(new Error(`Failed to preload video at index ${index}`));
              }
            };

            abortController.signal.addEventListener("abort", () => {
              isAborted = true;
              video.removeEventListener("canplaythrough", handleCanPlayThrough);
              video.removeEventListener("loadeddata", handleLoadedData);
              video.src = "";
              video.load();
              loadingPromises.current.delete(index);
              abortControllers.current.delete(index);
            });
          });

          loadingPromises.current.set(index, loadPromise);
          video.src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
          video.preload = "auto"; // Changed from "metadata" to "auto" for better buffering
          video.setAttribute("playsinline", "");
          video.muted = true;
          
          // Start loading immediately
          video.load();
        }
      });
    },
    [mediaFiles, isMuted],
  );

  const cleanupPreloadedMedia = useCallback(() => {
    const currentMedia = mediaFiles[currentIndex];
    const keepIndices = new Set([
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
    ]);

    // If current media is video, keep more preloaded videos
    if (currentMedia?.media_type === "video") {
      for (let i = 2; i <= 4; i++) {
        const lookAheadIndex = (currentIndex + i) % mediaFiles.length;
        const lookAheadMedia = mediaFiles[lookAheadIndex];
        if (lookAheadMedia?.media_type === "video") {
          keepIndices.add(lookAheadIndex);
          break; // Only keep the next video
        }
      }
    }

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
  }, [currentIndex, mediaFiles]);

  // Preload adjacent media when currentIndex changes
  useEffect(() => {
    if (mediaFiles.length === 0) return;

    const currentMedia = mediaFiles[currentIndex];
    const nextIndex = (currentIndex + 1) % mediaFiles.length;
    const prevIndex = (currentIndex - 1 + mediaFiles.length) % mediaFiles.length;
    
    // Always preload next and previous
    const preloadIndices = [nextIndex, prevIndex];
    
    // If current media is video, also preload the next video more aggressively
    // Right now it's set to 2 to save on bandwit but ngl this provides a 
    // better UX even if it's data intensive 
    if (currentMedia?.media_type === "video") {
      // Look ahead for more videos to preload
      for (let i = 1; i <= 2; i++) {
        const lookAheadIndex = (currentIndex + i) % mediaFiles.length;
        const lookAheadMedia = mediaFiles[lookAheadIndex];
        if (lookAheadMedia?.media_type === "video" && !preloadIndices.includes(lookAheadIndex)) {
          preloadIndices.push(lookAheadIndex);
          break; // Only preload the next video
        }
      }
    }

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
