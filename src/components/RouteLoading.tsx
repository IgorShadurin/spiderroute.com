import { Route } from "lucide-react";
export function RouteLoading({ locale }: { locale: string }) {
  return (
    <div
      className="route-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="route-loading-heading" aria-hidden="true" />
      <div className="route-loading-map">
        <Route size={36} aria-hidden="true" />
        <strong>
          {locale === "ru" ? "Загружаем маршрут…" : "Loading route…"}
        </strong>
        <div className="route-loading-track" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
