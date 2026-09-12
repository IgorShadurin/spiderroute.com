"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, Settings, X } from "lucide-react";
import type { Theme } from "@/lib/theme";
import type { Locale } from "@/lib/types";
export function AccountSettings({
  locale,
  accountLocale,
  theme,
  onSave,
}: {
  locale: Locale;
  accountLocale: Locale;
  theme: Theme;
  onSave: (value: Locale, theme: Theme) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(accountLocale),
    [themeValue, setThemeValue] = useState(theme),
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
          setThemeValue(theme);
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
                  await onSave(value, themeValue);
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
              <label className="settings-theme-label" htmlFor="account-theme">
                {ru ? "Тема оформления" : "Appearance"}
              </label>
              <select
                id="account-theme"
                value={themeValue}
                onChange={(event) => setThemeValue(event.target.value as Theme)}
                disabled={saving}
              >
                <option value="dark">{ru ? "Тёмная" : "Dark"}</option>
                <option value="light">{ru ? "Светлая" : "Light"}</option>
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
                  <Save size={16} aria-hidden="true" />
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
