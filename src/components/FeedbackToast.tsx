"use client";

import { useEffect, useRef } from "react";
import { Check, CircleAlert, X } from "lucide-react";

/** A non-blocking top-layer notification, including above native dialogs. */
export function FeedbackToast({
  message,
  error = false,
  dismissLabel,
  onDismiss,
}: {
  message: string;
  error?: boolean;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const node = ref.current;
    node?.showPopover();
    let finish: ReturnType<typeof setTimeout>;
    const timer = setTimeout(
      () => {
        node?.hidePopover();
        finish = setTimeout(() => dismiss.current(), 200);
      },
      error ? 6000 : 2800,
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(finish);
    };
  }, [error]);
  return (
    <div
      ref={ref}
      popover="manual"
      className={`feedback-toast${error ? " feedback-toast-error" : ""}`}
    >
      <span className="feedback-toast-icon" aria-hidden="true">
        {error ? <CircleAlert size={18} /> : <Check size={18} />}
      </span>
      <span role={error ? "alert" : "status"} aria-atomic="true">
        {message}
      </span>
      <button
        type="button"
        className="icon-button"
        aria-label={dismissLabel}
        onClick={onDismiss}
      >
        <X size={16} />
      </button>
    </div>
  );
}
