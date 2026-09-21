"use client";
import { MarketplaceLabel } from "./MarketplaceLabel";
import { useConfirm } from "./ConfirmationProvider";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Globe,
  ImagePlus,
  MoreHorizontal,
  Settings2,
  LockKeyhole,
  Package,
  Pencil,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";
import { Brand } from "./Brand";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeProvider";
import {
  itemPhotoUrl,
  itemInput,
  setSeoTitle,
  setDescription,
  marketplaceOrder,
  countedLabel,
  type ItemSet,
  type SetItem,
  type ItemInput,
  type SetInput,
} from "@/lib/item-sets";

type Props = {
  initialSets: ItemSet[];
  signedIn: boolean;
  locale: "en" | "ru";
  name?: string | null;
  image?: string | null;
  homeHref: string;
};
const errorText = (code: string, ru: boolean) =>
  ({
    linkRequired: ru
      ? "Добавьте хотя бы одну ссылку или артикул товара."
      : "Add at least one shopping link or product ID.",
    unauthorized: ru
      ? "Войдите в аккаунт и попробуйте снова."
      : "Sign in and try again.",
    invalidInput: ru
      ? "Проверьте поля. Укажите артикул, ASIN Amazon, номер товара eBay или ссылку на нужный магазин."
      : "Check your fields. Use a SKU, Amazon ASIN, eBay item number or a URL for the matching marketplace.",
    invalidImage: ru
      ? "Выберите JPEG, PNG, WebP или AVIF до 25 мегапикселей."
      : "Choose a JPEG, PNG, WebP or AVIF image up to 25 megapixels.",
    fileTooLarge: ru
      ? "Фото должно быть не больше 8 МБ."
      : "Photos must be no larger than 8 MB.",
    emptySet: ru
      ? "Добавьте хотя бы одну вещь перед публикацией."
      : "Add at least one item before sharing.",
    limitReached: ru
      ? "Достигнут лимит: 100 наборов или 100 вещей в наборе."
      : "Limit reached: 100 sets or 100 items per set.",
    notFound: ru
      ? "Набор или вещь больше недоступны. Обновите страницу."
      : "This set or item is no longer available. Refresh the page.",
  })[code] ||
  (ru
    ? "Не удалось сохранить. Проверьте соединение и попробуйте снова."
    : "Could not save. Check your connection and try again.");
