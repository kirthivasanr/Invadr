/**
 * Haversine formula – returns the distance in kilometres between two
 * GPS coordinate pairs.
 */
export function haversineDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns true if `dateStr` is within `days` days of now.
 */
export function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr).getTime();
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return now - date <= windowMs;
}

/**
 * Simple UUID v4 generator (no external dependency).
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format a timestamp as a readable local date/time string.
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
