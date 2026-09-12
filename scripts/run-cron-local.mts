/**
 * Déclenche les jobs en local, comme le ferait Vercel Cron.
 *
 *   npm run cron:local -- ingest
 *   npm run cron:local -- dispatch
 *   npm run cron:local -- rollup
 *   npm run cron:local -- reconcile
 */
import { loadEnvFiles } from "../src/lib/envfile";

loadEnvFiles();

const job = process.argv[2] ?? "ingest";
const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET ?? "";

const res = await fetch(`${base}/api/cron/${job}`, {
  headers: { authorization: `Bearer ${secret}` },
});
console.log(res.status, await res.text());
