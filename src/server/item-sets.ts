import { migrateSetShareLinks, reserveSetShareLink } from "./set-share-links";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { sql, dataDir } from "./db";
import {
  setInput,
  itemInput,
  type ItemSet,
  type SetItem,
} from "../lib/item-sets";

sql.exec(`
CREATE TABLE IF NOT EXISTS item_sets (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', meta_title TEXT NOT NULL DEFAULT '',
 meta_description TEXT NOT NULL DEFAULT '', locale TEXT NOT NULL DEFAULT 'en', token TEXT UNIQUE,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS item_sets_owner ON item_sets(user_id,updated_at);
CREATE TABLE IF NOT EXISTS set_items (
 id TEXT PRIMARY KEY, set_id TEXT NOT NULL REFERENCES item_sets(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', wb TEXT NOT NULL DEFAULT '',
 ozon TEXT NOT NULL DEFAULT '', links TEXT NOT NULL DEFAULT '[]', photo TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS set_items_set ON set_items(set_id,created_at);
`);
// Additive migration: keep every existing item and its marketplace links.
sql
  .transaction(() => {
    const columns = new Set(
      (
        sql.prepare("PRAGMA table_info(set_items)").all() as { name: string }[]
      ).map((column) => column.name),
    );
    for (const column of ["amazon", "ebay"]) {
      if (!columns.has(column))
        sql.exec(
          `ALTER TABLE set_items ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`,
        );
    }
  })
  .immediate();
