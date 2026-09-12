import Database from "better-sqlite3";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
const dir = process.env.DATA_DIR || "/data";
const db = new Database(dir + "/spiderroute.sqlite");
db.pragma("busy_timeout=5000");
const [command, arg, name] = process.argv.slice(2);
if (command === "demo") {
  if (!arg || !/^\S+@\S+\.\S+$/.test(arg)) throw Error("Email required");
  const password =
    process.env.DEMO_PASSWORD || randomBytes(24).toString("base64url");
  if (password.length < 16) throw Error("Password too short");
  const salt = randomBytes(16).toString("hex"),
    hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
  db.prepare(
    "INSERT INTO users(id,email,name,password_hash,is_demo,created_at) VALUES(?,?,?,?,1,?)",
  ).run(
    randomUUID(),
    arg.toLowerCase(),
    name || "Explorer",
    hash,
    new Date().toISOString(),
  );
  console.log(JSON.stringify({ email: arg, password }));
} else if (command === "backup") {
  mkdirSync(arg || dir + "/backups", { recursive: true, mode: 0o700 });
  await db.backup((arg || dir + "/backups") + "/" + Date.now() + ".sqlite");
  console.log("Backup complete");
} else if (command === "mail-test") {
  if (!arg || !/^\S+@\S+\.\S+$/.test(arg))
    throw Error("Controlled test mailbox required");
  db.prepare(
    "INSERT INTO outbox(id,recipient,subject,body,created_at) VALUES(?,?,?,?,?)",
  ).run(
    randomUUID(),
    arg,
    "SpiderRoute delivery test",
    "This is the requested SpiderRoute transactional email delivery test. No route data is included.",
    new Date().toISOString(),
  );
  console.log("Test queued");
} else
  throw Error("Commands: demo EMAIL [NAME], backup [DIR], mail-test EMAIL");
db.close();
