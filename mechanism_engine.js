// Mechanism Kinematics Engine
(function(){
const wrapper = document.getElementById('wrapper');
const canvas  = document.getElementById('cv');
const ctx     = canvas.getContext('2d');
const hint    = document.getElementById('hint');

let displayW, displayH;

function resize(){
  const r = wrapper.getBoundingClientRect();
  const w = r.width, h = Math.max(480, w * 0.55);
  displayW = w; displayH = h;
  canvas.width  = Math.floor(w * devicePixelRatio);
  canvas.height = Math.floor(h * devicePixelRatio);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
resize();
window.addEventListener('resize', ()=>{ resize(); resetTraj(); });

const originX = ()=> displayW * 0.36;
const originY = ()=> displayH * 0.55;
let zoomD = 1.0;

function toScreen(wx, wy){ return { x: originX() + wx*zoomD, y: originY() - wy*zoomD }; }
function screenToWorld(sx, sy){ return { x: (sx - originX())/zoomD, y: (originY() - sy)/zoomD }; }

let mechanism = 'guideBar';
let r = 120, d = 300, L = 200, e = 0;
let sunR = 70, planetR = 45;
let omega = 1.8, vScale = 0.60, aScale = 0.22;
let theta = Math.PI/4, time = 0;
let paused = false;
let showVel = true, showAcc = false, showTrail = true, showComp = false;

let trajAbs = [], trajRel = [], trajEnt = [];
const MAX_TRAJ = 1200;
function resetTraj(){ trajAbs=[]; trajRel=[]; trajEnt=[]; }

function computeGuideBar(th, om, rr, dd){
  const cos=Math.cos(th), sin=Math.sin(th);
  const Ax=rr*cos, Ay=rr*sin;
  const BAx=Ax-dd, BAy=Ay;
  const s=Math.sqrt(BAx*BAx+BAy*BAy);
  if(s<0.5) return null;
  const ux=BAx/s, uy=BAy/s;
  const upx=-uy, upy=ux;
  const D=s*s;
  const ome=om*rr*(rr-dd*cos)/D;
  const ale=(om*om*rr*dd*sin*(dd*dd-rr*rr))/(D*D);
  const va_x=-om*rr*sin, va_y=om*rr*cos, va_mag=om*rr;
  const vr_mag=rr*dd*om*sin/s;
  const ve_mag=ome*s;
  const ve_x=ve_mag*upx, ve_y=ve_mag*upy;
  const vr_x=vr_mag*ux, vr_y=vr_mag*uy;
  const aa_x=-om*om*rr*cos, aa_y=-om*om*rr*sin;
  const aen_x=-ome*ome*s*ux, aen_y=-ome*ome*s*uy;
  const aet_x=ale*s*upx, aet_y=ale*s*upy;
  const ae_x=aen_x+aet_x, ae_y=aen_y+aet_y;
  const ac_x=2*ome*vr_mag*upx, ac_y=2*ome*vr_mag*upy;
  const ar_x=aa_x-ae_x-ac_x, ar_y=aa_y-ae_y-ac_y;
  const ar_mag=ar_x*ux+ar_y*uy;
  const velRes=Math.hypot(ve_x+vr_x-va_x, ve_y+vr_y-va_y);
  const accRes=Math.hypot(ae_x+ar_x+ac_x-aa_x, ae_y+ar_y+ac_y-aa_y);
  const phi=Math.atan2(uy,ux);
  return { Ax,Ay,s,ux,uy,upx,upy,omega_e:ome,alpha_e:ale,phi,
    va_x,va_y,va_mag, ve_x,ve_y,ve_mag, vr_x,vr_y,vr_mag,
    aa_x,aa_y, aen_x,aen_y,aet_x,aet_y,ae_x,ae_y, ac_x,ac_y, ar_x,ar_y,ar_mag,
    velResidual:velRes, accResidual:accRes,
    absPt:{x:Ax,y:Ay}, relPt:{x:s,y:0,phi}, entPt:{x:dd+s*Math.cos(phi), y:s*Math.sin(phi)},
    movingPoint:{x:Ax,y:Ay,name:'A'},
  };
}

function computeSliderCrank(th, om, rr, LL, ee){
  const cos=Math.cos(th), sin=Math.sin(th);
  const Ax=rr*cos, Ay=rr*sin;
  const disc=LL*LL - (ee+rr*sin)*(ee+rr*sin);
  if(disc<1) return null;
  const Bx=rr*cos + Math.sqrt(disc);
  const By=-ee;
  const Mx=(Ax+Bx)/2, My=(Ay+By)/2;
  const sB=Math.sqrt(Math.max(disc,0.01));
  const dBx=-rr*om*sin - (ee+rr*sin)*rr*om*cos/sB;
  const vMx=(-rr*om*sin + dBx)/2, vMy=rr*om*cos/2;
  const vBx=dBx, vBy=0;
  const vRelX=vMx-vBx, vRelY=vMy-vBy;
  const vr=Math.hypot(vRelX,vRelY);
  const ve=Math.abs(vBx);
  const va=Math.hypot(vMx,vMy);
  const dth=0.002;
  function getVM(t){
    const c=Math.cos(t),si=Math.sin(t),sd2=Math.sqrt(Math.max(LL*LL-(ee+rr*si)*(ee+rr*si),0.01));
    const bX=rr*c+sd2, dbX=-rr*om*si-(ee+rr*si)*rr*om*c/sd2;
    return {x:(-rr*om*si+dbX)/2, y:rr*om*c/2};
  }
  const vmP=getVM(th+dth), vmN=getVM(th-dth);
  const aMx=(vmP.x-vmN.x)/(2*dth/om), aMy=(vmP.y-vmN.y)/(2*dth/om);
  function getBAcc(t){
    const c=Math.cos(t),si=Math.sin(t),sd2=Math.sqrt(Math.max(LL*LL-(ee+rr*si)*(ee+rr*si),0.01));
    return -rr*om*si - (ee+rr*si)*rr*om*c/sd2;
  }
  const bP=getBAcc(th+dth), bN=getBAcc(th-dth);
  const aBx=(bP-bN)/(2*dth/om);
  const ae=aBx, ar=Math.hypot(aMx-aBx, aMy);
  const aa=Math.hypot(aMx,aMy);
  return {
    Ax,Ay,Bx,By,Mx,My, vBx, aBx, vMx,vMy,aMx,aMy,
    va,ve,vr, ae,ar,aa, s:Bx, phi:Math.atan2(Ay, Bx-Ax),
    va_x:vMx,va_y:vMy, ve_x:vBx,ve_y:0, vr_x:vRelX,vr_y:vRelY,
    aa_x:aMx,aa_y:aMy, ae_x:aBx,ae_y:0, ar_x:aMx-aBx,ar_y:aMy,
    ac_x:0,ac_y:0,
    absPt:{x:Mx,y:My}, relPt:{x:Mx-Bx,y:My}, entPt:{x:Bx,y:0},
    movingPoint:{x:Mx,y:My,name:'M'},
    velResidual:0, accResidual:0,
  };
}

function computeScotchYoke(th, om, rr){
  const cos=Math.cos(th), sin=Math.sin(th);
  const Ax=rr*cos, Ay=rr*sin;
  const Yx=0, Yy=Ay;
  const va_x=-om*rr*sin, va_y=om*rr*cos, va_mag=om*rr;
  const ve_x=0, ve_y=om*rr*cos, ve_mag=Math.abs(om*rr*cos);
  const vr_x=-om*rr*sin, vr_y=0, vr_mag=Math.abs(om*rr*sin);
  const aa_x=-om*om*rr*cos, aa_y=-om*om*rr*sin;
  const ae_x=0, ae_y=-om*om*rr*sin;
  const ar_x=-om*om*rr*cos, ar_y=0;
  return {
    Ax,Ay,Yx,Yy,
    va_x,va_y,va_mag, ve_x,ve_y,ve_mag, vr_x,vr_y,vr_mag,
    aa_x,aa_y, ae_x,ae_y, ar_x,ar_y,
    ac_x:0,ac_y:0, omega_e:0, alpha_e:0, phi:0, s:Math.abs(Ax),
    absPt:{x:Ax,y:Ay}, relPt:{x:Ax,y:0}, entPt:{x:0,y:Ay},
    movingPoint:{x:Ax,y:Ay,name:'A'},
    velResidual:Math.hypot(ve_x+vr_x-va_x,ve_y+vr_y-va_y),
    accResidual:Math.hypot(ae_x+ar_x-aa_x,ae_y+ar_y-aa_y),
  };
}

function computePlanetaryGear(th, om, sunR, planetR){
  const rp=Math.max(24, planetR);
  const rs=Math.max(28, sunR);
  const carrierR=rs+rp;
  const ringR=rs+2*rp;
  const omegaC=om*rs/(rs+ringR);
  const omegaP=-omegaC*carrierR/rp;
  const psi=omegaC/om*th;
  const beta=omegaP/om*th;
  const Cx=carrierR*Math.cos(psi), Cy=carrierR*Math.sin(psi);
  const relX=rp*Math.cos(beta), relY=rp*Math.sin(beta);
  const Px=Cx+relX, Py=Cy+relY;
  const ve_x=-omegaC*Cy, ve_y=omegaC*Cx;
  const vr_x=-omegaP*relY, vr_y=omegaP*relX;
  const va_x=ve_x+vr_x, va_y=ve_y+vr_y;
  const ae_x=-omegaC*omegaC*Cx, ae_y=-omegaC*omegaC*Cy;
  const ar_x=-omegaP*omegaP*relX, ar_y=-omegaP*omegaP*relY;
  const aa_x=ae_x+ar_x, aa_y=ae_y+ar_y;
  return {
    sunR:rs, planetR:rp, ringR, carrierR, Cx,Cy,Px,Py, psi,beta,
    omega_e:omegaC, omega_p:omegaP, ratio:om/omegaC,
    va_x,va_y,va_mag:Math.hypot(va_x,va_y),
    ve_x,ve_y,ve_mag:Math.hypot(ve_x,ve_y),
    vr_x,vr_y,vr_mag:Math.hypot(vr_x,vr_y),
    aa_x,aa_y, ae_x,ae_y, ar_x,ar_y, ac_x:0,ac_y:0,
    absPt:{x:Px,y:Py}, relPt:{x:relX,y:relY}, entPt:{x:Cx,y:Cy},
    movingPoint:{x:Px,y:Py,name:'P'},
    velResidual:Math.hypot(ve_x+vr_x-va_x,ve_y+vr_y-va_y),
    accResidual:Math.hypot(ae_x+ar_x-aa_x,ae_y+ar_y-aa_y),
  };
}

function computeKinematics(th, om){
  if(mechanism==='guideBar') return computeGuideBar(th, om, r, d);
  if(mechanism==='sliderCrank') return computeSliderCrank(th, om, r, L, e);
  if(mechanism==='scotchYoke') return computeScotchYoke(th, om, r);
  if(mechanism==='planetaryGear') return computePlanetaryGear(th, om, sunR, planetR);
  return null;
}

function scrArrow(fx,fy,tx,ty,color,lw,head){
  const dx=tx-fx, dy=ty-fy, len=Math.hypot(dx,dy);
  if(len<0.5) return;
  const ux=dx/len, uy=dy/len;
  ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=lw; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(tx,ty); ctx.stroke();
  const h=head, bx=tx-ux*h, by=ty-uy*h;
  const px=-uy*h*0.55, py=ux*h*0.55;
  ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(bx+px,by+py); ctx.lineTo(bx-px,by-py); ctx.closePath(); ctx.fill();
}
function drawArrowW(wx,wy,vx,vy,color,lw,head){
  const s=toScreen(wx,wy);
  scrArrow(s.x, s.y, s.x+vx*zoomD, s.y-vy*zoomD, color, lw*zoomD, head*zoomD);
}
function drawDashedArrowW(wx,wy,vx,vy,color,lw,head){
  const s=toScreen(wx,wy);
  const sx=s.x, sy=s.y, ex=sx+vx*zoomD, ey=sy-vy*zoomD;
  const dx=ex-sx, dy=ey-sy, len=Math.hypot(dx,dy);
  if(len<0.5) return;
  const ux=dx/len, uy=dy/len;
  ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=lw; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
  ctx.setLineDash([]);
  const h=head, bx=ex-ux*h, by=ey-uy*h;
  ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(bx-uy*h*0.55,by+ux*h*0.55); ctx.lineTo(bx+uy*h*0.55,by-ux*h*0.55); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawCircleW(wx,wy,rad,color,fill,lw){
  const s=toScreen(wx,wy);
  const r2=rad*zoomD;
  ctx.beginPath(); ctx.arc(s.x, s.y, r2, 0, Math.PI*2);
  if(fill){ ctx.fillStyle=fill; ctx.fill(); }
  ctx.strokeStyle=color; ctx.lineWidth=lw||1.5; ctx.stroke();
}
function drawLineW(x1,y1,x2,y2,color,lw,dash){
  const a=toScreen(x1,y1), b=toScreen(x2,y2);
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=lw||1.5;
  if(dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}
function drawLabelW(wx,wy,text,color,size,dx,dy){
  const s=toScreen(wx,wy);
  ctx.fillStyle=color; ctx.font=`bold ${size*zoomD}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign='center'; ctx.fillText(text, s.x+(dx||0), s.y+(dy||0));
}

function drawGuideBar(kin){
  const {Ax,Ay,ux,uy,phi,s}=kin;
  [[0,0],[d,0]].forEach(([px,py])=>{
    const sc=toScreen(px,py);
    ctx.strokeStyle='#666'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.moveTo(sc.x-14*zoomD,sc.y); ctx.lineTo(sc.x+14*zoomD,sc.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sc.x,sc.y-9*zoomD); ctx.lineTo(sc.x,sc.y+9*zoomD); ctx.stroke();
  });
  drawCircleW(0,0,7,'#999','#333',2.2);
  drawCircleW(d,0,7,'#999','#333',2.2);
  drawLabelW(0,0,'O','#fff',13,0,-16);
  drawLabelW(d,0,'B','#fff',13,0,-16);
  drawLineW(0,0,Ax,Ay,'#e8b830',4.5*zoomD);
  drawLineW(0,0,Ax,Ay,'#f5d060',2*zoomD);
  drawCircleW(Ax,Ay,8,'#e8b830','#ff8800',2.5);
  drawLabelW(Ax,Ay,'A (动点)','#ffcc44',12,16,-12);
  const barLen = d + r + 140;
  const bx1=Ax+ux*60, by1=Ay+uy*60;
  const bx2=d-ux*barLen*0.4, by2=-uy*barLen*0.4;
  drawLineW(bx1,by1, bx2,by2, '#557799', 8*zoomD);
  drawLineW(bx1,by1, bx2,by2, '#88bbdd', 3.5*zoomD);
  const as=toScreen(Ax,Ay);
  const barAng=Math.atan2(-uy, ux);
  ctx.save(); ctx.translate(as.x,as.y); ctx.rotate(barAng);
  const sw2=16*zoomD, sh2=30*zoomD;
  ctx.fillStyle='#ff9944'; ctx.strokeStyle='#cc6600'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.rect(-sw2/2,-sh2/2,sw2,sh2); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(0,0,4.5*zoomD,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawSliderCrank(kin){
  const {Ax,Ay,Bx,By,Mx,My}=kin;
  drawCircleW(0,0,7,'#999','#333',2.2);
  drawLabelW(0,0,'O','#fff',13,0,-16);
  const r1=toScreen(-60,By), r2=toScreen(Bx+120,By);
  ctx.strokeStyle='#667'; ctx.lineWidth=3; ctx.beginPath();
  ctx.moveTo(r1.x,r1.y); ctx.lineTo(r2.x,r2.y); ctx.stroke();
  for(let x=-40; x<Bx+100; x+=30){
    const sc=toScreen(x,By);
    ctx.strokeStyle='#445'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sc.x,sc.y-7*zoomD); ctx.lineTo(sc.x,sc.y+7*zoomD); ctx.stroke();
  }
  drawLineW(0,0,Ax,Ay,'#e8b830',4*zoomD);
  drawCircleW(Ax,Ay,7,'#e8b830','#ff8800',2.2);
  drawLabelW(Ax,Ay,'A','#ffcc44',11,12,-12);
  drawLineW(Ax,Ay,Bx,By,'#bb9944',3.5*zoomD);
  drawCircleW(Mx,My,8,'#ff8888','#cc5555',3);
  drawLabelW(Mx,My,'M (动点)','#ffaaaa',12,14,12);
  drawCircleW(Bx,By,8,'#aaa','#555',2.5);
  drawLabelW(Bx,By,'B','#ccc',11,(Bx>Ax?14:-14),-18);
  const bs=toScreen(Bx,By);
  ctx.save(); ctx.strokeStyle='rgba(136,187,221,0.5)'; ctx.lineWidth=1.2;
  ctx.setLineDash([4,5]);
  ctx.strokeRect(bs.x-22*zoomD, bs.y-18*zoomD, 44*zoomD, 36*zoomD);
  ctx.fillStyle='rgba(136,187,221,0.08)';
  ctx.fillRect(bs.x-22*zoomD, bs.y-18*zoomD, 44*zoomD, 36*zoomD);
  ctx.setLineDash([]);
  ctx.fillStyle='#88bbdd';
  ctx.font=`${10*zoomD}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign='center';
  ctx.fillText('动系(滑块B)', bs.x, bs.y-24*zoomD);
  ctx.restore();
}

function drawScotchYoke(kin){
  const {Ax,Ay,Yx,Yy}=kin;
  drawCircleW(0,0,7,'#999','#333',2.2);
  drawLabelW(0,0,'O','#fff',13,0,-16);
  drawLineW(0,0,Ax,Ay,'#e8b830',4*zoomD);
  drawCircleW(Ax,Ay,8,'#e8b830','#ff8800',2.5);
  drawLabelW(Ax,Ay,'A (动点)','#ffcc44',12,14,10);
  const fw=50*zoomD, fh=110*zoomD;
  const fs=toScreen(Yx,Yy);
  ctx.save();
  ctx.strokeStyle='#88aacc'; ctx.fillStyle='rgba(68,136,204,0.12)'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.rect(fs.x-fw/2, fs.y-fh/2, fw, fh); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#6699cc'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(fs.x-fw*0.85, fs.y); ctx.lineTo(fs.x+fw*0.85, fs.y); ctx.stroke();
  ctx.fillStyle='#88bbdd'; ctx.font=`${10*zoomD}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign='center'; ctx.fillText('动系(滑框)', fs.x, fs.y-fh/2-8*zoomD);
  ctx.restore();
  const gx=Yx;
  drawLineW(gx-30,-100, gx-30,120,'#445',1.5,[6,5]);
  drawLineW(gx+30,-100, gx+30,120,'#445',1.5,[6,5]);
}

function drawGearW(cx,cy,rad,teeth,color,fill,markAngle){
  drawCircleW(cx,cy,rad,color,fill,2.2);
  for(let i=0;i<teeth;i++){
    const a=i*Math.PI*2/teeth;
    const x1=cx+Math.cos(a)*rad*0.9, y1=cy+Math.sin(a)*rad*0.9;
    const x2=cx+Math.cos(a)*rad*1.08, y2=cy+Math.sin(a)*rad*1.08;
    drawLineW(x1,y1,x2,y2,color,1.1*zoomD);
  }
  if(markAngle!==undefined){
    drawLineW(cx,cy,cx+Math.cos(markAngle)*rad*0.72,cy+Math.sin(markAngle)*rad*0.72,'#f5f7ff',2.1*zoomD);
  }
}

function drawPlanetaryGear(kin){
  const {sunR,planetR,ringR,carrierR,psi,beta,Px,Py,Cx,Cy}=kin;
  drawCircleW(0,0,ringR+15,'#4b6078','rgba(70,95,120,0.10)',2);
  drawCircleW(0,0,ringR,'#88aacc','rgba(64,84,104,0.10)',3.2);
  for(let i=0;i<64;i++){
    const a=i*Math.PI*2/64;
    const x1=Math.cos(a)*ringR, y1=Math.sin(a)*ringR;
    const x2=Math.cos(a)*(ringR-13), y2=Math.sin(a)*(ringR-13);
    drawLineW(x1,y1,x2,y2,'#7da6c8',1.1*zoomD);
  }
  for(let i=0;i<24;i++){
    const a=i*Math.PI*2/24;
    drawLineW(Math.cos(a)*(ringR+17),Math.sin(a)*(ringR+17),
              Math.cos(a)*(ringR+26),Math.sin(a)*(ringR+26),'#3b4a5c',1*zoomD);
  }

  drawGearW(0,0,sunR,28,'#e8b830','rgba(232,184,48,0.20)',theta);
  drawCircleW(0,0,7,'#999','#333',2.2);
  drawLabelW(0,0,'O','#fff',13,0,-16);
  drawLabelW(0,-sunR-24,'太阳轮输入','#ffdd66',11,0,0);

  for(let k=0;k<3;k++){
    const a=psi+k*Math.PI*2/3;
    const pcx=carrierR*Math.cos(a), pcy=carrierR*Math.sin(a);
    drawLineW(0,0,pcx,pcy,'#557799',4*zoomD);
  }
  drawCircleW(0,0,18,'#88bbdd','rgba(136,187,221,0.18)',2.2);

  for(let k=0;k<3;k++){
    const a=psi+k*Math.PI*2/3;
    const pcx=carrierR*Math.cos(a), pcy=carrierR*Math.sin(a);
    const spinMark=beta+k*Math.PI*2/3;
    drawGearW(pcx,pcy,planetR,22,'#77ccaa','rgba(80,180,150,0.18)',spinMark);
    drawCircleW(pcx,pcy,5,'#bdebdc','#223a36',1.6);
  }

  drawCircleW(Cx,Cy,7,'#77ccaa','#22aa88',2.4);
  drawCircleW(Px,Py,8,'#ff8888','#cc5555',2.6);
  drawLabelW(Px,Py,'P (动点)','#ffaaaa',12,18,-10);
  drawLabelW(-ringR*0.64,ringR+26,'内齿圈固定','#9db8cf',11,0,0);
  drawLabelW(Cx,Cy,'行星架输出','#88bbdd',10,0,22);
}

function drawMechanism(kin){
  if(!kin) return;
  if(mechanism==='guideBar') drawGuideBar(kin);
  else if(mechanism==='sliderCrank') drawSliderCrank(kin);
  else if(mechanism==='scotchYoke') drawScotchYoke(kin);
  else if(mechanism==='planetaryGear') drawPlanetaryGear(kin);
}

function drawVectors(kin){
  if(!showVel && !showAcc) return;
  const mp = kin.movingPoint ? {x:kin.movingPoint.x,y:kin.movingPoint.y} :
             (mechanism==='sliderCrank' ? {x:kin.Mx,y:kin.My} :
             (mechanism==='scotchYoke' ? {x:kin.Ax,y:kin.Ay} : {x:kin.Ax,y:kin.Ay}));
  const px=mp.x, py=mp.y;
  if(showVel){
    if(showComp){
      const tipVeX=px+kin.ve_x*vScale, tipVeY=py+kin.ve_y*vScale;
      const tipVrX=px+kin.vr_x*vScale, tipVrY=py+kin.vr_y*vScale;
      drawLineW(tipVeX,tipVeY, tipVeX+kin.vr_x*vScale, tipVeY+kin.vr_y*vScale, 'rgba(255,255,255,0.15)', 1, [3,4]);
      drawLineW(tipVrX,tipVrY, tipVrX+kin.ve_x*vScale, tipVrY+kin.ve_y*vScale, 'rgba(255,255,255,0.15)', 1, [3,4]);
    }
    drawArrowW(px,py, kin.va_x*vScale, kin.va_y*vScale, '#ff4444', 3.2*zoomD, 13*zoomD);
    drawArrowW(px,py, kin.ve_x*vScale, kin.ve_y*vScale, '#4488ff', 2.8*zoomD, 12*zoomD);
    drawArrowW(px,py, kin.vr_x*vScale, kin.vr_y*vScale, '#44cc44', 2.8*zoomD, 12*zoomD);
    const off=1.1;
    drawLabelW(px+kin.va_x*vScale*off, py+kin.va_y*vScale*off, 'vₐ','#ff4444',12,0,-6);
    drawLabelW(px+kin.ve_x*vScale*off, py+kin.ve_y*vScale*off, 'vₑ','#4488ff',12,0,-6);
    drawLabelW(px+kin.vr_x*vScale*off, py+kin.vr_y*vScale*off, 'vᵣ','#44cc44',12,0,-6);
  }
  if(showAcc){
    const aa_x=kin.aa_x, aa_y=kin.aa_y;
    const ae_x=kin.ae_x||0, ae_y=kin.ae_y||0;
    const ar_x=kin.ar_x||0, ar_y=kin.ar_y||0;
    const ac_x=kin.ac_x||0, ac_y=kin.ac_y||0;
    drawArrowW(px,py, aa_x*aScale, aa_y*aScale, '#cc3333', 3.5*zoomD, 14*zoomD);
    if(mechanism==='guideBar' && kin.aen_x!==undefined){
      drawDashedArrowW(px,py, kin.aen_x*aScale, kin.aen_y*aScale, '#3388cc', 2.5*zoomD, 11*zoomD);
      drawDashedArrowW(px,py, kin.aet_x*aScale, kin.aet_y*aScale, '#ff8800', 2.5*zoomD, 11*zoomD);
    } else { drawDashedArrowW(px,py, ae_x*aScale, ae_y*aScale, '#3388cc', 2.5*zoomD, 11*zoomD); }
    drawDashedArrowW(px,py, ar_x*aScale, ar_y*aScale, '#228844', 2.5*zoomD, 11*zoomD);
    if(mechanism==='guideBar'){ drawDashedArrowW(px,py, ac_x*aScale, ac_y*aScale, '#cc66ff', 2.5*zoomD, 11*zoomD); }
    const off2=1.12;
    drawLabelW(px+aa_x*aScale*off2, py+aa_y*aScale*off2, 'aₐ','#cc3333',11,0,-4);
    if(mechanism==='guideBar'){
      drawLabelW(px+kin.aen_x*aScale*off2, py+kin.aen_y*aScale*off2, 'aₑₙ','#3388cc',10,0,-4);
      drawLabelW(px+kin.aet_x*aScale*off2, py+kin.aet_y*aScale*off2, 'aₑₜ','#ff8800',10,0,-4);
      drawLabelW(px+ac_x*aScale*off2, py+ac_y*aScale*off2, 'a𝒸','#cc66ff',10,0,-4);
    }
    drawLabelW(px+ar_x*aScale*off2, py+ar_y*aScale*off2, 'aᵣ','#228844',10,0,-4);
  }
}

function drawTrajectories(kin){
  if(!showTrail) return;
  if(trajAbs.length>1){
    ctx.save(); ctx.strokeStyle='#ff6666'; ctx.lineWidth=2*zoomD; ctx.setLineDash([7,5]);
    ctx.beginPath(); const p0=toScreen(trajAbs[0].x,trajAbs[0].y); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<trajAbs.length;i++){ const p=toScreen(trajAbs[i].x,trajAbs[i].y); ctx.lineTo(p.x,p.y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  if(trajRel.length>1){
    let pts;
    if(mechanism==='guideBar'){ pts=trajRel.map(p=>({x:kin?d+p.x*Math.cos(p.phi):0, y:kin?p.x*Math.sin(p.phi):0})); }
    else if(mechanism==='planetaryGear'){ pts=trajRel.map(p=>({x:kin.Cx+p.x, y:kin.Cy+p.y})); }
    else if(mechanism==='sliderCrank'){ pts=trajRel; }
    else { pts=trajRel; }
    ctx.save(); ctx.strokeStyle='#6699ff'; ctx.lineWidth=1.8*zoomD; ctx.setLineDash([5,4]);
    ctx.beginPath(); const p0=toScreen(pts[0].x,pts[0].y); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<pts.length;i++){ const p=toScreen(pts[i].x,pts[i].y); ctx.lineTo(p.x,p.y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  if(trajEnt.length>1){
    ctx.save(); ctx.strokeStyle='#66dd66'; ctx.lineWidth=1.8*zoomD; ctx.setLineDash([5,4]);
    ctx.beginPath(); const p0=toScreen(trajEnt[0].x,trajEnt[0].y); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<trajEnt.length;i++){ const p=toScreen(trajEnt[i].x,trajEnt[i].y); ctx.lineTo(p.x,p.y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
}

function drawVelTriangle(kin){
  if(!showComp || !kin) return;
  const triX=displayW-175, triY=displayH-110;
  ctx.fillStyle='rgba(13,17,23,0.9)'; ctx.strokeStyle='#3a4f7a'; ctx.lineWidth=1.2;
  const rx=triX-6, ry=triY-20, rw=168, rh=105, rr=7;
  ctx.beginPath();
  ctx.moveTo(rx+rr,ry); ctx.lineTo(rx+rw-rr,ry); ctx.arcTo(rx+rw,ry,rx+rw,ry+rr,rr);
  ctx.lineTo(rx+rw,ry+rh-rr); ctx.arcTo(rx+rw,ry+rh,rx+rw-rr,ry+rh,rr);
  ctx.lineTo(rx+rr,ry+rh); ctx.arcTo(rx,ry+rh,rx,ry+rh-rr,rr);
  ctx.lineTo(rx,ry+rr); ctx.arcTo(rx,ry,rx+rr,ry,rr);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#aaa'; ctx.font='bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign='left'; ctx.fillText('合成: vₐ=vₑ+vᵣ', triX+4, triY-4);
  const tvx=triX+38, tvy=triY+60;
  const ts=0.25;
  const tveX=kin.ve_x*vScale*ts*zoomD, tveY=-kin.ve_y*vScale*ts*zoomD;
  const tvrX=kin.vr_x*vScale*ts*zoomD, tvrY=-kin.vr_y*vScale*ts*zoomD;
  const tvaX=kin.va_x*vScale*ts*zoomD, tvaY=-kin.va_y*vScale*ts*zoomD;
  scrArrow(tvx,tvy, tvx+tveX,tvy+tveY, '#4488ff', 2, 8);
  scrArrow(tvx+tveX,tvy+tveY, tvx+tveX+tvrX,tvy+tveY+tvrY, '#44cc44', 2, 8);
  scrArrow(tvx,tvy, tvx+tvaX,tvy+tvaY, '#ff4444', 2.5, 9);
  ctx.fillStyle='#4488ff'; ctx.font='9px "PingFang SC","Microsoft YaHei",sans-serif'; ctx.textAlign='center';
  ctx.fillText('vₑ', tvx+tveX/2-14, tvy+tveY/2-4);
  ctx.fillStyle='#44cc44'; ctx.fillText('vᵣ', tvx+tveX+tvrX/2+6, tvy+tveY+tvrY/2+8);
  ctx.fillStyle='#ff4444'; ctx.fillText('vₐ', tvx+tvaX/2-6, tvy+tvaY/2-6);
}

function draw(kin){
  ctx.clearRect(0,0,displayW,displayH);
  ctx.save(); ctx.strokeStyle='#151d2a'; ctx.lineWidth=0.5;
  const gs=45*zoomD, cx=originX(), cy=originY();
  for(let gx=cx%gs; gx<displayW; gx+=gs){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,displayH); ctx.stroke(); }
  for(let gy=cy%gs; gy<displayH; gy+=gs){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(displayW,gy); ctx.stroke(); }
  ctx.restore();
  drawTrajectories(kin);
  drawMechanism(kin);
  drawVectors(kin);
  drawVelTriangle(kin);
  if(!kin){
    ctx.fillStyle='#e06060'; ctx.font=`${15}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.textAlign='center'; ctx.fillText('运动学奇异：请调整参数', displayW/2, displayH/2);
  }
}

function updateInfo(kin){
  const area=document.getElementById('infoArea');
  if(!kin){ area.innerHTML='<div style="color:#e06060;font-size:0.72em;text-align:center;">参数不可用</div>'; return; }
  const thD=(theta*180/Math.PI%360);
  let rows=[];
  if(mechanism==='guideBar'){
    const phiD=(Math.atan2(kin.uy,kin.ux)*180/Math.PI);
    rows=[['时间 t',`${time.toFixed(2)} s`],['曲柄角 θ',`${thD.toFixed(1)}°`],['导杆角 φ',`${phiD.toFixed(1)}°`],
      ['ωₑ 导杆角速度',`${kin.omega_e.toFixed(3)} rad/s`],['αₑ 导杆角加速度',`${kin.alpha_e.toFixed(3)} rad/s²`],
      ['|vₐ|',`${kin.va_mag.toFixed(1)} px/s`],['|vₑ|',`${kin.ve_mag.toFixed(1)} px/s`],['|vᵣ|',`${Math.abs(kin.vr_mag).toFixed(1)} px/s`],
      ['|a𝒸| 科氏加速度',`${Math.hypot(kin.ac_x,kin.ac_y).toFixed(2)} px/s²`],['速度残差',`${kin.velResidual.toExponential(2)}`]];
  } else if(mechanism==='sliderCrank'){
    rows=[['时间 t',`${time.toFixed(2)} s`],['曲柄角 θ',`${thD.toFixed(1)}°`],['滑块位置 Bx',`${kin.Bx.toFixed(1)} px`],
      ['连杆角(°)',`${(kin.phi*180/Math.PI).toFixed(1)}°`],['|vₐ| (M点)',`${kin.va.toFixed(1)} px/s`],
      ['|vₑ| (滑块B)',`${kin.ve.toFixed(1)} px/s`],['|vᵣ| (M相对B)',`${kin.vr.toFixed(1)} px/s`],['科氏加速度',`0 (动系平动)`]];
  } else if(mechanism==='scotchYoke'){
    rows=[['时间 t',`${time.toFixed(2)} s`],['曲柄角 θ',`${thD.toFixed(1)}°`],['滑框位移 y',`${kin.Yy.toFixed(1)} px`],
      ['|vₐ|',`${kin.va_mag.toFixed(1)} px/s`],['|vₑ| (滑框)',`${kin.ve_mag.toFixed(1)} px/s`],
      ['|vᵣ| (水平)',`${kin.vr_mag.toFixed(1)} px/s`],['科氏加速度',`0 (动系平动)`]];
  } else if(mechanism==='planetaryGear'){
    rows=[['时间 t',`${time.toFixed(2)} s`],['太阳轮角 θ',`${thD.toFixed(1)}°`],['行星架角 ψ',`${(kin.psi*180/Math.PI%360).toFixed(1)}°`],
      ['ωc 行星架',`${kin.omega_e.toFixed(3)} rad/s`],['ωp 行星轮自转',`${kin.omega_p.toFixed(3)} rad/s`],
      ['固定齿圈半径 Rr',`${kin.ringR.toFixed(1)} px`],['减速比 i',`${kin.ratio.toFixed(2)} : 1`],
      ['|vₐ| (P点)',`${kin.va_mag.toFixed(1)} px/s`],['|vₑ| (行星架)',`${kin.ve_mag.toFixed(1)} px/s`],
      ['|vᵣ| (行星自转)',`${kin.vr_mag.toFixed(1)} px/s`]];
  }
  area.innerHTML=rows.map(r=>`<div class="info-row"><span>${r[0]}</span><span class="val">${r[1]}</span></div>`).join('');
}

function updateLegend(){
  const area=document.getElementById('legendArea');
  if(mechanism==='guideBar'){
    area.innerHTML=`
      <div class="legend-item"><span class="legend-swatch" style="background:#ff4444"></span> vₐ 绝对速度</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#4488ff"></span> vₑ 牵连速度</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#44cc44"></span> vᵣ 相对速度</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#cc3333"></span> aₐ 绝对加速度</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#3388cc"></span> aₑₙ 牵连法向加速度</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#ff8800"></span> aₑₜ 牵连切向加速度</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#228844"></span> aᵣ 相对加速度</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#cc66ff"></span> a𝒸 科氏加速度</div>
      <div style="font-size:0.6em;color:#888;margin-top:4px;">轨迹：<span style="color:#ff6666">红=绝对</span> <span style="color:#6699ff">蓝=相对</span> <span style="color:#66dd66">绿=牵连</span></div>`;
  } else if(mechanism==='sliderCrank'){
    area.innerHTML=`
      <div class="legend-item"><span class="legend-swatch" style="background:#ff4444"></span> vₐ (M点)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#4488ff"></span> vₑ (滑块B)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#44cc44"></span> vᵣ (M相对B)</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#cc3333"></span> aₐ</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#3388cc"></span> aₑ</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#228844"></span> aᵣ</div>
      <div style="font-size:0.6em;color:#888;margin-top:4px;">⚠ a𝒸=0 (动系平动)</div>`;
  } else if(mechanism==='scotchYoke'){
    area.innerHTML=`
      <div class="legend-item"><span class="legend-swatch" style="background:#ff4444"></span> vₐ (圆周)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#4488ff"></span> vₑ (滑框竖直)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#44cc44"></span> vᵣ (水平)</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#cc3333"></span> aₐ (向心)</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#3388cc"></span> aₑ</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#228844"></span> aᵣ</div>
      <div style="font-size:0.6em;color:#888;margin-top:4px;">⚠ a𝒸=0 (动系平动)</div>`;
  } else if(mechanism==='planetaryGear'){
    area.innerHTML=`
      <div class="legend-item"><span class="legend-swatch" style="background:#ff4444"></span> vₐ (P点绝对速度)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#4488ff"></span> vₑ (行星架牵连)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#44cc44"></span> vᵣ (行星轮自转)</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#cc3333"></span> aₐ</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#3388cc"></span> aₑ (行星架向心)</div>
      <div class="legend-item"><span class="legend-swatch thick" style="background:#228844"></span> aᵣ (自转向心)</div>
      <div style="font-size:0.6em;color:#888;margin-top:4px;">固定内齿圈：太阳轮输入，行星架减速输出</div>`;
  }
}

let lastT=null;
function loop(ts){
  if(!lastT) lastT=ts;
  let dt=(ts-lastT)/1000;
  if(dt<=0) dt=1/60; if(dt>0.1) dt=0.1;
  lastT=ts;
  if(!paused && !dragging){
    time+=dt; theta+=omega*dt;
    theta%=Math.PI*2; if(theta<0) theta+=Math.PI*2;
  }
  const kin=computeKinematics(theta, omega);
  if(kin && !paused && !dragging && showTrail){
    trajAbs.push({x:kin.absPt.x, y:kin.absPt.y});
    trajRel.push({x:kin.relPt.x, y:kin.relPt.y, phi:kin.relPt.phi});
    trajEnt.push({x:kin.entPt.x, y:kin.entPt.y});
    while(trajAbs.length>MAX_TRAJ){ trajAbs.shift(); trajRel.shift(); trajEnt.shift(); }
  }
  draw(kin); updateInfo(kin);
  requestAnimationFrame(loop);
}

let dragging=false;
canvas.addEventListener('mousedown', e=>{
  const pos={x:e.offsetX, y:e.offsetY};
  const w=screenToWorld(pos.x,pos.y);
  const kin=computeKinematics(theta,omega);
  if(!kin) return;
  const mp=kin.movingPoint ? {x:kin.movingPoint.x,y:kin.movingPoint.y} :
           (mechanism==='sliderCrank'?{x:kin.Mx,y:kin.My}:{x:kin.Ax,y:kin.Ay});
  const dist=Math.hypot(w.x-mp.x, w.y-mp.y);
  if(dist<35/zoomD){ dragging=true; canvas.style.cursor='grabbing'; hint.style.opacity='0'; }
});
canvas.addEventListener('mousemove', e=>{
  const pos={x:e.offsetX, y:e.offsetY};
  const w=screenToWorld(pos.x,pos.y);
  if(dragging){ theta=Math.atan2(w.y, w.x); if(theta<0) theta+=Math.PI*2; }
  else {
    const kin=computeKinematics(theta,omega);
    if(!kin) return;
    const mp=kin.movingPoint ? {x:kin.movingPoint.x,y:kin.movingPoint.y} :
             (mechanism==='sliderCrank'?{x:kin.Mx,y:kin.My}:{x:kin.Ax,y:kin.Ay});
    const dist=Math.hypot(w.x-mp.x, w.y-mp.y);
    canvas.style.cursor=dist<35/zoomD?'grab':'default';
  }
});
canvas.addEventListener('mouseup',()=>{ dragging=false; canvas.style.cursor='default'; hint.style.opacity='1'; });
canvas.addEventListener('mouseleave',()=>{ dragging=false; canvas.style.cursor='default'; });
canvas.addEventListener('wheel', e=>{ e.preventDefault(); zoomD=Math.max(0.45, Math.min(2.8, zoomD+(e.deltaY>0?-0.07:0.07))); }, {passive:false});

const mechInfoTabs={
  guideBar:'guide',
  sliderCrank:'slider',
  scotchYoke:'scotch',
  planetaryGear:'planetary',
};
const mechDescriptions={
  guideBar:'动点：A(滑块) | 动系：导杆(绕B转动)<br>va=ve+vr · 有科氏加速度 a𝒸=2ωₑ×vᵣ',
  sliderCrank:'动点：M(连杆中点) | 动系：滑块B(平动)<br>va=ve+vr · 科氏加速度=0（动系平动）',
  scotchYoke:'动点：A(曲柄销) | 动系：滑框(竖直平动)<br>va=ve+vr · 科氏加速度=0（动系平动）',
  planetaryGear:'动点：P(行星轮标记点) | 动系：行星架(绕O转动)<br>固定内齿圈 · 太阳轮输入，行星架减速输出',
};

function setMechanism(next){
  mechanism=next;
  resetTraj();
  updateMechUI();
  const tab=mechInfoTabs[mechanism];
  if(tab && window.switchInfoTab) window.switchInfoTab(tab);
}

document.getElementById('mechBtns').addEventListener('click', e=>{
  if(e.target.tagName!=='BUTTON') return;
  setMechanism(e.target.dataset.mech);
});

['R','D','L','E','Sun','Planet','Omega','VScale','AScale'].forEach(id=>{
  const sld=document.getElementById('sld'+id);
  if(!sld) return;
  sld.addEventListener('input', ()=>{
    const v=parseFloat(sld.value);
    if(id==='R'){ r=v; document.getElementById('valR').textContent=v; resetTraj(); }
    else if(id==='D'){ d=v; document.getElementById('valD').textContent=v; resetTraj(); }
    else if(id==='L'){ L=v; document.getElementById('valL').textContent=v; resetTraj(); }
    else if(id==='E'){ e=v; document.getElementById('valE').textContent=v; resetTraj(); }
    else if(id==='Sun'){ sunR=v; document.getElementById('valSun').textContent=v; resetTraj(); }
    else if(id==='Planet'){ planetR=v; document.getElementById('valPlanet').textContent=v; resetTraj(); }
    else if(id==='Omega'){ omega=v; document.getElementById('valOmega').textContent=v.toFixed(1); }
    else if(id==='VScale'){ vScale=v; document.getElementById('valVScale').textContent=v.toFixed(2); }
    else if(id==='AScale'){ aScale=v; document.getElementById('valAScale').textContent=v.toFixed(2); }
  });
});

document.getElementById('chkVel').addEventListener('change', function(){ showVel=this.checked; });
document.getElementById('chkAcc').addEventListener('change', function(){ showAcc=this.checked; });
document.getElementById('chkTrail').addEventListener('change', function(){ showTrail=this.checked; });
document.getElementById('chkComp').addEventListener('change', function(){ showComp=this.checked; });

document.getElementById('btnPlay').addEventListener('click', function(){ paused=!paused; this.textContent=paused?'▶ 播放':'⏯ 暂停'; });
document.getElementById('btnStep').addEventListener('click', ()=>{
  paused=true; document.getElementById('btnPlay').textContent='▶ 播放';
  const dt=0.05; time+=dt; theta+=omega*dt; theta%=Math.PI*2; if(theta<0) theta+=Math.PI*2;
  const kin=computeKinematics(theta,omega);
  if(kin && showTrail){
    trajAbs.push({x:kin.absPt.x,y:kin.absPt.y}); trajRel.push({x:kin.relPt.x,y:kin.relPt.y,phi:kin.relPt.phi}); trajEnt.push({x:kin.entPt.x,y:kin.entPt.y});
    while(trajAbs.length>MAX_TRAJ){ trajAbs.shift(); trajRel.shift(); trajEnt.shift(); }
  }
  draw(kin); updateInfo(kin);
});
document.getElementById('btnReset').addEventListener('click', ()=>{ theta=Math.PI/4; time=0; resetTraj(); paused=false; document.getElementById('btnPlay').textContent='⏯ 暂停'; });
document.getElementById('btnClearTraj').addEventListener('click', resetTraj);

window.addEventListener('keydown', e=>{
  if(e.key==='1'){ setMechanism('guideBar'); }
  else if(e.key==='2'){ setMechanism('sliderCrank'); }
  else if(e.key==='3'){ setMechanism('scotchYoke'); }
  else if(e.key==='4'){ setMechanism('planetaryGear'); }
  else if(e.key===' '){ e.preventDefault(); paused=!paused; document.getElementById('btnPlay').textContent=paused?'▶ 播放':'⏯ 暂停'; }
  else if(e.key==='ArrowRight'){ e.preventDefault(); theta+=0.06; theta%=Math.PI*2; }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); theta-=0.06; if(theta<0) theta+=Math.PI*2; }
});

function updateMechUI(){
  document.querySelectorAll('#mechBtns button').forEach(b=>{ b.classList.toggle('active', b.dataset.mech===mechanism); });
  const pgR=document.getElementById('pgR'), pgD=document.getElementById('pgD'), pgL=document.getElementById('pgL'), pgE=document.getElementById('pgE');
  const pgSun=document.getElementById('pgSun'), pgPlanet=document.getElementById('pgPlanet');
  document.getElementById('labelR').textContent='曲柄长度 r';
  document.getElementById('labelD').textContent='枢轴间距 d';
  document.getElementById('labelL').textContent='连杆长度 L';
  document.getElementById('labelE').textContent='滑块偏距 e';
  pgR.style.display='';
  pgD.style.display=pgL.style.display=pgE.style.display=pgSun.style.display=pgPlanet.style.display='none';
  if(mechanism==='guideBar') pgD.style.display='';
  else if(mechanism==='sliderCrank'){ pgL.style.display=''; pgE.style.display=''; }
  else if(mechanism==='planetaryGear'){
    pgR.style.display='none';
    pgSun.style.display=''; pgPlanet.style.display='';
  }
  document.getElementById('mechDesc').innerHTML=mechDescriptions[mechanism] || '';
  updateLegend();
}

// Theory info tab switching
window.switchInfoTab = function(tab){
  document.querySelectorAll('.info-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.info-content').forEach(c=>c.classList.remove('active'));
  document.querySelector(`.info-tab[onclick*="${tab}"]`).classList.add('active');
  document.getElementById('info-'+tab).classList.add('active');
};

updateLegend();
requestAnimationFrame(loop);
})();
