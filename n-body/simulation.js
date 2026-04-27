/* ══════════════════════════════════════════════════════════════════════
   CONSTANTS  (km · kg · seconds throughout)
   ══════════════════════════════════════════════════════════════════════ */
const G   = 6.674e-20;           // km³ kg⁻¹ s⁻²
const C   = 299792.458;          // speed of light, km/s
const AU  = 1.495978707e8;       // km per AU

/* ══════════════════════════════════════════════════════════════════════
   BODIES CONFIGURATION
   Tier 1: Sun + Mercury, Venus, Earth, Mars
   ══════════════════════════════════════════════════════════════════════ */
const BODIES_CONFIG = [
    { name:'Sun',     naif:'10',  mass:1.989e30,  physR:695700,  color:'#fde047', renderMinPx:5 },
    { name:'Mercury', naif:'199', mass:3.301e23,  physR:2439.7,  color:'#94a3b8', renderMinPx:2 },
    { name:'Venus',   naif:'299', mass:4.867e24,  physR:6051.8,  color:'#fde68a', renderMinPx:2 },
    { name:'Earth',   naif:'399', mass:5.972e24,  physR:6371.0,  color:'#3b82f6', renderMinPx:2 },
    { name:'Mars',    naif:'499', mass:6.417e23,  physR:3389.5,  color:'#ef4444', renderMinPx:2 },
    { name:'Jupiter', naif:'599', mass:1.8982e27, physR:71492,   color:'#c2884e', renderMinPx:4 },
    { name:'Saturn',  naif:'699', mass:5.6834e26, physR:60268,   color:'#e8d080', renderMinPx:4 },
    { name:'Uranus',  naif:'799', mass:8.6810e25, physR:25559,   color:'#7dd4c7', renderMinPx:3 },
    { name:'Neptune', naif:'899', mass:1.0243e26, physR:24764,   color:'#4477cc', renderMinPx:3 },
    { name:'Pluto',   naif:'999', mass:1.303e22,  physR:1188.3,  color:'#a08880', renderMinPx:2 },
];

/* ══════════════════════════════════════════════════════════════════════
   TIME SYSTEM
   1 real second → 604 800 sim-seconds (1 week) × timeWarp
   ══════════════════════════════════════════════════════════════════════ */
const REAL_TO_SIM = 604800;

/* ══════════════════════════════════════════════════════════════════════
   J2000.0 BUILT-IN  (2000-Jan-01.5 TDB, heliocentric J2000 mean ecliptic, km / km/s)

   J2000_ICRF: stored in ICRF (equatorial); icrfToEcliptic() is applied in initDefault().
     Sun: standard SSB displacement (~0.007 AU from barycenter).
     Venus: from IAU mean elements a=0.72333199 AU, e=0.00677323, i=3.39471°.

   J2000_ECL: heliocentric J2000 mean ecliptic (no rotation needed).
     Positions derived from IAU mean orbital elements (Standish 2001) via
     Kepler equation + perifocal→ecliptic rotation. Approximate — use FETCH
     FROM NASA for precise initial conditions.
     Inner planets:  Mercury(aphelion), Earth(near perihelion), Mars(near perihelion)
     Outer planets:  Jupiter(ν≈21.6°), Saturn(ν≈-47.3°), Uranus(ν≈146.5°),
                     Neptune(ν≈-101.4°), Pluto(ν≈25.0°, near perihelion)
   ══════════════════════════════════════════════════════════════════════ */
const J2000_ICRF = {
    Sun:   { x: 1.063e6,   y:-2.702e5,   z:-2.134e4,   vx: 6.48e-3,  vy: 1.17e-2,  vz:-2.30e-4  },
    Venus: { x:-1.0622e8,  y:-8.913e6,   z: 2.887e6,   vx: 1.9213,   vy:-3.1972e1, vz:-1.4499e1 },
};
const J2000_ECL = {
    Mercury: { x:-1.539e7,  y:-6.820e7,  z:-5.0e6,   vx: 37.73,  vy:  -9.06, vz: -4.40  },
    Earth:   { x:-2.54e7,   y: 1.444e8,  z:-2.134e4,  vx:-29.73,  vy:  -5.44, vz: -2.30e-4 },
    Mars:    { x: 1.960e8,  y: 6.925e7,  z: 6.66e6,   vx: -9.06,  vy:  24.91, vz: -1.40  },
    // Outer planets — derived from IAU J2000 mean elements (Standish 2001)
    Jupiter: { x: 5.976e8,  y: 4.409e8,  z:-1.523e7,  vx: -7.921, vy:  11.133, vz:  0.131 },
    Saturn:  { x: 9.631e8,  y: 9.772e8,  z:-5.531e7,  vx: -7.392, vy:   6.751, vz:  0.175 },
    Uranus:  { x: 2.202e9,  y:-2.010e9,  z:-3.578e7,  vx:  4.538, vy:   4.709, vz: -0.042 },
    Neptune: { x: 2.461e9,  y:-3.774e9,  z: 1.991e7,  vx:  4.519, vy:   3.001, vz: -0.166 },
    Pluto:   { x:-1.475e9,  y:-4.186e9,  z: 8.750e8,  vx:  5.254, vy:  -2.664, vz: -1.231 },
};

/* ══════════════════════════════════════════════════════════════════════
   COORDINATE FRAME  (ICRF → J2000 ecliptic rotation, ε ≈ 23.439°)
   Applied only to J2000_ICRF entries; Horizons data and J2000_ECL are
   already in ecliptic frame.
   ══════════════════════════════════════════════════════════════════════ */
const OBLIQUITY_J2000 = 23.4392911 * (Math.PI / 180);

function icrfToEcliptic(v) {
    const ce = Math.cos(OBLIQUITY_J2000);
    const se = Math.sin(OBLIQUITY_J2000);
    return {
        x:  v.x,
        y:  ce * v.y + se * v.z,
        z: -se * v.y + ce * v.z,
        vx:  v.vx,
        vy:  ce * v.vy + se * v.vz,
        vz: -se * v.vy + ce * v.vz
    };
}

