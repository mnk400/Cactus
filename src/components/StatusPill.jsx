import React, { memo } from "react";

const baseClass =
  "inline-flex h-8 max-w-[min(260px,72vw)] flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 ease-in-out";

const StatusPill = memo(function StatusPill({
  children,
  color = "#202020",
  title,
  onClick,
  onRemove,
  removeLabel,
  className = "",
}) {
  const content = (
    <>
      <span className="min-w-0 truncate">{children}</span>
      {onRemove && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="ml-1 flex h-5 w-5 items-center justify-center rounded-lg text-lg leading-none text-white transition-colors duration-150 hover:bg-white hover:bg-opacity-20 hover:text-gray-200 focus:outline-none"
          aria-label={removeLabel}
        >
          ×
        </button>
      )}
    </>
  );

  const sharedProps = {
    title,
    className: `${baseClass} ${className}`,
    style: { backgroundColor: color },
  };

  if (onClick) {
    return (
      <button
        type="button"
        {...sharedProps}
        onClick={onClick}
        className={`${sharedProps.className} cursor-pointer hover:bg-opacity-90 active:scale-95`}
      >
        {content}
      </button>
    );
  }

  return <span {...sharedProps}>{content}</span>;
});

export default StatusPill;
