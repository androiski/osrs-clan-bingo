// Fireworks over the page in one colour (plus shades of it). They keep going until the
// returned stop() is called; browsers pause them while the tab isn't visible. Skipped
// (returns nothing) for people who've asked their device to reduce motion.
//
// The first rocket spells out BINGO. After that, bursts are spheres, willows, crackles, and
// item shapes: sparks fly out, form the pixel shape of one of the given item icons, hold
// it for a moment, then fall away.
// Every 15-20 seconds there's a small finale volley.
export function fireworks(color, iconUrls = []){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0;
  const size = () => { W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener("resize", size);

  const shade = (hex, k) => "#" + [1, 3, 5].map(i => {   // k > 0 lightens, k < 0 darkens
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)).toString(16).padStart(2, "0");
  }).join("");
  const base = color, dark = shade(color, -0.45), light = shade(color, 0.4), pale = shade(color, 0.75);
  const shades = [base, base, light, pale];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const MAX_SPARKS = 3500;

  // Item shapes: every visible pixel of each icon, coloured by how bright it is.
  const shapes = [];
  for (const url of iconUrls){
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data, px = [];
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++){
          const o = (y * c.width + x) * 4;
          if (d[o + 3] < 120) continue;
          const lum = (0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2]) / 255;
          px.push([x - c.width / 2, y - c.height / 2, lum < 0.15 ? dark : lum < 0.45 ? base : lum < 0.7 ? light : pale]);
        }
        if (px.length > 20) shapes.push({px, w: c.width, h: c.height});
      } catch {}   // pixels unreadable: just skip this shape
    };
    img.src = url;
  }

  const rockets = [], sparks = [], flashes = [];
  const t0 = performance.now();
  let nextLaunch = t0 + 2600, nextFinale = t0 + rand(15000, 20000), last = t0, running = true;   // the BINGO rocket goes up alone first

  function launch(x = W * rand(0.1, 0.9)){
    rockets.push({x, y: H + 10, vx: rand(-0.6, 0.6), vy: -rand(H / 70, H / 52), top: H * rand(0.12, 0.42),
      color: pick(shades), trail: []});
  }

  function spark(x, y, angle, speed, o = {}){
    if (sparks.length >= MAX_SPARKS) return;
    sparks.push({x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: o.decay ?? rand(0.007, 0.012), gravity: o.gravity ?? 0.05, drag: o.drag ?? 0.982,
      color: o.color ?? pick(shades), size: o.size ?? 3, crackle: o.crackle || false});
  }

  // A word spelled out in sparks, in the RuneScape font (already loaded by the page).
  function wordShape(word){
    const c = document.createElement("canvas"), g = c.getContext("2d");
    let fontPx = Math.round(Math.min(W * 0.48, H * 0.6, 460));
    g.font = `${fontPx}px "RuneScape Bold", Georgia, serif`;
    const fit = W * 0.94 / g.measureText(word).width;   // keep the whole word on screen
    if (fit < 1) fontPx = Math.floor(fontPx * fit);
    const font = `${fontPx}px "RuneScape Bold", Georgia, serif`;
    g.font = font;
    const w = Math.ceil(g.measureText(word).width) + 8, h = Math.ceil(fontPx * 1.15);
    c.width = w; c.height = h;
    g.font = font; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(word, 4, h / 2);
    const step = Math.max(3, Math.round(fontPx / 30)), d = g.getImageData(0, 0, w, h).data, px = [];
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step)
      if (d[(y * w + x) * 4 + 3] > 128) px.push([x - w / 2, y - h / 2, pick([pale, pale, light, base])]);
    return {px, w, h, scale: 1, size: step * 0.95, hold: 150, grow: true};
  }

  function shapeBurst(x, y, s = pick(shapes)){
    const scale = s.scale || Math.max(3, Math.min(9, Math.min(W, H) * 0.26 / Math.max(s.w, s.h)));
    const cx = Math.min(Math.max(x, s.w * scale / 2 + 12), W - s.w * scale / 2 - 12);
    const cy = Math.max(y, s.h * scale / 2 + 12);
    const hold = s.hold || rand(45, 70), size = s.size || scale * 0.9;
    for (const [px, py, col] of s.px){
      if (sparks.length >= MAX_SPARKS) break;
      sparks.push({x, y, px: x, py: y, vx: 0, vy: 0, life: 1, decay: 0, gravity: 0, drag: 0.98,
        color: col, size, shape: true, tx: cx + px * scale, ty: cy + py * scale, hold,
        // Words grow outward as one crisp shape; items drift in spark by spark.
        grow: !!s.grow, cx, cy, ox: px * scale, oy: py * scale, age: s.grow ? 0 : rand(-18, 0)});
    }
    for (let i = 0; i < 40; i++) spark(x, y, rand(0, Math.PI * 2), rand(2, 5), {size: 2});
  }

  function burst(x, y){
    flashes.push({x, y, r: rand(60, 110), life: 1});
    const kind = shapes.length && Math.random() < 0.15 ? "item" : pick(["sphere", "sphere", "willow", "crackle"]);
    const n = Math.floor(rand(120, 180)), speed = rand(3.5, 6.5);
    if (kind === "item") shapeBurst(x, y);
    else if (kind === "sphere"){
      for (let i = 0; i < n; i++) spark(x, y, rand(0, Math.PI * 2), speed * Math.sqrt(Math.random()) * 1.15);
    } else if (kind === "willow"){
      for (let i = 0; i < n; i++) spark(x, y, rand(0, Math.PI * 2), speed * rand(0.4, 0.9),
        {color: pick([light, pale]), decay: rand(0.004, 0.006), gravity: 0.035, drag: 0.975, size: 2});
    } else {
      for (let i = 0; i < n * 0.8; i++) spark(x, y, rand(0, Math.PI * 2), speed * rand(0.5, 1), {crackle: true, decay: rand(0.012, 0.018)});
    }
  }

  // Crackle sparks pop into a little cloud of glitter when they fade.
  function crackle(p){
    for (let i = 0; i < 6; i++) spark(p.x, p.y, rand(0, Math.PI * 2), rand(0.5, 2),
      {color: pale, decay: rand(0.03, 0.05), gravity: 0.02, size: 2});
  }

  function frame(t){
    // Movement is per 60th of a second, so it looks the same on 60 Hz and 240 Hz screens.
    const dt = Math.min(3, (t - last) / (1000 / 60)); last = t;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";   // overlapping light adds up, like real fireworks

    // A lively first few seconds, then an unhurried show with a small finale now and then.
    const opening = t - t0 < 4000;
    if (running && t > nextLaunch){
      launch();
      nextLaunch = t + (opening ? rand(350, 650) : rand(1100, 2000));
    }
    if (running && t > nextFinale){
      for (let i = 0; i < 4; i++) setTimeout(() => running && launch(W * (0.2 + 0.6 * i / 3)), i * 200);
      nextFinale = t + rand(15000, 20000);
    }

    for (let i = flashes.length - 1; i >= 0; i--){
      const f = flashes[i];
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, pale); g.addColorStop(1, "transparent");
      ctx.globalAlpha = f.life * 0.35; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      f.life -= 0.08 * dt;
      if (f.life <= 0) flashes.splice(i, 1);
    }

    for (let i = rockets.length - 1; i >= 0; i--){
      const r = rockets[i];
      r.trail.push([r.x, r.y]); if (r.trail.length > Math.round(10 / Math.max(dt, 0.25))) r.trail.shift();
      r.x += (r.vx + Math.sin(t / 60 + i) * 0.3) * dt; r.y += r.vy * dt; r.vy *= Math.pow(0.982, dt);
      r.trail.forEach(([x, y], k) => { ctx.globalAlpha = (k + 1) / r.trail.length * 0.7; ctx.fillStyle = r.color; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); });
      ctx.globalAlpha = 1; ctx.fillStyle = pale; ctx.fillRect(r.x - 2, r.y - 2, 4, 4);
      if (r.y <= r.top || r.vy > -1.2){
        if (r.shape){ flashes.push({x: r.x, y: r.y, r: 160, life: 1}); shapeBurst(r.x, r.y, r.shape); }
        else burst(r.x, r.y);
        rockets.splice(i, 1);
      }
    }

    ctx.lineCap = "square";
    for (let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i];
      p.px = p.x; p.py = p.y;
      if (p.shape){
        // Fly to its place in the item's shape, hold, then drop like a normal spark.
        p.age += dt;
        // Drift out from the burst and ease into place over about a second, fading in.
        if (p.age < 0) continue;
        if (p.grow && p.age < 70){ const e = 1 - Math.pow(1 - Math.min(1, p.age / 55), 3); p.x = p.cx + p.ox * e; p.y = p.cy + p.oy * e; }
        else if (p.age < 70){ const k = 1 - Math.pow(0.955, dt); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
        else if (p.age > 70 + p.hold){ p.shape = false; p.vx = rand(-0.5, 0.5); p.vy = rand(-0.6, 0.2); p.gravity = 0.035; p.decay = rand(0.012, 0.02); }
        ctx.globalAlpha = 0.8 * Math.min(1, p.age / (p.grow ? 10 : 45)); ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        continue;
      }
      const drag = Math.pow(p.drag, dt);
      p.vx *= drag; p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0){ if (p.crackle) crackle(p); sparks.splice(i, 1); continue; }
      const a = p.life * (0.75 + 0.25 * Math.random());   // a little twinkle
      ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = Math.min(p.size, 4);
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 2, p.py - p.vy * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2 - 0.5, p.y - p.size / 2 - 0.5, p.size + 1, p.size + 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (running || rockets.length || sparks.length || flashes.length) requestAnimationFrame(frame);
    else { removeEventListener("resize", size); canvas.remove(); }
  }

  // Opening: one rocket up the middle that spells BINGO, then a small volley.
  document.fonts.load('48px "RuneScape Bold"').catch(() => {}).finally(() => {
    if (!running) return;
    rockets.push({x: W / 2, y: H + 10, vx: 0, vy: -H / 55, top: H * 0.3, color: pale, trail: [], shape: wordShape("BINGO")});
    for (let i = 0; i < 3; i++) setTimeout(() => running && launch(W * (0.2 + 0.6 * i / 2)), 1800 + i * 300);
  });
  requestAnimationFrame(frame);

  // Stop launching; what's in the air fades out quickly, then the canvas is removed.
  return function stop(){
    running = false;
    rockets.length = 0;
    for (const p of sparks){
      if (p.shape){ p.shape = false; p.vx = rand(-0.5, 0.5); p.vy = 0; p.gravity = 0.035; }
      p.decay = Math.max(p.decay, 0.01) * 4; p.crackle = false;
    }
  };
}
