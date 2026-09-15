import { Medium } from "./model.js";
import { writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const out = new URL("./evidence/geometry/", import.meta.url);
await mkdir(out, { recursive: true });
const cases = [];
const base = {
  width: 80,
  height: 64,
  dt: 0.025,
  closure: "release",
  resistanceLaw: "dense",
  steeringLaw: "original",
};
function run(name, options, time = 120) {
  const m = new Medium({ ...base, ...options }),
    history = [];
  let maxBudgetError = 0;
  for (let k = 0; k < Math.round(time / m.p.dt); k++) {
    m.step();
    if (k % 40 === 0) {
      const a = m.account();
      maxBudgetError = Math.max(maxBudgetError, Math.abs(a.error));
      history.push({ t: m.t, ...a, births: m.births.length });
    }
    if (m.stopped) break;
  }
  const dist = (b) => Math.hypot(b.x - m.origin.x, b.y - m.origin.y) * m.p.dx;
  const pathReturns = [];
  for (const [id, path] of m.paths) {
    const b = path[0];
    let turn = 0,
      maxRadius = 0;
    for (let k = 1; k < path.length; k++) {
      const z = path[k],
        radius = Math.hypot(z[1] - b[1], z[2] - b[2]) * m.p.dx;
      turn += Math.abs(z[4] - path[k - 1][4]);
      maxRadius = Math.max(maxRadius, radius);
      if (
        maxRadius > 4 &&
        radius < 2 &&
        turn > Math.PI / 2 &&
        (z[0] - b[0]) * m.p.c * m.p.bulkSpeed > 8
      ) {
        pathReturns.push({ id, born: b[0], t: z[0], radius, maxRadius, turn });
        break;
      }
    }
  }
  const curved = m.collisions.filter(
    (c) => Math.min(...c.distances) > 8 && Math.min(...c.turns) > Math.PI / 2,
  );
  const nearby = curved.filter(
    (c) =>
      Math.hypot(
        c.birthPositions[0][0] - c.birthPositions[1][0],
        c.birthPositions[0][1] - c.birthPositions[1][1],
      ) *
        m.p.dx <
      3,
  );
  const same = curved.filter((c) => c.birthEvents[0] > 0 && c.birthEvents[0] === c.birthEvents[1]);
  const signals = m.signalHistory,
    changed = signals.flatMap((s) =>
      (s.recruits ?? []).map((r) => ({ ...r, changed: r.k !== s.k })),
    );
  const late = m.births.filter((b) => b.t > time * 0.75);
  const row = {
    name,
    options: m.p,
    summary: m.summary(),
    maxBudgetError,
    uniqueBirthSites: new Set(m.births.map((b) => `${b.x},${b.y}`)).size,
    birthExtent: Math.max(0, ...m.births.map(dist)),
    lateBirths: late.length,
    lateCentralBirths: late.filter((b) => dist(b) < 5).length,
    lastBirth: m.births.at(-1)?.t ?? null,
    curvedContacts: curved.length,
    nearbyCurvedContacts: nearby.length,
    sameBirthCurvedContacts: same.length,
    nearbyCurvedPairs: new Set(nearby.map((c) => [...c.ids].sort((a, b) => a - b).join(","))).size,
    sameBirthCurvedPairs: new Set(same.map((c) => [...c.ids].sort((a, b) => a - b).join(","))).size,
    sameBirthCurvedEvents: new Set(same.map((c) => c.birthEvents[0])).size,
    individualReturns: pathReturns.length,
    changedRecruitments: changed.filter((r) => r.changed).length,
    totalRecruitments: changed.length,
    signalOutcomes: Object.fromEntries(
      [...new Set(signals.map((s) => s.reason))].map((r) => [
        r,
        signals.filter((s) => s.reason === r).length,
      ]),
    ),
  };
  cases.push(row);
  const trace = {
    name,
    history,
    births: m.births,
    transfers: m.transfers,
    signals,
    collisions: m.collisions,
    pathReturns,
    paths: [...m.paths],
  };
  const filename = name.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  return writeFile(new URL(filename + ".json.gz", out), gzipSync(JSON.stringify(trace))).then(
    () => {
      console.log(
        JSON.stringify({
          name,
          births: m.births.length,
          extent: row.birthExtent,
          late: row.lateBirths,
          central: row.lateCentralBirths,
          changes: row.changedRecruitments,
          curved: row.curvedContacts,
          near: nearby.length,
          same: same.length,
          returns: pathReturns.length,
        }),
      );
    },
  );
}
for (const recruitment of ["inherited", "strongest", "distributed"]) {
  for (const bulkSpeed of [0.6, 1, 1.4])
    await run(`${recruitment} speed ${bulkSpeed}`, { recruitment, bulkSpeed });
  await run(`${recruitment} shifted`, { recruitment, offsetX: 0.35, offsetY: -0.25 });
  await run(`${recruitment} no wake`, { recruitment, wake: 0 });
  await run(`${recruitment} no steering`, { recruitment, steering: 0 });
  await run(`${recruitment} no export`, { recruitment, export: false });
}
await writeFile(
  new URL("results.json", out),
  JSON.stringify({ generated: new Date().toISOString(), cases }, null, 2),
);
