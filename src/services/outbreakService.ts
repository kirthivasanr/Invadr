/**
 * outbreakService.ts
 * Detects outbreak clusters from a list of invasive reports.
 *
 * Rules (configurable via OUTBREAK_CONFIG):
 *  • 5+ high-confidence invasive reports
 *  • Within a 5 km radius
 *  • Within 7 days
 */
import { InvasiveReport, OutbreakZone } from '../types';
import { OUTBREAK_CONFIG } from '../constants';
import { haversineDistanceKm, isWithinDays, generateId } from '../utils/geo';

function isHighRisk(report: InvasiveReport): boolean {
  return (
    report.prediction !== null &&
    report.prediction.invasive_risk_level === 'high' &&
    report.prediction.confidence_score >= OUTBREAK_CONFIG.MIN_CONFIDENCE
  );
}

/**
 * Groups reports into clusters using a simple sweep algorithm:
 *  - For each unvisited high-risk report within the time window,
 *    collect all other qualifying reports within RADIUS_KM.
 *  - If the cluster size >= MIN_REPORTS, record an OutbreakZone.
 */
export function detectOutbreaks(reports: InvasiveReport[]): OutbreakZone[] {
  // Filter to qualifying candidates
  const candidates = reports.filter(
    (r) => isHighRisk(r) && isWithinDays(r.timestamp, OUTBREAK_CONFIG.TIME_WINDOW_DAYS),
  );

  const zones: OutbreakZone[] = [];
  const used = new Set<string>();

  for (const anchor of candidates) {
    if (used.has(anchor.id)) continue;

    // Find all reports within radius of this anchor
    const cluster = candidates.filter(
      (r) =>
        haversineDistanceKm(
          anchor.coordinates.latitude,
          anchor.coordinates.longitude,
          r.coordinates.latitude,
          r.coordinates.longitude,
        ) <= OUTBREAK_CONFIG.RADIUS_KM,
    );

    if (cluster.length >= OUTBREAK_CONFIG.MIN_REPORTS) {
      // Compute centroid
      const avgLat =
        cluster.reduce((s, r) => s + r.coordinates.latitude, 0) / cluster.length;
      const avgLon =
        cluster.reduce((s, r) => s + r.coordinates.longitude, 0) / cluster.length;

      zones.push({
        id: generateId(),
        centerCoordinates: { latitude: avgLat, longitude: avgLon },
        radiusKm: OUTBREAK_CONFIG.RADIUS_KM,
        reportCount: cluster.length,
        detectedAt: new Date().toISOString(),
        reports: cluster,
      });

      // Mark all cluster members to avoid re-clustering
      cluster.forEach((r) => used.add(r.id));
    }
  }

  return zones;
}
