"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Route } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapType, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Annotation, Geometry, MapConfig, Point } from "@/lib/types";
import { privacyCircle } from "@/lib/geo";
maplibregl.setWorkerUrl("/maplibre/6.9.0/maplibre-gl-worker.mjs");
export type MapMode = "view" | "select" | "move" | "insert" | "draw";
export default function RouteMap({
  fullscreenView = false,
  onExitFullscreen,
  geometry,
  annotations = [],
  segmentColors,
  privacyPreview,
  focusAnnotation,
  selected,
  endSelected,
  mode = "view",
  onSelect,
  onCoordinate,
  fitKey = "",
  errorLabel = "Map background unavailable",
  locale = "en",
}: {
  fullscreenView?: boolean;
  onExitFullscreen?: () => void;
  geometry: Geometry;
  privacyPreview?: {
    original: Geometry;
    start: Point;
    end: Point;
    startRadius: number;
    endRadius: number;
  };
  annotations?: Annotation[];
  segmentColors?: string[];
  focusAnnotation?: { id: string };
  selected?: string;
  endSelected?: string;
  mode?: MapMode;
  onSelect?: (id: string) => void;
  onCoordinate?: (lat: number, lon: number) => void;
  fitKey?: string;
  errorLabel?: string;
  locale?: "en" | "ru";
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    map = useRef<MapType | null>(null),
    marker = useRef<Marker | null>(null),
    props = useRef({
      privacyPreview,
      geometry,
      annotations,
      selected,
      endSelected,
      mode,
      onSelect,
      onCoordinate,
    });
  props.current = {
    privacyPreview,
    geometry,
    annotations,
    selected,
    endSelected,
    mode,
    onSelect,
    onCoordinate,
  };
  const noteMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const fit = () => {
    const m = map.current,
      g = props.current.privacyPreview?.original ?? props.current.geometry;
    if (!m || !g.flat().length) return;
    const b = new maplibregl.LngLatBounds();
    for (const s of g)
      for (const p of s) b.extend([p.lon, Math.max(-85, Math.min(85, p.lat))]);
    const privacy = props.current.privacyPreview;
    if (privacy)
      for (const [c, r] of [
        [privacy.start, privacy.startRadius],
        [privacy.end, privacy.endRadius],
      ] as [Point, number][])
        for (const coordinate of privacyCircle(c, r))
          b.extend(coordinate as [number, number]);
    m.fitBounds(b, { padding: 65, maxZoom: 16, duration: 500 });
  };
  useEffect(() => {
    let cancelled = false;
    setReady(false);
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
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
            },
          ],
        };
        const m = new maplibregl.Map({
          container: container.current,
          locale:
            locale === "ru"
              ? {
                  "Map.Title": "Карта",
                  "NavigationControl.ZoomIn": "Приблизить",
                  "NavigationControl.ZoomOut": "Отдалить",
                  "AttributionControl.ToggleAttribution": "Источники карты",
                }
              : undefined,
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
  }, [locale]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const features: any[] = [];
    if (privacyPreview) {
      for (const segment of privacyPreview.original)
        if (segment.length > 1)
          features.push({
            type: "Feature",
            properties: { kind: "original" },
            geometry: {
              type: "LineString",
              coordinates: segment.map((p) => [p.lon, p.lat]),
            },
          });
      for (const [center, radius, color] of [
        [privacyPreview.start, privacyPreview.startRadius, "#2563eb"],
        [privacyPreview.end, privacyPreview.endRadius, "#9333ea"],
      ] as [Point, number, string][]) {
        const ring = privacyCircle(center, radius);
        if (ring.length)
          features.push({
            type: "Feature",
            properties: { kind: "zone", color },
            geometry: { type: "Polygon", coordinates: [ring] },
          });
        features.push({
          type: "Feature",
          properties: { kind: "endpoint", color },
          geometry: { type: "Point", coordinates: [center.lon, center.lat] },
        });
      }
    }
    for (const [i, s] of geometry.entries())
      if (s.length > 1)
        features.push({
          type: "Feature",
          properties: { color: segmentColors?.[i] || "#d5ff39", kind: "route" },
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
        id: "privacy-fill",
        type: "fill",
        source: "route",
        filter: ["==", ["get", "kind"], "zone"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.16 },
      });
      m.addLayer({
        id: "privacy-outline",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "zone"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      m.addLayer({
        id: "original-route",
        type: "line",
        source: "route",
        filter: ["==", ["get", "kind"], "original"],
        paint: {
          "line-color": "#c3cfc7",
          "line-width": 4,
          "line-dasharray": [2, 2],
        },
      });
      m.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        filter: [
          "all",
          ["==", ["geometry-type"], "LineString"],
          ["!=", ["get", "kind"], "original"],
        ],
        paint: { "line-color": "#142719", "line-width": 9 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        filter: [
          "all",
          ["==", ["geometry-type"], "LineString"],
          ["!=", ["get", "kind"], "original"],
        ],
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
      el.setAttribute(
        "aria-label",
        locale === "ru" ? "Выбранная точка маршрута" : "Selected route point",
      );
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
  }, [
    segmentColors,
    ready,
    geometry,
    annotations,
    selected,
    endSelected,
    mode,
    privacyPreview,
  ]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const marker of noteMarkers.current.values()) marker.remove();
    noteMarkers.current.clear();
    const popupResizeHandlers: (() => void)[] = [];
    annotations.forEach((annotation, index) => {
      const segment = geometry.find((s) =>
        s.some((p) => p.id === annotation.startId),
      );
      if (!segment) return;
      const start = segment.findIndex((p) => p.id === annotation.startId),
        end = segment.findIndex((p) => p.id === annotation.endId);
      if (end < 0) return;
      const point = segment[Math.floor((start + end) / 2)];
      const button = document.createElement("button");
      button.className =
        "annotation-pin" + (start === end ? "" : " segment-pin");
      button.style.borderColor = annotation.color;
      button.style.color = annotation.color;
      button.textContent = String(index + 1);
      button.title = annotation.text;
      button.setAttribute("aria-label", `${index + 1}. ${annotation.text}`);
      const content = document.createElement("div");
      content.className = "annotation-popup";
      const heading = document.createElement("div");
      heading.className = "annotation-popup-heading";
      heading.style.setProperty("--note-color", annotation.color);
      heading.textContent = `${index + 1} · ${locale === "ru" ? (start === end ? "Точка маршрута" : "Участок маршрута") : start === end ? "Route point" : "Route section"}`;
      const body = document.createElement("div");
      body.className = "annotation-popup-body";
      body.textContent = annotation.text;
      body.tabIndex = 0;
      const sizeBody = () => {
        body.style.maxHeight = `${Math.max(64, Math.min(240, m.getContainer().clientHeight / 2 - 90))}px`;
      };
      sizeBody();
      popupResizeHandlers.push(sizeBody);
      m.on("resize", sizeBody);
      content.append(heading, body);
      const popup = new maplibregl.Popup({
        offset: 20,
        maxWidth: "min(340px, calc(100vw - 48px))",
        className: "route-note-popup",
        focusAfterOpen: false,
        closeButton: true,
      }).setDOMContent(content);
      popup.on("open", () => {
        const close = popup
          .getElement()
          ?.querySelector(".maplibregl-popup-close-button");
        close?.setAttribute(
          "aria-label",
          locale === "ru" ? "Закрыть заметку" : "Close note",
        );
      });
      const pin = new maplibregl.Marker({
        element: button,
        offset: start === end ? [0, 0] : [0, -28],
      })
        .setLngLat([point.lon, point.lat])
        .setPopup(popup)
        .addTo(m);
      noteMarkers.current.set(annotation.id, pin);
    });
    return () => {
      for (const handler of popupResizeHandlers) m.off("resize", handler);
      for (const marker of noteMarkers.current.values()) marker.remove();
      noteMarkers.current.clear();
    };
  }, [ready, geometry, annotations, locale]);
  useEffect(() => {
    if (!focusAnnotation) return;
    const marker = noteMarkers.current.get(focusAnnotation.id);
    if (!marker || !map.current) return;
    for (const other of noteMarkers.current.values())
      if (other.getPopup()?.isOpen()) other.togglePopup();
    marker.togglePopup();
    map.current.easeTo({ center: marker.getLngLat(), duration: 500 });
  }, [focusAnnotation, ready, annotations]);
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
      <div className="map-actions">
        <button className="map-action" onClick={fit}>
          <Route size={17} aria-hidden="true" />
          <span>{locale === "ru" ? "Весь маршрут" : "Fit route"}</span>
        </button>
        <button
          className="map-action"
          onClick={() =>
            fullscreenView ? onExitFullscreen?.() : setFullscreen(true)
          }
        >
          {fullscreenView ? (
            <Minimize2 size={17} aria-hidden="true" />
          ) : (
            <Maximize2 size={17} aria-hidden="true" />
          )}
          <span>
            {fullscreenView
              ? locale === "ru"
                ? "Закрыть"
                : "Exit fullscreen"
              : locale === "ru"
                ? "На весь экран"
                : "Fullscreen"}
          </span>
        </button>
      </div>
      {fullscreen &&
        createPortal(
          <FullscreenMapDialog
            locale={locale}
            onClose={() => setFullscreen(false)}
          >
            <RouteMap
              geometry={geometry}
              segmentColors={segmentColors}
              annotations={annotations}
              privacyPreview={privacyPreview}
              focusAnnotation={focusAnnotation}
              selected={selected}
              endSelected={endSelected}
              mode={mode}
              onSelect={onSelect}
              onCoordinate={onCoordinate}
              fitKey={fitKey}
              errorLabel={errorLabel}
              locale={locale}
              fullscreenView
              onExitFullscreen={() => setFullscreen(false)}
            />
          </FullscreenMapDialog>,
          document.body,
        )}
    </div>
  );
}

function FullscreenMapDialog({
  children,
  locale,
  onClose,
}: {
  children: React.ReactNode;
  locale: "en" | "ru";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="fullscreen-map-dialog"
      aria-label={locale === "ru" ? "Карта на весь экран" : "Fullscreen map"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
    >
      {children}
    </dialog>
  );
}