/* ══════════════════════════════════════════════════════════════════════
   NASA JPL HORIZONS  (text-format, CENTER = 500@0 = SSB)
   ══════════════════════════════════════════════════════════════════════ */
const _HORIZONS_DIRECT = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const _isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

function buildHorizonsUrl(params) {
    if (_isLocal) return `http://localhost:8010/proxy/api/horizons.api?${params}`;
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(`${_HORIZONS_DIRECT}?${params}`)}`;
}

const HORIZONS_MIN_DATE = '1900-01-01';
const HORIZONS_MAX_DATE = '2100-12-31';
const PREFETCH_HALF     = 30;

async function horizonsVec(command, epochDate) {
    const d1 = epochDate;
    const d2obj = new Date(epochDate); d2obj.setDate(d2obj.getDate() + 1);
    const d2 = d2obj.toISOString().slice(0,10);

    const params = new URLSearchParams({
        format:      'json',
        COMMAND:     `'${command}'`,
        OBJ_DATA:    'NO',
        MAKE_EPHEM:  'YES',
        EPHEM_TYPE:  'VECTORS',
        CENTER:      '500@0',
        START_TIME:  d1,
        STOP_TIME:   d2,
        STEP_SIZE:   '1d',
        VEC_TABLE:   '2',
        OUT_UNITS:   'KM-S',
        CSV_FORMAT:  'NO',
        REF_PLANE:   'ECLIPTIC',
        REF_SYSTEM:  'J2000'
    });

    const r = await fetch(buildHorizonsUrl(params));
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${command}`);
    const j = await r.json();
    if (!j.result) throw new Error(`No result for ${command}`);
    return parseHorizonsText(j.result, command);
}

function parseHorizonsText(text, label) {
    const soe = text.indexOf('$$SOE');
    const eoe = text.indexOf('$$EOE');
    if (soe === -1 || eoe === -1) throw new Error(`No SOE/EOE for ${label}. Response:\n${text.slice(0,400)}`);

    const block = text.slice(soe + 5, eoe);

    const xyzRe = /X\s*=\s*([\-+]?\d[\d.E+\-]+)\s+Y\s*=\s*([\-+]?\d[\d.E+\-]+)\s+Z\s*=\s*([\-+]?\d[\d.E+\-]+)/;
    const vRe   = /VX=\s*([\-+]?\d[\d.E+\-]+)\s+VY=\s*([\-+]?\d[\d.E+\-]+)\s+VZ=\s*([\-+]?\d[\d.E+\-]+)/;

    const xm = xyzRe.exec(block);
    const vm = vRe.exec(block);

    if (!xm || !vm) throw new Error(`Failed to parse vectors for ${label}. Block:\n${block.slice(0,300)}`);

    return {
        x:  parseFloat(xm[1]), y:  parseFloat(xm[2]), z:  parseFloat(xm[3]),
        vx: parseFloat(vm[1]), vy: parseFloat(vm[2]), vz: parseFloat(vm[3])
    };
}

function parseHorizonsTextAll(text, label) {
    const soe = text.indexOf('$$SOE');
    const eoe = text.indexOf('$$EOE');
    if (soe === -1 || eoe === -1) throw new Error(`No SOE/EOE for ${label}`);
    const block = text.slice(soe + 5, eoe);

    const MONTH_MAP = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                       Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    const xyzRe = /X\s*=\s*([\-+]?\d[\d.E+\-]+)\s+Y\s*=\s*([\-+]?\d[\d.E+\-]+)\s+Z\s*=\s*([\-+]?\d[\d.E+\-]+)/;
    const vRe   = /VX=\s*([\-+]?\d[\d.E+\-]+)\s+VY=\s*([\-+]?\d[\d.E+\-]+)\s+VZ=\s*([\-+]?\d[\d.E+\-]+)/;
    const dateRe = /A\.D\.\s+(\d{4})-(\w{3})-(\d{2})\s/g;

    const results = new Map();
    let m;
    while ((m = dateRe.exec(block)) !== null) {
        const dateStr = `${m[1]}-${MONTH_MAP[m[2]]||'01'}-${m[3]}`;
        const seg = block.slice(m.index, m.index + 600);
        const xm = xyzRe.exec(seg);
        const vm = vRe.exec(seg);
        if (xm && vm) {
            results.set(dateStr, {
                x:  parseFloat(xm[1]), y:  parseFloat(xm[2]), z:  parseFloat(xm[3]),
                vx: parseFloat(vm[1]), vy: parseFloat(vm[2]), vz: parseFloat(vm[3])
            });
        }
    }
    return results;
}

