"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, UserRound } from "lucide-react";

export function UserMenu({
  name,
  image,
  locale,
  children,
}: {
  name?: string | null;
  image?: string | null;
  locale: "en" | "ru";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="user-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="user-menu-trigger"
        aria-expanded={open}
        aria-label={locale === "ru" ? "Меню аккаунта" : "Account menu"}
        onClick={() => setOpen(!open)}
      >
        {image && image !== failedImage ? (
          <img
            className="user-menu-avatar"
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <span className="user-menu-avatar user-menu-placeholder">
            <UserRound size={21} />
          </span>
        )}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <div className="user-menu-panel" hidden={!open}>
        {name && <p className="user-menu-name">{name}</p>}
        {children}
      </div>
    </div>
  );
}