migrateSetShareLinks(sql);
const photoDir = join(dataDir, "set-photos");
function removePhoto(name: string | null) {
  if (!name) return;
  try {
    unlinkSync(join(photoDir, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
export function ownedSet(id: string, user: string): ItemSet {
  const row = sql
    .prepare(
      `SELECT id,title,description,meta_title AS metaTitle,meta_description AS metaDescription,locale,token,created_at AS createdAt,updated_at AS updatedAt FROM item_sets WHERE id=? AND user_id=?`,
    )
    .get(id, user) as Omit<ItemSet, "items"> | undefined;
  if (!row) throw Error("notFound");
  const items = sql
    .prepare(
      "SELECT id,title,description,wb,ozon,amazon,ebay,links,photo FROM set_items WHERE set_id=? ORDER BY created_at,id",
    )
    .all(id) as (Omit<SetItem, "links"> & { links: string })[];
  return {
    ...row,
    items: items.map((item) => ({ ...item, links: JSON.parse(item.links) })),
  };
}
export function listSets(user: string) {
  return (
    sql
      .prepare(
        "SELECT id FROM item_sets WHERE user_id=? ORDER BY updated_at DESC,id",
      )
      .all(user) as { id: string }[]
  ).map(({ id }) => ownedSet(id, user));
}
export function saveSet(user: string, value: unknown, id?: string) {
  const existing = id ? ownedSet(id, user) : undefined;
  const owner = sql.prepare("SELECT locale FROM users WHERE id=?").get(user) as
    { locale: string } | undefined;
  const fallbackLocale =
    existing?.locale || (owner?.locale === "ru" ? "ru" : "en");
  const data = setInput.parse(
    typeof value === "object" && value !== null
      ? {
          ...value,
          locale: (value as { locale?: string }).locale ?? fallbackLocale,
        }
      : value,
  );
  const now = new Date().toISOString();
  if (id) {
    ownedSet(id, user);
    sql
      .prepare(
        "UPDATE item_sets SET title=?,description=?,meta_title=?,meta_description=?,locale=?,updated_at=? WHERE id=? AND user_id=?",
      )
      .run(
        data.title,
        data.description,
        data.metaTitle,
        data.metaDescription,
        data.locale,
        now,
        id,
        user,
      );
  } else {
    if (
      (
        sql
          .prepare("SELECT count(*) AS n FROM item_sets WHERE user_id=?")
          .get(user) as { n: number }
      ).n >= 100
    )
      throw Error("limitReached");
    id = randomUUID();
    sql
      .prepare(
        "INSERT INTO item_sets(id,user_id,title,description,meta_title,meta_description,locale,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        user,
        data.title,
        data.description,
        data.metaTitle,
        data.metaDescription,
        data.locale,
        now,
        now,
      );
  }
  return ownedSet(id, user);
}
export function setVisibility(id: string, user: string, publish: boolean) {
  return sql
    .transaction(() => {
      const set = ownedSet(id, user);
      if (publish && !set.items.length) throw Error("emptySet");
      const token = publish ? reserveSetShareLink(sql, id) : null;
      sql
        .prepare("UPDATE item_sets SET token=?,updated_at=? WHERE id=?")
        .run(token, new Date().toISOString(), id);
      return ownedSet(id, user);
    })
    .immediate();
}
export function publicSet(token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw Error("notFound");
  const row = sql
    .prepare(
      "SELECT s.id,s.user_id FROM item_sets s JOIN users u ON u.id=s.user_id WHERE s.token=? AND u.disabled=0",
    )
    .get(token) as { id: string; user_id: string } | undefined;
  if (!row) throw Error("notFound");
  return ownedSet(row.id, row.user_id);
}
export function publicSetsForSitemap() {
  return sql
    .prepare(
      "SELECT s.token,s.updated_at FROM item_sets s JOIN users u ON u.id=s.user_id WHERE s.token IS NOT NULL AND u.disabled=0",
    )
    .all() as { token: string; updated_at: string }[];
}
export function deleteSet(id: string, user: string) {
  const set = ownedSet(id, user);
  sql.prepare("DELETE FROM item_sets WHERE id=? AND user_id=?").run(id, user);
  set.items.forEach((item) => removePhoto(item.photo));
}
export function saveItem(
  setId: string,
  user: string,
  value: unknown,
  id?: string,
) {
  const set = ownedSet(setId, user);
  const data = itemInput.parse(value);
  if (id && !set.items.some((item) => item.id === id)) throw Error("notFound");
  if (!id && set.items.length >= 100) throw Error("limitReached");
  const savedItemId = id || randomUUID();
  sql.transaction(() => {
    if (id)
      sql
        .prepare(
          "UPDATE set_items SET title=?,description=?,wb=?,ozon=?,amazon=?,ebay=?,links=? WHERE id=? AND set_id=?",
        )
        .run(
          data.title,
          data.description,
          data.wb,
          data.ozon,
          data.amazon,
          data.ebay,
          JSON.stringify(data.links),
          id,
          setId,
        );
    else
      sql
        .prepare(
          "INSERT INTO set_items(id,set_id,title,description,wb,ozon,amazon,ebay,links,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          savedItemId,
          setId,
          data.title,
          data.description,
          data.wb,
          data.ozon,
          data.amazon,
          data.ebay,
          JSON.stringify(data.links),
          new Date().toISOString(),
        );
    sql
      .prepare("UPDATE item_sets SET updated_at=? WHERE id=?")
      .run(new Date().toISOString(), setId);
  })();
  return { ...ownedSet(setId, user), savedItemId };
}
export function deleteItem(setId: string, user: string, id: string) {
  const item = ownedSet(setId, user).items.find((item) => item.id === id);
  if (!item) throw Error("notFound");
  sql.transaction(() => {
    sql.prepare("DELETE FROM set_items WHERE id=? AND set_id=?").run(id, setId);
    sql
      .prepare("UPDATE item_sets SET updated_at=? WHERE id=?")
      .run(new Date().toISOString(), setId);
  })();
  removePhoto(item.photo);
  return ownedSet(setId, user);
}
export async function saveItemPhoto(
  setId: string,
  user: string,
  id: string,
  bytes: Buffer,
) {
  const initial = ownedSet(setId, user).items.find((item) => item.id === id);
  if (!initial) throw Error("notFound");
  if (bytes.length > 8 * 1024 * 1024) throw Error("fileTooLarge");
  let output: Buffer;
  try {
    const source = sharp(bytes, {
      limitInputPixels: 25_000_000,
      animated: false,
    });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp", "avif"].includes(metadata.format || ""))
      throw Error();
    output = await source
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw Error("invalidImage");
  }
  // Re-check after decoding: a concurrent delete/replacement may have happened.
  let previousPhoto: string | null = null;
  mkdirSync(photoDir, { recursive: true, mode: 0o700 });
  const name = randomUUID() + ".webp";
  try {
    writeFileSync(join(photoDir, name), output, { flag: "wx", mode: 0o600 });
    sql
      .transaction(() => {
        const current = ownedSet(setId, user).items.find(
          (item) => item.id === id,
        );
        if (!current) throw Error("notFound");
        previousPhoto = current.photo;
        sql
          .prepare("UPDATE set_items SET photo=? WHERE id=? AND set_id=?")
          .run(name, id, setId);
        sql
          .prepare("UPDATE item_sets SET updated_at=? WHERE id=?")
          .run(new Date().toISOString(), setId);
      })
      .immediate();
  } catch (error) {
    removePhoto(name);
    throw error;
  }
  removePhoto(previousPhoto);
  return ownedSet(setId, user);
}
export function deleteItemPhoto(setId: string, user: string, id: string) {
  const item = ownedSet(setId, user).items.find((item) => item.id === id);
  if (!item) throw Error("notFound");
  sql.prepare("UPDATE set_items SET photo=NULL WHERE id=?").run(id);
  sql
    .prepare("UPDATE item_sets SET updated_at=? WHERE id=?")
    .run(new Date().toISOString(), setId);
  removePhoto(item.photo);
  return ownedSet(setId, user);
}
export function readItemPhoto(
  id: string,
  name: string,
  user?: string,
  token?: string | null,
) {
  const row = sql
    .prepare(
      "SELECT s.user_id,s.token,i.photo FROM set_items i JOIN item_sets s ON s.id=i.set_id JOIN users u ON u.id=s.user_id WHERE i.id=? AND u.disabled=0",
    )
    .get(id) as
    { user_id: string; token: string | null; photo: string | null } | undefined;
  if (
    !row ||
    row.photo !== name ||
    !/^[\da-f-]{36}\.webp$/.test(name) ||
    !(user === row.user_id || (token && row.token === token))
  )
    throw Error("notFound");
  try {
    return readFileSync(join(photoDir, name));
  } catch {
    throw Error("notFound");
  }
}
