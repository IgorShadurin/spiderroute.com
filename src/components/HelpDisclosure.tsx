"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function HelpDisclosure({
  title,
  children,
  className = "",
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`share-help help-disclosure ${className}`} data-open={open}>
      <button
        type="button"
        className="help-disclosure-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown size={14} className="disclosure-chevron" />
      </button>
      <div className="help-disclosure-panel" id={id} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}
