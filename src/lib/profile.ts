import { z } from "zod";
export type SocialKind = "youtube" | "telegram" | "instagram";
export const socialNames = {
  youtube: "YouTube",
  telegram: "Telegram",
  instagram: "Instagram",
};
export function socialUrl(kind: SocialKind, input: string) {
  const value = input.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    const handle = value.replace(/^@/, "");
    if (!/^[\p{L}\p{N}_.-]{1,100}$/u.test(handle))
      throw Error("invalidProfile");
    return kind === "youtube"
      ? `https://www.youtube.com/@${handle}`
      : kind === "telegram"
        ? `https://t.me/${handle}`
        : `https://www.instagram.com/${handle}/`;
  }
  const url = new URL(value);
  const domains =
    kind === "youtube"
      ? ["youtube.com", "www.youtube.com", "m.youtube.com"]
      : kind === "telegram"
        ? ["t.me", "telegram.me"]
        : ["instagram.com", "www.instagram.com"];
  if (
    !domains.includes(url.hostname) ||
    url.username ||
    url.password ||
    !url.pathname.replace(/\//g, "") ||
    url.port
  )
    throw Error("invalidProfile");
  if (
    kind === "youtube" &&
    !/^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/.test(url.pathname)
  )
    throw Error("invalidProfile");
  if (kind !== "youtube" && !/^\/[\p{L}\p{N}_.-]+\/?$/u.test(url.pathname))
    throw Error("invalidProfile");
  return `https://${url.hostname}${url.pathname}`;
}
const social = (kind: SocialKind) =>
  z
    .object({
      name: z.string().trim().max(80).default(""),
      url: z
        .string()
        .trim()
        .max(500)
        .default("")
        .refine((value) => {
          try {
            socialUrl(kind, value);
            return true;
          } catch {
            return false;
          }
        }, "invalidProfile"),
    })
    .default({ name: "", url: "" });
export const profileInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).default(""),
  bio: z.string().trim().max(500).default(""),
  youtube: social("youtube"),
  telegram: social("telegram"),
  instagram: social("instagram"),
  publicEmail: z.union([z.literal(""), z.email()]).default(""),
});
export type ProfileInput = z.infer<typeof profileInput>;
export type PublicProfile = ProfileInput & {
  id: string;
  avatarUrl: string | null;
};
