import { Medium } from "./model.js";
import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const out = new URL("./evidence/", import.meta.url);
await mkdir(out, { recursive: true });
const cases = [];
const traces = [];
function run(name, options, time = 30) {
  const m = new Medium({ width: 64, height: 48, record: true, ...options }),
    history = [],
    start = performance.now();
  for (let k = 0; k < Math.round(time / m.p.dt); k++) {
    m.step();
    if (k % 5 === 0) history.push({ t: m.t, ...m.account() });
    if (m.stopped) break;
  }
  const sites = new Map();
  for (const b of m.births) {
    const key = `${b.x},${b.y}`;
    if (!sites.has(key)) sites.set(key, { x: b.x, y: b.y, t: b.t, m: 0 });
    sites.get(key).m += b.m;
  }
  const angular = Array(32).fill(0);
  for (const b of m.births)
    for (const p of b.peaks)
      angular[
        Math.round(((((p.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * 32) %
          32
      ] += p.m;
  const donorExtent = Math.max(
    0,
    ...m.transfers.map((b) => Math.hypot(b.x - m.origin.x, b.y - m.origin.y) * m.p.dx),
  );
  const firstSites = [...sites.values()].sort((a, b) => a.t - b.t);
  const extent = Math.max(
    0,
    ...firstSites.map((b) => Math.hypot(b.x - m.origin.x, b.y - m.origin.y) * m.p.dx),
  );
  const paths = [...m.paths].map(([id, path]) => ({ id, path }));
  let turned = 0,
    maxTurn = 0,
    maxDistance = 0;
  for (const { path } of paths) {
    let turn = 0;
    for (let i = 1; i < path.length; i++) turn += Math.abs(path[i][4] - path[i - 1][4]);
    turned += turn;
    maxTurn = Math.max(maxTurn, turn);
    if (path.length) {
      const a = path[0],
        b = path.at(-1);
      maxDistance = Math.max(maxDistance, (b[0] - a[0]) * m.p.c * m.p.bulkSpeed);
    }
  }
  const longEncounters = m.collisions.filter((c) => Math.min(...c.distances) > 12);
  const row = {
    name,
    options: m.p,
    summary: m.summary(),
    elapsedMs: performance.now() - start,
    birthSites: firstSites,
    donorExtent,
    birthExtent: extent,
    angular,
    meanPathTurn: paths.length ? turned / paths.length : 0,
    maxPathTurn: maxTurn,
    maxTrackedDistance: maxDistance,
    longEncounters: longEncounters.length,
    returnCandidates: m.collisions.filter(
      (c) =>
        Math.min(...c.distances) > 8 &&
        Math.min(...c.turns) > Math.PI / 2 &&
        c.birthEvents[0] === c.birthEvents[1] &&
        c.birthEvents[0] > 0,
    ).length,
    releaseSignalCount: m.signalHistory.length,
    signalOutcomes: Object.fromEntries(
      [...new Set(m.signalHistory.map((s) => s.reason))].map((k) => [
        k,
        m.signalHistory.filter((s) => s.reason === k).length,
      ]),
    ),
    firstCollision: m.collisions[0] ?? null,
  };
  cases.push(row);
  traces.push({
    name,
    history,
    births: m.births,
    transfers: m.transfers,
    collisions: m.collisions,
    signals: m.signalHistory,
    paths,
  });
  console.log(
    name,
    JSON.stringify({
      births: m.births.length,
      sites: sites.size,
      extent,
      donorExtent,
      moving: row.summary.moving,
      exported: m.totals.exported,
      collision: m.totals.collision,
      meanTurn: row.meanPathTurn,
      longEncounters: row.longEncounters,
      ms: Math.round(row.elapsedMs),
    }),
  );
  return m;
}
run("quiet", { scenario: "quiet" }, 40);
run("shallow", { scenario: "shallow" }, 40);
run("tiny dip — limited", { scenario: "dip", wake: 0, steering: 0 }, 40);
run("tiny dip — no export", { scenario: "dip", wake: 0, steering: 0, export: false }, 40);
run("symmetric dip", { scenario: "symmetric", wake: 0, steering: 0 }, 40);
run("rotated dip", { scenario: "dip", angle: Math.PI / 4, wake: 0, steering: 0 }, 40);
run("aggregate — export", { closure: "aggregate", wake: 0, steering: 0 }, 20);
run("aggregate — no export", { closure: "aggregate", export: false, wake: 0, steering: 0 }, 20);
run("unorganized contact disabled", { inflowInteraction: false, wake: 0, steering: 0 }, 40);
run("stress trigger", { closure: "stress", wake: 0, steering: 0 }, 40);
run(
  "opposed unorganized inflow",
  { scenario: "converging", conversion: false, wake: 0, steering: 0, wear: 0 },
  15,
);
run(
  "compression relaxation",
  { scenario: "converging", conversion: false, export: false, wake: 0, steering: 0, wear: 0 },
  20,
);
run("wear", { scenario: "wear", conversion: false, wake: 0, steering: 0 }, 30);
run("wear off", { scenario: "wear", conversion: false, wake: 0, steering: 0, wear: 0 }, 30);
run(
  "head-on collision",
  { scenario: "collision", conversion: false, wake: 0, steering: 0, wear: 0 },
  20,
);
for (const steering of [0, 1.2])
  for (const wake of [0, 0.035])
    run(`coupled steering ${steering} wake ${wake}`, { steering, wake }, 45);
for (const steering of [0, 1.2])
  run(
    `wake pair steering ${steering}`,
    { scenario: "wake-pair", conversion: false, steering, wake: 0.035 },
    40,
  );
run(
  "original shader steering law",
  { scenario: "wake-pair", conversion: false, steering: 1.2, steeringLaw: "original", wake: 0.035 },
  40,
);
for (const bulkSpeed of [0.6, 1.4]) run(`bulk speed ${bulkSpeed}`, { bulkSpeed }, 45);
for (const dt of [0.2, 0.1, 0.05, 0.0125]) run(`time step ${dt}`, { dt, wake: 0, steering: 0 }, 20);
for (const loading of [0.12, 0.18, 0.34, 0.5])
  run(`loading ${loading}`, { loading, wake: 0, steering: 0 }, 30);
run("refined mesh", { dx: 0.5, dt: 0.1, width: 128, height: 96, wake: 0, steering: 0 }, 20);
run("larger domain", { width: 96, height: 72, wake: 0, steering: 0 }, 45);
run("noisy AM", { scenario: "noisy" }, 35);
for (const resistanceLaw of ["rising", "dense"])
  for (const ex of [true, false])
    run(
      `release response ${resistanceLaw} export ${ex}`,
      { closure: "release", resistanceLaw, export: ex, wake: 0, steering: 0 },
      60,
    );
for (const dt of [0.1, 0.05])
  run(
    `release response dt ${dt}`,
    { closure: "release", resistanceLaw: "dense", dt, wake: 0, steering: 0 },
    60,
  );
for (const loading of [0.34, 0.5])
  run(
    `release response loading ${loading}`,
    { closure: "release", resistanceLaw: "dense", loading, wake: 0, steering: 0 },
    60,
  );
for (const steering of [0, 1.2])
  run(
    `release coupled steering ${steering}`,
    { closure: "release", resistanceLaw: "dense", steering },
    120,
  );
run(
  "release response rotated",
  { closure: "release", resistanceLaw: "dense", angle: Math.PI / 4 },
  100,
);
run(
  "release response larger domain",
  { closure: "release", resistanceLaw: "dense", width: 80, height: 56 },
  100,
);
run(
  "release response refined",
  {
    closure: "release",
    resistanceLaw: "dense",
    width: 128,
    height: 96,
    dx: 0.5,
    dt: 0.1,
    wake: 0,
    steering: 0,
  },
  60,
);
run(
  "release original steering",
  { closure: "release", resistanceLaw: "dense", steeringLaw: "original" },
  160,
);
for (const wear of [0.006, 0.024])
  run(
    `release wear ${wear}`,
    { closure: "release", resistanceLaw: "dense", steeringLaw: "original", wear },
    160,
  );
run(
  "release long-run",
  { closure: "release", resistanceLaw: "dense", steeringLaw: "original", width: 96, height: 72 },
  600,
);
for (const compressionThreshold of [0.06, 0.18])
  run(
    `compression threshold ${compressionThreshold}`,
    { closure: "release", resistanceLaw: "dense", compressionThreshold, wake: 0, steering: 0 },
    60,
  );
run(
  "release response shifted",
  { closure: "release", resistanceLaw: "dense", offsetX: 0.35, offsetY: -0.25 },
  100,
);
const wave = [];
for (const dt of [0.2, 0.1]) {
  const m = new Medium({
    scenario: "quiet",
    width: 121,
    height: 9,
    dt,
    conversion: false,
    healing: 0,
    response: 0,
    damping: 0,
    record: false,
  });
  for (let y = 0; y < m.h; y++) m.q[y * m.w + 30] = 1;
  const peaks = [];
  for (let k = 0; k < 15 / dt; k++) {
    m.step();
    if (Math.abs(m.t - Math.round(m.t)) < 1e-8 && m.t > 3) {
      let best = 0,
        index = 31;
      for (let x = 32; x < 60; x++)
        if (m.q[4 * m.w + x] > best) {
          best = m.q[4 * m.w + x];
          index = x;
        }
      peaks.push({ t: m.t, x: index, amplitude: best });
    }
  }
  wave.push({
    dt,
    peaks,
    peakSpeed: (peaks.at(-1).x - peaks[0].x) / (peaks.at(-1).t - peaks[0].t),
  });
}
const report = {
  generated: new Date().toISOString(),
  modelVersion: "0.1.0-experimental",
  cases,
  wave,
  claims: {
    quiet: "observed",
    localCompression: "observed in natural dip arrivals and prepared opposing arrivals",
    wearAndCollision: "observed in isolated tests",
    kickback:
      "conditional axial birth-site advance at 0.2 c with explicit release feedback and dense resistance; emergent invariant law not established",
    twoReturningBranches: "not established",
    resolutionConvergence: "not established",
  },
};
await writeFile(new URL("results.json", out), JSON.stringify(report, null, 2));
await writeFile(new URL("traces.json", out), JSON.stringify(traces));
