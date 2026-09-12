import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const files = execFileSync("git", ["ls-files", "--cached"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);
let failures = 0;
for (const file of files) {
  if (
    /(^|\/)(\.env($|\.(?!example$))|data\/|private\/|artifacts\/)|\.(gpx|pmtiles|mbtiles|sqlite|db)(-|$)/i.test(
      file,
    )
  ) {
    console.error("Disallowed tracked artifact:", file);
    failures++;
    continue;
  }
  const content = readFileSync(file, "utf8");
  if (
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}/.test(
      content,
    )
  ) {
    console.error("Possible secret:", file);
    failures++;
  }
}
if (failures) process.exit(1);
console.log(
  `Reviewed ${files.length} tracked paths; no disallowed artifacts or recognized secrets.`,
);
