import React from "react";

function Message({ message, variant = "loading" }) {
  if (variant === "error") {
    return (
      <div className="h-full w-full flex justify-center items-center">
        <div className="text-red-500 p-2.5 text-center bg-red-500 bg-opacity-10 rounded mt-2.5 max-w-md">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex justify-center items-center text-gray-500 text-base text-center p-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse z-50">
      {message}
    </div>
  );
}

export default Message;
