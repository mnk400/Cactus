import { forwardRef } from "react";

// Controls used inside the sheet. Each one is a capsule painted by a finish
// class from index.css (well = sunken, pill = raised, thumb = selected
// segment), so switching Soft/Matte restyles them all.

export const FIELD =
  "well h-9 min-w-0 rounded-full px-3.5 text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-white/25";

export const PanelSection = forwardRef(function PanelSection(
  { title, children, className = "" },
  ref,
) {
  return (
    <section ref={ref} className={`space-y-2 ${className}`}>
      {title && <h3 className="m-0 px-1 text-xs text-white/45">{title}</h3>}
      {children}
    </section>
  );
});

export function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`well grid h-8 rounded-full p-0.5 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-w-0 truncate rounded-full px-2 font-medium ${
              active ? "thumb" : "text-white/50 hover:text-white/80"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "pill-on",
  secondary: "pill text-gray-100",
  ghost: "text-white/55 hover:text-white",
  dangerGhost: "text-red-300/80 hover:text-red-300",
};

export function PanelButton({
  children,
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`h-9 shrink-0 rounded-full px-3.5 font-medium transition-transform duration-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const CHIP_TONES = {
  pill: "pill text-gray-100",
  on: "pill-on",
  add: "pill-add",
  not: "well text-white/45 line-through",
};

// A tag as a capsule. `tone` is its state; `color` (the tag's own color)
// shows as a small dot so tags stay recognizable without breaking the finish.
export function Chip({
  children,
  tone = "pill",
  color,
  title,
  onClick,
  onRemove,
  removeLabel,
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 max-w-[16rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium ${
        onRemove ? "pr-1.5" : ""
      } ${onClick ? "transition-transform duration-100 active:scale-95" : ""} ${CHIP_TONES[tone]}`}
    >
      {color && (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="min-w-0 truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
          className="relative flex h-5 w-5 items-center justify-center rounded-full text-base leading-none opacity-60 before:absolute before:-inset-2 before:content-[''] hover:opacity-100"
        >
          ×
        </button>
      )}
    </Tag>
  );
}
