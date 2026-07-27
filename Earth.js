
(function(){

// PHYSICAL CONSTANTS  (WGS84 / GRS80)

const CONST = {
  a: 6378137,               // equatorial radius, m
  b: 6356752.314245,        // polar radius, m
  GM: 3.986004418e14,       // m^3/s^2
  omega: 7.292115e-5,       // rad/s
  J2: 1.08263e-3,
  gamma_e: 9.7803253359,    // m/s^2
  k_somig: 0.00193185265241,
  e2_grav: 0.00669437999014
};
CONST.f  = (CONST.a - CONST.b) / CONST.a;
CONST.e2 = 1 - (CONST.b*CONST.b)/(CONST.a*CONST.a);

const VIS_SCALE = 1/1e6;              // meters -> visual units
const A_VIS = CONST.a * VIS_SCALE;    // ~6.378
const B_VIS = CONST.b * VIS_SCALE;    // ~6.357

function deg2rad(d){ return d*Math.PI/180; }
function rad2deg(r){ return r*180/Math.PI; }
function clamp(x,lo,hi){ return Math.max(lo,Math.min(hi,x)); }

// Somigliana normal gravity
function normalGravity(phiRad){
  const s2 = Math.sin(phiRad)**2;
  return CONST.gamma_e * (1 + CONST.k_somig*s2) / Math.sqrt(1 - CONST.e2_grav*s2);
}
// Geodetic -> geocentric latitude
function geocentricLat(phiRad){
  if (Math.abs(Math.abs(phiRad) - Math.PI/2) < 1e-9) return phiRad;
  return Math.atan((1-CONST.e2) * Math.tan(phiRad));
}

function primeVerticalN(phiRad, e2, a){
  return a / Math.sqrt(1 - e2*Math.sin(phiRad)**2);
}
// Centrifugal acceleration magnitude at geodetic point (h=0)
function centrifugalAccel(phiRad){
  const N = primeVerticalN(phiRad, CONST.e2, CONST.a);
  const r_perp = N*Math.cos(phiRad); // distance from rotation axis
  return CONST.omega*CONST.omega*r_perp;
}

// Simplified illustrative geoid undulation N(phi,lambda) in meters

const J3 = -2.532e-6, J4 = -1.620e-6, C22 = 1.574e-6, S22 = -0.897e-6;
function geoidUndulation(phiRad, lamRad){
  const s = Math.sin(phiRad), c = Math.cos(phiRad);
  const P3 = 0.5*(5*s*s*s - 3*s);
  const P4 = (35*s*s*s*s - 30*s*s + 3)/8;
  const P22 = 3*c*c;
  const GMa = CONST.GM / CONST.a;
  const T = GMa*( -J3*P3 - J4*P4 + C22*P22*Math.cos(2*lamRad) + S22*P22*Math.sin(2*lamRad) );
  return T / normalGravity(phiRad); // meters
}

// THREE.JS SETUP
const container = document.getElementById('scene-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070d, 1);
container.appendChild(renderer.domElement);

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
scene.add(new THREE.AmbientLight(0x445066, 0.55));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.25);
sun.position.set(12, 6, 8);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x5b7cff, 0.35);
rim.position.set(-10, -4, -6);
scene.add(rim);

// Starfield
(function buildStars(){
  const N = 2400;
  const positions = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r = 200 + Math.random()*600;
    const th = Math.random()*Math.PI*2;
    const ph = Math.acos(2*Math.random()-1);
    positions[i*3]   = r*Math.sin(ph)*Math.cos(th);
    positions[i*3+1] = r*Math.cos(ph);
    positions[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const mat = new THREE.PointsMaterial({ color:0xaab4c8, size:0.6, sizeAttenuation:true, transparent:true, opacity:0.55 });
  scene.add(new THREE.Points(geo, mat));
})();


// SIMPLE ORBIT CONTROLS (custom, no external deps)

const controlsState = { radius:19, theta:0.9, phiAng:1.05, target:new THREE.Vector3(0,0,0) };
let isDragging=false, lastX=0, lastY=0;
renderer.domElement.addEventListener('pointerdown', e=>{ isDragging=true; lastX=e.clientX; lastY=e.clientY; });
window.addEventListener('pointerup', ()=> isDragging=false);
window.addEventListener('pointermove', e=>{
  if(!isDragging) return;
  const dx = e.clientX-lastX, dy = e.clientY-lastY;
  lastX=e.clientX; lastY=e.clientY;
  controlsState.theta -= dx*0.0045;
  controlsState.phiAng = clamp(controlsState.phiAng - dy*0.0045, 0.2, Math.PI-0.2);
});
renderer.domElement.addEventListener('wheel', e=>{
  e.preventDefault();
  controlsState.radius = clamp(controlsState.radius + e.deltaY*0.012, 9, 55);
}, { passive:false });

function updateCamera(){
  const { radius, theta, phiAng, target } = controlsState;
  camera.position.set(
    target.x + radius*Math.sin(phiAng)*Math.sin(theta),
    target.y + radius*Math.cos(phiAng),
    target.z + radius*Math.sin(phiAng)*Math.cos(theta)
  );
  camera.lookAt(target);
}

// ============================================================
// EARTH GROUP (rotates as a whole about polar axis = Y)
// ============================================================
const earthGroup = new THREE.Group();
scene.add(earthGroup);

// -- base geometry (unit sphere) whose vertices we remap --
const SEG_W = 96, SEG_H = 72;
const baseGeo = new THREE.SphereGeometry(1, SEG_W, SEG_H);
const baseUnit = baseGeo.attributes.position.array.slice(); // pristine unit-sphere coords

const earthMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness:0.75, metalness:0.05, flatShading:false
});
const earthMesh = new THREE.Mesh(baseGeo, earthMat);
earthGroup.add(earthMesh);

