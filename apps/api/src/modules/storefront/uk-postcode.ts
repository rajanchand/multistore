/**
 * Lightweight UK postcode helpers for nearest-branch matching (no external geocoder).
 */

/** Compact form without spaces, uppercase. */
export function compactUkPostcode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Format G11AA → G1 1AA when possible. */
export function formatUkPostcode(compact: string): string {
  if (compact.length >= 5) {
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }
  return compact;
}

/** Outward code (e.g. G1, EH2, W1D). */
export function outwardCode(compact: string): string {
  if (compact.length >= 5) return compact.slice(0, -3);
  return compact;
}

/**
 * Approximate centroids for common UK outward / area codes used in seed data.
 * Lookup tries exact outward, then letter+digit stem, then letter-only area.
 */
const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  G: { lat: 55.8642, lng: -4.2518 },
  G1: { lat: 55.8609, lng: -4.2514 },
  G2: { lat: 55.8615, lng: -4.258 },
  G3: { lat: 55.866, lng: -4.28 },
  G4: { lat: 55.8665, lng: -4.245 },
  G5: { lat: 55.848, lng: -4.255 },
  EH: { lat: 55.9533, lng: -3.1883 },
  EH1: { lat: 55.9505, lng: -3.187 },
  EH2: { lat: 55.953, lng: -3.195 },
  EH3: { lat: 55.948, lng: -3.205 },
  EH6: { lat: 55.974, lng: -3.17 },
  PA: { lat: 55.8456, lng: -4.423 },
  PA1: { lat: 55.8455, lng: -4.4237 },
  PA2: { lat: 55.83, lng: -4.43 },
  M: { lat: 53.4808, lng: -2.2426 },
  M1: { lat: 53.479, lng: -2.241 },
  M2: { lat: 53.4805, lng: -2.244 },
  M3: { lat: 53.482, lng: -2.25 },
  M14: { lat: 53.455, lng: -2.22 },
  W1: { lat: 51.5145, lng: -0.1447 },
  W1D: { lat: 51.5154, lng: -0.1411 },
  W1B: { lat: 51.514, lng: -0.144 },
  NW: { lat: 51.5342, lng: -0.1385 },
  NW1: { lat: 51.53, lng: -0.14 },
  SW: { lat: 51.495, lng: -0.145 },
  E: { lat: 51.52, lng: -0.05 },
  EC: { lat: 51.5155, lng: -0.092 },
  N: { lat: 51.55, lng: -0.1 },
  SE: { lat: 51.49, lng: -0.08 },
};

export function approximateLatLngFromPostcode(compact: string): { lat: number; lng: number } | null {
  const outward = outwardCode(compact);
  const candidates = [
    outward,
    outward.replace(/\d+$/, ''), // W1D → W1
    outward.match(/^[A-Z]+/)?.[0] ?? '',
  ].filter(Boolean);

  for (const key of candidates) {
    const hit = AREA_CENTROIDS[key];
    if (hit) return hit;
  }
  return null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Shared outward-area letter prefix for soft matching (G, EH, PA, M, W…). */
export function areaPrefix(outward: string): string {
  const m = outward.match(/^([A-Z]+)/);
  return m?.[1] ?? outward;
}
