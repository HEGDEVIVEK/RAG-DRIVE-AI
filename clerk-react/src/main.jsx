import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  document.body.innerHTML = "<pre>Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local</pre>";
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error('Root element with id="root" not found');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);