import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LoginPage from "./components/LoginPage.jsx";
import LoadingMessage from "./components/LoadingMessage.jsx";
import ErrorMessage from "./components/ErrorMessage.jsx";
import "./index.css";
import { MediaProvider } from "./context/MediaContext";

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
      } catch (err) {
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
        <LoadingMessage message="Loading..." />
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="container flex flex-col h-screen w-full max-w-full shadow-2xl overflow-hidden bg-black text-gray-200">
        <ErrorMessage message={authState.error} />
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
