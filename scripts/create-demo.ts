import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "../src/server/db";
import { hashPassword } from "../src/server/auth";
const email = process.argv[2]?.toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw Error("Usage: npm run demo:create -- email [name]");
const password =
  process.env.DEMO_PASSWORD || randomBytes(24).toString("base64url");
if (password.length < 16) throw Error("Use at least 16 characters");
sql
  .prepare(
    "INSERT INTO users(id,email,name,password_hash,is_demo,created_at) VALUES(?,?,?,?,1,?)",
  )
  .run(
    randomUUID(),
    email,
    process.argv[3] || "Explorer",
    hashPassword(password),
    new Date().toISOString(),
  );
console.log(JSON.stringify({ email, password }));
