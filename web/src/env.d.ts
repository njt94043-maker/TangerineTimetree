/// <reference types="vite/client" />

// Injected by vite.config.ts `define` — the real package.json version (s258).
declare const __APP_VERSION__: string;

// Injected by vite.config.ts `define` — Vercel's VERCEL_ENV at build time
// ('production' | 'preview' | 'development'), 'development' when unset (F0).
declare const __DEPLOY_ENV__: string;
