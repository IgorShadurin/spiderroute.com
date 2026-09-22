"use client";

import { useId, useState } from "react";
import { Copy } from "lucide-react";
import { FeedbackToast } from "./FeedbackToast";

/** A selectable value with an inline copy action and non-blocking feedback. */
export function CopyField({
  value,
  label,
  copyLabel,
  copiedMessage,
  locale,
  disabled = false,
  showLabel = false,
}: {
  value: string;
  label: string;
  copyLabel: string;
  copiedMessage: string;
  locale: "ru" | "en";
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const id = useId();
  const [feedback, setFeedback] = useState<{
    id: number;
    message: string;
    error?: boolean;
  }>();
  const ru = locale === "ru";
  return (
    <>
      {showLabel && (
        <label className="copy-field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="share-link-field">
        <input
          id={id}
          readOnly
          value={value}
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="icon-button"
          disabled={disabled}
          aria-label={copyLabel}
          title={copyLabel}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setFeedback({ id: Date.now(), message: copiedMessage });
            } catch {
              setFeedback({
                id: Date.now(),
                error: true,
                message: ru
                  ? "Не удалось скопировать. Выделите текст и скопируйте вручную."
                  : "Could not copy. Select the text and copy manually.",
              });
            }
          }}
        >
          <Copy size={18} />
        </button>
      </div>
      {feedback && (
        <FeedbackToast
          key={feedback.id}
          message={feedback.message}
          error={feedback.error}
          dismissLabel={ru ? "Закрыть уведомление" : "Dismiss notification"}
          onDismiss={() => setFeedback(undefined)}
        />
      )}
    </>
  );
}
