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
  geometry: Geometry;
  annotations: Annotation[];
  stats: Stats;
  revision: number;
  privacyStart: number;
  privacyEnd: number;
  shared: boolean;
  shareToken?: string;
  updatedAt: string;
  favorite?: boolean;
};
export type PublicRoute = {
  title: string;
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
