"use client";
import { useEffect, useRef, useState } from "react";
import { PlaceIcon } from "./PlaceIcon";
import { placeIcons, placeIconKeys } from "@/lib/place-icons";
import { MapPin, Plus, Pencil, Trash2, X, ImagePlus } from "lucide-react";
import type { Locale, RouteData, RoutePlace } from "@/lib/types";
import { placeInput, placePhotoUrl } from "@/lib/route-places";
import { sharePath, shareUrl } from "@/lib/sharing";
import { ShareLink } from "./ShareLink";
import { ItemDescription } from "./ItemDescription";
import { useConfirm } from "./ConfirmationProvider";
import { FeedbackToast } from "./FeedbackToast";

export function RoutePlaces({
  places = [],
  locale,
  routeId,
  token,
  selectedId,
  onSelect,
  onPick,
  draft,
  onDraftClear,
  beforeSave,
  onSaved,
}: {
  places?: RoutePlace[];
  locale: Locale;
  routeId?: string;
  token?: string;
  selectedId?: string;
  onSelect: (id?: string) => void;
  onPick?: () => void;
  draft?: { lat: number; lon: number };
  onDraftClear?: () => void;
  beforeSave?: () => Promise<void>;
  onSaved?: (route: RouteData) => void;
}) {
  const ru = locale === "ru";
  const confirm = useConfirm(locale);
  const [edit, setEdit] = useState<Partial<RoutePlace> | null>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ id: number; message: string }>();
  const [base, setBase] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const selected = places.find((p) => p.id === selectedId);
  const [lastSelected, setLastSelected] = useState<RoutePlace>();
  const shown = selected || lastSelected;
  useEffect(() => {
    if (selected) setLastSelected(selected);
  }, [selected]);
  const open = !!edit || !!selected;
  useEffect(() => {
    setBase(
      token
        ? ["localhost", "127.0.0.1"].includes(location.hostname)
          ? location.origin + sharePath(token, locale)
          : shareUrl(token, locale)
        : "",
    );
  }, [token, locale]);
  useEffect(() => {
    const sync = () => {
      const match = /^#place-(.+)$/.exec(location.hash);
      onSelect(
        match && places.some((p) => p.id === match[1]) ? match[1] : undefined,
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [places, onSelect]);
  useEffect(() => {
    if (draft) {
      setEdit({ ...draft, title: "", description: "", icon: "pin" });
      setFile(undefined);
      setRemovePhoto(false);
      setChanged(false);
      setError("");
      onSelect(undefined);
    }
  }, [draft, onSelect]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) {
      node?.showModal();
      heading.current?.focus({ preventScroll: true });
    } else if (!open && node?.open) node.close();
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [open]);
  function show(p: RoutePlace) {
    const url = new URL(location.href);
    url.hash = "place-" + p.id;
    history.pushState(null, "", url);
    onSelect(p.id);
  }
  async function close() {
    if (busy) return;
    if (
      changed &&
      !(await confirm(
        ru
          ? "Изменения места не сохранятся."
          : "Your place changes will be lost.",
        "discard",
      ))
    )
      return;
    setEdit(null);
    setChanged(false);
    setError("");
    setFile(undefined);
    onDraftClear?.();
    onSelect(undefined);
    if (location.hash.startsWith("#place-")) {
      const url = new URL(location.href);
      url.hash = "";
      history.replaceState(null, "", url);
    }
  }
  function startEdit(p: RoutePlace) {
    setEdit({ ...p });
    setFile(undefined);
    setRemovePhoto(false);
    setChanged(false);
    setError("");
  }
  async function mutate(
    method: "POST" | "PATCH" | "DELETE",
    id?: string,
    body?: FormData,
  ) {
    if (!routeId) return;
    setBusy(true);
    setError("");
    try {
      await beforeSave?.();
      const r = await fetch(
        `/api/route-places/${routeId}${id ? "/" + id : ""}`,
        { method, body },
      );
      const value = await r.json();
      if (!r.ok) throw Error(value.error);
      onSaved?.(value);
      setChanged(false);
      setEdit(null);
      setFile(undefined);
      onDraftClear?.();
      const savedPlace =
        method === "DELETE"
          ? undefined
          : (value.places as RoutePlace[]).find((p) =>
              id ? p.id === id : !places.some((old) => old.id === p.id),
            );
      const target = new URL(location.href);
      target.hash = savedPlace ? `place-${savedPlace.id}` : "";
      history.replaceState(null, "", target);
      onSelect(savedPlace?.id);
      setToast({
        id: Date.now(),
        message:
          method === "DELETE"
            ? ru
              ? "Место удалено"
              : "Place deleted"
            : ru
              ? "Место сохранено"
              : "Place saved",
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "fileTooLarge"
          ? ru
            ? "Фото должно быть до 8 МБ."
            : "Choose a photo up to 8 MB."
          : code === "invalidImage"
            ? ru
              ? "Выберите фото JPEG, PNG, WebP или AVIF."
              : "Choose a JPEG, PNG, WebP or AVIF photo."
            : ru
              ? "Не удалось сохранить. Проверьте данные и попробуйте ещё раз."
              : "Could not save. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const valid = edit && placeInput.safeParse(edit).success;
  const photo =
    preview ||
    (!removePhoto && edit?.photo ? placePhotoUrl(edit as RoutePlace) : "");
  if (!routeId && !places.length) return null;
  return (
    <section className="route-places-section">
      <div className="places-heading">
        <div>
          <h2>
            <MapPin size={21} />
            {ru ? "Места на маршруте" : "Places along the route"}{" "}
            <span>{places.length}</span>
          </h2>
          <p>
            {ru
              ? "Остановки, виды и находки, которыми хочется поделиться."
              : "Stops, views and discoveries worth sharing."}
          </p>
        </div>
        {onPick && (
          <button
            className="button light small"
            disabled={busy}
            onClick={onPick}
          >
            <Plus size={16} />
            {ru ? "Добавить место" : "Add place"}
          </button>
        )}
      </div>
      {!places.length && (
        <p className="places-empty">
          {ru
            ? "Выберите точку на карте и добавьте название. Фото и описание — по желанию."
            : "Pick a point on the map and add a title. A photo and description are optional."}
        </p>
      )}
      <div className="route-places-grid">
        {places.map((p) => (
          <article className="route-place-card" key={p.id}>
            <a
              className="place-card-photo"
              href={`#place-${p.id}`}
              aria-label={`${ru ? "Открыть место" : "View place"}: ${p.title}`}
              onClick={(e) => {
                e.preventDefault();
                show(p);
              }}
            >
              {p.photo ? (
                <img
                  src={placePhotoUrl(p, routeId ? undefined : token)}
                  alt={p.title}
                  loading="lazy"
                />
              ) : (
                <PlaceIcon icon={p.icon} size={34} />
              )}
              <span className="place-card-number">
                <PlaceIcon icon={p.icon} size={18} />
              </span>
            </a>
            <div className="place-card-content">
              <h3>
                <a
                  href={`#place-${p.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    show(p);
                  }}
                >
                  {p.title}
                </a>
              </h3>
              <ItemDescription
                text={p.description}
                id={p.id}
                prefix="place"
                ru={ru}
                onOpen={() => show(p)}
              />
              <footer>
                <button className="text-link" onClick={() => show(p)}>
                  <MapPin size={15} />
                  {ru ? "Место и QR-код" : "Place & QR code"}
                </button>
                {routeId && (
                  <button
                    className="icon-button"
                    aria-label={`${ru ? "Изменить" : "Edit"} ${p.title}`}
                    onClick={() => startEdit(p)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </footer>
            </div>
          </article>
        ))}
      </div>
      {error && !open && (
        <p className="sets-error" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        className="public-item-dialog route-place-dialog"
        aria-labelledby="route-place-title"
        onCancel={(e) => {
          e.preventDefault();
          void close();
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
              void close();
          }
        }}
      >
        <header className="item-modal-header">
          <h2 ref={heading} tabIndex={-1} id="route-place-title">
            {edit
              ? edit.id
                ? ru
                  ? "Изменить место"
                  : "Edit place"
                : ru
                  ? "Новое место"
                  : "New place"
              : shown?.title}
          </h2>
          <button
            className="icon-button"
            disabled={busy}
            aria-label={ru ? "Закрыть место" : "Close place"}
            onClick={() => void close()}
          >
            <X size={22} />
          </button>
        </header>
        {edit ? (
          <form
            className="place-editor"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid || busy) return;
              const form = new FormData();
              form.set("title", edit.title || "");
              form.set("icon", edit.icon || "pin");
              form.set("description", edit.description || "");
              form.set("lat", String(edit.lat));
              form.set("lon", String(edit.lon));
              if (removePhoto) form.set("removePhoto", "true");
              if (file) form.set("photo", file);
              void mutate(edit.id ? "PATCH" : "POST", edit.id, form);
            }}
          >
            <fieldset disabled={busy}>
              <div className="place-photo-upload">
                <div className="place-photo-preview">
                  {photo ? (
                    <img src={photo} alt={ru ? "Фото места" : "Place photo"} />
                  ) : (
                    <ImagePlus size={30} />
                  )}
                </div>
                <div>
                  <strong>{ru ? "Фото места" : "Place photo"}</strong>
                  <p>JPEG, PNG, WebP, AVIF · {ru ? "до 8 МБ" : "up to 8 MB"}</p>
                  <input
                    ref={upload}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > 8 * 1024 * 1024) {
                        setError(
                          ru
                            ? "Фото должно быть до 8 МБ."
                            : "Choose a photo up to 8 MB.",
                        );
                        return;
                      }
                      setError("");
                      setFile(f);
                      setChanged(true);
                    }}
                  />
                  <button
                    type="button"
                    className="button light small"
                    onClick={() => upload.current?.click()}
                  >
                    {photo
                      ? ru
                        ? "Заменить фото"
                        : "Change photo"
                      : ru
                        ? "Выбрать фото"
                        : "Choose photo"}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={ru ? "Удалить фото" : "Remove photo"}
                      onClick={async () => {
                        if (
                          await confirm(
                            ru
                              ? "Удалить фото этого места?"
                              : "Remove this place photo?",
                            "delete",
                          )
                        ) {
                          setFile(undefined);
                          setRemovePhoto(true);
                          setChanged(true);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <fieldset className="place-icon-picker">
                <legend>{ru ? "Значок на карте" : "Map icon"}</legend>
                <div>
                  {placeIconKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="icon-button"
                      aria-pressed={(edit.icon || "pin") === key}
                      aria-label={placeIcons[key][ru ? "ru" : "en"]}
                      title={placeIcons[key][ru ? "ru" : "en"]}
                      onClick={() => {
                        setEdit({ ...edit, icon: key });
                        setChanged(true);
                      }}
                    >
                      <PlaceIcon icon={key} />
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                {ru ? "Название места" : "Place title"}
                <input
                  required
                  maxLength={120}
                  value={edit.title || ""}
                  onChange={(e) => {
                    setEdit({ ...edit, title: e.target.value });
                    setChanged(true);
                  }}
                  placeholder={
                    ru
                      ? "Например, вид на озеро"
                      : "For example, a lake viewpoint"
                  }
                />
              </label>
              <label>
                {ru ? "Описание · необязательно" : "Description · optional"}
                <textarea
                  maxLength={6000}
                  rows={4}
                  value={edit.description || ""}
                  onChange={(e) => {
                    setEdit({ ...edit, description: e.target.value });
                    setChanged(true);
                  }}
                />
              </label>
              <div className="place-coordinates">
                <label>
                  {ru ? "Широта" : "Latitude"}
                  <input
                    type="number"
                    required
                    min={-85}
                    max={85}
                    step="any"
                    value={edit.lat ?? ""}
                    onChange={(e) => {
                      setEdit({
                        ...edit,
                        lat:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      });
                      setChanged(true);
                    }}
                  />
                </label>
                <label>
                  {ru ? "Долгота" : "Longitude"}
                  <input
                    type="number"
                    required
                    min={-180}
                    max={180}
                    step="any"
                    value={edit.lon ?? ""}
                    onChange={(e) => {
                      setEdit({
                        ...edit,
                        lon:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      });
                      setChanged(true);
                    }}
                  />
                </label>
              </div>
              {error && (
                <p className="sets-error" role="alert">
                  {error}
                </p>
              )}
              <div className="place-editor-actions">
                {edit.id && (
                  <button
                    type="button"
                    className="text-link danger-link"
                    onClick={async () => {
                      if (
                        await confirm(
                          ru
                            ? "Место, фото и ссылка на него будут удалены."
                            : "This place, its photo and its link will be removed.",
                          "delete",
                        )
                      )
                        void mutate("DELETE", edit.id);
                    }}
                  >
                    <Trash2 size={16} />
                    {ru ? "Удалить" : "Delete"}
                  </button>
                )}
                <button
                  type="button"
                  className="button light"
                  onClick={() => void close()}
                >
                  {ru ? "Отмена" : "Cancel"}
                </button>
                <button className="button coral" disabled={!valid || busy}>
                  {busy
                    ? ru
                      ? "Сохраняем…"
                      : "Saving…"
                    : ru
                      ? "Сохранить место"
                      : "Save place"}
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          shown && (
            <div className="place-detail">
              {shown.photo && (
                <img
                  className="place-detail-photo"
                  src={placePhotoUrl(shown, routeId ? undefined : token)}
                  alt={shown.title}
                />
              )}
              <p className="place-detail-description">{shown.description}</p>
              <p className="place-detail-coordinates">
                <MapPin size={15} />
                {shown.lat.toFixed(5)}, {shown.lon.toFixed(5)}
              </p>
              {base ? (
                <ShareLink
                  url={`${base}#place-${shown.id}`}
                  locale={locale}
                  name={shown.title}
                />
              ) : (
                <p className="subtle">
                  {ru
                    ? "Опубликуйте маршрут, чтобы получить ссылку и QR-код места."
                    : "Share the route to get this place’s link and QR code."}
                </p>
              )}
              {routeId && (
                <button
                  className="button light small"
                  onClick={() => startEdit(shown)}
                >
                  <Pencil size={16} />
                  {ru ? "Изменить место" : "Edit place"}
                </button>
              )}
            </div>
          )
        )}
        {open && toast && (
          <FeedbackToast
            key={toast.id}
            message={toast.message}
            dismissLabel={ru ? "Закрыть уведомление" : "Dismiss notification"}
            onDismiss={() => setToast(undefined)}
          />
        )}
      </dialog>
      {!open && toast && (
        <FeedbackToast
          key={toast.id}
          message={toast.message}
          dismissLabel={ru ? "Закрыть уведомление" : "Dismiss notification"}
          onDismiss={() => setToast(undefined)}
        />
      )}
    </section>
  );
}
