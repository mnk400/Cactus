import { useState } from "react";

export const usePrediction = (
  predictApiUrl,
  currentMediaFile,
  onTagsPredicted,
) => {
  const [isPredicting, setIsPredicting] = useState(false);

  const predictTags = async (filePath) => {
    if (
      !filePath ||
      !currentMediaFile ||
      !predictApiUrl ||
      (currentMediaFile.media_type !== "image" &&
        currentMediaFile.media_type !== "video")
    ) {
      return;
    }

    setIsPredicting(true);
    try {
      if (currentMediaFile.media_type === "image") {
        const formData = new FormData();
        const image = await fetch(
          `/media?path=${encodeURIComponent(filePath)}`,
        );
        if (!image.ok) {
          throw new Error(`Failed to fetch image: ${image.status}`);
        }
        const imageBlob = await image.blob();
        formData.append("image", imageBlob, "media.jpeg");

        const predictResponse = await fetch(predictApiUrl, {
          method: "POST",
          body: formData,
        });

        if (!predictResponse.ok) {
          throw new Error(
            `Prediction failed with status: ${predictResponse.status}`,
          );
        }

        const data = await predictResponse.json();

        if (data.tags) {
          const predictedTags = data.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
          onTagsPredicted(predictedTags);
        }
      } else if (currentMediaFile.media_type === "video") {
        const video = document.createElement("video");
        video.src = `/media?path=${encodeURIComponent(filePath)}`;
        video.crossOrigin = "anonymous";

        const captureFrame = (videoElement, time) => {
          return new Promise((resolve, reject) => {
            videoElement.currentTime = time;
            videoElement.onseeked = () => {
              const canvas = document.createElement("canvas");
              canvas.width = videoElement.videoWidth;
              canvas.height = videoElement.videoHeight;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
              canvas.toBlob(resolve, "image/jpeg");
            };
            videoElement.onerror = (err) =>
              reject(new Error("Failed during frame capture."));
          });
        };

        await new Promise((resolve, reject) => {
          video.onloadeddata = async () => {
            try {
              const duration = video.duration;
              const time1 = Math.random() * (duration / 3);
              const time2 = duration / 3 + Math.random() * (duration / 3);
              const time3 = (2 * duration) / 3 + Math.random() * (duration / 3);

              const blob1 = await captureFrame(video, time1);
              const blob2 = await captureFrame(video, time2);
              const blob3 = await captureFrame(video, time3);

              const formData1 = new FormData();
              formData1.append("image", blob1, "media.jpeg");

              const formData2 = new FormData();
              formData2.append("image", blob2, "media.jpeg");

              const formData3 = new FormData();
              formData3.append("image", blob3, "media.jpeg");

              const [predictResponse1, predictResponse2, predictResponse3] =
                await Promise.all([
                  fetch(predictApiUrl, { method: "POST", body: formData1 }),
                  fetch(predictApiUrl, { method: "POST", body: formData2 }),
                  fetch(predictApiUrl, { method: "POST", body: formData3 }),
                ]);

              if (
                !predictResponse1.ok ||
                !predictResponse2.ok ||
                !predictResponse3.ok
              ) {
                throw new Error(`Prediction failed`);
              }

              const data1 = await predictResponse1.json();
              const data2 = await predictResponse2.json();
              const data3 = await predictResponse3.json();

              const tags1 = data1.tags
                ? data1.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag)
                : [];
              const tags2 = data2.tags
                ? data2.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag)
                : [];
              const tags3 = data3.tags
                ? data3.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag)
                : [];

              const allTags = [...tags1, ...tags2, ...tags3];
              const uniqueTags = [...new Set(allTags)];

              onTagsPredicted(uniqueTags);
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          video.onerror = (err) => {
            reject(new Error("Failed to load video for frame capture."));
          };
        });
      }
    } catch (error) {
      console.error("Failed to predict tags:", error);
    } finally {
      setIsPredicting(false);
    }
  };

  return { isPredicting, predictTags };
};
