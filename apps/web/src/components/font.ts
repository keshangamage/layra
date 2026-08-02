/**
 * Bundled so troika never reaches for its remote font resolver.
 *
 * Without an explicit font it fetches four files from cdn.jsdelivr.net, which
 * means no labels offline or behind a strict CSP. Geist matches the UI and is
 * OFL licensed.
 */
export const LABEL_FONT = "/fonts/geist-latin.woff2";
