import { sql, dataDir } from "../src/server/db";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
async function main() {
  const dir = process.env.BACKUP_DIR || join(dataDir, "backups");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = join(
    dir,
    new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
  );
  await sql.backup(target);
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (
      name.endsWith(".sqlite") &&
      Date.now() - statSync(p).mtimeMs > 30 * 86400000
    )
      unlinkSync(p);
  }
  console.log("Backup completed.");
  sql.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
