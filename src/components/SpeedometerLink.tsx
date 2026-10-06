import { Smartphone, ArrowUpRight } from "lucide-react";

import { APP_STORE_URL } from "@/lib/links";

export function SpeedometerLink({
  locale = "en",
  compact = false,
}: {
  locale?: "en" | "ru";
  compact?: boolean;
}) {
  const label =
    locale === "ru"
      ? "Bike Tracker SpiderRoute — GPS-трекер в App Store"
      : "Bike Tracker SpiderRoute — GPS Tracker on the App Store";
  return (
    <a
      className={
        compact ? "icon-button speedometer-link" : "speedometer-footer-link"
      }
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
    >
      <Smartphone size={19} aria-hidden="true" />
      {!compact && (
        <>
          Bike Tracker SpiderRoute <ArrowUpRight size={15} aria-hidden="true" />
        </>
      )}
    </a>
  );
}