async function request(path: string, method = "GET", data?: unknown) {
  const file = data instanceof File;
  const res = await fetch("/api/sets" + path, {
    method,
    headers: data
      ? {
          "Content-Type": file
            ? "application/octet-stream"
            : "application/json",
        }
      : undefined,
    body: data ? (file ? data : JSON.stringify(data)) : undefined,
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "failed");
  return body;
}
export function SetsWorkspace({
  initialSets,
  signedIn,
  locale,
  name,
  image,
  homeHref,
}: Props) {
  const ru = locale === "ru";
  const confirm = useConfirm(locale);
  const [sets, setSets] = useState(initialSets),
    [active, setActive] = useState(initialSets[0]?.id || ""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const leaving = useRef(false);
  const selected = sets.find((set) => set.id === active);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty && !leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const canLeave = async () =>
    !dirty ||
    (await confirm(
      ru ? "Отменить несохранённые изменения?" : "Discard unsaved changes?",
      "discard",
    ));
  const update = (set: ItemSet) =>
    setSets((current) =>
      current.some((s) => s.id === set.id)
        ? current.map((s) => (s.id === set.id ? set : s))
        : [set, ...current],
    );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const set = await request("", "POST", {
        title: form.get("title"),
        locale,
      });
      update(set);
      setActive(set.id);
      setCreating(false);
      setDirty(false);
    } catch (e) {
      setError(errorText((e as Error).message, ru));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="sets-page"
      lang={locale}
      onClickCapture={async (event) => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          "a[href]",
        );
        if (
          !dirty ||
          !link ||
          link.target === "_blank" ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const destination = link.href;
        event.preventDefault();
        event.stopPropagation();
        if (await canLeave()) {
          leaving.current = true;
          setDirty(false);
          window.location.assign(destination);
        }
      }}
    >
      <header className="sets-header">
        <a href={homeHref}>
          <Brand />
        </a>
        <div className="sets-header-actions">
          <ThemeToggle locale={locale} />
          {signedIn && (
            <UserMenu name={name} image={image} locale={locale}>
              <a className="user-menu-action" href={homeHref}>
                <Route size={18} />
                {ru ? "Мои маршруты" : "My routes"}
              </a>
              <a className="user-menu-action" href="/sets">
                <Package size={18} />
                {ru ? "Мои наборы" : "My sets"}
              </a>
              <a className="user-menu-action" href="/settings">
                <Settings2 size={18} />
                {ru ? "Профиль и ссылки" : "Profile & links"}
              </a>
            </UserMenu>
          )}
        </div>
      </header>
      {!signedIn ? (
        <main className="sets-signin">
          <Package size={46} />
          <h1>{ru ? "Все ваши вещи — в наборах" : "Your finds, collected"}</h1>
          <p>
            {ru
              ? "Войдите, чтобы создавать личные наборы и делиться ими."
              : "Sign in to create private sets and share your favorites."}
          </p>
          <a className="button coral" href={homeHref}>
            {ru ? "Войти" : "Sign in"}
            <ArrowUpRight size={17} />
          </a>
        </main>
      ) : (
        <main className="sets-layout">
          <aside className="sets-sidebar">
            <a className="sets-back" href={homeHref}>
              <ArrowLeft size={15} />
              {ru ? "К маршрутам" : "Back to routes"}
            </a>
            <div className="sets-eyebrow">
              {ru ? "ВАША КОЛЛЕКЦИЯ" : "YOUR COLLECTION"}
            </div>
            <h1>{ru ? "Мои наборы" : "My sets"}</h1>
            <p className="sets-muted">
              {ru
                ? "Вещи для поездок и не только."
                : "Things for the ride. And beyond."}
            </p>
            <button
              className="button coral full"
              onClick={async () => {
                if (await canLeave()) {
                  setCreating(true);
                  setDirty(false);
                }
              }}
            >
              <Plus size={18} />
              {ru ? "Создать набор" : "Create a set"}
            </button>
            <nav
              aria-label={ru ? "Ваши наборы" : "Your sets"}
              className="sets-list"
            >
              {sets.map((set) => (
                <button
                  key={set.id}
                  className={
                    active === set.id && !creating
                      ? "set-nav active"
                      : "set-nav"
                  }
                  onClick={async () => {
                    if (await canLeave()) {
                      setActive(set.id);
                      setCreating(false);
                      setDirty(false);
                    }
                  }}
                >
                  <span className="set-nav-icon">
                    <Package size={21} />
                  </span>
                  <span>
                    <strong>{set.title}</strong>
                    <small>
                      {countedLabel(set.items.length, ru)} ·{" "}
                      {set.token
                        ? ru
                          ? "Опубликован"
                          : "Public"
                        : ru
                          ? "Личный"
                          : "Private"}
                    </small>
                  </span>
                  {set.token ? <Globe size={14} /> : <LockKeyhole size={14} />}
                </button>
              ))}
            </nav>
            <div className="sets-privacy-note">
              <LockKeyhole size={16} />
              <span>
                {ru
                  ? "Новые наборы видны только вам. Вы решаете, чем поделиться."
                  : "New sets are just for you. You choose what to share."}
              </span>
            </div>
          </aside>
          <section className="sets-detail">
            {creating ? (
              <div className="set-create">
                <div className="sets-large-icon">
                  <Package size={35} />
                </div>
                <div className="sets-eyebrow">
                  {ru ? "НАЧНИТЕ С ИДЕИ" : "START WITH AN IDEA"}
                </div>
                <h2>{ru ? "Что соберём вместе?" : "What belongs together?"}</h2>
                <p className="sets-muted">
                  {ru
                    ? "Например, «Всё для велопоездки» или «Мои любимые находки»."
                    : "Try “Weekend ride essentials” or “My favorite finds”."}
                </p>
                <form onSubmit={create}>
                  <label>
                    {ru ? "Название набора" : "Set title"}
                    <input
                      name="title"
                      required
                      maxLength={120}
                      autoFocus
                      placeholder={
                        ru ? "Всё для велопоездки" : "Weekend ride essentials"
                      }
                      onChange={() => setDirty(true)}
                    />
                  </label>
                  <div className="sets-actions">
                    <button className="button coral" disabled={busy}>
                      {ru ? "Создать личный набор" : "Create private set"}
                    </button>
                    <button
                      type="button"
                      className="button light"
                      onClick={async () => {
                        if (await canLeave()) {
                          setCreating(false);
                          setDirty(false);
                        }
                      }}
                    >
                      {ru ? "Отмена" : "Cancel"}
                    </button>
                  </div>
                  {error && (
                    <p role="alert" className="sets-error">
                      {error}
                    </p>
                  )}
                </form>
              </div>
            ) : selected ? (
              <SetEditor
                key={selected.id}
                set={selected}
                ru={ru}
                dirty={dirty}
                onDirty={setDirty}
                onUpdate={update}
                onDelete={() => {
                  setSets((current) =>
                    current.filter((s) => s.id !== selected.id),
                  );
                  setActive(sets.find((s) => s.id !== selected.id)?.id || "");
                  setDirty(false);
                }}
              />
            ) : (
              <div className="sets-empty">
                <div className="sets-large-icon">
                  <Package size={42} />
                </div>
                <h2>
                  {ru
                    ? "Хорошие вещи стоит сохранить"
                    : "Good finds deserve a home"}
                </h2>
                <p>
                  {ru
                    ? "Соберите фото, описания и ссылки на магазины в одном наборе. Оставьте его личным или поделитесь одной ссылкой."
                    : "Bring photos, notes and shopping links together. Keep your set private or share it with one link."}
                </p>
                <button
                  className="button coral"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={18} />
                  {ru ? "Создать первый набор" : "Create your first set"}
                </button>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
function SetEditor({
  set,
  ru,
  dirty,
  onDirty,
  onUpdate,
  onDelete,
}: {
  set: ItemSet;
  ru: boolean;
  dirty: boolean;
  onDirty: (value: boolean) => void;
  onUpdate: (set: ItemSet) => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm(ru ? "ru" : "en");
  const [seoOpen, setSeoOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const [form, setForm] = useState<SetInput>({
    title: set.title,
    description: set.description,
    metaTitle: set.metaTitle,
    metaDescription: set.metaDescription,
    locale: set.locale,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false),
    [item, setItem] = useState<SetItem | null | undefined>(undefined);
  const field = (key: keyof SetInput, value: string) => {
    setForm({ ...form, [key]: value });
    onDirty(true);
    setSaved(false);
  };
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText((e as Error).message, ru));
    } finally {
      setBusy(false);
    }
  }
  const shareUrl = set.token ? `/sets/shared/${set.token}` : "";
  return (
    <>
      <div className="set-detail-heading">
        <div>
          <span className={`set-status ${set.token ? "public" : ""}`}>
            {set.token ? <Globe size={13} /> : <LockKeyhole size={13} />}{" "}
            {set.token
              ? ru
                ? "Опубликован"
                : "Public"
              : ru
                ? "Личный набор"
                : "Private set"}
          </span>
          <h2>{set.title}</h2>
        </div>
        <details
          className="set-page-menu"
          ref={menu}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              menu.current!.open = false;
              menu.current?.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className="icon-button"
            aria-label={ru ? "Меню набора" : "Set menu"}
          >
            <MoreHorizontal size={21} />
          </summary>
          <div className="set-page-menu-panel">
            <button
              type="button"
              onClick={() => {
                menu.current!.open = false;
                setSeoOpen(true);
              }}
            >
              <Settings2 size={16} />
              {ru ? "SEO и язык" : "SEO & language"}
            </button>
            <button
              className="set-menu-delete"
              title={ru ? "Удалить набор" : "Delete set"}
              aria-label={ru ? "Удалить набор" : "Delete set"}
              disabled={busy}
              onClick={async () => {
                if (
                  await confirm(
                    ru
                      ? `Удалить «${set.title}» со всеми вещами и фотографиями? Это действие нельзя отменить.`
                      : `Delete “${set.title}” and all its items and photos? This cannot be undone.`,
                  )
                )
                  void act(async () => {
                    await request(`/${set.id}`, "DELETE");
                    onDelete();
                  });
              }}
            >
              <Trash2 size={16} /> {ru ? "Удалить набор" : "Delete set"}
            </button>
          </div>
        </details>
      </div>
      <div className="set-sharing">
        <div>
          {set.token ? <Globe size={22} /> : <LockKeyhole size={22} />}
          <span>
            <strong>
              {set.token
                ? ru
                  ? "Доступен по ссылке и для поисковиков"
                  : "Visible by link and to search engines"
                : ru
                  ? "Этот набор виден только вам"
                  : "Only you can see this set"}
            </strong>
            <small>
              {set.token
                ? ru
                  ? "Сохранённые изменения сразу появятся на публичной странице."
                  : "Saved changes appear on the public page immediately."
                : ru
                  ? "При повторной публикации ссылка останется прежней."
                  : "Publishing again restores the same link."}
            </small>
          </span>
        </div>
        <button
          className="button light"
          disabled={busy || (!set.token && (dirty || !set.items.length))}
          title={
            !set.items.length
              ? ru
                ? "Сначала добавьте вещь"
                : "Add an item first"
              : dirty
                ? ru
                  ? "Сначала сохраните изменения"
                  : "Save changes first"
                : undefined
          }
          onClick={async () => {
            if (
              await confirm(
                set.token
                  ? ru
                    ? "Закрыть публичный доступ? Набор, автор и фотографии будут скрыты. Повторная публикация восстановит эту же ссылку."
                    : "Revoke public access? The collection, author and photos will be hidden. Publishing again restores this same link."
                  : ru
                    ? "Опубликовать этот набор? Его вещи, фотографии и ссылки будут доступны всем и могут появиться в поисковиках."
                    : "Publish this set? Its items, photos and links will be available to everyone and may appear in search engines.",
                set.token ? "revoke" : "publish",
              )
            )
              void act(async () =>
                onUpdate(
                  await request(`/${set.id}/visibility`, "POST", {
                    public: !set.token,
                  }),
                ),
              );
          }}
        >
          {set.token
            ? ru
              ? "Закрыть доступ"
              : "Revoke link"
            : ru
              ? "Поделиться"
              : "Share set"}
        </button>
      </div>
      {set.token && (
        <div className="set-share-link">
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            {ru ? "Открыть публичную страницу" : "Open public page"}
            <ArrowUpRight size={15} />
          </a>
          <button
            className="text-link"
            onClick={() =>
              void act(async () => {
                await navigator.clipboard.writeText(
                  new URL(shareUrl, location.origin).href,
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied
              ? ru
                ? "Скопировано"
                : "Copied"
              : ru
                ? "Копировать ссылку"
                : "Copy link"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="sets-error">
          {error}
        </p>
      )}
      <form
        className="set-details-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            onUpdate(await request(`/${set.id}`, "PATCH", form));
            onDirty(false);
            setSaved(true);
          });
        }}
      >
        <div className="sets-section-label">
          {ru ? "О НАБОРЕ" : "ABOUT THIS SET"}
        </div>
        <label>
          {ru ? "Название" : "Title"}
          <input
            required
            maxLength={120}
            value={form.title}
            onChange={(e) => field("title", e.target.value)}
          />
        </label>
        <label>
          {ru ? "Описание · необязательно" : "Description · optional"}
          <textarea
            rows={3}
            maxLength={2000}
            value={form.description}
            onChange={(e) => field("description", e.target.value)}
            placeholder={
              ru
                ? "Для кого этот набор и почему вы выбрали эти вещи?"
                : "Who is this set for, and why did you choose these items?"
            }
          />
        </label>
        <div className="sets-actions">
          <button className="button light" disabled={busy || !dirty}>
            {busy
              ? ru
                ? "Сохранение…"
                : "Saving…"
              : ru
                ? "Сохранить изменения"
                : "Save changes"}
          </button>
          {saved && !dirty && (
            <span className="sets-saved" role="status">
              <Check size={15} />
              {ru ? "Сохранено" : "Saved"}
            </span>
          )}
          {dirty && (
            <span className="sets-muted">
              {ru ? "Есть несохранённые изменения" : "Unsaved changes"}
            </span>
          )}
        </div>
      </form>
      {seoOpen && (
        <SetSeoDialog
          set={set}
          ru={ru}
          onClose={() => setSeoOpen(false)}
          onSave={(updated) => {
            onUpdate(updated);
            setForm((current) => ({
              ...current,
              metaTitle: updated.metaTitle,
              metaDescription: updated.metaDescription,
              locale: updated.locale,
            }));
            setSeoOpen(false);
          }}
        />
      )}
      <div className="set-items-heading">
        <h3>
          {ru ? "Вещи в наборе" : "Items in this set"}{" "}
          <span>{set.items.length}</span>
        </h3>
        <button className="button coral" onClick={() => setItem(null)}>
          <Plus size={17} />
          {ru ? "Добавить вещь" : "Add item"}
        </button>
      </div>
      {!set.items.length ? (
        <div className="set-items-empty">
          <ImagePlus size={30} />
          <h4>
            {ru ? "Начните с первой находки" : "Start with your first find"}
          </h4>
          <p>
            {ru
              ? "Добавьте название, фото и ссылки на магазины."
              : "Add a title, a photo, and shopping links."}
          </p>
        </div>
      ) : (
        <div className="set-edit-items">
          {set.items.map((entry) => (
            <article className="set-edit-item" key={entry.id}>
              <div className="set-edit-thumbnail">
                {entry.photo ? (
                  <img
                    src={itemPhotoUrl(entry)}
                    alt={entry.title}
                    width="100"
                    height="100"
                  />
                ) : (
                  <Package size={28} />
                )}
              </div>
              <div className="set-edit-item-text">
                <h4>{entry.title}</h4>
                {entry.description && <p>{entry.description}</p>}
                <div className="set-link-tags">
                  {marketplaceOrder(ru ? "ru" : "en").map(
                    (market) =>
                      entry[market] && (
                        <MarketplaceLabel
                          key={market}
                          market={market}
                          compact
                        />
                      ),
                  )}
                  {!!entry.links.length && (
                    <span>{countedLabel(entry.links.length, ru, "links")}</span>
                  )}
                </div>
              </div>
              <button
                className="icon-button"
                aria-label={(ru ? "Изменить " : "Edit ") + entry.title}
                onClick={() => setItem(entry)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={(ru ? "Удалить " : "Delete ") + entry.title}
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirm(
                      ru
                        ? `Удалить «${entry.title}» и его фотографию?`
                        : `Delete “${entry.title}” and its photo?`,
                    )
                  )
                    void act(async () =>
                      onUpdate(
                        await request(`/${set.id}/items/${entry.id}`, "DELETE"),
                      ),
                    );
                }}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
      {item !== undefined && (
        <ItemEditor
          set={set}
          item={item}
          ru={ru}
          onUpdate={onUpdate}
          onClose={() => setItem(undefined)}
        />
      )}
    </>
  );
}
function ItemEditor({
  set,
  item,
  ru,
  onUpdate,
  onClose,
}: {
  set: ItemSet;
  item: SetItem | null;
  ru: boolean;
  onUpdate: (set: ItemSet) => void;
  onClose: () => void;
}) {
  const confirm = useConfirm(ru ? "ru" : "en");
  const dialog = useRef<HTMLDialogElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ItemInput>(
    item || {
      title: "",
      description: "",
      wb: "",
      ozon: "",
      amazon: "",
      ebay: "",
      links: [],
    },
  );
  const [id, setId] = useState(item?.id),
    [photo, setPhoto] = useState(item?.photo || null),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [changed, setChanged] = useState(false);
  const close = async () => {
    if (
      !busy &&
      (!changed ||
        (await confirm(
          ru
            ? "Отменить несохранённые изменения вещи?"
            : "Discard unsaved item changes?",
          "discard",
        )))
    )
      onClose();
  };
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
    const warn = (event: BeforeUnloadEvent) => {
      if (changed) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  const field = (key: keyof ItemInput, value: unknown) => {
    setForm({ ...form, [key]: value });
    setChanged(true);
  };
  const validation = itemInput.safeParse(form);
  const hasLink =
    [form.wb, form.ozon, form.amazon, form.ebay].some((value) =>
      value.trim(),
    ) || form.links.some((link) => link.url.trim());
  const saveHint = !form.title.trim()
    ? ru
      ? "Укажите название вещи."
      : "Enter an item title."
    : !hasLink
      ? errorText("linkRequired", ru)
      : !validation.success
        ? ru
          ? "Проверьте ссылки и заполните их названия."
          : "Check the links and fill in their labels."
        : "";
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!validation.success) {
      setError(saveHint);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let result: ItemSet & { savedItemId?: string } = await request(
        `/${set.id}/items${id ? `/${id}` : ""}`,
        id ? "PATCH" : "POST",
        form,
      );
      const savedId = id || result.savedItemId!;
      setId(savedId);
      onUpdate(result);
      if (file) {
        try {
          result = await request(
            `/${set.id}/items/${savedId}/photo`,
            "PUT",
            file,
          );
          onUpdate(result);
        } catch (e) {
          setError(
            (ru
              ? "Вещь сохранена, но фото не загружено. "
              : "Item saved, but photo upload failed. ") +
              errorText((e as Error).message, ru),
          );
          return;
        }
      }
      onClose();
    } catch (e) {
      setError(errorText((e as Error).message, ru));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="set-item-dialog"
      aria-labelledby="item-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={save}>
        <div className="set-dialog-heading">
          <h2 id="item-editor-title">
            {id
              ? ru
                ? "Изменить вещь"
                : "Edit item"
              : ru
                ? "Новая вещь"
                : "Add an item"}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={ru ? "Закрыть" : "Close"}
            disabled={busy}
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <fieldset disabled={busy}>
          <div className="set-photo-upload">
            <div className="set-photo-preview">
              {preview || photo ? (
                <img
                  src={preview || itemPhotoUrl({ id, photo } as SetItem)}
                  alt={ru ? "Предпросмотр фото" : "Photo preview"}
                />
              ) : (
                <ImagePlus size={28} aria-hidden="true" />
              )}
            </div>
            <div className="set-photo-controls">
              <strong>{ru ? "Фото вещи" : "Item photo"}</strong>
              <span className="set-photo-hint">
                JPEG, PNG, WebP, AVIF · {ru ? "до 8 МБ" : "up to 8 MB"}
              </span>
              <div className="set-photo-actions">
                <button
                  type="button"
                  className="button light"
                  onClick={() => photoInput.current?.click()}
                >
                  {file || photo
                    ? ru
                      ? "Заменить"
                      : "Replace"
                    : ru
                      ? "Выбрать фото"
                      : "Choose photo"}
                </button>
                {(file || photo) && (
                  <button
                    type="button"
                    className="set-photo-remove"
                    onClick={async () => {
                      if (
                        !(await confirm(
                          ru ? "Удалить фотографию?" : "Remove this photo?",
                        ))
                      )
                        return;
                      setBusy(true);
                      try {
                        if (id && photo)
                          onUpdate(
                            await request(
                              `/${set.id}/items/${id}/photo`,
                              "DELETE",
                            ),
                          );
                        setPhoto(null);
                        setFile(null);
                        setPreview("");
                        if (photoInput.current) photoInput.current.value = "";
                        setError("");
                      } catch (e) {
                        setError(errorText((e as Error).message, ru));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {ru ? "Удалить" : "Remove"}
                  </button>
                )}
              </div>
              <input
                ref={photoInput}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp,image/avif"
                aria-label={ru ? "Фотография вещи" : "Item photo"}
                onChange={(e) => {
                  const next = e.target.files?.[0];
                  e.target.value = "";
                  if (!next) return;
                  if (next.size > 8 * 1024 * 1024) {
                    setError(errorText("fileTooLarge", ru));
                    return;
                  }
                  if (
                    ![
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "image/avif",
                    ].includes(next.type)
                  ) {
                    setError(errorText("invalidImage", ru));
                    return;
                  }
                  setFile(next);
                  setChanged(true);
                  setError("");
                }}
              />
            </div>
          </div>
          <label>
            {ru ? "Название вещи" : "Item title"}
            <input
              autoFocus
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => field("title", e.target.value)}
              placeholder={
                ru
                  ? "Например, велосипедный шлем"
                  : "For example, a cycling helmet"
              }
            />
          </label>
          <label>
            {ru ? "Описание · необязательно" : "Description · optional"}
            <textarea
              rows={3}
              maxLength={3000}
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <div className="sets-section-label">
            {ru
              ? "ГДЕ НАЙТИ · МИНИМУМ ОДНА ССЫЛКА"
              : "WHERE TO FIND IT · AT LEAST ONE LINK"}
          </div>
          <div className="set-marketplace-fields">
            {marketplaceOrder(ru ? "ru" : "en").map((market) => (
              <label key={market}>
                <MarketplaceLabel market={market} />
                <input
                  value={form[market]}
                  maxLength={2000}
                  onChange={(e) => field(market, e.target.value)}
                  placeholder={
                    market === "amazon"
                      ? ru
                        ? "ASIN или ссылка Amazon"
                        : "Amazon ASIN or URL"
                      : market === "ebay"
                        ? ru
                          ? "Номер товара или ссылка eBay"
                          : "eBay item number or URL"
                        : market === "wb"
                          ? ru
                            ? "Артикул или ссылка WB"
                            : "WB SKU or URL"
                          : ru
                            ? "Артикул или ссылка Ozon"
                            : "Ozon SKU or URL"
                  }
                />
              </label>
            ))}
          </div>
          {form.links.map((link, index) => (
            <div className="set-custom-link" key={index}>
              <label>
                {ru ? "Название ссылки" : "Link label"}
                <input
                  required
                  maxLength={80}
                  value={link.label}
                  onChange={(e) =>
                    field(
                      "links",
                      form.links.map((old, i) =>
                        i === index ? { ...old, label: e.target.value } : old,
                      ),
                    )
                  }
                  placeholder={ru ? "Сайт производителя" : "Brand website"}
                />
              </label>
              <label>
                URL
                <input
                  type="url"
                  required
                  maxLength={2000}
                  value={link.url}
                  onChange={(e) =>
                    field(
                      "links",
                      form.links.map((old, i) =>
                        i === index ? { ...old, url: e.target.value } : old,
                      ),
                    )
                  }
                  placeholder="https://…"
                />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={
                  (ru ? "Удалить ссылку " : "Remove link ") + (index + 1)
                }
                onClick={async () => {
                  if (
                    await confirm(
                      ru ? "Удалить эту ссылку?" : "Remove this link?",
                    )
                  )
                    field(
                      "links",
                      form.links.filter((_, i) => i !== index),
                    );
                }}
              >
                <X size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-link"
            disabled={form.links.length >= 12}
            onClick={() =>
              field("links", [...form.links, { label: "", url: "" }])
            }
          >
            <Plus size={15} />
            {ru ? "Добавить другую ссылку" : "Add another link"}
          </button>
        </fieldset>
        {error && (
          <p className="sets-error" role="alert">
            {error}
          </p>
        )}
        {saveHint && (
          <p id="item-save-hint" className="item-save-hint" role="status">
            {saveHint}
          </p>
        )}
        <div className="set-dialog-footer">
          <button
            type="button"
            className="button light"
            disabled={busy}
            onClick={close}
          >
            {ru ? "Отмена" : "Cancel"}
          </button>
          <button
            className="button coral"
            disabled={busy || !validation.success}
            aria-describedby={saveHint ? "item-save-hint" : undefined}
          >
            {busy
              ? ru
                ? "Сохранение…"
                : "Saving…"
              : ru
                ? "Сохранить вещь"
                : "Save item"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function SetSeoDialog({
  set,
  ru,
  onSave,
  onClose,
}: {
  set: ItemSet;
  ru: boolean;
  onSave: (set: ItemSet) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirm = useConfirm(ru ? "ru" : "en");
  const [metaTitle, setTitle] = useState(set.metaTitle);
  const [metaDescription, setDescriptionValue] = useState(set.metaDescription);
  const [locale, setLocale] = useState(set.locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed =
    metaTitle !== set.metaTitle ||
    metaDescription !== set.metaDescription ||
    locale !== set.locale;
  const preview = { ...set, metaTitle, metaDescription, locale };
  async function close() {
    if (
      !busy &&
      (!changed ||
        (await confirm(
          ru ? "Выйти без сохранения?" : "Leave without saving?",
          "discard",
        )))
    )
      onClose();
  }
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  return (
    <dialog
      ref={dialog}
      className="set-item-dialog set-seo-dialog"
      aria-labelledby="set-seo-title"
      onCancel={(event) => {
        event.preventDefault();
        void close();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            onSave(
              await request(`/${set.id}`, "PATCH", {
                ...set,
                metaTitle,
                metaDescription,
                locale,
              }),
            );
          } catch (error) {
            setError(errorText((error as Error).message, ru));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="set-dialog-heading">
          <h2 id="set-seo-title">{ru ? "SEO и язык" : "SEO & language"}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={ru ? "Закрыть" : "Close"}
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <p className="sets-muted">
          {ru
            ? "Всё заполняется автоматически из названия и описания набора. Язык берём из интерфейса при создании. Здесь можно задать свои значения."
            : "Titles and descriptions are generated from your set. Language follows the interface when you create it. Override these defaults here."}
        </p>
        <fieldset disabled={busy}>
          <label>
            {ru ? "SEO-заголовок" : "SEO title"}
            <input
              maxLength={70}
              value={metaTitle}
              placeholder={setSeoTitle({ ...preview, metaTitle: "" })}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            {ru ? "Метаописание" : "Meta description"}
            <textarea
              rows={2}
              maxLength={160}
              value={metaDescription}
              placeholder={setDescription({ ...preview, metaDescription: "" })}
              onChange={(event) => setDescriptionValue(event.target.value)}
            />
          </label>
          <label>
            {ru ? "Язык публичной страницы" : "Public page language"}
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as "en" | "ru")}
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </label>
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setTitle("");
              setDescriptionValue("");
            }}
          >
            {ru
              ? "Автоматические заголовок и описание"
              : "Use automatic title and description"}
          </button>
          <div className="set-seo-preview">
            <span>SpiderRoute</span>
            <strong>{setSeoTitle(preview)}</strong>
            <p>{setDescription(preview)}</p>
          </div>
          <p className="sets-muted">
            {ru
              ? "Личные наборы не индексируются. Публичные страницы получают метаданные, превью для соцсетей и запись в sitemap."
              : "Private sets are not indexed. Public sets include metadata, social previews and a sitemap entry."}
          </p>
          {error && (
            <p role="alert" className="sets-error">
              {error}
            </p>
          )}
          <div className="set-dialog-footer">
            <button type="button" className="button light" onClick={close}>
              {ru ? "Отмена" : "Cancel"}
            </button>
            <button className="button coral" disabled={!changed || busy}>
              {busy
                ? ru
                  ? "Сохранение…"
                  : "Saving…"
                : ru
                  ? "Сохранить"
                  : "Save"}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