// color buffer
const colorArr = new Float32Array(baseUnit.length);
baseGeo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));

const colLo = new THREE.Color(0x3b82f6);
const colMid = new THREE.Color(0xa76fd9);
const colHi = new THREE.Color(0xf2795a);

// Atmosphere glow shell
const atmoGeo = new THREE.SphereGeometry(1.045, 64, 48);
const atmoMat = new THREE.MeshBasicMaterial({ color:0x5ac8e0, transparent:true, opacity:0.07, side:THREE.BackSide });
const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
earthGroup.add(atmoMesh);

// Polar axis line
{
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,-9,0), new THREE.Vector3(0,9,0)
  ]);
  const axisMat = new THREE.LineDashedMaterial({ color:0x8b93a6, dashSize:0.25, gapSize:0.18, transparent:true, opacity:0.55 });
  const axisLine = new THREE.Line(axisGeo, axisMat);
  axisLine.computeLineDistances();
  scene.add(axisLine); // fixed in world space (inertial), does NOT spin with earth
}

// Graticule (lat/long grid) — separate group, spins WITH earth
const graticule = new THREE.Group();
earthGroup.add(graticule);

function ellipsoidPoint(phi, lam, aVis, e2vis){
  const N = aVis / Math.sqrt(1 - e2vis*Math.sin(phi)**2);
  return new THREE.Vector3(
    N*Math.cos(phi)*Math.cos(lam),
    N*(1-e2vis)*Math.sin(phi),
    N*Math.cos(phi)*Math.sin(lam)
  );
}

