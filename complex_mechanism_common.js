// Shared runtime for separated compound mechanism demonstrations.
(function(){
const cfg = window.COMPLEX_DEMO_CONFIG;
if(!cfg) return;

const canvas = document.getElementById('complexCanvas');
const wrapper = document.getElementById('canvasWrap');
const ctx = canvas.getContext('2d');
const titleEl = document.getElementById('demoTitle');
const subtitleEl = document.getElementById('demoSubtitle');
const goalEl = document.getElementById('teachingGoals');
const dataEl = document.getElementById('dataPanel');
const compareEl = document.getElementById('comparePanel');
const formulaEl = document.getElementById('formulaPanel');

let displayW = 900;
let displayH = 560;
let theta = cfg.initialTheta || Math.PI / 5;
let time = 0;
let lastT = null;
let paused = false;
let omega = cfg.omega || 1.6;
let vScale = 0.38;
let aScale = 0.08;
let showVel = true;
let showAcc = true;
let showTrail = true;
let showPhase = true;
let trails = {};
const MAX_TRAIL = 420;

function resize(){
  const rect = wrapper.getBoundingClientRect();
  displayW = rect.width;
  displayH = Math.max(500, Math.min(720, displayW * 0.58));
  canvas.width = Math.floor(displayW * devicePixelRatio);
  canvas.height = Math.floor(displayH * devicePixelRatio);
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(devicePixelRatio, devicePixelRatio);
}

function world(origin, scale, x, y){
  return {x: origin.x + x * scale, y: origin.y - y * scale};
}

function clearTrails(){ trails = {}; }

function addTrail(id, p){
  if(!showTrail || !p) return;
  if(!trails[id]) trails[id] = [];
  trails[id].push({x:p.x, y:p.y});
  if(trails[id].length > MAX_TRAIL) trails[id].shift();
}

function drawTrail(points, origin, scale, color){
  if(!showTrail || !points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6,5]);
  ctx.beginPath();
  const p0 = world(origin, scale, points[0].x, points[0].y);
  ctx.moveTo(p0.x, p0.y);
  for(let i=1;i<points.length;i++){
    const p = world(origin, scale, points[i].x, points[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function line(origin, scale, x1, y1, x2, y2, color, width, dash){
  const a = world(origin, scale, x1, y1);
  const b = world(origin, scale, x2, y2);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 2;
  if(dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function circle(origin, scale, x, y, r, stroke, fill, width){
  const p = world(origin, scale, x, y);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * scale, 0, Math.PI * 2);
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = stroke || '#d7e3f5';
  ctx.lineWidth = width || 2;
  ctx.stroke();
}

function label(origin, scale, x, y, text, color, size, dx, dy){
  const p = world(origin, scale, x, y);
  ctx.fillStyle = color || '#dce9ff';
  ctx.font = `600 ${size || 12}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x + (dx || 0), p.y + (dy || 0));
}

function screenArrow(x1, y1, x2, y2, color, width){
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if(len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width || 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const h = 9;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * h - uy * h * 0.45, y2 - uy * h + ux * h * 0.45);
  ctx.lineTo(x2 - ux * h + uy * h * 0.45, y2 - uy * h - ux * h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function vector(origin, scale, x, y, vx, vy, color, factor, text){
  const p = world(origin, scale, x, y);
  const q = world(origin, scale, x + vx * factor, y + vy * factor);
  screenArrow(p.x, p.y, q.x, q.y, color, 2.2);
  if(text){
    ctx.fillStyle = color;
    ctx.font = '600 11px "Microsoft YaHei", sans-serif';
    ctx.fillText(text, q.x + 8, q.y - 5);
  }
}

function panel(x, y, w, h, title){
  ctx.save();
  ctx.fillStyle = 'rgba(8,13,24,0.72)';
  ctx.strokeStyle = '#263b61';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8edcff';
  ctx.font = '700 13px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 12, y + 22);
  ctx.restore();
}

function computePlanetary(th, om, p){
  const rs = p.sunR || 48;
  const rp = p.planetR || 30;
  const ringR = rs + 2 * rp;
  const carrierR = rs + rp;
  const omegaC = om * rs / (rs + ringR);
  const psi = omegaC / om * th + (p.phase || 0);
  const beta = -omegaC * carrierR / rp / om * th;
  const Cx = carrierR * Math.cos(psi);
  const Cy = carrierR * Math.sin(psi);
  const Px = Cx + rp * Math.cos(beta);
  const Py = Cy + rp * Math.sin(beta);
  return {rs,rp,ringR,carrierR,omegaC,ratio:om/omegaC,psi,beta,Cx,Cy,Px,Py};
}

function computeSlider(th, om, p){
  const r = p.r || 54;
  const L = p.L || 145;
  const e = p.e || 0;
  const t = th + (p.phase || 0);
  const s = Math.max(8, Math.sqrt(Math.max(L*L - (e + r*Math.sin(t))**2, 8)));
  const Ax = r * Math.cos(t);
  const Ay = r * Math.sin(t);
  const Bx = r * Math.cos(t) + s;
  const By = -e;
  const vx = -r * om * Math.sin(t) - (e + r*Math.sin(t)) * r * om * Math.cos(t) / s;
  const vy = 0;
  const dth = 0.001;
  const pos = a => {
    const ss = Math.sqrt(Math.max(L*L - (e + r*Math.sin(a))**2, 8));
    return r * Math.cos(a) + ss;
  };
  const vxP = (pos(t+dth) - pos(t)) / (dth / om);
  const vxN = (pos(t) - pos(t-dth)) / (dth / om);
  const ax = (vxP - vxN) / (2 * dth / om);
  return {r,L,e,t,Ax,Ay,Bx,By,vx,vy,ax,ay:0,point:{x:Bx,y:By}};
}

function computeScotch(th, om, p){
  const r = p.r || 62;
  const t = th + (p.phase || 0);
  const Ax = r * Math.cos(t);
  const Ay = r * Math.sin(t);
  return {
    r,t,Ax,Ay,Yx:0,Yy:Ay,
    vx:0, vy:om*r*Math.cos(t),
    ax:0, ay:-om*om*r*Math.sin(t),
    relVx:-om*r*Math.sin(t), relVy:0,
    point:{x:0,y:Ay},
  };
}

function computeGuide(th, om, p){
  const r = p.r || 58;
  const d = p.d || 165;
  const t = th + (p.phase || 0);
  const Ax = r * Math.cos(t);
  const Ay = r * Math.sin(t);
  const BAx = Ax - d;
  const BAy = Ay;
  const s = Math.max(1, Math.hypot(BAx, BAy));
  const ux = BAx / s;
  const uy = BAy / s;
  const upx = -uy;
  const upy = ux;
  const D = s*s;
  const omegaE = om * r * (r - d * Math.cos(t)) / D;
  const vr = r * d * om * Math.sin(t) / s;
  const ac = 2 * omegaE * vr;
  const vaX = -om * r * Math.sin(t);
  const vaY = om * r * Math.cos(t);
  const veX = omegaE * s * upx;
  const veY = omegaE * s * upy;
  const vrX = vr * ux;
  const vrY = vr * uy;
  return {r,d,t,Ax,Ay,s,ux,uy,upx,upy,omegaE,vr,ac,vaX,vaY,veX,veY,vrX,vrY,point:{x:Ax,y:Ay}};
}

function drawGear(origin, scale, x, y, r, teeth, color, fill, angle){
  circle(origin, scale, x, y, r, color, fill, 2);
  for(let i=0;i<teeth;i++){
    const a = i * Math.PI * 2 / teeth;
    line(origin, scale, x+Math.cos(a)*r*0.88, y+Math.sin(a)*r*0.88, x+Math.cos(a)*r*1.08, y+Math.sin(a)*r*1.08, color, 1);
  }
  if(angle !== undefined) line(origin, scale, x, y, x+Math.cos(angle)*r*0.72, y+Math.sin(angle)*r*0.72, '#f7fbff', 2);
}

function drawPlanetary(mod, kin){
  const o = mod.origin;
  const s = mod.scale;
  drawGear(o, s, 0, 0, kin.ringR, 48, '#88aacc', 'rgba(80,110,145,0.12)');
  drawGear(o, s, 0, 0, kin.rs, 24, '#e8b830', 'rgba(232,184,48,0.20)', theta);
  for(let k=0;k<3;k++){
    const a = kin.psi + k*Math.PI*2/3;
    const cx = kin.carrierR*Math.cos(a);
    const cy = kin.carrierR*Math.sin(a);
    line(o,s,0,0,cx,cy,'#5c82aa',3);
    drawGear(o,s,cx,cy,kin.rp,18,'#77ccaa','rgba(80,180,150,0.18)',kin.beta+k*Math.PI*2/3);
  }
  circle(o,s,kin.Cx,kin.Cy,5,'#77ccaa','#22aa88',2);
  label(o,s,0,-kin.ringR-22,'行星减速输入','#ffdf7d',12);
  label(o,s,kin.Cx,kin.Cy,'输出架','#9bd8ff',10,0,18);
}

function drawSlider(mod, kin){
  const o = mod.origin;
  const s = mod.scale;
  line(o,s,-70,kin.By,kin.Bx+80,kin.By,'#536273',2);
  for(let x=-60;x<kin.Bx+70;x+=22) line(o,s,x,kin.By-5,x+8,kin.By-13,'#34445b',1);
  circle(o,s,0,0,6,'#9aa7b8','#253145',2);
  line(o,s,0,0,kin.Ax,kin.Ay,'#e8b830',4);
  line(o,s,kin.Ax,kin.Ay,kin.Bx,kin.By,'#bb9944',3);
  circle(o,s,kin.Ax,kin.Ay,6,'#ffbd55','#ff8a2a',2);
  circle(o,s,kin.Bx,kin.By,10,'#88bbdd','rgba(136,187,221,0.24)',2);
  label(o,s,kin.Bx,kin.By,mod.label || '滑块','#d8efff',11,0,-20);
  if(showVel) vector(o,s,kin.Bx,kin.By,kin.vx,0,'#ff5555',vScale,'v');
  if(showAcc) vector(o,s,kin.Bx,kin.By,kin.ax,0,'#cc66ff',aScale,'a');
}

function drawScotch(mod, kin){
  const o = mod.origin;
  const s = mod.scale;
  line(o,s,-90,0,90,0,'#2d3a50',1,[5,5]);
  line(o,s,0,-90,0,90,'#40506a',2);
  circle(o,s,0,0,6,'#9aa7b8','#253145',2);
  line(o,s,0,0,kin.Ax,kin.Ay,'#e8b830',4);
  const p = world(o,s,0,kin.Yy);
  ctx.save();
  ctx.strokeStyle = '#88bbdd';
  ctx.fillStyle = 'rgba(80,140,190,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x-28*s, p.y-52*s, 56*s, 104*s, 7);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#6fa0cf';
  ctx.beginPath();
  ctx.moveTo(p.x-42*s, p.y);
  ctx.lineTo(p.x+42*s, p.y);
  ctx.stroke();
  ctx.restore();
  circle(o,s,kin.Ax,kin.Ay,7,'#ffbd55','#ff8a2a',2);
  label(o,s,0,kin.Yy,mod.label || '滑框','#d8efff',11,0,-65*s);
  if(showVel) vector(o,s,0,kin.Yy,0,kin.vy,'#ff5555',vScale,'v');
  if(showAcc) vector(o,s,0,kin.Yy,0,kin.ay,'#cc66ff',aScale,'a');
}

function drawGuide(mod, kin){
  const o = mod.origin;
  const s = mod.scale;
  circle(o,s,0,0,6,'#9aa7b8','#253145',2);
  circle(o,s,kin.d,0,6,'#9aa7b8','#253145',2);
  line(o,s,0,0,kin.Ax,kin.Ay,'#e8b830',4);
  const barLen = kin.d + kin.r + 80;
  line(o,s,kin.Ax+kin.ux*40,kin.Ay+kin.uy*40,kin.d-kin.ux*barLen*0.55,-kin.uy*barLen*0.55,'#557799',7);
  line(o,s,kin.Ax+kin.ux*40,kin.Ay+kin.uy*40,kin.d-kin.ux*barLen*0.55,-kin.uy*barLen*0.55,'#94c4e8',3);
  circle(o,s,kin.Ax,kin.Ay,8,'#ffbd55','#ff8a2a',2);
  label(o,s,kin.Ax,kin.Ay,mod.label || 'A','#ffd88b',11,0,-18);
  if(showVel){
    vector(o,s,kin.Ax,kin.Ay,kin.vaX,kin.vaY,'#ff5555',vScale,'va');
    vector(o,s,kin.Ax,kin.Ay,kin.veX,kin.veY,'#4488ff',vScale,'ve');
    vector(o,s,kin.Ax,kin.Ay,kin.vrX,kin.vrY,'#44cc66',vScale,'vr');
  }
  if(showAcc) vector(o,s,kin.Ax,kin.Ay,kin.ac*kin.upx,kin.ac*kin.upy,'#cc66ff',aScale,'aC');
}

function drawMiniPlot(mod, series, colorA, colorB){
  if(!mod.plot) return;
  const x = mod.plot.x;
  const y = mod.plot.y;
  const w = mod.plot.w;
  const h = mod.plot.h;
  panel(x,y,w,h,mod.plot.title);
  ctx.save();
  ctx.strokeStyle = '#253858';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x+14, y+h/2);
  ctx.lineTo(x+w-14, y+h/2);
  ctx.stroke();
  const drawSeries = (phase, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i=0;i<120;i++){
      const u = i / 119;
      const px = x + 18 + u * (w - 36);
      const py = y + h/2 - Math.sin(theta + phase + u * Math.PI * 2) * (h * 0.28);
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  };
  drawSeries(series[0] || 0, colorA || '#ff6666');
  if(series.length > 1) drawSeries(series[1], colorB || '#66d9ef');
  ctx.restore();
}

function computeModule(mod){
  const om = omega * (mod.speed || 1);
  if(mod.type === 'planetary') return computePlanetary(theta, om, mod);
  if(mod.type === 'slider') return computeSlider(theta, om, mod);
  if(mod.type === 'scotch') return computeScotch(theta, om, mod);
  if(mod.type === 'guide') return computeGuide(theta, om, mod);
  return null;
}

function drawModule(mod, kin){
  if(mod.titleBox) panel(mod.titleBox.x, mod.titleBox.y, mod.titleBox.w, mod.titleBox.h, mod.titleBox.title);
  if(mod.type === 'planetary') drawPlanetary(mod, kin);
  if(mod.type === 'slider') drawSlider(mod, kin);
  if(mod.type === 'scotch') drawScotch(mod, kin);
  if(mod.type === 'guide') drawGuide(mod, kin);
  if(showPhase && mod.phaseMark){
    ctx.fillStyle = '#9eb5d6';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText(mod.phaseMark, mod.origin.x - 46, mod.origin.y + 82);
  }
}

function buildInfo(results){
  const thD = ((theta * 180 / Math.PI) % 360).toFixed(1);
  dataEl.innerHTML = [
    row('时间 t', `${time.toFixed(2)} s`),
    row('输入角 θ', `${thD}°`),
    row('输入角速度', `${omega.toFixed(2)} rad/s`),
    row('显示场景', cfg.shortTitle)
  ].join('');

  compareEl.innerHTML = cfg.modules.map((mod, idx) => {
    const k = results[idx];
    let extra = '';
    if(mod.type === 'planetary') extra = `减速比 i=${k.ratio.toFixed(2)}`;
    if(mod.type === 'slider') extra = `x=${k.Bx.toFixed(1)}, aC=0`;
    if(mod.type === 'scotch') extra = `y=${k.Yy.toFixed(1)}, aC=0`;
    if(mod.type === 'guide') extra = `aC=${Math.abs(k.ac).toFixed(1)}`;
    return `<div class="compare-row"><b>${mod.name}</b><span>${mod.motion}</span><em>${extra}</em></div>`;
  }).join('');

  formulaEl.innerHTML = cfg.formulas.map(f => `<div class="formula-line">${f}</div>`).join('');
}

function row(k, v){
  return `<div class="data-row"><span>${k}</span><b>${v}</b></div>`;
}

function drawGrid(){
  ctx.clearRect(0,0,displayW,displayH);
  ctx.fillStyle = '#08101d';
  ctx.fillRect(0,0,displayW,displayH);
  ctx.save();
  ctx.strokeStyle = '#142238';
  ctx.lineWidth = 1;
  for(let x=0;x<displayW;x+=42){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,displayH); ctx.stroke(); }
  for(let y=0;y<displayH;y+=42){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(displayW,y); ctx.stroke(); }
  ctx.restore();
}

function drawConnections(){
  if(!cfg.connections) return;
  cfg.connections.forEach(conn => {
    if(!conn.points || conn.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = conn.color || '#6ea8d8';
    ctx.fillStyle = conn.color || '#6ea8d8';
    ctx.lineWidth = conn.width || 3;
    ctx.lineCap = 'round';
    if(conn.dash) ctx.setLineDash(conn.dash);
    ctx.beginPath();
    ctx.moveTo(conn.points[0].x, conn.points[0].y);
    for(let i=1;i<conn.points.length;i++) ctx.lineTo(conn.points[i].x, conn.points[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    if(conn.arrow !== false){
      const a = conn.points[conn.points.length - 2];
      const b = conn.points[conn.points.length - 1];
      screenArrow(a.x, a.y, b.x, b.y, conn.color || '#6ea8d8', conn.width || 3);
    }
    if(conn.label){
      const mid = conn.points[Math.floor(conn.points.length / 2)];
      ctx.font = '600 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(conn.label, mid.x + (conn.dx || 0), mid.y + (conn.dy || -10));
    }
    ctx.restore();
  });
}

function render(){
  drawGrid();
  drawConnections();
  const results = cfg.modules.map(computeModule);
  cfg.modules.forEach((mod, i) => {
    const k = results[i];
    if(k && k.point) addTrail(mod.id, k.point);
    drawTrail(trails[mod.id], mod.origin, mod.scale, mod.trailColor || '#ff7777');
    drawModule(mod, k);
  });
  (cfg.plots || []).forEach(plot => drawMiniPlot(plot, plot.phases || [0], plot.colorA, plot.colorB));
  buildInfo(results);
}

function loop(ts){
  if(!lastT) lastT = ts;
  let dt = (ts - lastT) / 1000;
  if(dt > 0.08) dt = 0.08;
  lastT = ts;
  if(!paused){
    time += dt;
    theta = (theta + omega * dt) % (Math.PI * 2);
  }
  render();
  requestAnimationFrame(loop);
}

function bind(){
  document.getElementById('btnPlay').addEventListener('click', () => {
    paused = !paused;
    document.getElementById('btnPlay').textContent = paused ? '播放' : '暂停';
  });
  document.getElementById('btnStep').addEventListener('click', () => {
    paused = true;
    document.getElementById('btnPlay').textContent = '播放';
    time += 0.05;
    theta = (theta + omega * 0.05) % (Math.PI * 2);
    render();
  });
  document.getElementById('btnReset').addEventListener('click', () => {
    theta = cfg.initialTheta || Math.PI / 5;
    time = 0;
    paused = false;
    clearTrails();
    document.getElementById('btnPlay').textContent = '暂停';
  });
  document.getElementById('btnClear').addEventListener('click', clearTrails);
  document.getElementById('omega').addEventListener('input', e => {
    omega = parseFloat(e.target.value);
    document.getElementById('omegaVal').textContent = omega.toFixed(1);
    clearTrails();
  });
  document.getElementById('showVel').addEventListener('change', e => showVel = e.target.checked);
  document.getElementById('showAcc').addEventListener('change', e => showAcc = e.target.checked);
  document.getElementById('showTrail').addEventListener('change', e => { showTrail = e.target.checked; if(!showTrail) clearTrails(); });
  document.getElementById('showPhase').addEventListener('change', e => showPhase = e.target.checked);
  window.addEventListener('resize', () => { resize(); clearTrails(); render(); });
}

function init(){
  titleEl.textContent = cfg.title;
  subtitleEl.textContent = cfg.subtitle;
  goalEl.innerHTML = cfg.goals.map(g => `<li>${g}</li>`).join('');
  document.getElementById('omega').value = omega;
  document.getElementById('omegaVal').textContent = omega.toFixed(1);
  resize();
  bind();
  render();
  requestAnimationFrame(loop);
}

init();
})();
