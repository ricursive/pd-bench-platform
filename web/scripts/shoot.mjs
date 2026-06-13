import { chromium } from "playwright";
const base = process.env.BASE || "http://localhost:3210";
const shots = [
  ["/", "home"],
  ["/tasks/ariane133-asap7-mixed-placement", "task"],
  ["/run?id=ariane133-asap7-mixed-placement__DTxa2ZM", "run"],
  ["/leaderboard", "leaderboard"],
  ["/launch", "launch"],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
for (const [path, name] of shots) {
  await p.goto(base + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400); // let canvas + client fetch settle
  await p.screenshot({ path: `/tmp/pdbench_${name}.png`, fullPage: true });
  console.log("shot", name);
}
await b.close();