function buildGraticule(aVis, bVis){
  while(graticule.children.length){
    const child = graticule.children[0];
    graticule.remove(child);
    if(child.geometry) child.geometry.dispose();
  }
  const e2vis = 1 - (bVis*bVis)/(aVis*aVis);
  const thinMat = new THREE.LineBasicMaterial({ color:0x7f8ba3, transparent:true, opacity:0.22 });
  const eqMat = new THREE.LineBasicMaterial({ color:0xf2b134, transparent:true, opacity:0.6 });

  // parallels (latitude circles) every 15deg
  for(let d=-75; d<=75; d+=15){
    const phi = deg2rad(d);
    const pts = [];
    for(let i=0;i<=96;i++){ pts.push(ellipsoidPoint(phi, (i/96)*2*Math.PI - Math.PI, aVis, e2vis)); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    graticule.add(new THREE.Line(geo, d===0?eqMat:thinMat));
  }
  // meridians every 30deg
  for(let d=-180; d<180; d+=30){
    const lam = deg2rad(d);
    const pts = [];
    for(let i=0;i<=64;i++){ const phi=(i/64)*Math.PI-Math.PI/2; pts.push(ellipsoidPoint(phi, lam, aVis, e2vis)); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    graticule.add(new THREE.Line(geo, d===0?eqMat:thinMat));
  }
}

// ============================================================
// SURFACE REBUILD  (shape + gravity shading + geoid bump)
// ============================================================
const state = {
  shapeMode:'sphere',
  flatExagg:40,
  geoidOn:false,
  geoidExagg:2500,
  gravShade:true,
  gridOn:true,
  spinOn:true,
  spinRate:1.0,
  lat:45,
  lon:20,
  vecOn:true
};

function currentShapeAxes(){
  if(state.shapeMode==='sphere'){
    const r = (A_VIS+B_VIS)/2;
    return { aVis:r, bVis:r };
  }
  const diff = (A_VIS - B_VIS) * state.flatExagg;
  const bVis = Math.max(A_VIS - diff, A_VIS*0.35);
  return { aVis:A_VIS, bVis };
}

function rebuildSurface(){
  const { aVis, bVis } = currentShapeAxes();
  const e2vis = 1 - (bVis*bVis)/(aVis*aVis);
  const posAttr = baseGeo.attributes.position;
  const colAttr = baseGeo.attributes.color;

  const gMin = CONST.gamma_e, gMax = normalGravity(Math.PI/2);

  for(let i=0;i<posAttr.count;i++){
    const ux = baseUnit[i*3], uy = baseUnit[i*3+1], uz = baseUnit[i*3+2];
    const phi = Math.asin(clamp(uy,-1,1));
    const lam = Math.atan2(uz, ux);

    let p = ellipsoidPoint(phi, lam, aVis, e2vis);

    if(state.geoidOn){
      const Nm = geoidUndulation(phi, lam); // meters
      const dispVis = (Nm * state.geoidExagg) * VIS_SCALE;
      const nrm = p.clone().normalize();
      p.addScaledVector(nrm, dispVis);
    }

    posAttr.setXYZ(i, p.x, p.y, p.z);

    // color by TRUE physical normal gravity (independent of visual exaggeration)
    let col;
    if(state.gravShade){
      const g = normalGravity(phi);
      const t = clamp((g - gMin)/(gMax - gMin), 0, 1);
      col = t < 0.5 ? colLo.clone().lerp(colMid, t*2) : colMid.clone().lerp(colHi, (t-0.5)*2);
    } else {
      col = new THREE.Color(0x3a4256);
    }
    colAttr.setXYZ(i, col.r, col.g, col.b);
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  baseGeo.computeVertexNormals();

  graticule.visible = state.gridOn;
  buildGraticule(aVis, bVis);

  // atmosphere shell (unit-sphere geometry, radius 1.045) scaled per-axis to hug the ellipsoid
  atmoMesh.scale.set(aVis*1.045, bVis*1.045, aVis*1.045);
}

// ============================================================
// SAMPLE-POINT MARKER + FIELD VECTORS
// ============================================================
const markerGroup = new THREE.Group();
earthGroup.add(markerGroup);

const markerDot = new THREE.Mesh(
  new THREE.SphereGeometry(0.075, 20, 16),
  new THREE.MeshBasicMaterial({ color:0xf2b134 })
);
markerGroup.add(markerDot);

function makeArrow(color){
  return new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 1, color, 0.16, 0.09);
}
const arrowGravity = makeArrow(0x6fb3ff); // g_grav (toward center)
const arrowCent    = makeArrow(0xf2b134); // a_cent (outward from axis, magnified)
const arrowEff     = makeArrow(0xf2795a); // g_eff (tilted, magnified)
markerGroup.add(arrowGravity, arrowCent, arrowEff);

const ANGLE_MAGNIFY = 22;     // magnify deflection-of-vertical angle for visibility
const CENT_LEN_SCALE = 55;    // magnify centrifugal arrow length relative to gravity arrow

function updateMarker(){
  const { aVis, bVis } = currentShapeAxes();
  const e2vis = 1 - (bVis*bVis)/(aVis*aVis);
  const phi = deg2rad(state.lat);
  const lam = deg2rad(state.lon);

  let p = ellipsoidPoint(phi, lam, aVis, e2vis);
  if(state.geoidOn){
    const Nm = geoidUndulation(phi, lam);
    const dispVis = (Nm * state.geoidExagg) * VIS_SCALE;
    p.addScaledVector(p.clone().normalize(), dispVis);
  }
  markerDot.position.copy(p);

  if(!state.vecOn){
    arrowGravity.visible = arrowCent.visible = arrowEff.visible = false;
  } else {
    arrowGravity.visible = arrowCent.visible = arrowEff.visible = true;

    // true geocentric radial direction (points OUTWARD from center)
    const radialDir = p.clone().normalize();
    // gravity acts toward center
    const gravDir = radialDir.clone().negate();
    const gravLen = 1.15;
    arrowGravity.position.copy(p);
    arrowGravity.setDirection(gravDir);
    arrowGravity.setLength(gravLen, 0.14, 0.07);

    // centrifugal direction: perpendicular to polar (Y) axis, pointing away from axis
    const axisComp = new THREE.Vector3(p.x, 0, p.z);
    const centDir = axisComp.lengthSq() > 1e-9 ? axisComp.normalize() : new THREE.Vector3(1,0,0);
    const acent = centrifugalAccel(phi);
    const centLen = Math.max(0.001, (acent / normalGravity(phi)) * gravLen * CENT_LEN_SCALE);
    arrowCent.position.copy(p);
    arrowCent.setDirection(centDir);
    arrowCent.setLength(centLen, 0.1, 0.05);

    // effective gravity: true direction sum but with a magnified tilt angle for visibility
    const trueDeflectionRad = (phi - geocentricLat(phi));
    const magnified = trueDeflectionRad * ANGLE_MAGNIFY;
    // rotate gravDir toward centDir by 'magnified' radians (approx via slerp-like construction)
    const axisOfRot = new THREE.Vector3().crossVectors(gravDir, centDir).normalize();
    const effDir = gravDir.clone();
    if(axisOfRot.lengthSq() > 1e-6){
      effDir.applyAxisAngle(axisOfRot, -magnified);
    }
    arrowEff.position.copy(p);
    arrowEff.setDirection(effDir);
    arrowEff.setLength(gravLen*1.0, 0.14, 0.07);
  }
}

// ============================================================
// UI READOUT
// ============================================================
function fmt(x, d){ return x.toFixed(d); }

function updateReadout(){
  const phi = deg2rad(state.lat);
  const psi = geocentricLat(phi);
  const defl = phi - psi;
  const N = primeVerticalN(phi, CONST.e2, CONST.a);
  const gamma = normalGravity(phi);
  const acent = centrifugalAccel(phi);
  const geoidN = state.geoidOn ? geoidUndulation(phi, deg2rad(state.lon)) : null;

  document.getElementById('r-phi').textContent = fmt(state.lat,2)+'°';
  document.getElementById('r-psi').textContent = fmt(rad2deg(psi),2)+'°';
  document.getElementById('r-defl').textContent = fmt(rad2deg(defl),3)+'° ('+fmt(rad2deg(defl)*60,1)+'′)';
  document.getElementById('r-N').textContent = fmt(N/1000,1)+' km';
  document.getElementById('r-gamma').textContent = fmt(gamma,4)+' m/s²';
  document.getElementById('r-acent').textContent = fmt(acent,4)+' m/s²';
  document.getElementById('r-geoid').textContent = geoidN===null ? '— (toggle on)' : fmt(geoidN,1)+' m';
  document.getElementById('r-vismode').textContent = state.shapeMode==='sphere' ? 'sphere (no shape)' : (state.flatExagg+'× flattening');
}

// ============================================================
// UI WIRING
// ============================================================
document.querySelectorAll('#shapeMode .chip').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#shapeMode .chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.shapeMode = btn.dataset.mode;
    rebuildSurface(); updateMarker(); updateReadout();
  });
});

