// Fireworks over the page in one colour (plus lighter shades of it). They keep going;
// browsers pause them while the tab isn't visible. Skipped for people who've asked
// their device to reduce motion.
function fireworks(color){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const size = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener("resize", size);

  const lighten = (hex, k) => "#" + [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * k).toString(16).padStart(2, "0");
  }).join("");
  const colors = [color, color, lighten(color, 0.35), lighten(color, 0.65)];
  const sparks = [], rockets = [];
  const busyUntil = performance.now() + 5000;   // a big opening, then a steady show
  let nextLaunch = 0;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function launch(){
    rockets.push({x: innerWidth * (0.15 + Math.random() * 0.7), y: innerHeight, vy: -(innerHeight / 60) * (0.75 + Math.random() * 0.3),
      top: innerHeight * (0.12 + Math.random() * 0.3), color: pick(colors)});
  }
  function burst(r){
    const n = 100 + Math.floor(Math.random() * 50), speed = 3 + Math.random() * 3;
    for (let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2, s = speed * (0.6 + Math.random() * 0.5);
      sparks.push({x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color: Math.random() < 0.8 ? r.color : pick(colors)});
    }
  }
  function frame(t){
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (t > nextLaunch){ launch(); nextLaunch = t + (t < busyUntil ? 180 + Math.random() * 320 : 500 + Math.random() * 900); }
    for (let i = rockets.length - 1; i >= 0; i--){
      const r = rockets[i];
      r.y += r.vy; r.vy *= 0.985;
      ctx.fillStyle = r.color; ctx.fillRect(r.x - 1.5, r.y, 3, 8);
      if (r.y <= r.top || r.vy > -1){ burst(r); rockets.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.009;
      if (p.life <= 0){ sparks.splice(i, 1); continue; }
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);   // square sparks, in keeping with the pixel fonts
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  launch(); launch(); launch();   // open with a volley
  requestAnimationFrame(frame);
}
