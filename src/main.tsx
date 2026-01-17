import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Initialize Sentry for production error monitoring
// DSN is public by design - only allows sending errors to this project
Sentry.init({
  dsn: "https://efa852f5b82606e7fbcbc25107505992@o4509418613506048.ingest.us.sentry.io/4510724666163200",
  sendDefaultPii: true,
  enabled: import.meta.env.PROD, // Only track errors in production builds
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
