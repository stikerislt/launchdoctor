/**
 * Centralized app icon path with a cache-busting version.
 * Bump APP_ICON_VERSION whenever public/launch-doctor-icon.png is replaced so
 * browsers and the CDN fetch the new image instead of a stale cached copy.
 */
export const APP_ICON_VERSION = 3;
export const APP_ICON_SRC = `/launch-doctor-icon.png?v=${APP_ICON_VERSION}`;
