import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { MediaProvider } from "./context/MediaContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MediaProvider>
      <App />
    </MediaProvider>
  </React.StrictMode>,
);
