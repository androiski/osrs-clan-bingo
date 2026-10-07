// Fireworks over the page in one colour (plus lighter shades of it). They keep going;
// browsers pause them while the tab isn't visible. Skipped for people who've asked
// their device to reduce motion.
//
// Bursts come in a few kinds (sphere, ring, double ring, willow, crackle), sparks leave
// short glowing streaks, and every so often there's a finale volley.
function fireworks(color){
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

  const lighten = (hex, k) => "#" + [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * k).toString(16).padStart(2, "0");
  }).join("");
  const base = color, light = lighten(color, 0.4), pale = lighten(color, 0.75);
  const shades = [base, base, light, pale];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const MAX_SPARKS = 3000;

  const rockets = [], sparks = [], flashes = [];
  const t0 = performance.now();
  let nextLaunch = 0, nextFinale = t0 + rand(9000, 12000), last = t0;

  function launch(x = W * rand(0.1, 0.9)){
    rockets.push({x, y: H + 10, vx: rand(-0.6, 0.6), vy: -rand(H / 70, H / 52), top: H * rand(0.1, 0.42),
      color: pick(shades), trail: []});
  }

  function spark(x, y, angle, speed, o = {}){
    if (sparks.length >= MAX_SPARKS) return;
    sparks.push({x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: o.decay ?? rand(0.007, 0.012), gravity: o.gravity ?? 0.05, drag: o.drag ?? 0.982,
      color: o.color ?? pick(shades), size: o.size ?? 3, crackle: o.crackle || false});
  }

  function burst(x, y){
    flashes.push({x, y, r: rand(60, 110), life: 1});
    const kind = pick(["sphere", "sphere", "ring", "double", "willow", "crackle"]);
    const n = Math.floor(rand(120, 180)), speed = rand(3.5, 6.5);
    if (kind === "sphere"){
      for (let i = 0; i < n; i++) spark(x, y, rand(0, Math.PI * 2), speed * Math.sqrt(Math.random()) * 1.15);
    } else if (kind === "ring" || kind === "double"){
      for (let i = 0; i < n; i++) spark(x, y, (i / n) * Math.PI * 2, speed, {color: base, gravity: 0.03});
      if (kind === "double") for (let i = 0; i < n * 0.6; i++) spark(x, y, (i / (n * 0.6)) * Math.PI * 2, speed * 0.55, {color: pale, gravity: 0.03});
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

    const opening = t - t0 < 5000;
    if (t > nextLaunch){
      launch();
      if (opening && Math.random() < 0.5) launch();
      nextLaunch = t + (opening ? rand(120, 300) : rand(350, 800));
    }
    if (t > nextFinale){
      for (let i = 0; i < 7; i++) setTimeout(() => launch(W * (0.1 + 0.8 * i / 6)), i * 90);
      nextFinale = t + rand(9000, 13000);
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
      if (r.y <= r.top || r.vy > -1.2){ burst(r.x, r.y); rockets.splice(i, 1); }
    }

    ctx.lineCap = "square";
    for (let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i];
      p.px = p.x; p.py = p.y;
      const drag = Math.pow(p.drag, dt);
      p.vx *= drag; p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0){ if (p.crackle) crackle(p); sparks.splice(i, 1); continue; }
      const a = p.life * (0.75 + 0.25 * Math.random());   // a little twinkle
      ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 2, p.py - p.vy * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2 - 0.5, p.y - p.size / 2 - 0.5, p.size + 1, p.size + 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  }

  for (let i = 0; i < 5; i++) setTimeout(() => launch(W * (0.15 + 0.7 * i / 4)), i * 140);   // opening volley
  requestAnimationFrame(frame);
}
