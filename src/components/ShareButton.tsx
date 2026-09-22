"use client";
import { useRef, useState, useEffect, useId } from "react";
import { Share2, X } from "lucide-react";
import { ShareLink } from "./ShareLink";
export function ShareButton({
  url,
  locale,
  name,
}: {
  url: string;
  locale: "ru" | "en";
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const ru = locale === "ru";
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    heading.current?.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      dialog.current?.close();
    };
  }, [open]);
  return (
    <>
      <button className="button light small" onClick={() => setOpen(true)}>
        <Share2 size={17} />
        {ru ? "Поделиться" : "Share"}
      </button>
      <dialog
        ref={dialog}
        className="public-item-dialog public-share-dialog"
        aria-labelledby={id}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              setOpen(false);
          }
        }}
      >
        <header className="item-modal-header">
          <h2 id={id} ref={heading} tabIndex={-1}>
            {ru ? "Поделиться" : "Share"}
          </h2>
          <button
            className="icon-button"
            aria-label={ru ? "Закрыть" : "Close"}
            onClick={() => setOpen(false)}
          >
            <X size={21} />
          </button>
        </header>
        {open && <ShareLink url={url} locale={locale} name={name} />}
      </dialog>
    </>
  );
}
