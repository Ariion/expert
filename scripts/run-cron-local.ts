/**
 * Déclenche les jobs en local, comme le ferait Vercel Cron.
 *
 *   npm run cron:local -- ingest
 *   npm run cron:local -- dispatch
 *   npm run cron:local -- rollup
 *   npm run cron:local -- reconcile
 */
import { readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignoré */
  }
}

const job = process.argv[2] ?? "ingest";
const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET ?? "";

const res = await fetch(`${base}/api/cron/${job}`, {
  headers: { authorization: `Bearer ${secret}` },
});
console.log(res.status, await res.text());
