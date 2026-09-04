import { forwardRef, useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useIsDesktop } from "../../hooks/useIsDesktop";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function ResponsivePanel({
  isOpen,
  onClose,
  onBack,
  title,
  children,
  initialFocusRef,
  contentClassName = "",
}) {
  const isDesktop = useIsDesktop();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const returnFocusTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ||
        panelRef.current?.querySelector("[data-panel-autofocus]") ||
        panelRef.current;
      target?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() =>
        returnFocusTo?.focus({ preventScroll: true }),
      );
    };
  }, [initialFocusRef, isOpen, onClose]);

  const panelMotion = isDesktop
    ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };

  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 320, damping: 34, mass: 0.7 };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={onClose}
          />
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`absolute flex flex-col overflow-hidden border-white/10 bg-black-shades-900 text-gray-200 shadow-2xl outline-none ${
              isDesktop
                ? "inset-y-0 right-0 w-[min(450px,calc(100vw-4rem))] border-l"
                : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl border-t"
            }`}
            initial={reduceMotion ? false : panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={motionTransition}
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3 safe-area-top">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                  aria-label="Back"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              )}
              <h2
                id={titleId}
                className="m-0 min-w-0 flex-1 text-lg font-semibold text-white"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-black-shades-700 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-white/15 active:scale-95"
                aria-label={`Close ${title.toLowerCase()}`}
              >
                Close
              </button>
            </header>
            <div
              className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 safe-area-bottom ${contentClassName}`}
            >
              {children}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

export const PanelSection = forwardRef(function PanelSection(
  { title, description, actions, children, className = "" },
  ref,
) {
  return (
    <section
      ref={ref}
      className={`rounded-2xl border border-white/5 bg-white/[0.035] p-4 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 text-sm leading-5 text-gray-500">
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
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
      className={`grid gap-1 rounded-xl bg-black/35 p-1 ${className}`}
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
            className={`min-w-0 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors active:scale-[0.98] ${
              active
                ? "bg-white/20 text-white shadow-sm"
                : "text-gray-400 hover:bg-white/10 hover:text-gray-200"
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
  primary: "bg-white/20 text-white hover:bg-white/30",
  secondary: "bg-black/35 text-gray-200 hover:bg-white/10",
  danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
  ghost: "text-gray-300 hover:bg-white/10 hover:text-white",
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
      className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
