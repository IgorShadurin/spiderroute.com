export type Locale = "en" | "ru";
export type Point = {
  id: string;
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  speed?: number;
};
export type Geometry = Point[][];
export type Annotation = {
  id: string;
  startId: string;
  endId: string;
  text: string;
  color: string;
  position?: { lat: number; lon: number };
  videoSeconds?: number;
  videoEndSeconds?: number;
};
export type Stats = {
  distance: number;
  points: number;
  segments: number;
  ascent: number | null;
};
export type RouteData = {
  id: string;
  title: string;
  youtubeUrl?: string | null;
  endpoints?: { startId: string; endId: string };
  geometry: Geometry;
  annotations: Annotation[];
  stats: Stats;
  revision: number;
  privacyStart: number;
  privacyEnd: number;
  privacyCenters?: { start: Point; end: Point };
  shared: boolean;
  shareToken?: string;
  updatedAt: string;
  favorite?: boolean;
};
export type PublicRoute = {
  title: string;
  youtubeUrl?: string | null;
  endpoints?: { startId: string; endId: string };
  geometry: Geometry;
  annotations: Annotation[];
  stats: Stats;
  revision: number;
  protected: boolean;
};
export type MapConfig = {
  provider: "osm-standard" | "self-hosted-vector";
  styleUrl?: string;
};
