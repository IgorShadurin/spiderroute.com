"use client";
import { routeEndpoints, type RouteEndpoints } from "@/lib/endpoints";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CirclePlay, Flag, Maximize2, Minimize2, Route } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapType, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Annotation, Geometry, MapConfig, Point } from "@/lib/types";
import { privacyCircle } from "@/lib/geo";
maplibregl.setWorkerUrl("/maplibre/6.9.0/maplibre-gl-worker.mjs");
export type MapMode =
  "view" | "select" | "move" | "insert" | "segment" | "pin" | "draw";
export default function RouteMap({
  fullscreenView = false,
  onExitFullscreen,
  geometry,
  annotations = [],
  endpoints,
  segmentColors,
  privacyPreview,
  focusAnnotation,
  selected,
  endSelected,
  mode = "view",
  onSelect,
  onCoordinate,
  onVideoSeek,
  activeAnnotationIds = [],
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
  endpoints?: RouteEndpoints;
  segmentColors?: string[];
  focusAnnotation?: { id: string };
  selected?: string;
  endSelected?: string;
  mode?: MapMode;
  onSelect?: (id: string) => void;
  onCoordinate?: (lat: number, lon: number, anchorId?: string) => void;
  onVideoSeek?: (seconds: number, endSeconds?: number) => void;
  activeAnnotationIds?: string[];
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
      onVideoSeek,
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
    onVideoSeek,
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
          if (p.mode === "draw" || p.mode === "pin") {
            p.onCoordinate?.(e.lngLat.lat, e.lngLat.lng);
            return;
          }
          if (p.mode === "insert" || p.mode === "segment") {
            let best = 24;
            let snapped: { x: number; y: number; anchorId: string } | undefined;
            for (const segment of p.geometry)
              for (let i = 1; i < segment.length; i++) {
                const a = m.project([segment[i - 1].lon, segment[i - 1].lat]);
                const b = m.project([segment[i].lon, segment[i].lat]);
                const dx = b.x - a.x,
                  dy = b.y - a.y;
                const t = Math.max(
                  0,
                  Math.min(
                    1,
                    ((e.point.x - a.x) * dx + (e.point.y - a.y) * dy) /
                      (dx * dx + dy * dy || 1),
                  ),
                );
                const x = a.x + t * dx,
                  y = a.y + t * dy;
                const d = Math.hypot(x - e.point.x, y - e.point.y);
                if (d < best) {
                  best = d;
                  snapped = { x, y, anchorId: segment[t < 0.5 ? i - 1 : i].id };
                }
              }
            if (snapped) {
              const point = m.unproject([snapped.x, snapped.y]);
              p.onCoordinate?.(point.lat, point.lng, snapped.anchorId);
            }
            return;
          }
          if (p.mode === "view") {
            if (p.onVideoSeek && m.getLayer("route-line")) {
              const hits = m.queryRenderedFeatures(
                [
                  [e.point.x - 6, e.point.y - 6],
                  [e.point.x + 6, e.point.y + 6],
                ],
                { layers: ["route-line"] },
              );
              const note = hits
                .map((f) =>
                  p.annotations.find(
                    (a) =>
                      a.id === f.properties?.annotationId &&
                      a.videoSeconds !== undefined,
                  ),
                )
                .find(Boolean);
              if (note) p.onVideoSeek(note.videoSeconds!, note.videoEndSeconds);
            }
            return;
          }
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
          annotationId: a.id,
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
    m.getCanvas().style.cursor = ["draw", "insert", "segment", "pin"].includes(
      mode,
    )
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
      const point =
        annotation.position ?? segment[Math.floor((start + end) / 2)];
      const button = document.createElement("button");
      button.className =
        "annotation-pin" + (start === end ? "" : " segment-pin");
      button.style.borderColor = annotation.color;
      button.style.color = annotation.color;
      button.textContent = String(index + 1);
      button.title = annotation.text;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (props.current.mode !== "view") {
          if (props.current.mode === "select" || props.current.mode === "move")
            props.current.onSelect?.(annotation.startId);
          return;
        }
        if (
          annotation.videoSeconds !== undefined &&
          props.current.onVideoSeek
        ) {
          if (fullscreenView) onExitFullscreen?.();
          props.current.onVideoSeek(
            annotation.videoSeconds,
            annotation.videoEndSeconds,
          );
        }
      });
      button.setAttribute("aria-label", `${index + 1}. ${annotation.text}`);
      const content = document.createElement("div");
      content.className = "annotation-popup";
      const heading = document.createElement("div");
      heading.className = "annotation-popup-heading";
      heading.style.setProperty("--note-color", annotation.color);
      heading.textContent = `${index + 1} · ${locale === "ru" ? (start === end ? "Точка маршрута" : "Участок маршрута") : start === end ? "Route point" : "Route section"}`;
      const body = document.createElement("div");
      body.className = "annotation-popup-body";
      body.textContent =
        annotation.text +
        (annotation.videoSeconds !== undefined
          ? ` · ▶ ${Math.floor(annotation.videoSeconds / 60)}:${String(annotation.videoSeconds % 60).padStart(2, "0")}`
          : "");
      if (annotation.videoEndSeconds !== undefined)
        body.textContent += ` – ${Math.floor(annotation.videoEndSeconds / 60)}:${String(annotation.videoEndSeconds % 60).padStart(2, "0")}`;
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
  }, [ready, geometry, annotations, locale, onVideoSeek]);
  const activeKey = activeAnnotationIds.join(",");
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !m.getSource("route")) return;
    const filter: maplibregl.FilterSpecification = [
      "all",
      ["==", ["geometry-type"], "LineString"],
      ["in", ["get", "annotationId"], ["literal", activeAnnotationIds]],
    ];
    for (const [id, width, color] of [
      ["video-active-halo", 15, "#ffffff"],
      ["video-active-line", 8, null],
    ] as const) {
      if (!m.getLayer(id))
        m.addLayer({
          id,
          type: "line",
          source: "route",
          filter,
          paint: {
            "line-width": width,
            "line-color": color ?? ["get", "color"],
          },
          layout: { "line-join": "round", "line-cap": "round" },
        });
      else m.setFilter(id, filter);
    }
    for (const [id, pin] of noteMarkers.current) {
      const active = activeAnnotationIds.includes(id);
      pin.getElement().classList.toggle("video-active", active);
      if (active) pin.getElement().setAttribute("aria-current", "true");
      else pin.getElement().removeAttribute("aria-current");
    }
  }, [ready, activeKey, geometry, annotations, locale, onVideoSeek]);
  useEffect(() => {
    if (!focusAnnotation) return;
    const marker = noteMarkers.current.get(focusAnnotation.id);
    if (!marker || !map.current) return;
    for (const other of noteMarkers.current.values())
      if (other.getPopup()?.isOpen()) other.togglePopup();
    marker.togglePopup();
    const annotation = annotations.find((a) => a.id === focusAnnotation.id);
    const segment = geometry.find((s) =>
      s.some((p) => p.id === annotation?.startId),
    );
    if (!annotation || !segment) return;
    const start = segment.findIndex((p) => p.id === annotation.startId);
    const end = segment.findIndex((p) => p.id === annotation.endId);
    if (annotation.position || start === end || end < 0) {
      map.current.easeTo({
        center: marker.getLngLat(),
        zoom: 16,
        duration: 500,
      });
    } else {
      const bounds = new maplibregl.LngLatBounds();
      for (const point of segment.slice(
        Math.min(start, end),
        Math.max(start, end) + 1,
      ))
        bounds.extend([point.lon, point.lat]);
      map.current.fitBounds(bounds, {
        padding: { top: 110, bottom: 80, left: 65, right: 65 },
        maxZoom: 16,
        duration: 500,
      });
    }
  }, [focusAnnotation, ready, annotations, geometry]);
  useEffect(() => {
    if (ready) fit();
  }, [ready, fitKey]);
  const jumpToEndpoint = (which: "startId" | "endId") => {
    const id = routeEndpoints(geometry, endpoints)?.[which];
    const point = geometry.flat().find((p) => p.id === id);
    if (point)
      map.current?.easeTo({
        center: [point.lon, point.lat],
        zoom: Math.max(map.current.getZoom(), 15),
        duration: 600,
      });
  };
  useEffect(() => {
    if (!ready || !map.current) return;
    const ends = routeEndpoints(geometry, endpoints);
    if (!ends) return;
    const markers: maplibregl.Marker[] = [];
    const first = geometry.flat().find((p) => p.id === ends.startId)!;
    const last = geometry.flat().find((p) => p.id === ends.endId)!;
    const sameLocation =
      Math.abs(first.lat - last.lat) < 0.00001 &&
      Math.abs(first.lon - last.lon) < 0.00001;
    for (const [kind, id] of [
      ["start", ends.startId],
      ["finish", ends.endId],
    ] as const) {
      const point = geometry.flat().find((p) => p.id === id)!;
      const el = document.createElement("button");
      el.className = "route-endpoint route-endpoint-" + kind;
      el.textContent = kind === "start" ? "▶" : "⚑";
      el.title =
        locale === "ru"
          ? kind === "start"
            ? "Старт"
            : "Финиш"
          : kind === "start"
            ? "Start"
            : "Finish";
      el.setAttribute("aria-label", el.title);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        if (props.current.mode === "select" || props.current.mode === "move")
          props.current.onSelect?.(id);
        else jumpToEndpoint(kind === "start" ? "startId" : "endId");
      });
      markers.push(
        new maplibregl.Marker({
          element: el,
          offset: sameLocation
            ? [kind === "start" ? -18 : 18, 0]
            : annotations.some((a) => a.startId === id || a.endId === id)
              ? [0, -25]
              : [0, 0],
        })
          .setLngLat([point.lon, point.lat])
          .addTo(map.current),
      );
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [ready, geometry, endpoints, locale, annotations]);
  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" />
      {failed && (
        <div className="map-error" role="status">
          {errorLabel}
        </div>
      )}
      <div className="map-actions">
        <button
          className="map-action endpoint-action"
          disabled={!geometry.some((s) => s.length)}
          onClick={() => jumpToEndpoint("startId")}
          title={locale === "ru" ? "К старту" : "Go to start"}
          aria-label={locale === "ru" ? "К старту" : "Go to start"}
        >
          <CirclePlay size={19} />
        </button>
        <button
          className="map-action endpoint-action"
          disabled={!geometry.some((s) => s.length)}
          onClick={() => jumpToEndpoint("endId")}
          title={locale === "ru" ? "К финишу" : "Go to finish"}
          aria-label={locale === "ru" ? "К финишу" : "Go to finish"}
        >
          <Flag size={19} />
        </button>
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
              endpoints={endpoints}
              segmentColors={segmentColors}
              annotations={annotations}
              privacyPreview={privacyPreview}
              focusAnnotation={focusAnnotation}
              selected={selected}
              endSelected={endSelected}
              mode={mode}
              onSelect={onSelect}
              onCoordinate={onCoordinate}
              onVideoSeek={onVideoSeek}
              activeAnnotationIds={activeAnnotationIds}
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
