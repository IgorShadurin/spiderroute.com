import { sql, dataDir } from "./db";
import {
  profileInput,
  socialUrl,
  type PublicProfile,
  type SocialKind,
} from "../lib/profile";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import sharp from "sharp";
sql.exec(
  `CREATE TABLE IF NOT EXISTS user_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,first_name TEXT NOT NULL,last_name TEXT NOT NULL DEFAULT '',bio TEXT NOT NULL DEFAULT '',links TEXT NOT NULL DEFAULT '{}',public_email TEXT NOT NULL DEFAULT '',avatar TEXT,google_avatar TEXT,avatar_custom INTEGER NOT NULL DEFAULT 0)`,
);
const dir = join(dataDir, "avatars");
function row(id: string) {
  return sql
    .prepare(
      "SELECT p.* FROM user_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND u.disabled=0",
    )
    .get(id) as any;
}
export function ensureProfile(id: string, googleImage?: string | null) {
  const user = sql.prepare("SELECT name FROM users WHERE id=?").get(id) as
    { name: string } | undefined;
  if (!user) throw Error("notFound");
  const [first, ...last] = user.name.trim().split(/\s+/);
  sql
    .prepare(
      "INSERT OR IGNORE INTO user_profiles(user_id,first_name,last_name) VALUES(?,?,?)",
    )
    .run(id, first || "Explorer", last.join(" "));
  if (googleImage) {
    try {
      const url = new URL(googleImage);
      if (
        url.protocol === "https:" &&
        (url.hostname === "googleusercontent.com" ||
          url.hostname.endsWith(".googleusercontent.com"))
      )
        sql
          .prepare(
            "UPDATE user_profiles SET google_avatar=? WHERE user_id=? AND google_avatar IS NULL AND avatar_custom=0",
          )
          .run(googleImage, id);
    } catch {}
  }
}
export function getProfile(id: string): PublicProfile {
  ensureProfile(id);
  const p = row(id);
  if (!p) throw Error("notFound");
  const links = JSON.parse(p.links);
  return {
    id,
    firstName: p.first_name,
    lastName: p.last_name,
    bio: p.bio,
    publicEmail: p.public_email,
    youtube: links.youtube || { name: "", url: "" },
    telegram: links.telegram || { name: "", url: "" },
    instagram: links.instagram || { name: "", url: "" },
    avatarUrl: p.avatar
      ? `/avatars/${id}/${p.avatar}`
      : p.avatar_custom
        ? null
        : p.google_avatar,
  };
}
export function saveProfile(id: string, input: unknown) {
  const data = profileInput.parse(input);
  ensureProfile(id);
  for (const kind of ["youtube", "telegram", "instagram"] as SocialKind[])
    data[kind].url = socialUrl(kind, data[kind].url);
  sql.transaction(() => {
    sql
      .prepare(
        "UPDATE user_profiles SET first_name=?,last_name=?,bio=?,public_email=?,links=? WHERE user_id=?",
      )
      .run(
        data.firstName,
        data.lastName,
        data.bio,
        data.publicEmail,
        JSON.stringify({
          youtube: data.youtube,
          telegram: data.telegram,
          instagram: data.instagram,
        }),
        id,
      );
    sql
      .prepare("UPDATE users SET name=? WHERE id=?")
      .run([data.firstName, data.lastName].filter(Boolean).join(" "), id);
  })();
  return getProfile(id);
}
function remove(name: string | null) {
  if (name)
    try {
      unlinkSync(join(dir, name));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
}
export async function saveAvatar(id: string, bytes: Buffer) {
  ensureProfile(id);
  if (!row(id)) throw Error("notFound");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw Error("fileTooLarge");
  let output: Buffer;
  try {
    const source = sharp(bytes, {
      limitInputPixels: 25_000_000,
      animated: false,
    });
    const meta = await source.metadata();
    if (!["jpeg", "png", "webp", "avif", "heif"].includes(meta.format || ""))
      throw Error();
    output = await source
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw Error("invalidImage");
  }
  let previousAvatar: string | null = null;
  const name = randomUUID() + ".webp";
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(join(dir, name), output, { mode: 0o600, flag: "wx" });
    sql
      .transaction(() => {
        const current = row(id);
        if (!current) throw Error("notFound");
        previousAvatar = current.avatar;
        sql
          .prepare(
            "UPDATE user_profiles SET avatar=?,avatar_custom=1 WHERE user_id=?",
          )
          .run(name, id);
      })
      .immediate();
  } catch (e) {
    remove(name);
    throw e;
  }
  remove(previousAvatar);
  return getProfile(id);
}
export function deleteAvatar(id: string) {
  const p = row(id);
  if (!p) throw Error("notFound");
  sql
    .prepare(
      "UPDATE user_profiles SET avatar=NULL,avatar_custom=1 WHERE user_id=?",
    )
    .run(id);
  remove(p.avatar);
  return getProfile(id);
}
export function readAvatar(id: string, name: string) {
  const p = row(id);
  if (!p || p.avatar !== name || !/^[-a-f0-9]{36}\.webp$/.test(name))
    throw Error("notFound");
  return readFileSync(join(dir, name));
}
export function setAuthor(setId: string) {
  const row = sql
    .prepare("SELECT user_id FROM item_sets WHERE id=?")
    .get(setId) as { user_id: string } | undefined;
  if (!row) throw Error("notFound");
  return getProfile(row.user_id);
}
