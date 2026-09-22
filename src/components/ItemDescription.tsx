"use client";
import { useEffect, useRef, useState } from "react";

export function ItemDescription({
  text,
  id,
  ru,
  onOpen,
  prefix = "item",
}: {
  prefix?: string;
  text: string;
  id: string;
  ru: boolean;
  onOpen: () => void;
}) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const node = paragraph.current;
    if (!node) return;
    const measure = () =>
      setTruncated(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    let mounted = true;
    document.fonts.ready.then(() => {
      if (mounted) measure();
    });
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [text]);
  if (!text) return null;
  return (
    <div className="item-description-excerpt">
      <p ref={paragraph} className="item-description-preview">
        {text}
      </p>
      {truncated && (
        <a
          className="item-description-more"
          href={`#${prefix}-${id}`}
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
          aria-label={ru ? "Читать полное описание" : "Read full description"}
        >
          … {ru ? "ещё" : "more"}
        </a>
      )}
    </div>
  );
}
