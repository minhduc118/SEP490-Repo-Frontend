// ─── TeamSpec — URL helpers (app is mounted at /teamspec/*) ──────────────────
export const BASE = '/teamspec';

export const teamspecPath = {
  change: (name: string) => `${BASE}/changes/${encodeURIComponent(name)}`,
  spec: (capability: string) => `${BASE}/specs/${encodeURIComponent(capability)}`,
};
