import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LoginPage from "./components/LoginPage.jsx";
import Message from "./components/Message.jsx";

import "@fontsource-variable/figtree";
import "./index.css";
import { initPrefs } from "./utils/prefs";
import { MediaProvider } from "./context/MediaContext";

initPrefs();
// iOS only applies :active styles on touch when a touch listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });
// data-keys on <html> while the keyboard is in use: from a key press (not
// typing in a field, not a shortcut) until the next tap or click. Marks
// that only help find your place with the keys show only then.
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest?.("input, textarea, select");
  if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
    document.documentElement.dataset.keys = "";
  }
});
document.addEventListener("pointerdown", () => {
  delete document.documentElement.dataset.keys;
});

function Root() {
  const [authState, setAuthState] = useState({
    checking: true,
    authRequired: false,
    authenticated: false,
    error: null,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/status");
        const data = await response.json();
        setAuthState({
          checking: false,
          authRequired: data.authRequired,
          authenticated: data.authenticated,
          error: null,
        });
      } catch {
        setAuthState({
          checking: false,
          authRequired: false,
          authenticated: false,
          error: "Failed to connect to server",
        });
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setAuthState((prev) => ({ ...prev, authenticated: true }));
  }, []);

  if (authState.checking) {
    return (
      <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
        <Message message="loading…" />
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
        <Message message={authState.error} variant="error" />
      </div>
    );
  }

  if (authState.authRequired && !authState.authenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Only mount MediaProvider after authentication is confirmed
  return (
    <MediaProvider>
      <App />
    </MediaProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
