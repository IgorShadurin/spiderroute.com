"use client";
import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Settings2,
  UserRound,
  Youtube,
  Send,
  Instagram,
  Mail,
} from "lucide-react";
import { Brand } from "./Brand";
import { ProfileCard } from "./ProfileCard";
import { useConfirm } from "./ConfirmationProvider";
import { ThemeToggle } from "./ThemeProvider";
import {
  profileInput,
  socialNames,
  type PublicProfile,
  type SocialKind,
} from "@/lib/profile";
export function ProfileEditor({
  initial,
  ru,
  homeHref,
}: {
  initial: PublicProfile;
  ru: boolean;
  homeHref: string;
}) {
  const [profile, setProfile] = useState(initial),
    [saved, setSaved] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  const picker = useRef<HTMLInputElement>(null),
    leaving = useRef(false);
  const confirm = useConfirm(ru ? "ru" : "en");
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved) || !!file;
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
      if (dirty && !leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function request(path: string, method: string, data?: unknown) {
    const response = await fetch("/api/profile" + path, {
      method,
      headers:
        data instanceof File ? {} : { "Content-Type": "application/json" },
      body:
        data instanceof File ? data : data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    return result as PublicProfile;
  }
  function field(key: string, value: unknown) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSuccess(false);
  }
  return (
    <div className="sets-page profile-page">
      <header className="sets-header">
        <a
          href={homeHref}
          onClick={async (event) => {
            if (dirty) {
              event.preventDefault();
              if (
                await confirm(
                  ru ? "Выйти без сохранения?" : "Leave without saving?",
                  "discard",
                )
              ) {
                leaving.current = true;
                window.location.assign(homeHref);
              }
            }
          }}
        >
          <Brand />
        </a>
        <ThemeToggle locale={ru ? "ru" : "en"} />
      </header>
      <main className="profile-layout">
        <section className="profile-form-column">
          <a
            className="sets-back"
            href="/sets"
            onClick={async (event) => {
              if (dirty) {
                event.preventDefault();
                if (
                  await confirm(
                    ru ? "Выйти без сохранения?" : "Leave without saving?",
                    "discard",
                  )
                ) {
                  leaving.current = true;
                  window.location.assign("/sets");
                }
              }
            }}
          >
            <ArrowLeft size={16} />
            {ru ? "Мои наборы" : "My sets"}
          </a>
          <div className="sets-eyebrow">
            {ru ? "ВАШ ПРОФИЛЬ" : "YOUR PROFILE"}
          </div>
          <h1>{ru ? "Расскажите о себе" : "Make it yours"}</h1>
          <p className="profile-intro">
            {ru
              ? "Имя, фото и ссылки, которые увидят люди в ваших публичных подборках."
              : "Your name, photo and links, shown with your public collections."}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!profileInput.safeParse(profile).success) {
                setError(
                  ru
                    ? "Проверьте имя, email и ссылки на профили."
                    : "Check your name, email and profile links.",
                );
                return;
              }
              setBusy(true);
              setError("");
              try {
                let result = await request("", "PATCH", profile);
                setSaved(result);
                if (file) {
                  try {
                    result = await request("/avatar", "PUT", file);
                  } catch {
                    setError(
                      ru
                        ? "Профиль сохранён, но фото не загрузилось. Выберите другое фото или повторите."
                        : "Profile saved, but the photo could not be uploaded. Try again.",
                    );
                    return;
                  }
                }
                setProfile(result);
                setSaved(result);
                setFile(null);
                setSuccess(true);
              } catch {
                setError(
                  ru
                    ? "Не удалось сохранить. Проверьте поля и попробуйте снова."
                    : "Could not save. Check your fields and try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              <div className="profile-photo-row">
                <div className="profile-photo">
                  {preview || profile.avatarUrl ? (
                    <img
                      src={preview || profile.avatarUrl!}
                      alt={ru ? "Ваше фото" : "Your photo"}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserRound size={32} />
                  )}
                </div>
                <div>
                  <strong>{ru ? "Фото профиля" : "Profile photo"}</strong>
                  <p>
                    {ru
                      ? "JPEG, PNG, WebP, AVIF · до 8 МБ"
                      : "JPEG, PNG, WebP, AVIF · up to 8 MB"}
                  </p>
                  <div className="set-photo-actions">
                    <button
                      className="button light"
                      type="button"
                      onClick={() => picker.current?.click()}
                    >
                      <Camera size={16} />
                      {ru ? "Выбрать фото" : "Choose photo"}
                    </button>
                    {(file || profile.avatarUrl) && (
                      <button
                        type="button"
                        className="set-photo-remove"
                        onClick={async () => {
                          if (
                            !(await confirm(
                              ru
                                ? "Удалить фото профиля?"
                                : "Remove profile photo?",
                            ))
                          )
                            return;
                          setBusy(true);
                          try {
                            const result = await request("/avatar", "DELETE");
                            setProfile((current) => ({
                              ...current,
                              avatarUrl: result.avatarUrl,
                            }));
                            setSaved((current) => ({
                              ...current,
                              avatarUrl: result.avatarUrl,
                            }));
                            setFile(null);
                          } catch {
                            setError(
                              ru
                                ? "Не удалось удалить фото."
                                : "Could not remove photo.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {ru ? "Удалить" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={picker}
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => {
                    const next = event.target.files?.[0];
                    event.target.value = "";
                    if (!next) return;
                    if (next.size > 8 * 1024 * 1024) {
                      setError(
                        ru
                          ? "Выберите фото до 8 МБ."
                          : "Choose a photo under 8 MB.",
                      );
                      return;
                    }
                    setFile(next);
                    setSuccess(false);
                    setError("");
                  }}
                />
              </div>
              <div className="profile-name-fields">
                <label>
                  {ru ? "Имя" : "First name"}
                  <input
                    required
                    maxLength={80}
                    autoComplete="given-name"
                    value={profile.firstName}
                    onChange={(e) => field("firstName", e.target.value)}
                  />
                </label>
                <label>
                  {ru ? "Фамилия" : "Last name"}
                  <input
                    maxLength={80}
                    autoComplete="family-name"
                    value={profile.lastName}
                    onChange={(e) => field("lastName", e.target.value)}
                  />
                </label>
              </div>
              <label>
                {ru ? "О себе · необязательно" : "About you · optional"}
                <textarea
                  maxLength={500}
                  rows={3}
                  value={profile.bio}
                  onChange={(e) => field("bio", e.target.value)}
                  placeholder={
                    ru
                      ? "Чем увлекаетесь и что собираете в подборках?"
                      : "What do you enjoy and collect?"
                  }
                />
              </label>
              <div className="profile-section-heading">
                <h2>{ru ? "Где вас найти" : "Find you online"}</h2>
                <p>
                  {ru
                    ? "Заполните только нужное. Пустые ссылки не показываются."
                    : "Add only what you want to share. Empty links stay hidden."}
                </p>
              </div>
              {(["youtube", "telegram", "instagram"] as SocialKind[]).map(
                (kind) => {
                  const Icon = {
                    youtube: Youtube,
                    telegram: Send,
                    instagram: Instagram,
                  }[kind];
                  return (
                    <div className="profile-social-row" key={kind}>
                      <div className="profile-social-title">
                        <Icon size={20} />
                        <strong>{socialNames[kind]}</strong>
                      </div>
                      <div className="profile-social-fields">
                        <label>
                          {ru ? "Название" : "Display name"}
                          <input
                            maxLength={80}
                            value={profile[kind].name}
                            placeholder={
                              ru ? "Как показать ссылку" : "Link label"
                            }
                            onChange={(e) =>
                              field(kind, {
                                ...profile[kind],
                                name: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {ru ? "Ник или ссылка" : "Handle or URL"}
                          <input
                            maxLength={500}
                            value={profile[kind].url}
                            placeholder={
                              kind === "youtube"
                                ? "@your-channel"
                                : kind === "telegram"
                                  ? "@username"
                                  : "@username"
                            }
                            onChange={(e) =>
                              field(kind, {
                                ...profile[kind],
                                url: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                },
              )}
              <label>
                <span className="profile-social-title">
                  <Mail size={18} />
                  {ru
                    ? "Публичный email · необязательно"
                    : "Public email · optional"}
                </span>
                <input
                  type="email"
                  value={profile.publicEmail}
                  onChange={(e) => field("publicEmail", e.target.value)}
                  placeholder="hello@example.com"
                />
                <small className="sets-muted">
                  {ru
                    ? "Будет виден посетителям. Email для входа не публикуется автоматически."
                    : "Visible to visitors. Your sign-in email is never published automatically."}
                </small>
              </label>
              <p className="profile-persistence-note">
                <Settings2 size={16} />
                {ru
                  ? "Повторный вход через Google не изменит ваши настройки профиля."
                  : "Signing in with Google again will keep your profile changes."}
              </p>
              {error && (
                <p role="alert" className="sets-error">
                  {error}
                </p>
              )}
              <div className="profile-save-row">
                <button className="button coral" disabled={!dirty || busy}>
                  {busy
                    ? ru
                      ? "Сохранение…"
                      : "Saving…"
                    : ru
                      ? "Сохранить профиль"
                      : "Save profile"}
                </button>
                {success && !dirty && (
                  <span role="status">
                    <Check size={16} />
                    {ru ? "Сохранено" : "Saved"}
                  </span>
                )}
              </div>
            </fieldset>
          </form>
        </section>
        <aside className="profile-preview">
          <div className="sets-eyebrow">
            {ru ? "ТАК ВАС УВИДЯТ" : "HOW YOU’LL APPEAR"}
          </div>
          <ProfileCard
            profile={{ ...profile, avatarUrl: preview || profile.avatarUrl }}
            ru={ru}
          />
          <p>
            {ru
              ? "Предпросмотр автора на публичной странице набора."
              : "A preview of the author on your public collection page."}
          </p>
        </aside>
      </main>
    </div>
  );
}
