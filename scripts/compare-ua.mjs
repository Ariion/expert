// Compare le user-agent de production à un user-agent de navigateur sur les
// mêmes adresses. Si l'écart est net, la cause des 179 « inconnus » est trouvée :
// ce n'est pas le flux qui est mort, c'est la porte qui se ferme devant le robot.
const URLS = [
  "https://status.github.com/api/v2/summary.json",
  "https://www.githubstatus.com/api/v2/summary.json",
  "https://status.notion.so/api/v2/summary.json",
  "https://status.figma.com/api/v2/summary.json",
  "https://status.shopify.com/api/v2/summary.json",
  "https://www.netlifystatus.com/api/v2/summary.json",
  "https://status.openai.com/api/v2/summary.json",
  "https://status.anthropic.com/api/v2/summary.json",
  "https://status.vercel.com/api/v2/summary.json",
  "https://status.cloudflare.com/api/v2/summary.json",
];

const BOT = "UpstreamStatusBot/1.0 (+https://www.upstreamstatus.com; vendor status aggregation)";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function probe(url, ua) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
      headers: { "user-agent": ua, accept: "application/json, application/xml, text/xml, */*" },
    });
    const body = await res.text();
    const t = body.trimStart();
    const json = t.startsWith("{");
    return { code: res.status, json, len: body.length };
  } catch (e) {
    return { code: 0, json: false, len: 0, err: e.name };
  }
}

for (const url of URLS) {
  const a = await probe(url, BOT);
  const b = await probe(url, BROWSER);
  const verdict = a.json === b.json && a.code === b.code ? "identique" : "DIFFÉRENT";
  console.log(
    `${verdict.padEnd(11)} bot=${String(a.code).padEnd(4)}${a.json ? "json" : "----"}  navigateur=${String(b.code).padEnd(4)}${b.json ? "json" : "----"}  ${url}`,
  );
}
