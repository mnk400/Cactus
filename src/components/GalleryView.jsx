import React, { useRef, useEffect } from "react";
import LazyImage from "./LazyImage";

function GalleryView({ mediaFiles, currentIndex, onSelectMedia }) {
  const galleryRef = useRef(null);

  useEffect(() => {
    if (galleryRef.current) {
      const selectedItem = galleryRef.current.children[currentIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentIndex, mediaFiles]);

  return (
    <div ref={galleryRef} className="gallery-view flex flex-wrap justify-center items-center pt-5 gap-4 overflow-y-auto h-full bg-black">
      {mediaFiles.map((file, index) => (
        <div
          key={file}
          className={`gallery-item sm:w-64 sm:h-80 w-40 h-56 flex-shrink-0 relative rounded-lg overflow-hidden cursor-pointer transform transition-transform duration-300 border-4 ${index === currentIndex ? "border-blue-500" : "border-transparent"}`}
          onClick={() => onSelectMedia(index)}
        >
          <LazyImage
            src={`/media?path=${encodeURIComponent(file)}`}
            alt={`media-${index}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export default GalleryView;
