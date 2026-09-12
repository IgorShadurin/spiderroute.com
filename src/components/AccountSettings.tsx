"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, X } from "lucide-react";
import type { Locale } from "@/lib/types";
export function AccountSettings({
  locale,
  accountLocale,
  onSave,
}: {
  locale: Locale;
  accountLocale: Locale;
  onSave: (value: Locale) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(accountLocale),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(false);
  const ru = locale === "ru";
  const close = () => {
    if (!saving) {
      dialog.current?.close();
      setOpen(false);
    }
  };
  return (
    <>
      <button
        className="icon-button"
        title={ru ? "Настройки аккаунта" : "Account settings"}
        aria-label={ru ? "Настройки аккаунта" : "Account settings"}
        onClick={() => {
          setValue(accountLocale);
          setError(false);
          setOpen(true);
        }}
      >
        <Settings size={19} />
      </button>
      {open &&
        createPortal(
          <dialog
            className="modal account-settings"
            aria-labelledby="account-settings-title"
            ref={(node) => {
              dialog.current = node;
              if (node && !node.open) node.showModal();
            }}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                const r = event.currentTarget.getBoundingClientRect();
                if (
                  event.clientX < r.left ||
                  event.clientX > r.right ||
                  event.clientY < r.top ||
                  event.clientY > r.bottom
                )
                  close();
              }
            }}
          >
            <button
              className="icon-button settings-close"
              aria-label={ru ? "Закрыть" : "Close"}
              onClick={close}
              disabled={saving}
            >
              <X size={20} />
            </button>
            <h2 id="account-settings-title">
              {ru ? "Настройки аккаунта" : "Account settings"}
            </h2>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                setError(false);
                try {
                  await onSave(value);
                  dialog.current?.close();
                  setOpen(false);
                } catch {
                  setError(true);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label htmlFor="account-language">
                {ru ? "Язык" : "Language"}
              </label>
              <p id="account-language-help" className="subtle">
                {ru
                  ? "Язык интерфейса и писем от SpiderRoute."
                  : "The language for the app and emails from SpiderRoute."}
              </p>
              <select
                id="account-language"
                value={value}
                onChange={(event) => setValue(event.target.value as Locale)}
                aria-describedby="account-language-help"
                disabled={saving}
              >
                <option value="en" lang="en">
                  English
                </option>
                <option value="ru" lang="ru">
                  Русский
                </option>
              </select>
              {error && (
                <p role="alert">
                  {ru
                    ? "Не удалось сохранить. Попробуйте ещё раз."
                    : "Could not save. Please try again."}
                </p>
              )}
              <div className="action-row">
                <button
                  type="button"
                  className="button light"
                  onClick={close}
                  disabled={saving}
                >
                  {ru ? "Отмена" : "Cancel"}
                </button>
                <button className="button dark" type="submit" disabled={saving}>
                  {saving
                    ? ru
                      ? "Сохранение…"
                      : "Saving…"
                    : ru
                      ? "Сохранить"
                      : "Save"}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
