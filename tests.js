import test from "node:test";
import assert from "node:assert/strict";
import { Medium, DIRS } from "./model.js";
const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
const isolated = {
  width: 64,
  height: 48,
  dt: 0.2,
  conversion: false,
  steering: 0,
  wake: 0,
  wear: 0,
  healing: 0,
};
test("uniform and shallow AM do not ignite", () => {
  for (const scenario of ["quiet", "shallow"]) {
    const m = new Medium({ width: 32, height: 24, scenario });
    m.step(100);
    assert.equal(m.births.length, 0);
    near(m.account().error, 0);
  }
});
test("opposing unorganized arrivals retain their loading with zero resultant", () => {
  const m = new Medium({ ...isolated, scenario: "converging" });
  m.step(10);
  assert.equal(m.births.length, 1);
  const b = m.births[0];
  near(b.held, 0.9);
  near(
    b.incoming.reduce((s, v, k) => s + v * DIRS[k].ux, 0),
    0,
  );
  near(
    b.incoming.reduce((s, v, k) => s + v * DIRS[k].uy, 0),
    0,
  );
  near(m.totals.exported, 0.9);
  assert.ok(b.peaks.length >= 1);
  near(m.account().error, 0);
});
test("a supply packet cannot load the receiver before its transit time", () => {
  const m = new Medium({ ...isolated, scenario: "converging" });
  m.step(9);
  near(m.totals.loaded, 0);
  near(m.account().flight, 0.9);
  m.step();
  near(m.totals.loaded, 0.9);
});
test("compression without export returns locally with an explicit destination", () => {
  const m = new Medium({ ...isolated, scenario: "converging", export: false, relax: 0.3 });
  m.step(100);
  const i = m.idx(32, 24);
  near(m.rho[i] - 1, m.totals.relaxed);
  near(m.account().held, 0.9 * Math.exp(-0.3 * (20 - 2 + 0.2)), 1e-8);
  near(m.account().error, 0);
});
test("ordinary wear follows the declared lifetime and returns its content", () => {
  const m = new Medium({ ...isolated, scenario: "wear", wear: 0.012 });
  m.step(150);
  near(m.account().moving, 0.8 * Math.exp(-0.012 * 30));
  near(m.totals.wear, 0.8 - m.account().moving);
  near(m.account().error, 0);
});
test("transport alone preserves speed and amount without numerical erosion", () => {
  const m = new Medium({ ...isolated, scenario: "wear" }),
    x = m.cohorts[0].x;
  m.step(100);
  near(m.cohorts[0].x - x, 20);
  near(m.cohorts[0].m, 0.8);
  near(m.cohorts[0].a, 0);
});
test("balanced head-on cohorts return both contents at the meeting", () => {
  const m = new Medium({ ...isolated, scenario: "collision" });
  m.step(60);
  near(m.account().moving, 0);
  near(m.totals.collision, 1.6);
  near(m.rho[m.idx(32, 24)], 2.6);
  assert.ok(m.collisions[0].t > 7);
  near(m.account().error, 0);
});
test("unequal head-on contact preserves the unmatched organized amount", () => {
  const m = new Medium({ ...isolated, scenario: "quiet" });
  m.seedCohort(25, 24, 0, 0.8);
  m.seedCohort(39, 24, Math.PI, 0.3);
  m.initial = m.account().total;
  m.step(50);
  near(m.totals.collision, 0.6);
  near(m.account().moving, 0.5);
  near(m.account().error, 0);
});
test("separating cohorts born together are not a head-on collision", () => {
  const m = new Medium({ ...isolated, scenario: "quiet" });
  m.seedCohort(32, 24, 0, 0.4);
  m.seedCohort(32, 24, Math.PI, 0.4);
  m.initial = m.account().total;
  m.step(20);
  near(m.totals.collision, 0);
  near(m.account().moving, 0.8);
});
test("open edges retain escaped content in the budget", () => {
  const m = new Medium({ ...isolated, scenario: "quiet" });
  m.seedCohort(62, 24, 0, 0.4);
  m.initial = m.account().total;
  m.step(20);
  near(m.escaped, 0.4);
  near(m.account().error, 0);
});
test("wake content is transferred into the moving carrier, never erased", () => {
  const m = new Medium({ ...isolated, scenario: "wear", wake: 0.035 });
  m.step(50);
  assert.ok(m.totals.pickup > 0);
  near(m.account().moving, 0.8);
  near(m.account().carried, m.totals.pickup);
  near(m.account().error, 0);
});
test("local conversion records actual supplying locations and closes all content accounts", () => {
  const m = new Medium({ width: 32, height: 24 });
  for (let i = 0; i < 100; i++) {
    m.step();
    for (const v of m.rho) assert.ok(Number.isFinite(v) && v >= -1e-12);
    near(m.account().error, 0, 1e-7);
  }
  assert.ok(m.births.length > 0);
  assert.ok(m.births.every((b) => b.suppliers.length));
  for (const b of m.births)
    near(
      b.suppliers.reduce((s, z) => s + z.m, 0),
      b.m,
    );
});
test("finite compute budget pauses rather than deleting cohorts", () => {
  const m = new Medium({ ...isolated, scenario: "collision", maxCohorts: 1 });
  const total = m.account().total;
  m.step(10);
  assert.ok(m.stopped);
  near(m.account().total, total);
  assert.equal(m.cohorts.length, 2);
});
test("opposing unorganized arrivals interact in the dip before any receiver search", () => {
  const m = new Medium({ ...isolated, scenario: "quiet" });
  m.rho[m.idx(30, 24)] -= 0.2;
  m.rho[m.idx(34, 24)] -= 0.2;
  m.flights = [
    { x: 30, y: 24, tx: 32, ty: 24, k: 0, m: 0.2, arrive: 2, start: 0, phase: "cross", id: 1 },
    { x: 34, y: 24, tx: 32, ty: 24, k: 4, m: 0.2, arrive: 2, start: 0, phase: "cross", id: 2 },
  ];
  m.initial = m.account().total;
  m.step(10);
  near(m.totals.loaded, 0.4);
  near(m.totals.exported, 0.4);
  assert.equal(m.births[0].suppliers.length, 2);
  near(m.account().error, 0);
});
test("release-feedback signals cannot act before their physical transit delay", () => {
  const m = new Medium({
    width: 32,
    height: 24,
    closure: "release",
    resistanceLaw: "dense",
    wake: 0,
    steering: 0,
    dt: 0.05,
  });
  m.step(400);
  assert.ok(m.signalHistory.length > 0);
  for (const s of m.signalHistory) {
    const flight = (Math.hypot(s.tx - s.x, s.ty - s.y) * m.p.dx) / m.p.c;
    assert.ok(s.received >= s.start + flight - 1e-9);
  }
  near(m.account().error, 0, 1e-7);
});
test("without export the release-feedback sequence has no downstream trigger", () => {
  const m = new Medium({
    width: 32,
    height: 24,
    closure: "release",
    resistanceLaw: "dense",
    export: false,
    wake: 0,
    steering: 0,
    dt: 0.05,
  });
  m.step(400);
  assert.equal(m.signalHistory.length, 0);
  assert.equal(m.releaseSignals.length, 0);
  assert.equal(m.births.length, 0);
  assert.ok(m.transfers.every((e) => e.parent === -1));
  near(m.account().error, 0, 1e-7);
});
test("current local geometry can recruit across a different axis after signal arrival", () => {
  const m = new Medium({
    ...isolated,
    scenario: "quiet",
    closure: "release",
    resistanceLaw: "dense",
    recruitment: "strongest",
  });
  const x = 32,
    y = 24;
  m.rho[m.idx(x, y)] = 0.5;
  m.rho[m.idx(x, y - 1)] = 1.3;
  m.releaseSignals = [{ birth: 101, k: 0, x: x + 2, y, tx: x, ty: y, m: 0.4, start: 0, arrive: 2 }];
  m.t = 1.9;
  m.processReleaseSignals();
  assert.equal(m.events.length, 0);
  m.t = 2;
  m.processReleaseSignals();
  assert.equal(m.events.length, 1);
  const e = m.events[0];
  assert.equal(e.dirs[0].k, 2);
  near(e.m, 0.4);
  near(e.ready, 3);
  assert.equal(e.parent, 101);
  near(m.rho[m.idx(x, y - 1)], 1.3);
});
test("equal strongest cliffs share release without selecting a grid index", () => {
  const m = new Medium({
    ...isolated,
    scenario: "quiet",
    closure: "release",
    resistanceLaw: "dense",
    recruitment: "strongest",
  });
  m.rho[m.idx(32, 24)] = 0.5;
  m.rho[m.idx(31, 24)] = m.rho[m.idx(33, 24)] = 1.3;
  m.releaseSignals = [
    { birth: 101, k: 2, x: 32, y: 26, tx: 32, ty: 24, m: 0.4, start: 0, arrive: 0 },
  ];
  m.processReleaseSignals();
  assert.equal(m.events.length, 2);
  assert.deepEqual(
    m.events.map((e) => e.dirs[0].k),
    [0, 4],
  );
  for (const e of m.events) near(e.m, 0.2);
});
test("distributed recruitment shares one signal budget and keeps diagonal transit delay", () => {
  const m = new Medium({
    ...isolated,
    scenario: "quiet",
    closure: "release",
    resistanceLaw: "dense",
    recruitment: "distributed",
  });
  m.rho[m.idx(32, 24)] = 0.5;
  m.releaseSignals = [
    { birth: 101, k: 0, x: 34, y: 24, tx: 32, ty: 24, m: 0.4, start: 0, arrive: 0 },
  ];
  m.processReleaseSignals();
  assert.equal(m.events.length, 8);
  near(
    m.events.reduce((s, e) => s + e.m, 0),
    0.4,
  );
  for (const e of m.events) near(e.ready, DIRS[e.dirs[0].k].l);
});