async function horizonsVecRangeAll(command, startDate, stopDate) {
    const params = new URLSearchParams({
        format:     'json', COMMAND: `'${command}'`, OBJ_DATA: 'NO',
        MAKE_EPHEM: 'YES',  EPHEM_TYPE: 'VECTORS',   CENTER:   '500@0',
        START_TIME: startDate, STOP_TIME: stopDate,   STEP_SIZE:'1d',
        VEC_TABLE:  '2',    OUT_UNITS:  'KM-S',       CSV_FORMAT:'NO',
        REF_PLANE:  'ECLIPTIC', REF_SYSTEM:'J2000'
    });
    const r = await fetch(buildHorizonsUrl(params));
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${command}`);
    const j = await r.json();
    if (!j.result) throw new Error(`No result for ${command}`);
    return parseHorizonsTextAll(j.result, command);
}

/* ══════════════════════════════════════════════════════════════════════
   SIMULATION STATE
   ══════════════════════════════════════════════════════════════════════ */
let bodies = BODIES_CONFIG.map(cfg => ({
    ...cfg,
    x:0, y:0, z:0, vx:0, vy:0, vz:0, ax:0, ay:0, az:0, posHist:[], trail:[],
    keplerGhost: null,   // {x,y,z} — analytic 2-body prediction
    horizonsGhost: null, // {x,y,z} — JPL actual position for today
}));

let simTime    = 0;
let refEpoch   = null;

let isRunning  = true;
let timeWarp   = 1.0;
let zoom       = 4e-9;
let camera     = { x:0, y:0 };
// 3D orbit camera — default shows full solar system out to Pluto (~40 AU)
let cam = { r: 8e9, theta: Math.PI/4, phi: Math.PI/5, fov: 800 };
let lastCollision = false;
let lastRAF    = null;
let frameCount = 0;

let epochCalendarDate   = new Date('2000-01-01T00:00:00Z');
// horizonsDailyCache: 'YYYY-MM-DD' → { Sun:vec, Mercury:vec, Venus:vec, Earth:vec, Mars:vec }
let horizonsDailyCache  = new Map();
let horizonsFetchPending = false;
let horizonsRefStatus   = 'idle';
let horizonsLastError   = '';
let lastPrefetchCenter  = null;

// Position history for light-delayed gravity.
// MAX_HIST_DURATION = 50000s to support Pluto's ~19800s light delay in later tiers.
const MAX_HIST_DURATION = 50000;
const HIST_INTERVAL     = 3600;
let nextHistRecord       = 0;

// Orbit trail for rendering the tilted ellipses.
// Sampled once per sim-day; 1500 points ≈ 4.1 sim-years, enough to trace
// multiple full orbits for every inner planet (Mars period = 687 days).
const TRAIL_INTERVAL = 86400;   // 1 sim-day per sample
const TRAIL_MAX_PTS  = 5000;    // ~13.7 years of daily points (~1 Jupiter orbit)
let nextTrailRecord  = 0;

/* ══════════════════════════════════════════════════════════════════════
   INITIALISE BODIES
   bodiesData: array of state vectors, same order as BODIES_CONFIG.
   ══════════════════════════════════════════════════════════════════════ */
function initBodies(bodiesData) {
    for (let i = 0; i < bodies.length; i++) {
        const d = bodiesData[i];
        const b = bodies[i];
        b.x = d.x; b.y = d.y; b.z = d.z||0;
        b.vx = d.vx; b.vy = d.vy; b.vz = d.vz||0;
        b.ax = 0; b.ay = 0; b.az = 0; b.posHist = [];
        b.keplerGhost = null; b.horizonsGhost = null;
    }

    simTime = 0;
    lastRAF = null;
    nextHistRecord = 0;
    nextTrailRecord = 0;
    frameCount  = 0;
    lastCollision = false;
    for (const b of bodies) b.trail = [];

    horizonsDailyCache  = new Map();
    horizonsRefStatus   = 'idle';
    lastPrefetchCenter  = null;
    horizonsFetchPending = false;

    // Snapshot epoch state for Kepler reference (all bodies).
    // refEpoch is a Map<name, {x,y,z,vx,vy,vz}> so keplerPropagate can be
    // called for every planet individually against the Sun.
    refEpoch = new Map(bodies.map(b => [
        b.name,
        { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz }
    ]));

    computeForces();
    updateTelemetry();
    updateReferenceTelemetry();
}

function initDefault() {
    document.getElementById('hudSrc').textContent = 'Built-in J2000 (ecliptic)';
    epochCalendarDate = new Date('2000-01-01T00:00:00Z');
    // Sun + Venus from ICRF (apply rotation); all others already in ecliptic
    initBodies([
        icrfToEcliptic(J2000_ICRF.Sun),
        J2000_ECL.Mercury,
        icrfToEcliptic(J2000_ICRF.Venus),
        J2000_ECL.Earth,
        J2000_ECL.Mars,
        J2000_ECL.Jupiter,
        J2000_ECL.Saturn,
        J2000_ECL.Uranus,
        J2000_ECL.Neptune,
        J2000_ECL.Pluto,
    ]);
}

/* ══════════════════════════════════════════════════════════════════════
   KEPLER PROPAGATOR  (analytic 3D two-body, Sun-centric)
   Used to track Venus's expected position against the perfect 2-body
   Newtonian solution. Deviations reveal light-delay effect + integration error.
   ══════════════════════════════════════════════════════════════════════ */
const MU_SUN = G * BODIES_CONFIG.find(b => b.name === 'Sun').mass;

function keplerPropagate(r0x, r0y, r0z, v0x, v0y, v0z, dt) {
    const r0mag = Math.sqrt(r0x*r0x + r0y*r0y + r0z*r0z);
    const v0sq  = v0x*v0x + v0y*v0y + v0z*v0z;

    const hx = r0y*v0z - r0z*v0y;
    const hy = r0z*v0x - r0x*v0z;
    const hz = r0x*v0y - r0y*v0x;
    const hmag = Math.sqrt(hx*hx + hy*hy + hz*hz);

    const vxhx = v0y*hz - v0z*hy;
    const vxhy = v0z*hx - v0x*hz;
    const vxhz = v0x*hy - v0y*hx;
    const ecx = vxhx/MU_SUN - r0x/r0mag;
    const ecy = vxhy/MU_SUN - r0y/r0mag;
    const ecz = vxhz/MU_SUN - r0z/r0mag;
    const emag = Math.sqrt(ecx*ecx + ecy*ecy + ecz*ecz);

    const energy = v0sq/2 - MU_SUN/r0mag;
    const a = -MU_SUN/(2*energy);

    let Px, Py, Pz;
    if (emag < 1e-10) { Px=r0x/r0mag; Py=r0y/r0mag; Pz=r0z/r0mag; }
    else              { Px=ecx/emag;  Py=ecy/emag;  Pz=ecz/emag;  }
    const hx_n=hx/hmag, hy_n=hy/hmag, hz_n=hz/hmag;
    const Qx = hy_n*Pz - hz_n*Py;
    const Qy = hz_n*Px - hx_n*Pz;
    const Qz = hx_n*Py - hy_n*Px;

    const r0xn=r0x/r0mag, r0yn=r0y/r0mag, r0zn=r0z/r0mag;
    const cosf0 = r0xn*Px + r0yn*Py + r0zn*Pz;
    const sinf0 = r0xn*Qx + r0yn*Qy + r0zn*Qz;
    const f0 = Math.atan2(sinf0, cosf0);

    const E0 = 2*Math.atan2(Math.sqrt(1-emag)*Math.sin(f0/2), Math.sqrt(1+emag)*Math.cos(f0/2));
    const M0 = E0 - emag*Math.sin(E0);
    const n  = Math.sqrt(MU_SUN/(a*a*a));
    const M  = M0 + n*dt;

    let E = M;
    for (let i = 0; i < 50; i++) {
        const dE = (M - E + emag*Math.sin(E))/(1 - emag*Math.cos(E));
        E += dE;
        if (Math.abs(dE) < 1e-12) break;
    }

    const f  = 2*Math.atan2(Math.sqrt(1+emag)*Math.sin(E/2), Math.sqrt(1-emag)*Math.cos(E/2));
    const r  = a*(1 - emag*Math.cos(E));
    const rf = r*Math.cos(f), rg = r*Math.sin(f);

    return {
        x: rf*Px + rg*Qx,
        y: rf*Py + rg*Qy,
        z: rf*Pz + rg*Qz
    };
}

/* ══════════════════════════════════════════════════════════════════════
   HORIZONS DAILY CACHE — date helpers + background prefetch
   ══════════════════════════════════════════════════════════════════════ */
function simDateString() {
    const ms = epochCalendarDate.getTime() + simTime * 1000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
}

function isInHorizonsRange(dateStr) {
    return dateStr >= HORIZONS_MIN_DATE && dateStr <= HORIZONS_MAX_DATE;
}

function dateAddDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function dateDiffDays(a, b) {
    return (new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000;
}

function clampDate(dateStr, minD, maxD) {
    return dateStr < minD ? minD : dateStr > maxD ? maxD : dateStr;
}

async function triggerHorizonsPrefetchIfNeeded() {
    if (horizonsFetchPending) return;
    const today = simDateString();

    if (!isInHorizonsRange(today)) {
        if (horizonsRefStatus !== 'out-of-range') horizonsRefStatus = 'out-of-range';
        return;
    }

    if (lastPrefetchCenter && Math.abs(dateDiffDays(today, lastPrefetchCenter)) < 15) return;

    horizonsFetchPending = true;
    horizonsRefStatus    = 'fetching';
    lastPrefetchCenter   = today;

    const start = clampDate(dateAddDays(today, -PREFETCH_HALF), HORIZONS_MIN_DATE, HORIZONS_MAX_DATE);
    const stop  = clampDate(dateAddDays(today,  PREFETCH_HALF), HORIZONS_MIN_DATE, HORIZONS_MAX_DATE);

    try {
        // Fetch bodies sequentially — JPL rejects concurrent requests with 503
        for (const b of bodies) {
            const map = await horizonsVecRangeAll(b.naif, start, stop);
            for (const [date, vec] of map) {
                const entry = horizonsDailyCache.get(date) || {};
                entry[b.name] = vec;
                horizonsDailyCache.set(date, entry);
            }
        }
        horizonsRefStatus = 'ok';
    } catch (err) {
        horizonsRefStatus = 'error';
        horizonsLastError = err.message;
        console.warn('Horizons prefetch failed:', err.message);
    } finally {
        horizonsFetchPending = false;
    }
}

/* ══════════════════════════════════════════════════════════════════════
   REFERENCE EPHEMERIS TELEMETRY
   Every planet gets its own Kepler drift (2-body analytic vs Sun) plus
   Horizons drift when the daily cache has data for the current date.
   The Sun gets only Horizons drift (no Kepler reference makes sense for it).
   ══════════════════════════════════════════════════════════════════════ */
function updateReferenceTelemetry() {
    if (!refEpoch) return;

    const s0     = refEpoch.get('Sun');
    const today  = simDateString();
    const hEntry = horizonsDailyCache.get(today) || {};

    function fmtDrift(d) { return d < 1e6 ? d.toFixed(0) + ' km' : (d/AU).toFixed(6) + ' AU'; }

    const rows = bodies.map(b => {
        const dist = Math.sqrt(b.x**2 + b.y**2 + b.z**2);
        const hVec = hEntry[b.name];
        let driftRows = '';

        // ── Kepler drift + Kepler↔Horizons gap (every non-Sun planet) ─────────
        if (b.name !== 'Sun') {
            const b0     = refEpoch.get(b.name);
            const rel0x  = b0.x  - s0.x,  rel0y  = b0.y  - s0.y,  rel0z  = b0.z  - s0.z;
            const relV0x = b0.vx - s0.vx, relV0y = b0.vy - s0.vy, relV0z = b0.vz - s0.vz;
            const bRef   = keplerPropagate(rel0x, rel0y, rel0z, relV0x, relV0y, relV0z, simTime);

            // Kepler-predicted barycentric position (Sun fixed at epoch)
            const kx = s0.x + bRef.x, ky = s0.y + bRef.y, kz = s0.z + bRef.z;
            b.keplerGhost = { x: kx, y: ky, z: kz };
            const kepDrift = Math.sqrt((b.x-kx)**2 + (b.y-ky)**2 + (b.z-kz)**2);
            const kc = kepDrift > 1000 ? 'yellow' : 'emerald';

            driftRows += `
                <div class="flex justify-between gap-2">
                    <span class="text-violet-400">Kepler ref</span>
                    <span class="text-slate-300">${(kx/AU).toFixed(4)}, ${(ky/AU).toFixed(4)}, ${(kz/AU).toFixed(4)} AU</span>
                </div>
                <div class="flex justify-between gap-2">
                    <span class="text-${kc}-400">Drift (Kepler)</span>
                    <span class="text-${kc}-300 font-bold">${fmtDrift(kepDrift)}</span>
                </div>`;

            // Kepler↔Horizons gap: distance between the 2-body analytic prediction
            // and the real JPL ephemeris — quantifies the perturbation error from
            // planets not yet in the simulation.
            if (hVec) {
                const khGap = Math.sqrt((kx-hVec.x)**2 + (ky-hVec.y)**2 + (kz-hVec.z)**2);
                const gc = khGap > 1000 ? 'orange' : 'slate';
                driftRows += `
                <div class="flex justify-between gap-2">
                    <span class="text-${gc}-400">Kepler↔Horizons</span>
                    <span class="text-${gc}-300 font-bold">${fmtDrift(khGap)}</span>
                </div>`;
            }
        }

        // ── Horizons drift: all bodies when cache has today's data ────────────
        if (hVec) {
            b.horizonsGhost = { x: hVec.x, y: hVec.y, z: hVec.z };
            const hd = Math.sqrt((b.x-hVec.x)**2 + (b.y-hVec.y)**2 + (b.z-hVec.z)**2);
            const hc = hd > 1000 ? 'yellow' : 'emerald';
            driftRows += `
                <div class="flex justify-between gap-2">
                    <span class="text-green-400">Horizons actual</span>
                    <span class="text-slate-300">${(hVec.x/AU).toFixed(4)}, ${(hVec.y/AU).toFixed(4)}, ${(hVec.z/AU).toFixed(4)} AU</span>
                </div>
                <div class="flex justify-between gap-2">
                    <span class="text-${hc}-400">Drift (Horizons)</span>
                    <span class="text-${hc}-300 font-bold">${fmtDrift(hd)}</span>
                </div>`;
        }

        // ── Sim actual position ───────────────────────────────────────────────
        driftRows += `
            <div class="flex justify-between gap-2">
                <span class="text-sky-400">Sim actual</span>
                <span class="text-slate-300">${(b.x/AU).toFixed(4)}, ${(b.y/AU).toFixed(4)}, ${(b.z/AU).toFixed(4)} AU</span>
            </div>`;

        return `<div class="space-y-1">
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full inline-block flex-shrink-0" style="background:${b.color}"></span>
                <span class="font-bold text-slate-200">${b.name}</span>
                <span class="text-[9px] text-slate-600">${(dist/AU).toFixed(3)} AU from origin</span>
            </div>
            <div class="pl-4 space-y-0.5 text-slate-500">${driftRows}</div>
        </div>`;
    });

    const statusMap = {
        idle:          '',
        fetching:      '<div class="text-[9px] text-yellow-400 animate-pulse mb-1">Fetching Horizons data…</div>',
        ok:            `<div class="text-[9px] text-emerald-500 mb-1">Horizons cache: ${horizonsDailyCache.size} days · ${today}</div>`,
        error:         `<div class="text-[9px] text-red-400 mb-1">Horizons fetch failed — ${horizonsLastError || 'JPL may be rate-limiting, try again shortly'}</div>`,
        'out-of-range':'<div class="text-[9px] text-slate-600 mb-1">Sim date outside Horizons range (1900–2100)</div>'
    };

    document.getElementById('refTelemetry').innerHTML = [
        statusMap[horizonsRefStatus] || '',
        rows.join('<hr class="border-slate-800">')
    ].join('');
}

/* ══════════════════════════════════════════════════════════════════════
   LIGHT-DELAYED POSITION LOOKUP
   ══════════════════════════════════════════════════════════════════════ */
function lightDelayedPos(b, tRet) {
    const h = b.posHist;
    if (h.length === 0) return { x: b.x, y: b.y, z: b.z };
    if (tRet <= h[0].t)           return { x: h[0].x, y: h[0].y, z: h[0].z };
    if (tRet >= h[h.length-1].t)  return { x: b.x,    y: b.y,    z: b.z    };
    let lo = 0, hi = h.length - 1;
    while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (h[mid].t <= tRet) lo = mid; else hi = mid;
    }
    const alpha = (tRet - h[lo].t) / (h[hi].t - h[lo].t);
    return {
        x: h[lo].x + alpha * (h[hi].x - h[lo].x),
        y: h[lo].y + alpha * (h[hi].y - h[lo].y),
        z: h[lo].z + alpha * (h[hi].z - h[lo].z)
    };
}

/* ══════════════════════════════════════════════════════════════════════
   N-BODY FORCE COMPUTATION WITH LIGHT-DELAYED GRAVITY
   O(N(N-1)/2) pair loop — 10 pairs for 5 bodies.
   Each pair computes mutual retarded forces independently.
   ══════════════════════════════════════════════════════════════════════ */
function computeForces() {
    // Clear accelerations
    for (const b of bodies) { b.ax = 0; b.ay = 0; b.az = 0; }

    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i], b = bodies[j];

            // Current separation (used to estimate light delay for this pair)
            const dx0 = b.x - a.x, dy0 = b.y - a.y, dz0 = b.z - a.z;
            const d0  = Math.sqrt(dx0*dx0 + dy0*dy0 + dz0*dz0);
            if (d0 === 0) continue;

            const lightDelay = d0 / C;
            const aPast = lightDelayedPos(a, simTime - lightDelay);
            const bPast = lightDelayedPos(b, simTime - lightDelay);

            // Force on b from a's retarded position
            const dxB = aPast.x - b.x, dyB = aPast.y - b.y, dzB = aPast.z - b.z;
            const d2B = dxB*dxB + dyB*dyB + dzB*dzB;
            if (d2B > 0) {
                const dB = Math.sqrt(d2B);
                const aB = G * a.mass / d2B;
                b.ax += aB * dxB / dB;
                b.ay += aB * dyB / dB;
                b.az += aB * dzB / dB;
            }

            // Force on a from b's retarded position
            const dxA = bPast.x - a.x, dyA = bPast.y - a.y, dzA = bPast.z - a.z;
            const d2A = dxA*dxA + dyA*dyA + dzA*dzA;
            if (d2A > 0) {
                const dA = Math.sqrt(d2A);
                const aA = G * b.mass / d2A;
                a.ax += aA * dxA / dA;
                a.ay += aA * dyA / dA;
                a.az += aA * dzA / dA;
            }
        }
    }

    // HUD: show Sun–Earth light delay + distance as representative values
    const sunB   = bodies[0];
    const earthB = bodies.find(b => b.name === 'Earth');
    if (sunB && earthB) {
        const dx = earthB.x - sunB.x, dy = earthB.y - sunB.y, dz = earthB.z - sunB.z;
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        document.getElementById('hudDelay').textContent = (d/C).toFixed(1) + ' s';
        document.getElementById('hudDist').textContent  = (d/AU).toFixed(4) + ' AU';
    }
}

/* ══════════════════════════════════════════════════════════════════════
   ELASTIC SOFT-BODY COLLISIONS  (all N(N-1)/2 pairs)
   ══════════════════════════════════════════════════════════════════════ */
function handleCollisions() {
    let anyCollision = false;
    let collisionMsg = 'None';

    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i], b = bodies[j];

            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            const d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
            const minD = a.physR + b.physR;

            if (d < minD) {
                anyCollision = true;
                collisionMsg = `${a.name}↔${b.name}`;

                const nx = dx/d, ny = dy/d, nz = dz/d;
                const dvx = b.vx - a.vx, dvy = b.vy - a.vy, dvz = b.vz - a.vz;
                const vRel = dvx*nx + dvy*ny + dvz*nz;

                if (vRel < 0) {
                    const m1 = a.mass, m2 = b.mass;
                    const jimp = (2 * m1 * m2 / (m1 + m2)) * Math.abs(vRel);
                    a.vx -= (jimp/m1)*nx; a.vy -= (jimp/m1)*ny; a.vz -= (jimp/m1)*nz;
                    b.vx += (jimp/m2)*nx; b.vy += (jimp/m2)*ny; b.vz += (jimp/m2)*nz;
                }

                const overlap = minD - d;
                const ratio = a.mass / (a.mass + b.mass);
                a.x -= nx * overlap * (1-ratio); a.y -= ny * overlap * (1-ratio); a.z -= nz * overlap * (1-ratio);
                b.x += nx * overlap * ratio;     b.y += ny * overlap * ratio;     b.z += nz * overlap * ratio;
            }
        }
    }

    lastCollision = anyCollision;
    document.getElementById('hudColl').textContent = collisionMsg;
    document.getElementById('hudColl').className   = anyCollision
        ? 'mono text-red-400 font-bold'
        : 'mono text-slate-600';
}

/* ══════════════════════════════════════════════════════════════════════
   SYMPLECTIC LEAPFROG INTEGRATION
   ══════════════════════════════════════════════════════════════════════ */
const DT_SUB = 3600;

function advanceSim(totalDt) {
    const steps = Math.max(1, Math.ceil(totalDt / DT_SUB));
    const dt    = totalDt / steps;

    for (let s = 0; s < steps; s++) {
        // Half kick
        for (const b of bodies) {
            b.vx += b.ax * (dt/2); b.vy += b.ay * (dt/2); b.vz += b.az * (dt/2);
        }
        // Drift
        for (const b of bodies) {
            b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        }

        simTime += dt;

        // Record position history for light-delayed gravity
        if (simTime >= nextHistRecord) {
            nextHistRecord = simTime + HIST_INTERVAL;
            for (const b of bodies) {
                b.posHist.push({ t: simTime, x: b.x, y: b.y, z: b.z });
                while (b.posHist.length > 1 && b.posHist[0].t < simTime - MAX_HIST_DURATION) {
                    b.posHist.shift();
                }
            }
        }

        // Record orbit trail (1 sample/day) for rendering the tilted ellipses
        if (simTime >= nextTrailRecord) {
            nextTrailRecord = simTime + TRAIL_INTERVAL;
            for (const b of bodies) {
                b.trail.push({ x: b.x, y: b.y, z: b.z });
                if (b.trail.length > TRAIL_MAX_PTS) b.trail.shift();
            }
        }

        computeForces();

        // Second half kick
        for (const b of bodies) {
            b.vx += b.ax * (dt/2); b.vy += b.ay * (dt/2); b.vz += b.az * (dt/2);
        }

        handleCollisions();
    }
}

/* ══════════════════════════════════════════════════════════════════════
   TIMER DISPLAY
   ══════════════════════════════════════════════════════════════════════ */
function updateTimer() {
    const SIM_DAY   = 86400;
    const SIM_MONTH = SIM_DAY * 30.4375;
    const SIM_YEAR  = SIM_DAY * 365.25;

    const years     = Math.floor(simTime / SIM_YEAR);
    const remainder = simTime % SIM_YEAR;
    const months    = Math.floor(remainder / SIM_MONTH);
    const days      = Math.floor((remainder % SIM_MONTH) / SIM_DAY);
    const monthFrac = (remainder % SIM_MONTH) / SIM_MONTH;

    document.getElementById('timerDisplay').textContent =
        `Y:${String(years).padStart(4,'0')}  M:${String(months).padStart(2,'0')}  D:${String(days).padStart(2,'0')}`;
    document.getElementById('monthBar').style.width  = (monthFrac * 100) + '%';
    document.getElementById('simYears').textContent  = (simTime / SIM_YEAR).toFixed(3) + ' yr';
    document.getElementById('simWeek').textContent   = Math.floor(simTime / 604800);
}

/* ══════════════════════════════════════════════════════════════════════
   TELEMETRY PANEL
   ══════════════════════════════════════════════════════════════════════ */
function updateTelemetry() {
    const rows = bodies.map(b => {
        const dist  = Math.sqrt(b.x*b.x + b.y*b.y + b.z*b.z);
        const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy + b.vz*b.vz);
        return `<div class="space-y-0.5">
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full inline-block" style="background:${b.color}"></span>
                <span class="font-bold text-slate-200">${b.name}</span>
            </div>
            <div class="pl-4 text-slate-500 space-y-0.5">
                <div>Dist from origin: <span class="text-white">${(dist/AU).toFixed(4)} AU</span></div>
                <div>Speed: <span class="text-white">${speed.toFixed(3)} km/s</span></div>
                <div>Pos x,y (AU): <span class="text-white">${(b.x/AU).toFixed(4)}, ${(b.y/AU).toFixed(4)}</span></div>
                <div>Pos z (AU): <span class="text-white">${(b.z/AU).toFixed(5)}</span></div>
            </div>
        </div>`;
    });
    document.getElementById('telemetry').innerHTML = rows.join('<hr class="border-slate-800 my-1">');
}

/* ══════════════════════════════════════════════════════════════════════
   RENDERING
   ══════════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

const STARS = (() => {
    const lcg = (s) => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    const out = [];
    let seed = 42;
    for (let i = 0; i < 500; i++) {
        seed = (seed * 1664525 + 1013904223) | 0;
        const x = lcg(seed) * 4000;
        seed = (seed * 1664525 + 1013904223) | 0;
        const y = lcg(seed) * 3000;
        seed = (seed * 1664525 + 1013904223) | 0;
        const r = lcg(seed) * 1.3;
        seed = (seed * 1664525 + 1013904223) | 0;
        const a = lcg(seed) * 0.6 + 0.1;
        out.push({ x, y, r, a });
    }
    return out;
})();

/* ══════════════════════════════════════════════════════════════════════
   PERSPECTIVE PROJECTION
   ══════════════════════════════════════════════════════════════════════ */
function project(wx, wy, wz) {
    const W = canvas.width, H = canvas.height;
    const cT = Math.cos(cam.theta), sT = Math.sin(cam.theta);
    const cP = Math.cos(cam.phi),   sP = Math.sin(cam.phi);

    const ex = cam.r * cP * cT, ey = cam.r * cP * sT, ez = cam.r * sP;
    const dx = wx - ex, dy = wy - ey, dz = wz - ez;

    const camX =  -sT*dx + cT*dy;
    const camY =  -sP*cT*dx - sP*sT*dy + cP*dz;
    const camZ =  -cP*cT*dx - cP*sT*dy - sP*dz;

    if (camZ <= 0) return { sx: 0, sy: 0, depth: camZ, visible: false };

    const sx = W/2 + cam.fov * (camX / camZ);
    const sy = H/2 - cam.fov * (camY / camZ);
    return { sx, sy, depth: camZ, visible: true };
}

function render() {
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = '#00000f';
    ctx.fillRect(0, 0, W, H);

    for (const s of STARS) {
        ctx.beginPath();
        ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.fill();
    }

    // Ecliptic grid rings (0.5, 1.0, 1.5 AU)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring++) {
        const rKm = ring * 0.5 * AU;
        const pts = 120;
        let first = true;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
            const ang = (i / pts) * Math.PI * 2;
            const p = project(rKm*Math.cos(ang), rKm*Math.sin(ang), 0);
            if (!p.visible) { first = true; continue; }
            first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
            first = false;
        }
        ctx.stroke();
    }

    // Orbit trails — drawn from the daily-sampled trail buffer so the full
    // tilted ellipse becomes visible after one orbital period has elapsed.
    for (const b of bodies) {
        if (b.trail.length < 2) continue;
        ctx.beginPath();
        let first = true;
        for (const h of b.trail) {
            const p = project(h.x, h.y, h.z);
            if (!p.visible) { first = true; continue; }
            first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
            first = false;
        }
        ctx.strokeStyle = b.color + '66';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Depth-sort bodies (farthest first)
    const bArr = bodies.map(b => {
        const p = project(b.x, b.y, b.z);
        return { b, p };
    }).sort((a, z) => z.p.depth - a.p.depth);

    // Ghost markers — Kepler (violet) and Horizons (green) reference positions
    // Drawn before actual bodies so they sit underneath the solid planets.
    for (const b of bodies) {
        const physPx = cam.fov * b.physR / (project(b.x, b.y, b.z).depth || 1);
        const drawR  = Math.max(b.renderMinPx, physPx);
        const ghostR = Math.max(b.renderMinPx + 2, drawR * 0.85);

        if (b.keplerGhost) {
            const gp = project(b.keplerGhost.x, b.keplerGhost.y, b.keplerGhost.z);
            const ap = project(b.x, b.y, b.z);
            if (gp.visible) {
                // Drift line from actual to Kepler ghost
                if (ap.visible) {
                    ctx.beginPath();
                    ctx.moveTo(ap.sx, ap.sy);
                    ctx.lineTo(gp.sx, gp.sy);
                    ctx.strokeStyle = 'rgba(167,139,250,0.35)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                // Hollow ring
                ctx.beginPath();
                ctx.arc(gp.sx, gp.sy, ghostR, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(167,139,250,0.75)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        if (b.horizonsGhost) {
            const gp = project(b.horizonsGhost.x, b.horizonsGhost.y, b.horizonsGhost.z);
            const ap = project(b.x, b.y, b.z);
            if (gp.visible) {
                // Drift line from actual to Horizons ghost
                if (ap.visible) {
                    ctx.beginPath();
                    ctx.moveTo(ap.sx, ap.sy);
                    ctx.lineTo(gp.sx, gp.sy);
                    ctx.strokeStyle = 'rgba(34,197,94,0.35)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                // Hollow ring (slightly larger to distinguish from Kepler)
                ctx.beginPath();
                ctx.arc(gp.sx, gp.sy, ghostR + 3, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(34,197,94,0.75)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }

    for (const { b, p } of bArr) {
        if (!p.visible) continue;

        const physPx = cam.fov * b.physR / p.depth;
        const drawR  = Math.max(b.renderMinPx, physPx);

        if (b.name === 'Sun') {
            ctx.shadowBlur  = Math.max(20, drawR * 1.5);
            ctx.shadowColor = b.color;
        }
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, drawR, 0, Math.PI*2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        const fontSize = Math.max(10, Math.min(18, drawR * 0.9 + 10));
        ctx.font      = `bold ${fontSize}px JetBrains Mono`;
        ctx.fillStyle = `rgba(203,213,225,${Math.min(1, Math.max(0.4, drawR / 20))})`;
        ctx.fillText(b.name, p.sx + drawR + 4, p.sy + fontSize * 0.35);
    }

    // Scale bar
    const barKm = cam.r * 0.2;
    const barAU = barKm / AU;
    zoom = cam.fov / cam.r;
    document.getElementById('scaleLabel').textContent =
        barAU >= 0.01 ? barAU.toFixed(2) + ' AU' : (barKm / 1e6).toFixed(2) + ' M km';
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN LOOP
   ══════════════════════════════════════════════════════════════════════ */
function loop(now) {
    if (!lastRAF) lastRAF = now;
    const realDt = Math.min((now - lastRAF) / 1000, 0.1);
    lastRAF = now;

    if (isRunning) {
        const simDt = realDt * REAL_TO_SIM * timeWarp;
        advanceSim(simDt);
        updateTimer();
        if (frameCount % 30 === 0) { updateTelemetry(); updateReferenceTelemetry(); triggerHorizonsPrefetchIfNeeded(); }
    }

    render();
    frameCount++;
    requestAnimationFrame(loop);
}

/* ══════════════════════════════════════════════════════════════════════
   NASA FETCH  — fetches all bodies from Horizons for the chosen epoch
   ══════════════════════════════════════════════════════════════════════ */
document.getElementById('fetchBtn').onclick = async () => {
    const epoch = document.getElementById('epochDate').value;
    const msgEl = document.getElementById('apiMsg');
    const dotEl = document.getElementById('apiDot');
    const btn   = document.getElementById('fetchBtn');

    btn.disabled = true;
    btn.textContent = 'FETCHING…';
    dotEl.className = 'w-2 h-2 rounded-full bg-yellow-400 animate-pulse';

    try {
        const results = [];
        for (const b of bodies) {
            msgEl.textContent = `Requesting ${b.name} state vectors…`;
            results.push(await horizonsVec(b.naif, epoch));
        }

        msgEl.textContent = `Loaded ${bodies.map(b => b.name).join(' + ')} for ${epoch}.`;
        dotEl.className   = 'w-2 h-2 rounded-full bg-emerald-400';
        document.getElementById('hudSrc').textContent = `Horizons (${epoch})`;
        epochCalendarDate = new Date(epoch + 'T00:00:00Z');
        initBodies(results);
    } catch (err) {
        msgEl.textContent = `Error: ${err.message}`;
        dotEl.className   = 'w-2 h-2 rounded-full bg-red-500';
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = 'FETCH FROM NASA';
    }
};

document.getElementById('builtinBtn').onclick = () => {
    document.getElementById('apiMsg').textContent = 'Loaded built-in J2000 data.';
    document.getElementById('apiDot').className = 'w-2 h-2 rounded-full bg-emerald-400';
    initDefault();
};

/* ══════════════════════════════════════════════════════════════════════
   CONTROLS
   ══════════════════════════════════════════════════════════════════════ */
document.getElementById('playBtn').onclick = (e) => {
    isRunning = !isRunning;
    lastRAF   = null;
    e.target.textContent = isRunning ? 'Pause' : 'Resume';
    e.target.classList.toggle('bg-emerald-700');
    e.target.classList.toggle('bg-slate-700');
};

document.getElementById('resetBtn').onclick = initDefault;

document.getElementById('warpSlider').oninput = (e) => {
    timeWarp = parseFloat(e.target.value);
    document.getElementById('warpLabel').textContent = timeWarp.toFixed(1) + '×';
};

function setCamR(r) {
    cam.r = Math.max(1e6, Math.min(2e10, r));
    const norm = cam.r / 8e9;
    document.getElementById('zoomSlider').value = Math.max(0.001, Math.min(200, norm));
    document.getElementById('zoomLabel').textContent = cam.r.toExponential(2) + ' km';
}

document.getElementById('zoomSlider').oninput = (e) => {
    setCamR(parseFloat(e.target.value) * 8e9);
};

document.getElementById('zIn') .onclick = () => setCamR(cam.r * 0.6);
document.getElementById('zOut').onclick = () => setCamR(cam.r * 1.6);
document.getElementById('zRec').onclick = () => {
    cam.r = 8e9; cam.theta = Math.PI/4; cam.phi = Math.PI/5;
    setCamR(cam.r);
};

document.getElementById('camTop') .onclick = () => { cam.phi = Math.PI/2 - 0.01; };
document.getElementById('camSide').onclick = () => { cam.phi = 0.01; };

let drag = false, lastM = { x:0, y:0 };
canvas.onmousedown = (e) => { drag = true; lastM = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; };
window.onmousemove = (e) => {
    if (!drag) return;
    const dx = e.clientX - lastM.x;
    const dy = e.clientY - lastM.y;
    cam.theta -= dx * 0.005;
    cam.phi    = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, cam.phi + dy * 0.005));
    lastM = { x: e.clientX, y: e.clientY };
};
window.onmouseup = () => { drag = false; canvas.style.cursor = 'crosshair'; };
canvas.onwheel = (e) => { e.preventDefault(); setCamR(e.deltaY > 0 ? cam.r * 1.15 : cam.r * 0.87); };

function resize() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
window.addEventListener('resize', resize);
resize();

/* ══════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════ */
initDefault();
requestAnimationFrame(loop);
