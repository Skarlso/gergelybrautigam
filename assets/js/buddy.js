(() => {
  const strip = document.querySelector('.strip');
  const canvas = strip && strip.querySelector('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');

  const stops = [...strip.querySelectorAll('.signs a')]
    .map(link => ({
      link,
      post: link.parentElement,
      el: document.getElementById(link.hash.slice(1)),
      pose: link.dataset.pose,
      say: link.dataset.say,
    }))
    .filter(st => st.el);
  const solo = { pose: strip.dataset.pose, say: strip.dataset.say };
  const hasWater = stops.length > 0 && stops[stops.length - 1].pose === 'sail';

  // GROUND matches the bottom offset of .signs li in main.css
  const GROUND = 24;
  const HIP = 23, TORSO = 22, LEG = 12, ARM = 11, HEAD = 9;

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (lo, hi, v) => { const k = clamp((v - lo) / (hi - lo), 0, 1); return k * k * (3 - 2 * k); };
  const strike = t => ((Math.sin(t * 5) + 1) / 2) ** 2;
  const turn = t => Math.sin(t * 1.3) * 0.5;
  const rim = a => [25 + Math.cos(a) * 10, 5 + Math.sin(a) * 10];

  // Hands are offsets from the shoulder, feet are offsets from the spot the figure stands on.
  const REST = { hL: [-7, 20], hR: [7, 20], fL: [-4, 0], fR: [4, 0], lean: 0, bob: 0 };
  const POSES = {
    idle: t => ({ ...REST, bob: Math.sin(t * 2) * 0.5 }),
    wave: t => ({ ...REST, hR: [14 + Math.sin(t * 9) * 4, -13 + Math.cos(t * 9) * 1.5] }),
    helm: t => ({ ...REST, lean: 0.06, hR: rim(turn(t) + Math.PI - 0.7), hL: rim(turn(t) + Math.PI + 0.7) }),
    hammer: t => ({ ...REST, lean: 0.04, hR: [lerp(15, 8, strike(t)), lerp(6, -12, strike(t))] }),
    mic: t => ({ ...REST, hR: [9, -7], hL: [-13 + Math.sin(t * 2.3) * 3, -2 + Math.sin(t * 3.1) * 4] }),
    teach: t => ({ ...REST, hR: [14 + Math.sin(t * 4), -6 + Math.cos(t * 4)], hL: [-5, 17] }),
    lookback: t => ({ ...REST, lean: -0.05, hL: [-7, -18], hR: [5, 18], bob: Math.sin(t * 2) * 0.5 }),
    sail: t => ({ ...REST, hR: [20, 9], hL: [-14 - Math.sin(t * 7) * 4, -13 + Math.cos(t * 7) * 1.5] }),
    jump: () => ({ ...REST, hL: [-13, -15], hR: [13, -15], fL: [-6, -7], fR: [6, -7] }),
    walk: (ph, f) => ({
      hL: [-10 * Math.sin(ph) * f, 19],
      hR: [10 * Math.sin(ph) * f, 19],
      fL: [11 * Math.sin(ph) * f, -5 * Math.max(0, Math.cos(ph))],
      fR: [-11 * Math.sin(ph) * f, -5 * Math.max(0, -Math.cos(ph))],
      lean: 0.07 * f,
      bob: 1.4 + Math.cos(ph * 2) * 0.8,
    }),
  };
  const GAZE = { helm: [2, 0.4], hammer: [2, 0.6], teach: [2.2, -0.2], lookback: [-2.4, -0.2] };

  let W = 0, H = 0, s = 1, dpr = 1, col = {};
  let T = 0.4, last = 0, raf = 0, boil = 7, boilAt = 0, seed = 1;
  let said = -2, current = -1, pointer = null;
  const fig = { x: null, y: 0, vy: 0, face: 1, phase: 0, rest: 0, kind: null, alpha: 0, look: [0, 0] };
  const cur = JSON.parse(JSON.stringify(REST));
  const bubble = { text: '', until: 0, a: 0 };

  const rnd = () => {
    seed = seed + 0x6D2B79F5 | 0;
    let v = Math.imul(seed ^ seed >>> 15, 1 | seed);
    v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v;
    return ((v ^ v >>> 14) >>> 0) / 4294967296;
  };
  const jit = a => (rnd() - 0.5) * 2 * a;

  function pen(color, width) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1 + jit(0.4), y1 + jit(0.4));
    ctx.quadraticCurveTo((x1 + x2) / 2 + jit(0.9), (y1 + y2) / 2 + jit(0.9), x2 + jit(0.4), y2 + jit(0.4));
    ctx.stroke();
  }

  function path(pts, fill) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + jit(0.5), y + jit(0.5)) : ctx.moveTo(x + jit(0.5), y + jit(0.5))));
    if (fill) {
      ctx.closePath();
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();
  }

  function blob(cx, cy, rx, ry, fill) {
    const n = 10, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = 1 + jit(0.045);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    if (fill) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();
  }

  function dot(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two-bone IK. Of the two possible joint positions, score() picks the natural one.
  function bend(from, to, len, score) {
    let dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 0.01;
    const reach = len * 2 - 0.01;
    if (d > reach) { dx *= reach / d; dy *= reach / d; d = reach; }
    const base = Math.atan2(dy, dx), off = Math.acos(d / (len * 2));
    const a = { x: from.x + Math.cos(base + off) * len, y: from.y + Math.sin(base + off) * len };
    const b = { x: from.x + Math.cos(base - off) * len, y: from.y + Math.sin(base - off) * len };
    return { mid: score(a) >= score(b) ? a : b, end: { x: from.x + dx, y: from.y + dy } };
  }

  function figure(p, o) {
    pen(col.ink, 2.6);
    const hip = { x: 0, y: -HIP + p.bob };
    const up = { x: Math.sin(p.lean), y: -Math.cos(p.lean) };
    const neck = { x: hip.x + up.x * TORSO, y: hip.y + up.y * TORSO };
    const sh = { x: hip.x + up.x * (TORSO - 3), y: hip.y + up.y * (TORSO - 3) };
    const head = { x: neck.x + up.x * (HEAD + 1), y: neck.y + up.y * (HEAD + 1) };

    for (const [side, f] of [[-1, p.fL], [1, p.fR]]) {
      const dir = o.stride ? o.face : side;
      const leg = bend(hip, { x: f[0], y: f[1] }, LEG, c => c.x * dir);
      line(hip.x, hip.y, leg.mid.x, leg.mid.y);
      line(leg.mid.x, leg.mid.y, leg.end.x, leg.end.y);
      line(leg.end.x, leg.end.y, leg.end.x + dir * 3.5, leg.end.y);
    }
    line(hip.x, hip.y, neck.x, neck.y);
    blob(head.x, head.y, HEAD, HEAD, col.paper);

    const [lx, ly] = o.look;
    dot(head.x - 3.1 + lx, head.y - 1.5 + ly, 1.2);
    dot(head.x + 3.1 + lx, head.y - 1.5 + ly, 1.2);
    const mx = head.x + lx * 0.6, my = head.y + 3.4 + ly * 0.5;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (o.mouth === 'talk') ctx.ellipse(mx, my + 0.6, 2, 0.8 + Math.abs(Math.sin(T * 11)) * 1.7, 0, 0, Math.PI * 2);
    else if (o.mouth === 'whee') ctx.arc(mx, my + 0.8, 2, 0, Math.PI * 2);
    else { ctx.moveTo(mx - 3, my); ctx.quadraticCurveTo(mx, my + 3, mx + 3, my); }
    ctx.stroke();
    ctx.lineWidth = 2.6;

    const hands = [];
    for (const [side, h] of [[-1, p.hL], [1, p.hR]]) {
      const arm = bend(sh, { x: sh.x + h[0], y: sh.y + h[1] }, ARM, c => c.x * side * 0.6 + c.y * 0.8);
      line(sh.x, sh.y, arm.mid.x, arm.mid.y);
      line(arm.mid.x, arm.mid.y, arm.end.x, arm.end.y);
      hands.push(arm.end);
    }
    return { head, handL: hands[0], handR: hands[1] };
  }

  // back() is drawn behind the figure, front() over it. at moves the figure inside the prop.
  const PROPS = {
    helm: {
      back() {
        pen(col.ink, 2.2);
        line(25, -27, 25, 0);
        line(18, 0, 32, 0);
      },
      front() {
        pen(col.ink, 2.2);
        blob(25, -37, 10, 10);
        for (let i = 0; i < 7; i++) {
          const a = turn(T) + (i / 7) * Math.PI * 2;
          line(25 + Math.cos(a) * 2.5, -37 + Math.sin(a) * 2.5, 25 + Math.cos(a) * 13.5, -37 + Math.sin(a) * 13.5);
        }
      },
    },
    hammer: {
      back() {
        pen(col.ink, 2.2);
        line(15, -21, 42, -21);
        line(18, -21, 17, 0);
        line(39, -21, 40, 0);
        path([[23, -21], [23, -30], [35, -30], [35, -21]], col.card);
      },
      front(j) {
        const k = strike(T), a = lerp(0.35, -1.9, k);
        const tx = j.handR.x + Math.cos(a) * 10, ty = j.handR.y + Math.sin(a) * 10;
        pen(col.ink, 2.2);
        line(j.handR.x, j.handR.y, tx, ty);
        ctx.lineWidth = 5;
        line(tx + Math.sin(a) * 4, ty - Math.cos(a) * 4, tx - Math.sin(a) * 4, ty + Math.cos(a) * 4);
        if (k < 0.07) {
          pen(col.pencil, 1.8);
          line(30, -34, 35, -40);
          line(27, -35, 27, -42);
          line(33, -32, 40, -34);
        }
      },
    },
    mic: {
      front(j) {
        pen(col.ink, 2.2);
        line(j.handR.x + 1.5, j.handR.y + 4, j.handR.x - 1, j.handR.y - 2.5);
        dot(j.handR.x - 2, j.handR.y - 4.5, 2.8);
      },
    },
    teach: {
      back() {
        pen(col.ink, 2.2);
        line(23, -38, 21, 0);
        line(45, -38, 47, 0);
        path([[19, -64], [49, -64], [49, -38], [19, -38]], col.card);
        pen(col.pencil, 1.8);
        path([[28, -58], [40, -58], [40, -46], [28, -46]], col.card);
        line(34, -58, 34, -61.5);
        dot(31.5, -53, 1.2);
        dot(36.5, -53, 1.2);
        line(31.5, -49, 36.5, -49);
      },
      front(j) {
        pen(col.ink, 2);
        line(j.handR.x, j.handR.y, j.handR.x + 8, j.handR.y - 3);
        const h = j.head;
        path([[h.x - 11, h.y - 8], [h.x, h.y - 13], [h.x + 11, h.y - 8], [h.x, h.y - 4]], col.ink);
        pen(col.pencil, 1.8);
        path([[h.x + 3, h.y - 9], [h.x + 10, h.y - 7], [h.x + 11, h.y - 1]]);
      },
    },
    lookback: {
      back() {
        pen(col.ink, 2);
        for (let k = 1; k <= 6; k++) {
          ctx.globalAlpha = fig.alpha * (1 - k / 7);
          line(-12 - k * 11, 7 + (k % 2) * 4, -16 - k * 11, 7 + (k % 2) * 4);
        }
      },
    },
    sail: {
      at: [-8, -3],
      back() {
        pen(col.ink, 2.2);
        line(12, -8, 12, -68);
        pen(col.pencil, 2.2);
        path([[15, -64], [15, -15], [41, -15]], col.card);
        path([[12, -68], [20, -65], [12, -62]], col.pencil);
      },
      front() {
        pen(col.ink, 2.4);
        path([[-30, -8], [33, -8], [25, 6], [-23, 6]], col.card);
      },
    },
  };

  function ground(shore) {
    const gy = H - GROUND;
    pen(col.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(-4, gy + jit(0.6));
    for (let x = 44; x < shore; x += 44) ctx.lineTo(x, gy + jit(0.7));
    ctx.lineTo(shore, gy);
    if (hasWater) ctx.lineTo(shore + 5, gy + 9);
    ctx.stroke();

    ctx.lineWidth = 1.6;
    for (const f of [0.06, 0.2, 0.33, 0.45, 0.59, 0.72, 0.9]) {
      const x = Math.round(f * shore);
      if (stops.some(st => Math.abs(st.post.offsetLeft - x) < 18)) continue;
      line(x - 3, gy - 1, x - 5, gy - 7);
      line(x, gy - 1, x, gy - 9);
      line(x + 3, gy - 1, x + 6, gy - 6);
    }

    if (!hasWater) return;
    for (const [dy, amp, speed, alpha] of [[3, 2.2, -1.8, 1], [11, 1.8, 1.3, 0.4]]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = shore + 4; x <= W + 6; x += 6) ctx.lineTo(x, gy + dy + Math.sin(x * 0.09 + T * speed + dy) * amp);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function speech(hx, top) {
    if (bubble.a < 0.02) return;
    const size = s < 1 ? 12 : 15;
    ctx.font = `600 ${size}px "Shantell Sans", sans-serif`;
    const w = ctx.measureText(bubble.text).width + 22, h = size + 13;
    const cx = clamp(hx + 10, w / 2 + 4, W - w / 2 - 4), cy = Math.max(h / 2 + 3, top - 9 - h / 2);
    ctx.globalAlpha = bubble.a;
    pen(col.ink, 2);
    blob(cx, cy, (w / 2) * (0.85 + bubble.a * 0.15), (h / 2) * (0.85 + bubble.a * 0.15), col.card);
    line(cx - 4, cy + h / 2 - 1, hx + 2, cy + h / 2 + 6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.text, cx, cy + 0.5);
    ctx.globalAlpha = 1;
  }

  function say(text, secs) {
    if (!text) return;
    bubble.text = text;
    bubble.until = performance.now() + secs * 1000;
    if (calm.matches) setTimeout(kick, secs * 1000 + 30);
  }

  // A section takes over once its heading is about a third down the viewport. Sections
  // too close to the end to get there still get a slice of the last stretch of scroll.
  function locate() {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return { i: 0, p: 0 };
    const at = stops.map((st, k) => (k ? Math.min(max, st.el.getBoundingClientRect().top + scrollY - innerHeight * 0.35) : 0));
    for (let k = at.length - 2; k > 0; k--) at[k] = Math.min(at[k], at[k + 1] - 80);
    let i = 0;
    for (let k = 1; k < at.length; k++) if (at[k] <= scrollY + 1) i = k;
    if (i === at.length - 1) return { i, p: 0 };
    return { i, p: clamp((scrollY - at[i]) / (at[i + 1] - at[i]), 0, 1) };
  }

  // The boat has to clear the shore, everyone else just steps out from behind the board.
  const standAt = i => stops[i].post.offsetLeft + (stops[i].pose === 'sail' ? 54 * s : (s < 1 ? 13 * s : stops[i].link.offsetWidth / 2 + 16 * s));

  function frame(now) {
    raf = 0;
    const still = calm.matches;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (!still) T += dt;
    if (!still && now - boilAt > 150) { boil = (boil * 16807) % 2147483647; boilAt = now; }
    seed = boil;

    let here = solo, target = W / 2, shore = W + 4;
    if (stops.length) {
      const loc = locate();
      here = stops[loc.i];
      target = loc.i + 1 < stops.length ? lerp(standAt(loc.i), standAt(loc.i + 1), smooth(0.55, 1, loc.p)) : standAt(loc.i);
      if (hasWater) shore = stops[stops.length - 1].post.offsetLeft + 12 * s;
      if (loc.i !== current) {
        current = loc.i;
        stops.forEach((st, k) => (k === current ? st.link.setAttribute('aria-current', 'true') : st.link.removeAttribute('aria-current')));
      }
    }

    if (fig.x === null || still) fig.x = target;
    const dx = target - fig.x, moving = Math.abs(dx) > 0.5;
    if (moving) {
      const speed = Math.max(60 * s, Math.abs(dx) * 5);
      const step = clamp(dx, -speed * dt, speed * dt);
      fig.x += step;
      fig.face = Math.sign(dx);
      fig.phase += Math.min((Math.abs(step) * 0.143) / s, 15 * dt);
      fig.rest = 0;
    } else {
      fig.rest = still ? 1 : fig.rest + dt;
    }

    if (fig.y < 0 || fig.vy < 0) {
      fig.vy += 520 * dt;
      fig.y = Math.min(0, fig.y + fig.vy * dt);
      if (fig.y === 0) fig.vy = 0;
    }
    const airborne = fig.y < 0;
    const sailing = hasWater && fig.x > shore;
    const stride = moving && !sailing && !airborne;

    let want, kind = null;
    if (airborne) want = POSES.jump();
    else if (sailing) { want = POSES.sail(T); kind = 'sail'; }
    else if (stride) want = POSES.walk(fig.phase, fig.face);
    else if (fig.rest > 0.12 && POSES[here.pose] && here.pose !== 'sail') { want = POSES[here.pose](T); kind = here.pose; }
    else want = POSES.idle(T);

    const k = still ? 1 : 1 - Math.exp(-(stride ? 28 : 12) * dt);
    for (const key of ['hL', 'hR', 'fL', 'fR']) {
      cur[key][0] = lerp(cur[key][0], want[key][0], k);
      cur[key][1] = lerp(cur[key][1], want[key][1], k);
    }
    cur.lean = lerp(cur.lean, want.lean, k);
    cur.bob = lerp(cur.bob, want.bob, k);

    if (fig.kind !== kind) {
      fig.alpha = still ? 0 : fig.alpha - dt * 7;
      if (fig.alpha <= 0) { fig.alpha = 0; fig.kind = kind; }
    }
    if (fig.kind === kind) fig.alpha = still ? 1 : Math.min(1, fig.alpha + dt * 5);
    const prop = PROPS[fig.kind];
    const at = (prop && prop.at) || [0, 0];

    if (!moving && fig.rest > 0.3 && said !== current) {
      said = current;
      say(here.say, 2.8);
    }
    const open = now < bubble.until;
    bubble.a = still ? +open : clamp(bubble.a + (open ? dt : -dt) * 8, 0, 1);

    const gy = H - GROUND;
    const swell = sailing ? Math.sin(T * 1.8) * 1.8 + 1 : 0;
    const baseY = gy + fig.y * s + swell;
    const headX = fig.x + at[0] * s, headY = baseY + (at[1] - HIP - TORSO - HEAD - 1) * s;

    let gaze = [0, 0];
    if (stride) gaze = [2.2 * fig.face, 0.3];
    else if (GAZE[fig.kind]) gaze = GAZE[fig.kind];
    else if (pointer) {
      const px = pointer.x - headX, py = pointer.y - headY, d = Math.hypot(px, py) || 1;
      gaze = [(px / d) * 1.9, (py / d) * 1.5];
    }
    fig.look[0] = lerp(fig.look[0], gaze[0], still ? 1 : 1 - Math.exp(-10 * dt));
    fig.look[1] = lerp(fig.look[1], gaze[1], still ? 1 : 1 - Math.exp(-10 * dt));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ground(shore);

    ctx.save();
    ctx.translate(fig.x, baseY);
    if (sailing) ctx.rotate(Math.sin(T * 1.8 + 1) * 0.035);
    ctx.scale(s, s);
    if (prop && prop.back) { ctx.globalAlpha = fig.alpha; prop.back(); ctx.globalAlpha = 1; }
    ctx.save();
    ctx.translate(at[0], at[1]);
    const mouth = airborne ? 'whee' : fig.kind === 'mic' && fig.alpha > 0.5 ? 'talk' : 'smile';
    const joints = figure(cur, { stride, face: fig.face, look: fig.look, mouth });
    ctx.restore();
    if (prop && prop.front) {
      ctx.globalAlpha = fig.alpha;
      prop.front(joints);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // on narrow screens the current board hangs over the figure, so the bubble goes above it
    const crown = headY - (HEAD + (fig.kind === 'teach' ? 6 : 0)) * s;
    speech(headX, s < 1 && stops.length ? Math.min(crown, gy - 76) : crown);
    if (!still) kick();
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function colours() {
    const css = getComputedStyle(document.documentElement);
    for (const name of ['ink', 'paper', 'card', 'pencil']) col[name] = css.getPropertyValue('--' + name).trim();
  }

  function fit() {
    const r = strip.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    s = W < 640 ? 0.8 : 1.5;
    fig.x = null;
  }

  const near = e => {
    const r = strip.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    const at = (PROPS[fig.kind] && PROPS[fig.kind].at) || [0, 0];
    return Math.hypot(pointer.x - fig.x - at[0] * s, pointer.y - (H - GROUND - 34 * s)) < 36 * s;
  };

  addEventListener('pointermove', e => {
    strip.classList.toggle('poke', near(e));
    kick();
  }, { passive: true });

  addEventListener('pointerdown', e => {
    if (!near(e) || e.target.closest('a') || fig.y < 0) return;
    if (!calm.matches) {
      fig.vy = -150;
      fig.y = -0.01;
    }
    say('wheee!', 1.2);
    kick();
  });

  addEventListener('scroll', kick, { passive: true });
  calm.addEventListener('change', kick);
  dark.addEventListener('change', () => { colours(); kick(); });
  new ResizeObserver(() => { fit(); kick(); }).observe(strip);
  if (document.fonts) document.fonts.ready.then(kick);

  strip.classList.add('live');
  colours();
  fit();
  kick();
})();
