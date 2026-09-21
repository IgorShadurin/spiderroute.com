import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { profileInput, socialUrl } from "../src/lib/profile";
test("social profile validation normalizes handles and rejects non-profile or unsafe links", () => {
  assert.equal(
    socialUrl("youtube", "@igor-koleso"),
    "https://www.youtube.com/@igor-koleso",
  );
  assert.equal(socialUrl("telegram", "igor"), "https://t.me/igor");
  assert.equal(
    socialUrl("instagram", "@igor"),
    "https://www.instagram.com/igor/",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/@igor",
    "https://www.youtube.com/watch?v=x",
    "https://user:pass@youtube.com/@igor",
  ])
    assert.throws(() => socialUrl("youtube", url));
  assert.equal(
    profileInput.safeParse({ firstName: " ", publicEmail: "" }).success,
    false,
  );
});
test("custom profile survives OAuth initialization; public email stays opt-in; avatars persist and clean up", async () => {
  const dir = mkdtempSync(join(tmpdir(), "profile-test-"));
  process.env.DATA_DIR = dir;
  const { sql } = await import("../src/server/db");
  const service = await import("../src/server/profiles");
  try {
    sql
      .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
      .run("owner", "private@example.test", "Original Person", "2026-09-21");
    service.ensureProfile(
      "owner",
      "https://lh3.googleusercontent.com/old-photo",
    );
    const initial = service.getProfile("owner");
    assert.equal(initial.firstName, "Original");
    assert.equal(initial.publicEmail, "");
    assert.ok(initial.avatarUrl);
    const changed = service.saveProfile("owner", {
      ...initial,
      firstName: "Custom",
      lastName: "Name",
      youtube: { name: "My channel", url: "@igor-koleso" },
    });
    service.ensureProfile(
      "owner",
      "https://lh3.googleusercontent.com/new-photo",
    );
    assert.equal(service.getProfile("owner").firstName, "Custom");
    assert.equal(service.getProfile("owner").avatarUrl, initial.avatarUrl);
    assert.equal(changed.youtube.url, "https://www.youtube.com/@igor-koleso");
    const bytes = await sharp({
      create: { width: 30, height: 40, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    const avatar = await service.saveAvatar("owner", bytes);
    assert.match(avatar.avatarUrl!, /\/avatars\/owner\//);
    assert.equal(readdirSync(join(dir, "avatars")).length, 1);
    service.ensureProfile(
      "owner",
      "https://lh3.googleusercontent.com/other-photo",
    );
    assert.equal(service.getProfile("owner").avatarUrl, avatar.avatarUrl);
    const second = await service.saveAvatar("owner", bytes);
    assert.notEqual(second.avatarUrl, avatar.avatarUrl);
    assert.equal(readdirSync(join(dir, "avatars")).length, 1);
    service.deleteAvatar("owner");
    service.ensureProfile(
      "owner",
      "https://lh3.googleusercontent.com/other-photo",
    );
    assert.equal(service.getProfile("owner").avatarUrl, null);
    assert.equal(readdirSync(join(dir, "avatars")).length, 0);
    await assert.rejects(
      () => service.saveAvatar("owner", Buffer.from("<svg/>")),
      /invalidImage/,
    );
    assert.equal(
      (sql.prepare("SELECT email FROM users WHERE id='owner'").get() as any)
        .email,
      "private@example.test",
    );
  } finally {
    sql.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
