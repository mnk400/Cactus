import React from "react";

function LoadingMessage({ message = "Loading media files..." }) {
  return (
    <div className="h-full w-full flex justify-center items-center text-gray-500 text-base text-center p-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse z-50">
      {message}
    </div>
  );
}

export default LoadingMessage;
