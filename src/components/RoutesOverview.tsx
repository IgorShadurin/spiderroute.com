"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Geometry, Locale } from "@/lib/types";
const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });
const colors = [
  "#1767c1",
  "#e86628",
  "#863cbb",
  "#218449",
  "#cd387a",
  "#987000",
  "#00848d",
  "#b33b32",
];
type Item = {
  id: string;
  title: string;
  geometry: Geometry;
  stats: { distance: number };
};
export function RoutesOverview({
  routes,
  locale,
  onClose,
  onOpen,
}: {
  routes: { id: string; title: string }[];
  locale: Locale;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const ru = locale === "ru";
  const [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState<Set<string>>(
      () => new Set(routes.map((r) => r.id)),
    ),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const ids = routes.map((r) => r.id).join(",");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    (async () => {
      const requested = ids ? ids.split(",") : [];
      const result: Item[] = [];
      for (let offset = 0; offset < requested.length; offset += 20) {
        const response = await fetch(
          "/api/routes/overview?ids=" +
            encodeURIComponent(requested.slice(offset, offset + 20).join(",")),
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw Error("loadFailed");
        result.push(...(await response.json()));
      }
      if (!controller.signal.aborted) {
        setItems(
          result.sort(
            (a, b) => requested.indexOf(a.id) - requested.indexOf(b.id),
          ),
        );
        setLoading(false);
      }
    })().catch(() => {
      if (!controller.signal.aborted) {
        setFailed(true);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [ids, retry]);
  const chosen = items.filter((item) => selected.has(item.id));
  const { geometry, segmentColors } = useMemo(() => {
    const geometry: Geometry = [],
      segmentColors: string[] = [];
    items.forEach((item, index) => {
      if (selected.has(item.id))
        item.geometry.forEach((segment) => {
          geometry.push(segment);
          segmentColors.push(colors[index % colors.length]);
        });
    });
    return { geometry, segmentColors };
  }, [items, selected]);
  return (
    <section className="routes-overview">
      <div className="overview-heading">
        <div>
          <h1>{ru ? "Маршруты на одной карте" : "Routes on one map"}</h1>
          <p>
            {ru
              ? "Выберите сохранённые маршруты для просмотра вместе."
              : "Choose saved routes to view together."}
          </p>
        </div>
        <button className="button light" onClick={onClose}>
          <ArrowLeft size={16} />
          {ru ? "К редактору" : "Back to editor"}
        </button>
      </div>
      {loading ? (
        <p role="status">{ru ? "Загрузка маршрутов…" : "Loading routes…"}</p>
      ) : failed ? (
        <div role="alert">
          <p>
            {ru ? "Не удалось загрузить маршруты." : "Could not load routes."}
          </p>
          <button
            className="button light"
            onClick={() => setRetry((x) => x + 1)}
          >
            {ru ? "Повторить" : "Retry"}
          </button>
        </div>
      ) : (
        <>
          <div className="overview-controls">
            <strong>
              {ru
                ? `Выбрано: ${chosen.length} из ${items.length}`
                : `${chosen.length} of ${items.length} selected`}
            </strong>
            <button
              className="text-link"
              onClick={() => setSelected(new Set(items.map((r) => r.id)))}
            >
              {ru ? "Выбрать все" : "Select all"}
            </button>
            <button
              className="text-link"
              onClick={() => setSelected(new Set())}
            >
              {ru ? "Снять выбор" : "Clear selection"}
            </button>
          </div>
          {chosen.length ? (
            <div className="overview-map">
              <RouteMap
                geometry={geometry}
                segmentColors={segmentColors}
                locale={locale}
                fitKey={[...selected].join(",")}
              />
            </div>
          ) : (
            <div className="overview-empty">
              {ru
                ? "Выберите хотя бы один маршрут ниже."
                : "Select at least one route below."}
            </div>
          )}
          <div
            className="overview-route-list"
            aria-label={ru ? "Выбор маршрутов" : "Route selection"}
          >
            {items.map((item, index) => (
              <div key={item.id} className="overview-route-row">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        next.has(item.id)
                          ? next.delete(item.id)
                          : next.add(item.id);
                        return next;
                      })
                    }
                  />
                  <span
                    className="overview-color"
                    style={{ background: colors[index % colors.length] }}
                  />
                  <span>
                    {item.title}
                    <small>
                      {(item.stats.distance / 1000).toFixed(1)}{" "}
                      {ru ? "км" : "km"}
                    </small>
                  </span>
                </label>
                <button
                  className="icon-button"
                  title={ru ? "Открыть маршрут" : "Open route"}
                  aria-label={`${ru ? "Открыть" : "Open"}: ${item.title}`}
                  onClick={() => onOpen(item.id)}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            ))}
          </div>
          <p className="subtle">
            {ru
              ? "На общей карте показаны упрощённые треки. Откройте маршрут для просмотра всех точек и редактирования."
              : "This overview uses simplified tracks. Open a route to see every point and edit it."}
          </p>
        </>
      )}
    </section>
  );
}
