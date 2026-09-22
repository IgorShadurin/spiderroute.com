"use client";

import { useEffect, useState, useRef } from "react";
import {
  Copy,
  Download,
  LoaderCircle,
  CircleAlert,
  ChevronDown,
} from "lucide-react";
import { FeedbackToast } from "./FeedbackToast";

/** Shared publishing controls: the copy, open and QR actions use one URL. */
export function ShareLink({
  url,
  locale,
  name = "spiderroute",
}: {
  url: string;
  locale: "ru" | "en";
  name?: string;
}) {
  const ru = locale === "ru";
  const [absolute, setAbsolute] = useState("");
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  const [png, setPng] = useState("");
  const [jpeg, setJpeg] = useState("");
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenu(false);
        menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape, true);
    };
  }, [menu]);
  const [feedback, setFeedback] = useState<{
    id: number;
    message: string;
    error?: boolean;
  }>();
  const report = (message: string, error = false) =>
    setFeedback({ id: Date.now(), message, error });
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    let pngUrl = "";
    let jpegUrl = "";
    const target = new URL(url, window.location.origin).href;
    setAbsolute(target);
    setImage("");
    setFailed(false);
    setPng("");
    setJpeg("");
    setMenu(false);
    void (async () => {
      const { default: QR } = await import("qr-code-styling");
      const code = new QR({
        width: 1024,
        height: 1024,
        type: "svg",
        data: target,
        margin: 64,
        image: new URL("/brand/route-qr-icon.svg", window.location.origin).href,
        qrOptions: { errorCorrectionLevel: "H" },
        dotsOptions: { type: "rounded", color: "#17392c" },
        cornersSquareOptions: { type: "extra-rounded", color: "#17392c" },
        cornersDotOptions: { type: "dot", color: "#17392c" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: {
          imageSize: 0.25,
          margin: 12,
          hideBackgroundDots: true,
          saveAsBlob: true,
        },
      });
      const blob = await code.getRawData("svg");
      if (cancelled || !(blob instanceof Blob)) return;
      objectUrl = URL.createObjectURL(blob);

      const pngBlob = await code.getRawData("png");
      if (cancelled || !(pngBlob instanceof Blob)) return;
      pngUrl = URL.createObjectURL(pngBlob);

      const jpegBlob = await code.getRawData("jpeg");
      if (cancelled || !(jpegBlob instanceof Blob)) return;
      jpegUrl = URL.createObjectURL(jpegBlob);
      const decoded = new Image();
      decoded.src = objectUrl;
      await decoded.decode();
      if (cancelled) return;
      setImage(objectUrl);
      setPng(pngUrl);
      setJpeg(jpegUrl);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (pngUrl) URL.revokeObjectURL(pngUrl);
      if (jpegUrl) URL.revokeObjectURL(jpegUrl);
    };
  }, [url]);
  const filename = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 70) || "spiderroute"}-qr`;
  return (
    <section
      className="share-kit"
      aria-label={ru ? "Ссылка и QR-код" : "Link and QR code"}
    >
      <div className="share-kit-visual">
        <div className="share-kit-code">
          {image ? (
            <img
              src={image}
              width={160}
              height={160}
              alt={ru ? "QR-код публичной ссылки" : "Public link QR code"}
            />
          ) : (
            <div role="status" className="qr-loading" aria-busy={!failed}>
              {failed ? (
                <CircleAlert size={26} />
              ) : (
                <LoaderCircle
                  className="loading-spinner"
                  size={26}
                  aria-hidden="true"
                />
              )}
              <span>
                {failed
                  ? ru
                    ? "QR-код недоступен"
                    : "QR unavailable"
                  : ru
                    ? "Создаём QR…"
                    : "Creating QR…"}
              </span>
            </div>
          )}
        </div>
        <div className="qr-download" ref={menuRef}>
          {png ? (
            <a
              className="button light small"
              href={png}
              download={`${filename}.png`}
            >
              <Download size={15} />
              {ru ? "Скачать QR" : "Download QR"}
            </a>
          ) : (
            <button className="button light small" disabled>
              <Download size={15} />
              {ru ? "Скачать QR" : "Download QR"}
            </button>
          )}
          <button
            className="button light small qr-format-toggle"
            disabled={!png}
            aria-label={ru ? "Формат QR-кода" : "QR code format"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <ChevronDown size={16} />
          </button>
          {menu && (
            <div
              className="qr-format-menu"
              aria-label={ru ? "Скачать в формате" : "Download format"}
            >
              {[
                { label: "PNG", url: png, ext: "png" },
                { label: "JPEG", url: jpeg, ext: "jpg" },
                { label: "SVG", url: image, ext: "svg" },
              ].map(
                (format) =>
                  format.url && (
                    <a
                      key={format.ext}
                      href={format.url}
                      download={`${filename}.${format.ext}`}
                      onClick={() => setMenu(false)}
                    >
                      <Download size={14} />
                      {format.label}
                    </a>
                  ),
              )}
            </div>
          )}
        </div>
      </div>
      <div className="share-kit-content">
        <strong>{ru ? "Ссылка" : "Link"}</strong>
        <p className="share-kit-hint">
          {ru
            ? "Отправьте ссылку или сохраните QR-код."
            : "Send the link or save the QR code."}
        </p>
        <div className="share-link-field">
          <input
            readOnly
            value={absolute || url}
            aria-label={ru ? "Ссылка для публикации" : "Sharing link"}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            className="icon-button"
            disabled={!absolute}
            aria-label={ru ? "Копировать ссылку" : "Copy link"}
            title={ru ? "Копировать ссылку" : "Copy link"}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(absolute);
                report(ru ? "Ссылка скопирована" : "Link copied");
              } catch {
                report(
                  ru
                    ? "Не удалось скопировать. Выделите ссылку и скопируйте вручную."
                    : "Could not copy. Select the link and copy manually.",
                  true,
                );
              }
            }}
          >
            <Copy size={18} />
          </button>
        </div>
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
    </section>
  );
}
