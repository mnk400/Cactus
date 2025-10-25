import { useRef, useEffect, useCallback } from "react";
import PriorityQueue from "priorityqueuejs";

export function useMediaPreloader(mediaFiles, currentIndex) {
  const preloadedMedia = useRef(new Map());
  const loadingPromises = useRef(new Map());
  const abortControllers = useRef(new Map());
  const preloadQueue = useRef(
    new PriorityQueue((a, b) => b.priority - a.priority),
  );
  const isProcessing = useRef(false);
  const MAX_CONCURRENT_LOADS = 3;
  const preloadMedia = useCallback(
    (indices, priority = 1) => {
      indices.forEach((index) => {
        if (
          index < 0 ||
          index >= mediaFiles.length ||
          preloadedMedia.current.has(index) ||
          loadingPromises.current.has(index)
        ) {
          return;
        }

        preloadQueue.current.enq({ index, priority });
      });
      processPreloadQueue();
    },
    [mediaFiles],
  );

  const processPreloadQueue = useCallback(async () => {
    if (
      isProcessing.current ||
      loadingPromises.current.size >= MAX_CONCURRENT_LOADS
    ) {
      return;
    }

    if (preloadQueue.current.isEmpty()) {
      return;
    }

    isProcessing.current = true;

    while (
      !preloadQueue.current.isEmpty() &&
      loadingPromises.current.size < MAX_CONCURRENT_LOADS
    ) {
      const { index, priority } = preloadQueue.current.deq();

      if (
        preloadedMedia.current.has(index) ||
        loadingPromises.current.has(index)
      ) {
        continue;
      }

      const mediaFile = mediaFiles[index];
      if (!mediaFile) continue;

      const abortController = new AbortController();
      abortControllers.current.set(index, abortController);

      const loadPromise = loadMediaItem(
        index,
        mediaFile,
        abortController,
        priority,
      );
      loadingPromises.current.set(index, loadPromise);

      loadPromise
        .then(() => {
          loadingPromises.current.delete(index);
          abortControllers.current.delete(index);
        })
        .catch(() => {
          loadingPromises.current.delete(index);
          abortControllers.current.delete(index);
        })
        .finally(() => {
          setTimeout(() => processPreloadQueue(), 0);
        });
    }

    isProcessing.current = false;
  }, [mediaFiles]);

  const loadMediaItem = useCallback(
    async (index, mediaFile, abortController, priority) => {
      if (mediaFile.media_type === "image") {
        const img = new Image();
        let isAborted = false;

        return new Promise((resolve, reject) => {
          img.onload = () => {
            if (!isAborted) {
              preloadedMedia.current.set(index, img);
              resolve(img);
            }
          };

          img.onerror = () => {
            if (!isAborted) {
              reject(new Error(`Failed to preload image at index ${index}`));
            }
          };

          abortController.signal.addEventListener("abort", () => {
            isAborted = true;
            img.src = "";
          });

          img.src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
        });
      } else if (mediaFile.media_type === "video") {
        const video = document.createElement("video");
        let isAborted = false;

        return new Promise((resolve, reject) => {
          let hasResolved = false;

          const handleCanPlayThrough = () => {
            if (!isAborted && !hasResolved) {
              hasResolved = true;
              preloadedMedia.current.set(index, video);
              resolve(video);
            }
          };

          const handleLoadedData = () => {
            if (!isAborted && !hasResolved) {
              const timeout = priority > 5 ? 200 : 500;
              setTimeout(() => {
                if (!hasResolved && !isAborted) {
                  hasResolved = true;
                  preloadedMedia.current.set(index, video);
                  resolve(video);
                }
              }, timeout);
            }
          };

          video.addEventListener("canplaythrough", handleCanPlayThrough);
          video.addEventListener("loadeddata", handleLoadedData);

          video.onerror = () => {
            if (!isAborted) {
              reject(new Error(`Failed to preload video at index ${index}`));
            }
          };

          abortController.signal.addEventListener("abort", () => {
            isAborted = true;
            video.removeEventListener("canplaythrough", handleCanPlayThrough);
            video.removeEventListener("loadeddata", handleLoadedData);
            video.src = "";
            video.load();
          });

          video.src = `/media?path=${encodeURIComponent(mediaFile.file_path)}`;
          video.preload = "auto";
          video.setAttribute("playsinline", "");
          video.muted = true;
          video.load();
        });
      }
    },
    [],
  );

  const cleanupPreloadedMedia = useCallback(() => {
    const currentMedia = mediaFiles[currentIndex];
    const keepIndices = new Set([
      currentIndex - 2,
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
      currentIndex + 2,
    ]);

    if (currentMedia?.media_type === "video") {
      for (let i = 3; i <= 5; i++) {
        const lookAheadIndex = (currentIndex + i) % mediaFiles.length;
        const lookAheadMedia = mediaFiles[lookAheadIndex];
        if (lookAheadMedia?.media_type === "video") {
          keepIndices.add(lookAheadIndex);
          break;
        }
      }
    }

    for (const [index, abortController] of abortControllers.current.entries()) {
      if (!keepIndices.has(index)) {
        abortController.abort();
      }
    }

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

    const newQueue = new PriorityQueue((a, b) => b.priority - a.priority);
    while (!preloadQueue.current.isEmpty()) {
      const item = preloadQueue.current.deq();
      if (keepIndices.has(item.index)) {
        newQueue.enq(item);
      }
    }
    preloadQueue.current = newQueue;
  }, [currentIndex, mediaFiles]);

  useEffect(() => {
    if (mediaFiles.length === 0) return;

    const currentMedia = mediaFiles[currentIndex];
    const nextIndex = (currentIndex + 1) % mediaFiles.length;
    const prevIndex =
      (currentIndex - 1 + mediaFiles.length) % mediaFiles.length;

    preloadMedia([nextIndex], 10);
    preloadMedia([prevIndex], 8);
    if (currentMedia?.media_type === "video") {
      const videoLookAhead = [];
      for (let i = 2; i <= 3; i++) {
        const lookAheadIndex = (currentIndex + i) % mediaFiles.length;
        const lookAheadMedia = mediaFiles[lookAheadIndex];
        if (lookAheadMedia?.media_type === "video") {
          videoLookAhead.push(lookAheadIndex);
          break;
        }
      }
      if (videoLookAhead.length > 0) {
        preloadMedia(videoLookAhead, 5);
      }
    }

    const additionalIndices = [];
    for (let i = 2; i <= 4; i++) {
      const forwardIndex = (currentIndex + i) % mediaFiles.length;
      const backwardIndex =
        (currentIndex - i + mediaFiles.length) % mediaFiles.length;
      additionalIndices.push(forwardIndex, backwardIndex);
    }
    preloadMedia(additionalIndices, 3);

    cleanupPreloadedMedia();
  }, [mediaFiles, currentIndex, preloadMedia, cleanupPreloadedMedia]);

  useEffect(() => {
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

    preloadedMedia.current.clear();
    loadingPromises.current.clear();
    abortControllers.current.clear();
    preloadQueue.current = new PriorityQueue((a, b) => b.priority - a.priority);
  }, [mediaFiles]);

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

      preloadQueue.current = new PriorityQueue(
        (a, b) => b.priority - a.priority,
      );
    };
  }, []);

  const getPreloadedMedia = useCallback((index) => {
    return preloadedMedia.current.get(index);
  }, []);

  return { getPreloadedMedia };
}
