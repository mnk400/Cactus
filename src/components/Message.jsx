// Loading and error states, centered on the stage.
function Message({ message, variant = "loading" }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-[13px] ${
        variant === "error" ? "text-red-300" : "animate-pulse text-white/45"
      }`}
    >
      <p className="m-0 max-w-xs">{message}</p>
    </div>
  );
}

export default Message;
