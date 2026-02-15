import { useState, useEffect, memo } from "react";
import { useCurrentMedia } from "../context/MediaContext";

function FieldRenderer({ field }) {
  switch (field.type) {
    case "tags":
      return (
        <div className="mb-2">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            {field.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {field.value.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-white bg-opacity-10 text-gray-200 rounded-lg text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      );

    case "rating": {
      const pct = Math.round(field.value);
      return (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">{field.label}</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-black-shades-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-200">{pct}%</span>
          </div>
        </div>
      );
    }

    case "badge":
      return (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">{field.label}</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              field.color === "green"
                ? "bg-green-900 text-green-300"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {field.value}
          </span>
        </div>
      );

    case "link":
      return (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">{field.label}</span>
          <a
            href={field.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            {field.linkLabel || field.value}
          </a>
        </div>
      );

    case "text":
    default:
      return (
        <div className="flex justify-between items-start mb-1.5 gap-4">
          <span className="text-xs text-gray-400 shrink-0">{field.label}</span>
          <span className="text-xs text-gray-200 text-right break-all">
            {field.value}
          </span>
        </div>
      );
  }
}

const MediaInfo = memo(function MediaInfo() {
  const { currentMediaFile } = useCurrentMedia();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded || !currentMediaFile?.file_hash) {
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/media/${encodeURIComponent(currentMediaFile.file_hash)}/info`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch media info");
        return res.json();
      })
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [currentMediaFile?.file_hash, isExpanded]);

  return (
    <div className="media-info-section mb-4 p-3 bg-black bg-opacity-40 rounded-2xl">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between text-left"
      >
        <h4 className="text-base font-medium text-white m-0">Media Info</h4>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3">
          {loading && (
            <div className="text-center py-4 text-gray-400 text-sm">
              Loading...
            </div>
          )}

          {error && (
            <div className="text-center py-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && !currentMediaFile && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No media selected
            </div>
          )}

          {info && !loading && (
            <div className="space-y-3">
              {info.sections.map((section, i) => (
                <div key={i} className="p-2.5 bg-black-shades-700 rounded-xl">
                  <h5 className="text-xs font-medium text-white uppercase tracking-wide mb-2">
                    {section.title}
                  </h5>
                  {section.fields.map((field, j) => (
                    <FieldRenderer key={j} field={field} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MediaInfo;
