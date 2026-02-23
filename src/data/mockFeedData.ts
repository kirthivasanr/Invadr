/**
 * mockFeedData.ts
 * Static mock data for the Photo Feed.
 * Will be replaced by real ML model output later.
 */

export type ThreatLevel = 'critical' | 'high' | 'moderate' | 'low' | 'none';

export interface ProcessedReport {
  id: string;
  /** Image URI — using picsum placeholder images for now */
  imageUri: string;
  /** Optional audio recording URI */
  audioUri?: string;
  audioDuration?: number;
  /** Species identified by ML */
  speciesName: string;
  scientificName: string;
  /** Is the species invasive? */
  isInvasive: boolean;
  /** Threat level assigned by ML */
  threatLevel: ThreatLevel;
  /** ML confidence 0-1 */
  confidence: number;
  /** Brief ML-generated description */
  description: string;
  /** Recommended actions */
  recommendations: string[];
  /** GPS */
  latitude: number;
  longitude: number;
  locationName: string;
  /** Reporter info */
  reportedBy: string;
  reporterEmail: string;
  /** ISO timestamp */
  timestamp: string;
  notes: string;
  /** Has audio analysis been done */
  audioAnalysisComplete: boolean;
  audioAnalysisSummary?: string;
}

export const MOCK_REPORTS: ProcessedReport[] = [
  {
    id: 'rpt-001',
    imageUri: 'https://picsum.photos/seed/kudzu/600/400',
    speciesName: 'Japanese Kudzu',
    scientificName: 'Pueraria montana',
    isInvasive: true,
    threatLevel: 'critical',
    confidence: 0.94,
    description:
      'Highly aggressive vine that smothers native vegetation. Grows up to 30 cm per day in optimal conditions. Originally introduced for erosion control but has become one of the most destructive invasive plants in North America.',
    recommendations: [
      'Immediate containment required — do NOT let it spread further',
      'Contact local forestry department for herbicide treatment',
      'Manual removal ineffective for large infestations',
      'Monitor adjacent areas for new growth within 500m radius',
    ],
    latitude: 33.749,
    longitude: -84.388,
    locationName: 'Piedmont Park, Atlanta, GA',
    reportedBy: 'Sarah Chen',
    reporterEmail: 'sarah.chen@invadr.io',
    timestamp: new Date(Date.now() - 2 * 3600_000).toISOString(),
    notes: 'Vine has covered approximately 200 sq ft of native trees along the trail.',
    audioAnalysisComplete: false,
  },
  {
    id: 'rpt-002',
    imageUri: 'https://picsum.photos/seed/boar/600/400',
    audioUri: 'mock://audio/boar-recording.m4a',
    audioDuration: 45,
    speciesName: 'Wild Boar',
    scientificName: 'Sus scrofa',
    isInvasive: true,
    threatLevel: 'high',
    confidence: 0.87,
    description:
      'Feral hogs cause extensive damage to crops, native habitats, and water quality. They are aggressive and can be dangerous to humans. Population estimated at 6+ million in the US alone.',
    recommendations: [
      'Do NOT approach — wild boars can be aggressive',
      'Report to state wildlife agency immediately',
      'Warn nearby residents and hikers',
      'Set up trail cameras to monitor movement patterns',
    ],
    latitude: 30.267,
    longitude: -97.743,
    locationName: 'Barton Creek Greenbelt, Austin, TX',
    reportedBy: 'Marcus Williams',
    reporterEmail: 'marcus.w@invadr.io',
    timestamp: new Date(Date.now() - 5 * 3600_000).toISOString(),
    notes: 'Heard grunting sounds near the creek. Found fresh rooting damage and tracks.',
    audioAnalysisComplete: true,
    audioAnalysisSummary: 'Audio confirms presence of 2-3 feral hogs. Grunting and rooting sounds detected at 12s and 34s marks.',
  },
  {
    id: 'rpt-003',
    imageUri: 'https://picsum.photos/seed/carp/600/400',
    speciesName: 'Asian Silver Carp',
    scientificName: 'Hypophthalmichthys molitrix',
    isInvasive: true,
    threatLevel: 'high',
    confidence: 0.91,
    description:
      'Highly invasive fish that outcompetes native species for food. Known for leaping out of water when startled by boat motors, posing a safety hazard. Threatens the Great Lakes ecosystem.',
    recommendations: [
      'Report to local DNR (Department of Natural Resources)',
      'Do not release back into water if captured',
      'Note exact location for barrier placement assessment',
      'Photograph any additional specimens',
    ],
    latitude: 38.627,
    longitude: -90.199,
    locationName: 'Mississippi River, St. Louis, MO',
    reportedBy: 'James Rivera',
    reporterEmail: 'j.rivera@invadr.io',
    timestamp: new Date(Date.now() - 12 * 3600_000).toISOString(),
    notes: 'Multiple fish observed jumping near the boat ramp. Estimated 15-20 individuals.',
    audioAnalysisComplete: false,
  },
  {
    id: 'rpt-004',
    imageUri: 'https://picsum.photos/seed/monarch/600/400',
    speciesName: 'Monarch Butterfly',
    scientificName: 'Danaus plexippus',
    isInvasive: false,
    threatLevel: 'none',
    confidence: 0.96,
    description:
      'Native migratory butterfly, currently classified as endangered. Not invasive — this is a protected species. Their population has declined by over 80% in the last two decades.',
    recommendations: [
      'This is a NATIVE species — do not disturb',
      'Plant milkweed to support their habitat',
      'Report sighting to Monarch Watch for tracking',
      'Consider creating a pollinator garden nearby',
    ],
    latitude: 36.778,
    longitude: -119.418,
    locationName: 'Pacific Grove, CA',
    reportedBy: 'Emily Nakamura',
    reporterEmail: 'emily.n@invadr.io',
    timestamp: new Date(Date.now() - 1 * 86400_000).toISOString(),
    notes: 'Beautiful cluster of monarchs resting in eucalyptus grove during migration.',
    audioAnalysisComplete: false,
  },
  {
    id: 'rpt-005',
    imageUri: 'https://picsum.photos/seed/python/600/400',
    audioUri: 'mock://audio/python-hiss.m4a',
    audioDuration: 18,
    speciesName: 'Burmese Python',
    scientificName: 'Python bivittatus',
    isInvasive: true,
    threatLevel: 'critical',
    confidence: 0.89,
    description:
      'One of the most damaging invasive species in the Florida Everglades. Can grow over 20 feet long. Has decimated native mammal populations including rabbits, foxes, and deer.',
    recommendations: [
      'DANGER: Do not attempt to capture — contact FWC immediately',
      'Keep safe distance (minimum 15 feet)',
      'Call Florida Fish and Wildlife: (888) 404-3922',
      'Mark location with GPS for removal team',
    ],
    latitude: 25.761,
    longitude: -80.191,
    locationName: 'Everglades National Park, FL',
    reportedBy: 'David Lopez',
    reporterEmail: 'david.l@invadr.io',
    timestamp: new Date(Date.now() - 30 * 60_000).toISOString(),
    notes: 'Large python (~12ft) spotted crossing the trail near the boardwalk. Appeared to have recently eaten.',
    audioAnalysisComplete: true,
    audioAnalysisSummary: 'Hissing sounds detected. Audio pattern consistent with large constrictor species.',
  },
  {
    id: 'rpt-006',
    imageUri: 'https://picsum.photos/seed/lionfish/600/400',
    speciesName: 'Red Lionfish',
    scientificName: 'Pterois volitans',
    isInvasive: true,
    threatLevel: 'moderate',
    confidence: 0.93,
    description:
      'Venomous reef fish native to Indo-Pacific. No natural predators in Atlantic waters. A single female can release up to 2 million eggs per year, devastating native reef fish populations.',
    recommendations: [
      'Warning: Venomous spines — do not touch',
      'Report to local marine conservation office',
      'If qualified, participate in lionfish removal programs',
      'Note depth and reef location for dive team',
    ],
    latitude: 24.555,
    longitude: -81.783,
    locationName: 'Key West Reef, FL',
    reportedBy: 'Ana Torres',
    reporterEmail: 'ana.t@invadr.io',
    timestamp: new Date(Date.now() - 2 * 86400_000).toISOString(),
    notes: 'Spotted during snorkeling at 15ft depth. At least 3 individuals on the same coral head.',
    audioAnalysisComplete: false,
  },
  {
    id: 'rpt-007',
    imageUri: 'https://picsum.photos/seed/deer/600/400',
    speciesName: 'White-tailed Deer',
    scientificName: 'Odocoileus virginianus',
    isInvasive: false,
    threatLevel: 'low',
    confidence: 0.98,
    description:
      'Native species across North America. While not invasive, overabundant deer populations can cause significant ecological damage through overgrazing.',
    recommendations: [
      'Native species — no immediate action needed',
      'If population seems excessive, report to wildlife management',
      'Avoid feeding — it disrupts natural behavior',
      'Drive carefully in the area, especially at dusk/dawn',
    ],
    latitude: 40.758,
    longitude: -73.985,
    locationName: 'Harriman State Park, NY',
    reportedBy: 'Mike Johnson',
    reporterEmail: 'mike.j@invadr.io',
    timestamp: new Date(Date.now() - 3 * 86400_000).toISOString(),
    notes: 'Small herd of 5 deer grazing near the parking area. Appeared healthy.',
    audioAnalysisComplete: false,
  },
  {
    id: 'rpt-008',
    imageUri: 'https://picsum.photos/seed/fire-ant/600/400',
    audioUri: 'mock://audio/ant-colony.m4a',
    audioDuration: 30,
    speciesName: 'Red Imported Fire Ant',
    scientificName: 'Solenopsis invicta',
    isInvasive: true,
    threatLevel: 'high',
    confidence: 0.85,
    description:
      'Aggressive invasive ant from South America. Delivers painful venomous stings that can cause allergic reactions. Damages crops, electrical equipment, and displaces native ant species.',
    recommendations: [
      'Do NOT disturb the mound — can trigger mass attack',
      'Call pest control for professional treatment',
      'Keep children and pets away from the area',
      'Mark mound locations for county pest management',
    ],
    latitude: 32.776,
    longitude: -96.797,
    locationName: 'White Rock Lake, Dallas, TX',
    reportedBy: 'Lisa Park',
    reporterEmail: 'lisa.p@invadr.io',
    timestamp: new Date(Date.now() - 6 * 3600_000).toISOString(),
    notes: 'Multiple fire ant mounds found along the jogging trail. One jogger reported being stung.',
    audioAnalysisComplete: true,
    audioAnalysisSummary: 'Ambient sounds near ant colony captured. Rustling patterns indicate large active colony.',
  },
];

/** Threat-level display config */
export const THREAT_CONFIG: Record<ThreatLevel, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: 'CRITICAL', color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' },
  high:     { label: 'HIGH',     color: '#EA580C', bg: '#FFF7ED', icon: 'warning' },
  moderate: { label: 'MODERATE', color: '#D97706', bg: '#FFF8E1', icon: 'information-circle' },
  low:      { label: 'LOW',      color: '#16A34A', bg: '#ECFDF5', icon: 'checkmark-circle' },
  none:     { label: 'SAFE',     color: '#0EA5E9', bg: '#E0F2FE', icon: 'shield-checkmark' },
};
