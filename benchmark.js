import { Medium } from "./model.js";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
const runs = [];
for (const size of [
  [96, 64],
  [192, 128],
])
  for (const closure of ["limited", "release"]) {
    const m = new Medium({
      width: size[0],
      height: size[1],
      closure,
      resistanceLaw: "dense",
      steeringLaw: "original",
      record: true,
      maxHistory: 1500,
    });
    m.step(200);
    let times = [];
    for (let i = 0; i < 50; i++) {
      const t = performance.now();
      m.step(16);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    runs.push({
      width: size[0],
      height: size[1],
      closure,
      stepsPerBatch: 16,
      timePerBatch: 0.4,
      medianMs: times[25],
      p95Ms: times[47],
      cohorts: m.cohorts.length,
    });
  }
await writeFile(
  new URL("./evidence/performance.json", import.meta.url),
  JSON.stringify(
    {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      scope:
        "Local numerical worker-equivalent batches, excluding browser drawing and structured cloning.",
      runs,
    },
    null,
    2,
  ),
);
console.log(runs);