function bindSlider(id, valId, fmtFn, onChange){
  const el = document.getElementById(id);
  const valEl = document.getElementById(valId);
  el.addEventListener('input', ()=>{
    const v = parseFloat(el.value);
    valEl.textContent = fmtFn(v);
    onChange(v);
  });
}

bindSlider('flatExagg','flatExaggVal', v=>Math.round(v)+'×', v=>{ state.flatExagg=v; rebuildSurface(); updateMarker(); updateReadout(); });
bindSlider('geoidExagg','geoidExaggVal', v=>Math.round(v)+'×', v=>{ state.geoidExagg=v; rebuildSurface(); updateMarker(); updateReadout(); });
bindSlider('spinRate','spinVal', v=>v.toFixed(1)+'×', v=>{ state.spinRate=v; });
bindSlider('latSlider','latVal', v=>v.toFixed(1)+'°', v=>{ state.lat=v; updateMarker(); updateReadout(); });
bindSlider('lonSlider','lonVal', v=>v.toFixed(1)+'°', v=>{ state.lon=v; updateMarker(); updateReadout(); });

document.getElementById('geoidToggle').addEventListener('change', e=>{ state.geoidOn=e.target.checked; rebuildSurface(); updateMarker(); updateReadout(); });
document.getElementById('gravShadeToggle').addEventListener('change', e=>{ state.gravShade=e.target.checked; rebuildSurface(); });
document.getElementById('gridToggle').addEventListener('change', e=>{ state.gridOn=e.target.checked; graticule.visible=state.gridOn; });
document.getElementById('spinToggle').addEventListener('change', e=>{ state.spinOn=e.target.checked; });
document.getElementById('vecToggle').addEventListener('change', e=>{ state.vecOn=e.target.checked; updateMarker(); });

// ============================================================
// ANIMATION LOOP
// ============================================================
let lastT = performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const dt = Math.min((now-lastT)/1000, 0.05);
  lastT = now;

  if(state.spinOn){
    earthGroup.rotation.y += dt * state.spinRate * 0.35; // visual rate, not real-time omega
  }

  updateCamera();
  renderer.render(scene, camera);
}

// init
rebuildSurface();
updateMarker();
updateReadout();
controlsState.radius = 19;
requestAnimationFrame(animate);

})();
