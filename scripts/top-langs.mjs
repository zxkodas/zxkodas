// Builds assets/top-langs.svg from the byte counts GitHub reports for the
// owner's public, non-fork repos. Run by .github/workflows/top-langs.yml.
import { writeFileSync } from "node:fs";

const user = process.env.GH_USER;
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  ...(token && { Authorization: `Bearer ${token}` }),
};

async function get(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const EXCLUDE = new Set((process.env.EXCLUDE_REPOS ?? "").split(",").filter(Boolean));
const repos = (await get(`/users/${user}/repos?per_page=100&type=owner`)).filter(
  (r) => !r.fork && !r.archived && !EXCLUDE.has(r.name),
);

const totals = {};
for (const r of repos) {
  const langs = await get(`/repos/${user}/${r.name}/languages`);
  for (const [name, bytes] of Object.entries(langs)) totals[name] = (totals[name] ?? 0) + bytes;
}

const COLORS = {
  Rust: "#dea584", TypeScript: "#3178c6", JavaScript: "#f1e05a", Svelte: "#ff3e00",
  HTML: "#e34c26", CSS: "#563d7c", Python: "#3572a5", Shell: "#89e051", Go: "#00add8",
  Java: "#b07219", Kotlin: "#a97bff", C: "#555555", "C++": "#f34b7d", "C#": "#178600",
  Lua: "#000080", Dockerfile: "#384d54", Nix: "#7e7eff",
};

const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
const sum = sorted.reduce((s, [, b]) => s + b, 0);
const top = sorted.slice(0, 8).map(([name, bytes]) => ({
  name, pct: (bytes / sum) * 100, color: COLORS[name] ?? "#8b949e",
}));

const W = 300, PAD = 25, BAR_W = W - PAD * 2;
const rows = Math.ceil(top.length / 2);
const H = 100 + rows * 25;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

let x = PAD;
const segs = top.map((l) => {
  const w = (l.pct / top.reduce((s, t) => s + t.pct, 0)) * BAR_W;
  const rect = `<rect x="${x.toFixed(2)}" y="55" width="${w.toFixed(2)}" height="8" fill="${l.color}"/>`;
  x += w;
  return rect;
}).join("");

const legend = top.map((l, i) => {
  const cx = PAD + (i % 2) * 130, cy = 90 + Math.floor(i / 2) * 25;
  return `<circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${l.color}"/>` +
    `<text x="${cx + 16}" y="${cy}" class="t">${esc(l.name)} ${l.pct.toFixed(1)}%</text>`;
}).join("");

writeFileSync("assets/top-langs.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Most used languages">
<style>.h{font:600 18px 'Segoe UI',Ubuntu,sans-serif;fill:#70a5fd}.t{font:400 12px 'Segoe UI',Ubuntu,sans-serif;fill:#38bdae}</style>
<rect width="${W}" height="${H}" rx="4.5" fill="#1a1b27"/>
<text x="${PAD}" y="35" class="h">Most Used Languages</text>
<clipPath id="c"><rect x="${PAD}" y="55" width="${BAR_W}" height="8" rx="4"/></clipPath>
<g clip-path="url(#c)">${segs}</g>
${legend}
</svg>
`);
console.log(top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(", "));
