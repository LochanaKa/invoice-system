// frontend/src/config.js
// Shared frontend configuration values.
// Use Vite env variables when available, otherwise fall back to localhost.

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
