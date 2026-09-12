import {
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  statfsSync,
} from "node:fs";
import { join } from "node:path";
import { sql, dataDir } from "./db";
let backingUp = false;
export async function dailyBackup() {
  if (backingUp) return;
  const directory = join(dataDir, "backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = join(
    directory,
    new Date().toISOString().slice(0, 10) + ".sqlite",
  );
  try {
    if (statSync(target).size > 0) return;
  } catch {}
  backingUp = true;
  try {
    const fs = statfsSync(dataDir);
    if (fs.bavail * fs.bsize < 1024 * 1024 * 1024) {
      console.error("SpiderRoute: less than 1 GiB disk space remains");
      return;
    }
    await sql.backup(target);
    for (const f of readdirSync(directory))
      if (
        /^\d{4}-\d{2}-\d{2}\.sqlite$/.test(f) &&
        Date.now() - statSync(join(directory, f)).mtimeMs > 30 * 86400000
      )
        unlinkSync(join(directory, f));
  } catch {
    console.error("SpiderRoute: daily backup failed");
  } finally {
    backingUp = false;
  }
}
