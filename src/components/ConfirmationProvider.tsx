"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Globe, LogOut, ShieldOff, Trash2, Undo2, X } from "lucide-react";

type Kind = "delete" | "discard" | "publish" | "revoke" | "signout";
type Request = { message: string; kind: Kind; ru: boolean };
const Context = createContext<((request: Request) => Promise<boolean>) | null>(
  null,
);
const labels = {
  delete: ["Удалить?", "Удалить", "Delete?", "Delete"],
  discard: [
    "Выйти без сохранения?",
    "Не сохранять",
    "Leave without saving?",
    "Discard changes",
  ],
  publish: [
    "Поделиться набором?",
    "Опубликовать",
    "Share this set?",
    "Publish set",
  ],
  revoke: [
    "Закрыть публичный доступ?",
    "Закрыть доступ",
    "Revoke public access?",
    "Revoke access",
  ],
  signout: ["Выйти из аккаунта?", "Выйти", "Sign out?", "Sign out"],
};
const icons = {
  delete: Trash2,
  discard: Undo2,
  publish: Globe,
  revoke: ShieldOff,
  signout: LogOut,
};
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  function finish(value: boolean) {
    dialog.current?.close();
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(value);
  }
  useEffect(() => {
    if (request) {
      dialog.current?.showModal();
      cancel.current?.focus();
    }
  }, [request]);
  useEffect(
    () => () => {
      pending.current?.(false);
      pending.current = null;
    },
    [],
  );
  const ask = (next: Request) => {
    // A second click must never queue a second destructive action.
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setRequest(next);
    });
  };
  const Icon = icons[request?.kind || "delete"];
  const copy = labels[request?.kind || "delete"];
  const question = request?.message.indexOf("?") ?? -1;
  const useQuestion =
    request?.kind !== "discard" && question >= 0 && question < 100;
  const title = useQuestion
    ? request!.message.slice(0, question + 1)
    : copy[request?.ru ? 0 : 2];
  const description =
    request?.kind === "discard"
      ? undefined
      : useQuestion
        ? request!.message.slice(question + 1).trim()
        : request?.message;
  return (
    <Context.Provider value={ask}>
      {children}
      <dialog
        ref={dialog}
        className="app-confirm"
        aria-labelledby="app-confirm-title"
        aria-describedby={description ? "app-confirm-message" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          finish(false);
        }}
      >
        {request && (
          <div className="app-confirm-content" lang={request.ru ? "ru" : "en"}>
            <div className="app-confirm-summary">
              <div className={`app-confirm-icon ${request.kind}`}>
                <Icon size={20} aria-hidden="true" />
              </div>
              <div className="app-confirm-text">
                <h2 id="app-confirm-title">{title}</h2>
                {description && <p id="app-confirm-message">{description}</p>}
              </div>
              <button
                type="button"
                className="icon-button app-confirm-close"
                aria-label={request.ru ? "Закрыть" : "Close"}
                onClick={() => finish(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="app-confirm-actions">
              <button
                ref={cancel}
                type="button"
                className="button light"
                onClick={() => finish(false)}
              >
                {request.kind === "discard"
                  ? request.ru
                    ? "Остаться"
                    : "Keep editing"
                  : request.ru
                    ? "Отмена"
                    : "Cancel"}
              </button>
              <button
                type="button"
                className={`button ${request.kind === "delete" ? "app-confirm-danger" : "coral"}`}
                onClick={() => finish(true)}
              >
                {copy[request.ru ? 1 : 3]}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </Context.Provider>
  );
}
export function useConfirm(locale: string) {
  const ask = useContext(Context);
  if (!ask) throw new Error("ConfirmationProvider is missing");
  return (message: string, kind: Kind = "delete") =>
    ask({ message, kind, ru: locale === "ru" });
}
