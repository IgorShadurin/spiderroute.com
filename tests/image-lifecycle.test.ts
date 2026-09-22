import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

test("repeated and concurrent photo replacements retain only the current optimized image", async () => {
  const directory = mkdtempSync(join(tmpdir(), "image-lifecycle-"));
  process.env.DATA_DIR = directory;
  const { sql } = await import("../src/server/db");
  const items = await import("../src/server/item-sets");
  const profiles = await import("../src/server/profiles");
  try {
    sql
      .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
      .run("owner", "images@example.test", "Owner", "2026");
    const set = items.saveSet("owner", { title: "Images" });
    const item = items.saveItem(set.id, "owner", {
      title: "Photo",
      wb: "123456",
    }).items[0];
    const image = await sharp({
      create: { width: 2400, height: 1800, channels: 3, background: "#568aab" },
    })
      .png()
      .withMetadata()
      .toBuffer();
    for (let i = 0; i < 3; i++)
      await items.saveItemPhoto(set.id, "owner", item.id, image);
    await Promise.all(
      Array.from({ length: 6 }, () =>
        items.saveItemPhoto(set.id, "owner", item.id, image),
      ),
    );
    const photo = items.ownedSet(set.id, "owner").items[0].photo!;
    assert.deepEqual(readdirSync(join(directory, "set-photos")), [photo]);
    const metadata = await sharp(
      join(directory, "set-photos", photo),
    ).metadata();
    assert.equal(metadata.format, "webp");
    assert.ok(metadata.width! <= 1600);
    assert.equal(metadata.exif, undefined);
    await assert.rejects(
      items.saveItemPhoto(set.id, "owner", item.id, Buffer.from("bad")),
      /invalidImage/,
    );
    assert.deepEqual(readdirSync(join(directory, "set-photos")), [photo]);
    await Promise.all(
      Array.from({ length: 6 }, () => profiles.saveAvatar("owner", image)),
    );
    const avatar = (
      sql
        .prepare("SELECT avatar FROM user_profiles WHERE user_id=?")
        .get("owner") as { avatar: string }
    ).avatar;
    assert.deepEqual(readdirSync(join(directory, "avatars")), [avatar]);
    const avatarMeta = await sharp(
      join(directory, "avatars", avatar),
    ).metadata();
    assert.equal(avatarMeta.width, 512);
    assert.equal(avatarMeta.format, "webp");
    assert.equal(avatarMeta.exif, undefined);
    profiles.deleteAvatar("owner");
    items.deleteItem(set.id, "owner", item.id);
    assert.deepEqual(readdirSync(join(directory, "avatars")), []);
    assert.deepEqual(readdirSync(join(directory, "set-photos")), []);
  } finally {
    sql.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
