/**
 * Presence heartbeat + how long admin views treat a student as “live”.
 * Keep these aligned with `App.tsx` (interval) and dashboard cutoffs (window).
 */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/** Sliding lookback: must exceed one heartbeat interval (plus slack for clock/network). */
export const PRESENCE_LIVE_WINDOW_MS = PRESENCE_HEARTBEAT_INTERVAL_MS * 2 + 60_000;
