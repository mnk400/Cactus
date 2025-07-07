import React, { useState, useEffect } from "react";

function DebugInfo({ show = false }) {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    innerHeight: 0,
    outerHeight: 0,
    orientation: "",
    userAgent: "",
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        innerHeight: window.innerHeight,
        outerHeight: window.outerHeight,
        orientation: window.screen?.orientation?.type || "unknown",
        userAgent: navigator.userAgent.includes("iPhone")
          ? "iPhone"
          : navigator.userAgent.includes("iPad")
            ? "iPad"
            : navigator.userAgent.includes("Android")
              ? "Android"
              : "Desktop",
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-4 left-4 bg-black bg-opacity-80 text-white text-xs p-2 rounded z-50 font-mono">
      <div>W: {viewport.width}px</div>
      <div>H: {viewport.height}px</div>
      <div>Inner: {viewport.innerHeight}px</div>
      <div>Outer: {viewport.outerHeight}px</div>
      <div>Orient: {viewport.orientation}</div>
      <div>Device: {viewport.userAgent}</div>
      <div>VH: {document.documentElement.style.getPropertyValue("--vh")}</div>
    </div>
  );
}

export default DebugInfo;
