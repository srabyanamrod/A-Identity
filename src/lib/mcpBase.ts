/**
 * Base URL for the A-Identity MCP HTTP backend, resolved per environment.
 *
 * Production: '' (same-origin). The deployed app calls /health, /api/*, /mcp on its
 * OWN domain, and vercel.json proxies those to the backend as first-party requests.
 * This dodges ad blockers / privacy lists that block *.onrender.com and would
 * otherwise show a false "backend offline". The production backend URL now lives in
 * vercel.json (change it there), so VITE_MCP_URL is a dev-only override.
 *
 * Dev: VITE_MCP_URL if set, else the local backend on :3399.
 */
export const MCP_BASE = import.meta.env.PROD
  ? ''
  : ((import.meta.env.VITE_MCP_URL as string | undefined) ?? 'http://localhost:3399')
