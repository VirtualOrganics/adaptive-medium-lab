// A mesoscopic experimental model, not a derived AM constitutive theory.
export const DEFAULTS = Object.freeze({
  width: 96,
  height: 64,
  dx: 1,
  c: 1,
  dt: 0.025,
  threshold: 0.12,
  compressionThreshold: 0.12,
  loading: 0.42,
  closure: "limited",
  relax: 0.3,
  wear: 0.012,
  wake: 0.035,
  steering: 1.2,
  steeringLaw: "continuous",
  response: 0.6,
  damping: 0.7,
  healing: 0.018,
  export: true,
  conversion: true,
  inflowInteraction: true,
  releaseGain: 1,
  resistanceLaw: "rising",
  recruitment: "inherited",
  angle: 0,
  offsetX: 0,
  offsetY: 0,
  depth: 0.2,
  seed: 1,
  scenario: "dip",
  record: true,
  bulkSpeed: 1,
});
const TAU = 2 * Math.PI,
  eps = 1e-10;
export const DIRS = Array.from({ length: 8 }, (_, k) => {
  const x = [1, 1, 0, -1, -1, -1, 0, 1][k],
    y = [0, 1, 1, 1, 0, -1, -1, -1][k],
    l = Math.hypot(x, y);
  return { x, y, l, ux: x / l, uy: y / l, a: Math.atan2(y, x) };
});
export class Medium {
  constructor(options = {}) {
    this.p = { ...DEFAULTS, ...options };
    const p = this.p;
    this.w = p.width;
    this.h = p.height;
    this.n = this.w * this.h;
    if (p.dt > p.dx / (p.c * 3)) throw Error("Time step exceeds the wave stability bound.");
    this.rho = new Float64Array(this.n).fill(1);
    this.q = new Float64Array(this.n);
    this.vq = new Float64Array(this.n);
    this.nextQ = new Float64Array(this.n);
    this.nextV = new Float64Array(this.n);
    this.held = new Float64Array(this.n * 8);
    this.busy = new Uint8Array(this.n);
    this.debit = new Float64Array(this.n);
    this.birthMap = new Float64Array(this.n);
    this.returnMap = new Float64Array(this.n);
    this.compression = new Float64Array(this.n);
    this.lastParent = new Int32Array(this.n).fill(-1);
    this.releaseSignals = [];
    this.signalHistory = [];
    this.signalTrials = [];
    this.seededRequests = false;
    this.heldSources = Array.from({ length: this.n }, () => []);
    this.events = [];
    this.flights = [];
    this.cohorts = [];
    this.births = [];
    this.transfers = [];
    this.collisions = [];
    this.returns = [];
    this.paths = new Map();
    this.t = 0;
    this.steps = 0;
    this.nextId = 1;
    this.nextEvent = 1;
    this.escaped = 0;
    this.initialRemoved = 0;
    this.totals = {
      launched: 0,
      loaded: 0,
      exported: 0,
      relaxed: 0,
      wear: 0,
      collision: 0,
      pickup: 0,
      roundoffReturn: 0,
    };
    this.initialize();
    this.initial = this.account().total;
    this.maxHistory = options.maxHistory ?? Infinity;
    this.maxCohorts = options.maxCohorts ?? 20000;
    this.stopped = null;
  }
  idx(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1;
  }
  sample(a, x, y) {
    x = Math.max(0, Math.min(this.w - 1, x));
    y = Math.max(0, Math.min(this.h - 1, y));
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy,
      j = iy * this.w + ix,
      jx = iy * this.w + Math.min(ix + 1, this.w - 1),
      jy = Math.min(iy + 1, this.h - 1) * this.w + ix,
      jxy = Math.min(iy + 1, this.h - 1) * this.w + Math.min(ix + 1, this.w - 1);
    return (a[j] * (1 - fx) + a[jx] * fx) * (1 - fy) + (a[jy] * (1 - fx) + a[jxy] * fx) * fy;
  }
  deposit(x, y, m, kind) {
    x = Math.max(0, Math.min(this.w - 1, x));
    y = Math.max(0, Math.min(this.h - 1, y));
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    for (const [ox, oy, w] of [
      [0, 0, (1 - fx) * (1 - fy)],
      [1, 0, fx * (1 - fy)],
      [0, 1, (1 - fx) * fy],
      [1, 1, fx * fy],
    ]) {
      const j = Math.min(iy + oy, this.h - 1) * this.w + Math.min(ix + ox, this.w - 1);
      this.rho[j] += m * w;
      this.returnMap[j] += m * w;
    }
    if (this.p.record && kind) this.returns.push({ t: this.t, x, y, m, kind });
  }
  initialize() {
    const p = this.p,
      cx = Math.floor(this.w / 2),
      cy = Math.floor(this.h / 2);
    this.origin = { x: cx + p.offsetX, y: cy + p.offsetY };
    let rng = p.seed >>> 0;
    const random = () => {
      rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const j = this.idx(x, y),
          a = p.angle,
          u = ((x - cx - p.offsetX) * Math.cos(a) + (y - cy - p.offsetY) * Math.sin(a)) * p.dx,
          v = (-(x - cx - p.offsetX) * Math.sin(a) + (y - cy - p.offsetY) * Math.cos(a)) * p.dx;
        let d = 0;
        if (["dip", "symmetric", "noisy"].includes(p.scenario)) {
          d = p.depth * Math.exp(-(u * u + v * v) / (2 * 0.65 * 0.65));
          if (p.scenario !== "symmetric") d *= 1 + 0.18 * u;
        }
        if (p.scenario === "shallow") d = 0.04 * Math.exp(-(u * u + v * v) / 128);
        if (p.scenario === "cliff") d = u > 0 ? p.depth : 0;
        if (p.scenario === "noisy") d += 0.012 * (random() - 0.5);
        this.rho[j] = 1 - d;
        this.q[j] = d;
        this.initialRemoved += d;
      }
    if (p.scenario === "wear") {
      this.seedCohort(cx - 15 / p.dx, cy, 0, 0.8);
    }
    if (p.scenario === "collision") {
      this.seedCohort(cx - 8 / p.dx, cy, 0, 0.8);
      this.seedCohort(cx + 8 / p.dx, cy, Math.PI, 0.8);
    }
    if (p.scenario === "wake-pair") {
      this.seedCohort(cx - 12 / p.dx, cy - 1.2 / p.dx, 0, 0.8);
      this.seedCohort(cx - 16 / p.dx, cy + 1.2 / p.dx, 0, 0.8);
    }
    if (p.scenario === "converging") {
      // Deliberately prepared unorganized opposing arrivals; no mean-axis gate.
      this.rho[this.idx(cx - 2, cy)] -= 0.45;
      this.rho[this.idx(cx + 2, cy)] -= 0.45;
      this.flights.push(
        {
          x: cx - 2,
          y: cy,
          tx: cx,
          ty: cy,
          k: 0,
          m: 0.45,
          arrive: (2 * p.dx) / p.c,
          start: 0,
          phase: "load",
          id: 0,
        },
        {
          x: cx + 2,
          y: cy,
          tx: cx,
          ty: cy,
          k: 4,
          m: 0.45,
          arrive: (2 * p.dx) / p.c,
          start: 0,
          phase: "load",
          id: 0,
        },
      );
    }
  }
  seedCohort(x, y, a, m) {
    const j = this.idx(Math.round(x), Math.round(y));
    this.rho[j] -= m;
    return this.addCohort(x, y, a, m, 0);
  }
  addCohort(x, y, a, m, event) {
    const id = this.nextId++,
      c = {
        id,
        x,
        y,
        a,
        m,
        load: 0,
        born: this.t,
        bx: x,
        by: y,
        ba: a,
        distance: 0,
        turn: 0,
        event,
      };
    this.cohorts.push(c);
    if (this.p.record) this.paths.set(id, [[this.t, x, y, m, a]]);
    return c;
  }
  scheduleSupply() {
    const p = this.p;
    if (!p.conversion) return;
    if (p.closure === "release" && this.seededRequests) return;
    this.seededRequests = true;
    const requests = [];
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < this.w - 1; x++) {
        const i = this.idx(x, y);
        if (this.busy[i] || this.rho[i] < 0.08) continue;
        const dirs = [];
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          const d = DIRS[k],
            j = this.idx(x + d.x, y + d.y),
            drop = p.closure === "stress" ? this.q[j] - this.q[i] : this.rho[i] - this.rho[j];
          if (drop / (d.l * p.dx) < p.threshold) continue;
          const weight = (drop / (d.l * p.dx) - p.threshold) / d.l;
          dirs.push({ k, weight, drop });
          sum += weight;
        }
        if (!sum) continue;
        const drop = dirs.reduce((s, d) => s + d.weight * d.drop, 0) / sum;
        const amount =
          p.closure === "limited"
            ? Math.min(p.loading * this.rho[i], 0.8 * drop)
            : p.loading * this.rho[i];
        const event = {
          id: this.nextEvent++,
          i,
          x,
          y,
          m: amount,
          dirs: dirs.map((d) => ({ ...d, m: (amount * d.weight) / sum })),
          ready: this.t + (Math.min(...dirs.map((d) => DIRS[d.k].l)) * p.dx) / p.c,
          parent: this.lastParent[i],
        };
        requests.push(event);
      }
    // No request can recruit another donor in this pass. Actual stock remains
    // at the supplying site during this explicitly assumed preparation delay.
    for (const e of requests) {
      this.busy[e.i] = 1;
      this.events.push(e);
    }
  }
  processEvents() {
    const p = this.p,
      waiting = [];
    for (const e of this.events) {
      if (e.ready > this.t + eps) {
        waiting.push(e);
        continue;
      }
      const scale = Math.min(1, this.rho[e.i] / e.m),
        m = e.m * scale;
      this.rho[e.i] -= m;
      this.debit[e.i] += m;
      this.totals.launched += m;
      this.busy[e.i] = 0;
      for (const z of e.dirs) {
        const d = DIRS[z.k],
          tx = e.x + d.x,
          ty = e.y + d.y;
        this.flights.push({
          id: e.id,
          parent: e.parent,
          receiver: e.receiver,
          x: e.x,
          y: e.y,
          tx,
          ty,
          k: z.k,
          m: z.m * scale,
          start: this.t,
          arrive: this.t + (d.l * p.dx) / p.c,
          phase: "cross",
          donorX: e.x,
          donorY: e.y,
        });
      }
      // Provenance identifies a changed supplying cell, not an imposed successor.
      for (const d of DIRS) {
        const j = this.idx(e.x + d.x, e.y + d.y);
        if (j >= 0) this.lastParent[j] = e.id;
      }
      if (p.record)
        this.transfers.push({
          t: this.t,
          id: e.id,
          parent: e.parent,
          receiver: e.receiver,
          x: e.x,
          y: e.y,
          m,
          dirs: e.dirs.map((z) => ({ k: z.k, m: z.m * scale })),
        });
    }
    this.events = waiting;
  }
  loadCompression(i, f, m) {
    if (m <= eps) return;
    this.held[i * 8 + f.k] += m;
    this.heldSources[i].push({
      id: f.id,
      k: f.k,
      m,
      donorX: f.donorX ?? f.x,
      donorY: f.donorY ?? f.y,
      arrived: this.t,
    });
    this.totals.loaded += m;
  }
  processFlights() {
    const p = this.p,
      next = [],
      arrivals = new Map();
    for (const f of this.flights) {
      if (f.arrive > this.t + eps) {
        next.push(f);
        continue;
      }
      const i = this.idx(f.tx, f.ty);
      if (i < 0) {
        this.escaped += f.m;
        continue;
      }
      if (f.phase === "load") {
        this.loadCompression(i, f, f.m);
        continue;
      }
      if (!arrivals.has(i)) arrivals.set(i, []);
      arrivals.get(i).push({ ...f });
    }
    for (const [i, group] of arrivals) {
      // Evaluate directional contact before resolving any onward transfer.
      // Equal counter-arrivals can load strongly with precisely zero net motion.
      if (p.inflowInteraction)
        for (let a = 0; a < group.length; a++)
          for (let b = a + 1; b < group.length; b++) {
            const f = group[a],
              g = group[b],
              u = DIRS[f.k],
              v = DIRS[g.k],
              opposition = -(u.ux * v.ux + u.uy * v.uy);
            if (opposition < 0.5) continue;
            const m = Math.min(f.m, g.m) * opposition;
            this.loadCompression(i, f, m);
            this.loadCompression(i, g, m);
            f.m -= m;
            g.m -= m;
          }
      for (const f of group) {
        if (f.m <= eps) continue;
        const d = DIRS[f.k],
          rx = f.tx + d.x,
          ry = f.ty + d.y,
          j = this.idx(rx, ry);
        if (
          j >= 0 &&
          (p.resistanceLaw === "dense"
            ? this.rho[j] > 0.25
            : this.rho[j] > this.rho[i] + p.threshold * 0.25)
        ) {
          next.push({
            ...f,
            x: f.tx,
            y: f.ty,
            tx: rx,
            ty: ry,
            start: this.t,
            arrive: this.t + (d.l * p.dx) / p.c,
            phase: "load",
          });
        } else this.deposit(f.tx, f.ty, f.m, "unorganized arrival");
      }
    }
    this.flights = next;
  }

  exitDirections(i) {
    const x = i % this.w,
      y = Math.floor(i / this.w),
      p = this.p;
    let total = 0,
      mx = 0,
      my = 0,
      sxx = 0,
      sxy = 0,
      syy = 0;
    for (let k = 0; k < 8; k++) {
      const m = this.held[i * 8 + k],
        d = DIRS[k];
      total += m;
      mx += m * d.ux;
      my += m * d.uy;
      sxx += m * d.ux * d.ux;
      sxy += m * d.ux * d.uy;
      syy += m * d.uy * d.uy;
    }
    if (total < eps) return [];
    const scores = [],
      n = 32;
    for (let k = 0; k < n; k++) {
      const a = (k * TAU) / n,
        ux = Math.cos(a),
        uy = Math.sin(a);
      const near =
        this.sample(this.rho, x + ux, y + uy) + this.sample(this.compression, x + ux, y + uy);
      // H1 constitutive hypothesis: scalar compression can release without net
      // incoming alignment; transverse stress relief competes with actual resistance.
      const transverse = 1 - (sxx * ux * ux + 2 * sxy * ux * uy + syy * uy * uy) / total;
      const forward = (mx * ux + my * uy) / total;
      scores.push(total * (0.55 + 0.45 * transverse + 0.35 * forward) + this.rho[i] - near);
    }
    const peaks = [];
    for (let k = 0; k < n; k++)
      if (
        scores[k] > 0.02 &&
        scores[k] > scores[(k + n - 1) % n] + 1e-8 &&
        scores[k] >= scores[(k + 1) % n]
      )
        peaks.push({ a: (k * TAU) / n, score: scores[k] });
    // Flat angular landscapes are unresolved and relax, never assigned an axis.
    return peaks;
  }
  releaseCompression() {
    const p = this.p,
      dt = p.dt;
    this.compression.fill(0);
    for (let i = 0; i < this.n; i++)
      for (let k = 0; k < 8; k++) this.compression[i] += this.held[i * 8 + k];
    for (let i = 0; i < this.n; i++) {
      let m = this.compression[i];
      if (m < eps) continue;
      const x = i % this.w,
        y = Math.floor(i / this.w),
        peaks = p.export ? this.exitDirections(i) : [];
      let exported = 0;
      if (peaks.length) {
        exported = m > p.compressionThreshold ? m : 0;
        const sum = peaks.reduce((s, z) => s + z.score, 0);
        if (exported > 1e-5) {
          const birth = {
            t: this.t,
            x,
            y,
            m: exported,
            held: m,
            peaks: peaks.map((z) => ({ a: z.a, m: (exported * z.score) / sum })),
            incoming: Array.from(this.held.subarray(i * 8, i * 8 + 8)),
            suppliers: this.heldSources[i].map((z) => ({ ...z, m: (z.m * exported) / m })),
          };
          birth.id = this.nextEvent++;
          if (p.closure === "release")
            for (const src of birth.suppliers) {
              const distance = Math.hypot(x - src.donorX, y - src.donorY);
              this.releaseSignals.push({
                birth: birth.id,
                k: src.k,
                x,
                y,
                tx: src.donorX,
                ty: src.donorY,
                m: src.m,
                start: this.t,
                arrive: this.t + (distance * p.dx) / p.c,
              });
            }
          for (const z of birth.peaks) this.addCohort(x, y, z.a, z.m, birth.id);
          this.birthMap[i] += exported;
          if (p.record) this.births.push(birth);
        } else exported = 0;
      }
      const relaxed = (m - exported) * (1 - Math.exp(-p.relax * dt));
      this.rho[i] += relaxed;
      this.totals.exported += exported;
      this.totals.relaxed += relaxed;
      const remain = (m - exported - relaxed) / m;
      for (let k = 0; k < 8; k++) this.held[i * 8 + k] *= remain;
      this.heldSources[i] = this.heldSources[i]
        .map((z) => ({ ...z, m: z.m * remain }))
        .filter((z) => z.m > 1e-12);
    }
  }
  processReleaseSignals() {
    const p = this.p;
    if (p.closure !== "release") return;
    const next = [];
    for (const signal of this.releaseSignals) {
      if (signal.arrive > this.t + eps) {
        next.push(signal);
        continue;
      }
      // The inherited comparison is deliberately directional. The geometry
      // alternatives inspect current local stock, with no inherited-axis bonus.
      const ks = p.recruitment === "inherited" ? [signal.k] : DIRS.map((_, k) => k);
      const gap = this.idx(signal.tx, signal.ty);
      const candidates = ks.map((k) => {
        const d = DIRS[k],
          x = signal.tx - d.x,
          y = signal.ty - d.y,
          i = this.idx(x, y),
          receiver = this.idx(signal.tx + d.x, signal.ty + d.y);
        let reason = "accepted",
          weight = 0;
        if (i < 0 || receiver < 0 || gap < 0) reason = "edge";
        else if (this.busy[i]) reason = "already loading";
        else if (this.rho[i] - this.rho[gap] < p.threshold * p.dx * d.l)
          reason = "supplying cliff too shallow";
        else if (
          p.resistanceLaw === "dense"
            ? this.rho[receiver] <= 0.25
            : this.rho[receiver] - this.rho[gap] < p.threshold * 0.25
        )
          reason = "no receiving resistance";
        else weight = (this.rho[i] - this.rho[gap]) / (p.dx * d.l);
        return { k, x, y, i, receiver, reason, weight };
      });
      let chosen = candidates.filter((z) => z.reason === "accepted");
      if (p.recruitment === "strongest" && chosen.length) {
        const best = Math.max(...chosen.map((z) => z.weight));
        // Equal maxima share the signal; a grid index never breaks a tie.
        chosen = chosen.filter((z) => z.weight >= best - 1e-10);
      }
      const weight = chosen.reduce((s, z) => s + z.weight, 0),
        recruits = [];
      for (const z of chosen) {
        const share = weight ? z.weight / weight : 0;
        const m = Math.min(p.loading * this.rho[z.i], p.releaseGain * signal.m * share);
        if (m <= 1e-5) continue;
        this.busy[z.i] = 1;
        const event = {
          id: this.nextEvent++,
          i: z.i,
          x: z.x,
          y: z.y,
          m,
          dirs: [{ k: z.k, m, weight: 1 }],
          ready: this.t + (DIRS[z.k].l * p.dx) / p.c,
          parent: signal.birth,
          receiver: z.receiver,
        };
        this.events.push(event);
        recruits.push({ k: z.k, x: z.x, y: z.y, m, event: event.id, ready: event.ready });
      }
      const reason = recruits.length
        ? "accepted"
        : chosen.length
          ? "insufficient released stress"
          : p.recruitment === "inherited"
            ? candidates[0].reason
            : "no eligible local direction";
      const record = {
        ...signal,
        received: this.t,
        nextDonor: recruits.length === 1 ? { x: recruits[0].x, y: recruits[0].y } : null,
        reason,
        requested: recruits.reduce((s, z) => s + z.m, 0),
        recruits,
        candidates: p.recruitment === "inherited" ? undefined : candidates,
      };
      if (p.record) this.signalHistory.push(record);
    }
    this.releaseSignals = next;
  }
  adapt() {
    const p = this.p,
      dt = p.dt,
      c2 = (p.c * p.c) / (p.dx * p.dx);
    for (let i = 0; i < this.n; i++) {
      const x = i % this.w,
        y = Math.floor(i / this.w),
        q = this.q[i],
        lap =
          this.q[this.idx(Math.max(0, x - 1), y)] +
          this.q[this.idx(Math.min(this.w - 1, x + 1), y)] +
          this.q[this.idx(x, Math.max(0, y - 1))] +
          this.q[this.idx(x, Math.min(this.h - 1, y + 1))] -
          4 * q;
      let held = 0;
      for (let k = 0; k < 8; k++) held += this.held[i * 8 + k];
      const target = 1 - this.rho[i] - held;
      const v =
        (this.vq[i] + dt * (c2 * lap + p.response * p.response * (target - q))) /
        (1 + 2 * p.damping * dt);
      this.nextV[i] = v;
      this.nextQ[i] = q + dt * v;
    }
    [this.q, this.nextQ] = [this.nextQ, this.q];
    [this.vq, this.nextV] = [this.nextV, this.vq];
    // Small conservative local exchange is explicitly a numerical AM-healing
    // hypothesis. It is not offered as an invariant-speed signal law.
    if (p.healing) {
      const delta = this.nextQ;
      delta.fill(0);
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          const i = this.idx(x, y);
          for (const j of [this.idx(x + 1, y), this.idx(x, y + 1)])
            if (j >= 0) {
              let f = ((p.healing * dt) / (p.dx * p.dx)) * (this.rho[i] - this.rho[j]);
              f = Math.max(-0.1 * this.rho[j], Math.min(0.1 * this.rho[i], f));
              delta[i] -= f;
              delta[j] += f;
            }
        }
      for (let i = 0; i < this.n; i++) this.rho[i] += delta[i];
    }
  }
  moveCohorts() {
    const p = this.p,
      dt = p.dt,
      speed = (p.c * p.bulkSpeed) / p.dx,
      list = this.cohorts;
    for (const c of list) {
      c.ox = c.x;
      c.oy = c.y;
      const ux = Math.cos(c.a),
        uy = Math.sin(c.a),
        px = c.x + ux,
        py = c.y + uy;
      const gx = (this.sample(this.q, px + 0.5, py) - this.sample(this.q, px - 0.5, py)) / p.dx,
        gy = (this.sample(this.q, px, py + 0.5) - this.sample(this.q, px, py - 0.5)) / p.dx;
      let da = p.steering * (-uy * gx + ux * gy) * dt;
      if (p.steeringLaw === "original") {
        const fx = c.x + 3 * ux,
          fy = c.y + 3 * uy,
          center = this.sample(this.q, fx, fy),
          left = this.sample(this.q, fx - 1.5 * uy, fy + 1.5 * ux),
          right = this.sample(this.q, fx + 1.5 * uy, fy - 1.5 * ux),
          e = 0.5 / 255;
        const sign =
          left > center + e && left > right + e
            ? 1
            : right > center + e && right > left + e
              ? -1
              : 0;
        da = sign * Math.atan2(1.5, 3) * 0.28 * p.steering * dt;
      }
      c.a += da;
      c.turn += Math.abs(da);
      c.x += Math.cos(c.a) * speed * dt;
      c.y += Math.sin(c.a) * speed * dt;
      c.distance += p.c * p.bulkSpeed * dt;
    }
    // Spatial buckets and swept relative motion preserve opposing contributions
    // until their actual contact. No averaging of velocities before collision.
    const buckets = new Map(),
      r = 0.42;
    for (const c of list) {
      const bx = Math.floor(c.x),
        by = Math.floor(c.y);
      for (let yy = by - 1; yy <= by + 1; yy++)
        for (let xx = bx - 1; xx <= bx + 1; xx++) {
          const b = buckets.get(yy * this.w + xx);
          if (!b) continue;
          for (const d of b) {
            if (c.m < eps || d.m < eps) continue;
            const opposition = -Math.cos(c.a - d.a);
            if (opposition < 0.5) continue;
            const rx = c.ox - d.ox,
              ry = c.oy - d.oy,
              vx = c.x - c.ox - d.x + d.ox,
              vy = c.y - c.oy - d.y + d.oy,
              t = Math.max(0, Math.min(1, -(rx * vx + ry * vy) / (vx * vx + vy * vy + eps)));
            if (rx * vx + ry * vy >= -eps || Math.hypot(rx + t * vx, ry + t * vy) > r) continue;
            const amount = Math.min(c.m, d.m) * opposition,
              x = (c.ox + t * (c.x - c.ox) + d.ox + t * (d.x - d.ox)) * 0.5,
              y = (c.oy + t * (c.y - c.oy) + d.oy + t * (d.y - d.oy)) * 0.5;
            const cLoad = (c.load * amount) / c.m,
              dLoad = (d.load * amount) / d.m;
            c.m -= amount;
            d.m -= amount;
            c.load -= cLoad;
            d.load -= dLoad;
            const returned = 2 * amount + cLoad + dLoad;
            this.deposit(x, y, returned, "collision");
            this.totals.collision += returned;
            if (p.record)
              this.collisions.push({
                t: this.t,
                x,
                y,
                m: returned,
                organized: 2 * amount,
                carried: cLoad + dLoad,
                ids: [c.id, d.id],
                ages: [this.t - c.born, this.t - d.born],
                distances: [c.distance, d.distance],
                opposition,
                birthEvents: [c.event, d.event],
                birthPositions: [
                  [c.bx, c.by],
                  [d.bx, d.by],
                ],
                turns: [c.turn, d.turn],
                netTurns: [c.a - c.ba, d.a - d.ba],
              });
          }
        }
      const key = by * this.w + bx;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }
    const survivors = [];
    for (const c of list) {
      if (c.x < 0 || c.x > this.w - 1 || c.y < 0 || c.y > this.h - 1) {
        this.escaped += c.m + c.load;
        continue;
      }
      const fraction = 1 - Math.exp(-p.wear * dt),
        worn = c.m * fraction,
        loadReturn = c.load * fraction;
      c.m -= worn;
      c.load -= loadReturn;
      this.deposit(c.x, c.y, worn + loadReturn, p.record ? "wear" : null);
      this.totals.wear += worn + loadReturn;
      // Wake material is entrained, paid for locally, and returned with its carrier.
      const i = this.idx(Math.round(c.x), Math.round(c.y)),
        pickup = Math.min(this.rho[i] * 0.05, p.wake * c.m * p.c * p.bulkSpeed * dt);
      this.rho[i] -= pickup;
      c.load += pickup;
      this.totals.pickup += pickup;
      if (c.m < 1e-6) {
        this.deposit(c.x, c.y, c.m + c.load, "small remainder");
        this.totals.roundoffReturn += c.m + c.load;
      } else survivors.push(c);
      if (p.record && this.steps % 5 === 0)
        this.paths.get(c.id)?.push([this.t, c.x, c.y, c.m, c.a, c.load]);
    }
    this.cohorts = survivors;
  }
  step(count = 1) {
    for (let k = 0; k < count; k++) {
      if (this.stopped) break;
      if (this.cohorts.length > this.maxCohorts) {
        this.stopped = "Paused at the cohort budget; no content discarded.";
        break;
      }
      this.t = ++this.steps * this.p.dt;
      this.processEvents();
      this.processReleaseSignals();
      this.processFlights();
      this.releaseCompression();
      this.adapt();
      this.moveCohorts();
      this.scheduleSupply();
      if (this.signalHistory.length > this.maxHistory)
        this.signalHistory.splice(0, this.signalHistory.length - this.maxHistory);
      if (this.births.length > this.maxHistory)
        this.births.splice(0, this.births.length - this.maxHistory);
      if (this.collisions.length > this.maxHistory)
        this.collisions.splice(0, this.collisions.length - this.maxHistory);
      if (this.transfers.length > this.maxHistory)
        this.transfers.splice(0, this.transfers.length - this.maxHistory);
      if (this.paths.size > this.maxHistory) {
        const active = new Set(this.cohorts.map((c) => c.id));
        for (const id of this.paths.keys())
          if (!active.has(id)) {
            this.paths.delete(id);
            if (this.paths.size <= this.maxHistory) break;
          }
      }
      if (Number.isFinite(this.maxHistory))
        for (const path of this.paths.values())
          if (path.length > 300) path.splice(0, path.length - 300);
    }
    return this;
  }
  account() {
    let free = 0,
      held = 0,
      moving = 0,
      carried = 0,
      flight = 0;
    for (const v of this.rho) free += v;
    for (const v of this.held) held += v;
    for (const c of this.cohorts) {
      moving += c.m;
      carried += c.load;
    }
    for (const f of this.flights) flight += f.m;
    const total = free + held + moving + carried + flight + this.escaped;
    return {
      free,
      held,
      moving,
      carried,
      flight,
      escaped: this.escaped,
      total,
      error: this.initial === undefined ? 0 : total - this.initial,
    };
  }
  summary() {
    return {
      stopped: this.stopped,
      t: this.t,
      ...this.account(),
      cohorts: this.cohorts.length,
      birthEvents: this.births.length,
      activeRequests: this.events.length,
      releaseSignals: this.releaseSignals.length,
      totals: { ...this.totals },
    };
  }
  snapshot() {
    this.compression.fill(0);
    for (let i = 0; i < this.n; i++)
      for (let k = 0; k < 8; k++) this.compression[i] += this.held[i * 8 + k];
    return {
      p: this.p,
      w: this.w,
      h: this.h,
      t: this.t,
      rho: this.rho,
      q: this.q,
      held: this.compression,
      debit: this.debit,
      birthMap: this.birthMap,
      returnMap: this.returnMap,
      releaseSignals: this.releaseSignals.map((s) => ({ ...s })),
      cohorts: this.cohorts.map((c) => ({ ...c })),
      flights: this.flights.map((f) => ({ ...f })),
      summary: this.summary(),
      births: this.births.slice(-80),
      transfers: this.transfers.slice(-80),
      paths: [...this.paths.entries()].slice(-300).map(([id, path]) => [id, path.slice(-250)]),
    };
  }
}
