import { Instagram, Mail } from "lucide-react";
export function SocialIcon({
  kind,
}: {
  kind: "youtube" | "telegram" | "instagram" | "email";
}) {
  if (kind === "youtube" || kind === "telegram")
    return (
      <img
        className={`social-brand-icon ${kind}`}
        src={`/brand/${kind}.${kind === "youtube" ? "png" : "svg"}`}
        width={24}
        height={24}
        alt=""
        aria-hidden="true"
      />
    );
  return (
    <span className={`social-brand-icon ${kind}`}>
      {kind === "email" ? <Mail size={18} /> : <Instagram size={18} />}
    </span>
  );
}
