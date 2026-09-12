"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapType, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Annotation, Geometry, MapConfig, Point } from "@/lib/types";
import { distance } from "@/lib/geo";
maplibregl.setWorkerUrl("/maplibre/6.9.0/maplibre-gl-worker.mjs");
export type MapMode = "view" | "select" | "move" | "insert" | "draw";
export default function RouteMap({
  geometry,
  annotations = [],
  selected,
  endSelected,
  mode = "view",
  onSelect,
  onCoordinate,
  fitKey = "",
  errorLabel = "Map background unavailable",
}: {
  geometry: Geometry;
  annotations?: Annotation[];
  selected?: string;
  endSelected?: string;
  mode?: MapMode;
  onSelect?: (id: string) => void;
  onCoordinate?: (lat: number, lon: number) => void;
  fitKey?: string;
  errorLabel?: string;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<MapType | null>(null),
    marker = useRef<Marker | null>(null),
    props = useRef({
      geometry,
      annotations,
      selected,
      endSelected,
      mode,
      onSelect,
      onCoordinate,
    });
  props.current = {
    geometry,
    annotations,
    selected,
    endSelected,
    mode,
    onSelect,
    onCoordinate,
  };
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const fit = () => {
    const m = map.current,
      g = props.current.geometry;
    if (!m || !g.flat().length) return;
    const b = new maplibregl.LngLatBounds();
    for (const s of g)
      for (const p of s) b.extend([p.lon, Math.max(-85, Math.min(85, p.lat))]);
    m.fitBounds(b, { padding: 65, maxZoom: 16, duration: 500 });
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/map-config")
      .then((r) => r.json())
      .then((cfg: MapConfig) => {
        if (cancelled || !container.current) return;
        const raster: StyleSpecification = {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        };
        const m = new maplibregl.Map({
          container: container.current,
          style:
            cfg.provider === "self-hosted-vector" && cfg.styleUrl
              ? cfg.styleUrl
              : raster,
          center: [10, 48],
          zoom: 3,
          attributionControl: { compact: false },
          maxZoom: 19,
        });
        map.current = m;
        m.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        m.on("error", () => setFailed(true));
        m.on("load", () => {
          setReady(true);
          fit();
        });
        m.on("click", (e) => {
          const p = props.current;
          if (p.mode === "draw" || p.mode === "insert") {
            p.onCoordinate?.(e.lngLat.lat, e.lngLat.lng);
            return;
          }
          if (p.mode === "view") return;
          let closest: Point | undefined,
            best = 32;
          for (const s of p.geometry)
            for (const v of s) {
              const screen = m.project([v.lon, v.lat]);
              const d = Math.hypot(screen.x - e.point.x, screen.y - e.point.y);
              if (d < best) {
                best = d;
                closest = v;
              }
            }
          if (closest) p.onSelect?.(closest.id);
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const features: any[] = [];
    for (const [i, s] of geometry.entries())
      if (s.length > 1)
        features.push({
          type: "Feature",
          properties: { color: "#ed704c", kind: "route" },
          geometry: {
            type: "LineString",
            coordinates: s.map((p) => [p.lon, p.lat]),
          },
        });
    for (const a of annotations) {
      const s = geometry.find((s) => s.some((p) => p.id === a.startId));
      if (!s) continue;
      const ai = s.findIndex((p) => p.id === a.startId),
        bi = s.findIndex((p) => p.id === a.endId);
      if (bi < 0) continue;
      const section = s.slice(Math.min(ai, bi), Math.max(ai, bi) + 1);
      features.push({
        type: "Feature",
        properties: {
          color: a.color,
          kind: section.length === 1 ? "note" : "annotation",
        },
        geometry:
          section.length === 1
            ? { type: "Point", coordinates: [section[0].lon, section[0].lat] }
            : {
                type: "LineString",
                coordinates: section.map((p) => [p.lon, p.lat]),
              },
      });
    }
    if (selected && endSelected) {
      const s = geometry.find((s) => s.some((p) => p.id === selected)),
        ai = s?.findIndex((p) => p.id === selected) ?? -1,
        bi = s?.findIndex((p) => p.id === endSelected) ?? -1;
      if (s && ai >= 0 && bi >= 0)
        features.push({
          type: "Feature",
          properties: { color: "#2563eb", kind: "selection" },
          geometry: {
            type: "LineString",
            coordinates: s
              .slice(Math.min(ai, bi), Math.max(ai, bi) + 1)
              .map((p) => [p.lon, p.lat]),
          },
        });
    }
    const data: any = { type: "FeatureCollection", features };
    const src = m.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      m.addSource("route", { type: "geojson", data });
      m.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#fff", "line-width": 9 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": ["get", "color"], "line-width": 5 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      m.addLayer({
        id: "route-notes",
        type: "circle",
        source: "route",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 7,
          "circle-stroke-color": "white",
          "circle-stroke-width": 3,
        },
      });
    }
    marker.current?.remove();
    const p = geometry.flat().find((p) => p.id === selected);
    if (p) {
      const el = document.createElement("div");
      el.className = "selected-marker";
      el.setAttribute("aria-label", "Selected route point");
      marker.current = new maplibregl.Marker({
        element: el,
        draggable: mode === "move",
      })
        .setLngLat([p.lon, p.lat])
        .addTo(m);
      marker.current!.on("dragend", () => {
        const ll = marker.current!.getLngLat();
        props.current.onCoordinate?.(ll.lat, ll.lng);
      });
    }
    m.getCanvas().style.cursor = ["draw", "insert"].includes(mode)
      ? "crosshair"
      : mode === "view"
        ? "grab"
        : "pointer";
  }, [ready, geometry, annotations, selected, endSelected, mode]);
  useEffect(() => {
    if (ready) fit();
  }, [ready, fitKey]);
  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" />
      {failed && (
        <div className="map-error" role="status">
          {errorLabel}
        </div>
      )}
      <button
        className="fit-map"
        title="Fit route"
        aria-label="Fit route"
        onClick={fit}
      >
        ⊙
      </button>
    </div>
  );
}
