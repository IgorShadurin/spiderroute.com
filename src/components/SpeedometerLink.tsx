import { Smartphone, ArrowUpRight } from "lucide-react";

const appStoreUrl =
  "https://apps.apple.com/us/app/speedometer-app-gps-tracker/id6801154513";

export function SpeedometerLink({
  locale = "en",
  compact = false,
}: {
  locale?: "en" | "ru";
  compact?: boolean;
}) {
  const label =
    locale === "ru"
      ? "Speedometer — GPS-трекер в App Store"
      : "Speedometer GPS Tracker on the App Store";
  return (
    <a
      className={
        compact ? "icon-button speedometer-link" : "speedometer-footer-link"
      }
      href={appStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
    >
      <Smartphone size={19} aria-hidden="true" />
      {!compact && (
        <>
          Speedometer <ArrowUpRight size={15} aria-hidden="true" />
        </>
      )}
    </a>
  );
}
