"use client";
import { useEffect, useRef } from "react";
import { formatVideoTime } from "@/lib/video-time";
import type { Annotation, Locale } from "@/lib/types";

export default function AnnotationList({
  annotations,
  onSelect,
  label,
  locale,
}: {
  annotations: Annotation[];
  onSelect: (annotation: Annotation) => void;
  label: string;
  locale: Locale;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = list.current;
    if (!element || annotations.length <= 20) return;
    const measure = () => {
      const twentieth = element.children[19] as HTMLElement;
      element.style.maxHeight = `min(60vh, ${twentieth.offsetTop + twentieth.offsetHeight}px)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const row of Array.from(element.children).slice(0, 20))
      observer.observe(row);
    return () => observer.disconnect();
  }, [annotations]);
  return (
    <div
      ref={list}
      className={`annotation-list${annotations.length > 20 ? " scrollable" : ""}`}
      role="list"
      aria-label={label}
      style={annotations.length <= 20 ? { maxHeight: "none" } : undefined}
    >
      {annotations.map((annotation, index) => (
        <div role="listitem" key={annotation.id}>
          <button className="note-card" onClick={() => onSelect(annotation)}>
            <span
              className="annotation-number"
              style={{ borderColor: annotation.color, color: annotation.color }}
            >
              {index + 1}
            </span>
            <p>
              {annotation.text}
              {annotation.videoSeconds !== undefined && (
                <small className="annotation-time">
                  ▶ {formatVideoTime(annotation.videoSeconds)}
                </small>
              )}
            </p>
            <span
              className="annotation-kind"
              aria-label={
                annotation.startId === annotation.endId
                  ? locale === "ru"
                    ? "Точка"
                    : "Point"
                  : locale === "ru"
                    ? "Участок"
                    : "Segment"
              }
            >
              {annotation.startId === annotation.endId ? "●" : "━"}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
