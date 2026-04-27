/* ══════════════════════════════════════════════════════════════════════
   CONSTANTS  (km · kg · seconds throughout)
   ══════════════════════════════════════════════════════════════════════ */
const G   = 6.674e-20;           // km³ kg⁻¹ s⁻²
const C   = 299792.458;          // speed of light, km/s
const AU  = 1.495978707e8;       // km per AU

const MASS = { Sun: 1.989e30, Venus: 4.867e24 };    // kg
const PHYS_R = { Sun: 695700, Venus: 6051.8 };       // physical radii, km

/* ══════════════════════════════════════════════════════════════════════
   TIME SYSTEM
   1 real second → 604 800 sim-seconds (1 week) × timeWarp
   Mission Clock shows the actual simulated calendar date elapsed,
   so it naturally speeds up / slows down with the time warp slider.
   ══════════════════════════════════════════════════════════════════════ */
const REAL_TO_SIM = 604800;   // sim-s per real-s at warp 1

/* ══════════════════════════════════════════════════════════════════════
   J2000.0 BUILT-IN  (2000-Jan-01.5 TDB, Solar System Barycenter, km / km/s)
   Stored in ICRF (equatorial); icrfToEcliptic() is applied before use.

   Sun: from standard SSB displacement tables (Jupiter-dominated offset).

   Venus: derived from IAU J2000 mean orbital elements:
     a=0.72333199 AU, e=0.00677323, i=3.39471°
     Ω=76.68069°, ω=54.85229°, M₀=50.44675°
   Propagated to Cartesian via Kepler's equation, then converted
   from heliocentric ecliptic → barycentric ecliptic → ICRF.
   Heliocentric distance at epoch: 0.7183 AU (near perihelion).
   These replace a previous set of values that placed Venus at 0.775 AU —
   on a ~251-day orbit instead of the correct 224.7 days.
   ══════════════════════════════════════════════════════════════════════ */
const J2000 = {
    Sun:   { x: 1.063e6,   y:-2.702e5,   z:-2.134e4,   vx: 6.48e-3,  vy: 1.17e-2,  vz:-2.30e-4  },
    Venus: { x:-1.0622e8,  y:-8.913e6,   z: 2.887e6,   vx: 1.9213,   vy:-3.1972e1, vz:-1.4499e1 }
};

/* ══════════════════════════════════════════════════════════════════════
   COORDINATE FRAME
   Horizons returns ICRF (equatorial) vectors by default. We rotate to
   J2000 mean ecliptic (ε ≈ 23.439° about x-axis) so that x-y is the
   ecliptic plane and z is the inclination component (3.39° for Venus).
   All three axes are propagated — this is a true 3D simulation.
   The API is told REF_PLANE=ECLIPTIC so fetched data arrives pre-rotated;
   the transform below is applied to the built-in J2000 constants
   (which are stored in ICRF for source transparency).
   ══════════════════════════════════════════════════════════════════════ */
const OBLIQUITY_J2000 = 23.4392911 * (Math.PI / 180); // radians, IAU 1976

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
const HORIZONS = 'http://localhost:8010/proxy/api/horizons.api';

// Horizons date range for batch prefetch
const HORIZONS_MIN_DATE = '1900-01-01';
const HORIZONS_MAX_DATE = '2100-12-31';
const PREFETCH_HALF     = 30;  // days on each side of current sim date

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
        CENTER:      '500@0',      // Solar System Barycenter
        START_TIME:  d1,
        STOP_TIME:   d2,
        STEP_SIZE:   '1d',
        VEC_TABLE:   '2',
        OUT_UNITS:   'KM-S',
        CSV_FORMAT:  'NO',
        REF_PLANE:   'ECLIPTIC',   // J2000 mean ecliptic — x-y IS the orbital plane
        REF_SYSTEM:  'J2000'       // J2000.0 equinox
    });

    const r = await fetch(`${HORIZONS}?${params}`);
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

    // Match: X = <num> Y = <num> Z = <num>
    const xyzRe = /X\s*=\s*([\-+]?\d[\d.E+\-]+)\s+Y\s*=\s*([\-+]?\d[\d.E+\-]+)\s+Z\s*=\s*([\-+]?\d[\d.E+\-]+)/;
    // Match: VX= <num> VY= <num> VZ= <num>
    const vRe   = /VX=\s*([\-+]?\d[\d.E+\-]+)\s+VY=\s*([\-+]?\d[\d.E+\-]+)\s+VZ=\s*([\-+]?\d[\d.E+\-]+)/;

    const xm = xyzRe.exec(block);
    const vm = vRe.exec(block);

    if (!xm || !vm) throw new Error(`Failed to parse vectors for ${label}. Block:\n${block.slice(0,300)}`);

    return {
        x:  parseFloat(xm[1]), y:  parseFloat(xm[2]), z:  parseFloat(xm[3]),
        vx: parseFloat(vm[1]), vy: parseFloat(vm[2]), vz: parseFloat(vm[3])
    };
}

// Parse ALL daily records from a $SOE..$EOE block → Map<'YYYY-MM-DD', {x,y,z,vx,vy,vz}>
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

// Fetch all daily records in [startDate, stopDate] → Map<'YYYY-MM-DD', vec>
async function horizonsVecRangeAll(command, startDate, stopDate) {
    const params = new URLSearchParams({
        format:     'json', COMMAND: `'${command}'`, OBJ_DATA: 'NO',
        MAKE_EPHEM: 'YES',  EPHEM_TYPE: 'VECTORS',   CENTER:   '500@0',
        START_TIME: startDate, STOP_TIME: stopDate,   STEP_SIZE:'1d',
        VEC_TABLE:  '2',    OUT_UNITS:  'KM-S',       CSV_FORMAT:'NO',
        REF_PLANE:  'ECLIPTIC', REF_SYSTEM:'J2000'
    });
    const r = await fetch(`${HORIZONS}?${params}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${command}`);
    const j = await r.json();
    if (!j.result) throw new Error(`No result for ${command}`);
    return parseHorizonsTextAll(j.result, command);
}

/* ══════════════════════════════════════════════════════════════════════
   SIMULATION STATE
   ══════════════════════════════════════════════════════════════════════ */
// Body state (all in km / km/s / s)
let bodies = {
    Sun:   { x:0, y:0, z:0, vx:0, vy:0, vz:0, ax:0, ay:0, az:0, mass: MASS.Sun,   physR: PHYS_R.Sun,   color:'#fde047', name:'Sun',   posHist:[] },
    Venus: { x:0, y:0, z:0, vx:0, vy:0, vz:0, ax:0, ay:0, az:0, mass: MASS.Venus, physR: PHYS_R.Venus, color:'#fde68a', name:'Venus', posHist:[] }
};

let simTime    = 0;   // total sim-seconds elapsed (drives the clock)
let refEpoch   = null; // snapshot of initial ecliptic-frame state for Kepler reference

let isRunning  = true;
let timeWarp   = 1.0;
// zoom: pixels per km  (default shows ~2 AU across a ~1000px canvas)
let zoom       = 4e-9;      // kept for scale-bar calculation
let camera     = { x:0, y:0 }; // unused in 3D mode; kept for reset compat
// 3D orbit camera
let cam = { r: 2.5e8, theta: Math.PI/4, phi: Math.PI/5, fov: 800 };
let lastCollision = false;
let lastRAF    = null;
let frameCount = 0;

// Horizons daily ephemeris cache
let epochCalendarDate   = new Date('2000-01-01T00:00:00Z'); // real-world date of sim t=0
let horizonsDailyCache  = new Map();  // 'YYYY-MM-DD' → { sun:{x,y,z,...}, venus:{x,y,z,...} }
let horizonsFetchPending = false;
let horizonsRefStatus   = 'idle';     // 'idle'|'fetching'|'ok'|'error'|'out-of-range'
let lastPrefetchCenter  = null;       // date string of last prefetch window center

// Position history for light-delayed gravity (each entry: { t, x, y, z })
// We keep last MAX_HIST_DURATION sim-seconds of history
const MAX_HIST_DURATION = 7200; // 2 hours of sim time → more than enough for ~360s light delay
const HIST_INTERVAL     = 3600; // record every 3600 sim-seconds (1 hour)
let nextHistRecord       = 0;

/* ══════════════════════════════════════════════════════════════════════
   INITIALISE BODIES
   ══════════════════════════════════════════════════════════════════════ */
function initBodies(sunData, venusData) {
    const s = bodies.Sun;
    const v = bodies.Venus;

    s.x = sunData.x;   s.y = sunData.y;   s.z = sunData.z||0;   s.vx = sunData.vx;   s.vy = sunData.vy;   s.vz = sunData.vz||0;
    v.x = venusData.x; v.y = venusData.y; v.z = venusData.z||0; v.vx = venusData.vx; v.vy = venusData.vy; v.vz = venusData.vz||0;

    // Clear accelerations and history
    for (const b of [s, v]) { b.ax = 0; b.ay = 0; b.az = 0; b.posHist = []; }

    simTime = 0;
    lastRAF = null;
    nextHistRecord = 0;
    frameCount  = 0;
    lastCollision = false;

    // Reset Horizons daily cache (new epoch = different date range)
    horizonsDailyCache  = new Map();
    horizonsRefStatus   = 'idle';
    lastPrefetchCenter  = null;
    horizonsFetchPending = false;

    // Snapshot epoch state for Kepler reference comparison
    refEpoch = {
        sun:   { x: sunData.x,   y: sunData.y,   z: sunData.z||0,   vx: sunData.vx,   vy: sunData.vy,   vz: sunData.vz||0   },
        venus: { x: venusData.x, y: venusData.y, z: venusData.z||0, vx: venusData.vx, vy: venusData.vy, vz: venusData.vz||0 }
    };

    // Seed initial forces
    computeForces();
    updateTelemetry();
    updateReferenceTelemetry();
}

function initDefault() {
    document.getElementById('hudSrc').textContent = 'Built-in J2000 (ecliptic)';
    epochCalendarDate = new Date('2000-01-01T00:00:00Z');
    // J2000 constants are stored in ICRF; rotate to ecliptic before use
    initBodies(icrfToEcliptic(J2000.Sun), icrfToEcliptic(J2000.Venus));
}

/* ══════════════════════════════════════════════════════════════════════
   KEPLER PROPAGATOR  (analytic 3D two-body, Sun-centric)
   Given Venus's initial 3D position and velocity relative to the Sun and
   elapsed time dt, returns the predicted heliocentric position.
   This is the "ground truth" of where a perfect 2-body Newtonian
   simulation would put Venus — deviations from the sim show the
   accumulated effect of light-delayed gravity and numerical integration error.
   mu = G*(M_sun + M_venus) ≈ G*M_sun  (Venus mass negligible)
   ══════════════════════════════════════════════════════════════════════ */
const MU_SUN = G * MASS.Sun;  // km³/s²  standard gravitational parameter

function keplerPropagate(r0x, r0y, r0z, v0x, v0y, v0z, dt) {
    const r0mag = Math.sqrt(r0x*r0x + r0y*r0y + r0z*r0z);
    const v0sq  = v0x*v0x + v0y*v0y + v0z*v0z;

    // Angular momentum vector h = r0 × v0
    const hx = r0y*v0z - r0z*v0y;
    const hy = r0z*v0x - r0x*v0z;
    const hz = r0x*v0y - r0y*v0x;
    const hmag = Math.sqrt(hx*hx + hy*hy + hz*hz);

    // Eccentricity vector e_vec = (v × h)/mu − r/|r|
    const vxhx = v0y*hz - v0z*hy;
    const vxhy = v0z*hx - v0x*hz;
    const vxhz = v0x*hy - v0y*hx;
    const ecx = vxhx/MU_SUN - r0x/r0mag;
    const ecy = vxhy/MU_SUN - r0y/r0mag;
    const ecz = vxhz/MU_SUN - r0z/r0mag;
    const emag = Math.sqrt(ecx*ecx + ecy*ecy + ecz*ecz);

    // Semi-major axis from specific orbital energy
    const energy = v0sq/2 - MU_SUN/r0mag;
    const a = -MU_SUN/(2*energy);

    // Perifocal frame unit vectors P (toward periapsis), Q (90° ahead in plane)
    let Px, Py, Pz;
    if (emag < 1e-10) { Px=r0x/r0mag; Py=r0y/r0mag; Pz=r0z/r0mag; }
    else              { Px=ecx/emag;  Py=ecy/emag;  Pz=ecz/emag;  }
    const hx_n=hx/hmag, hy_n=hy/hmag, hz_n=hz/hmag;
    const Qx = hy_n*Pz - hz_n*Py;
    const Qy = hz_n*Px - hx_n*Pz;
    const Qz = hx_n*Py - hy_n*Px;

    // True anomaly at epoch
    const r0xn=r0x/r0mag, r0yn=r0y/r0mag, r0zn=r0z/r0mag;
    const cosf0 = r0xn*Px + r0yn*Py + r0zn*Pz;
    const sinf0 = r0xn*Qx + r0yn*Qy + r0zn*Qz;
    const f0 = Math.atan2(sinf0, cosf0);

    // Eccentric anomaly at epoch → mean anomaly
    const E0 = 2*Math.atan2(Math.sqrt(1-emag)*Math.sin(f0/2), Math.sqrt(1+emag)*Math.cos(f0/2));
    const M0 = E0 - emag*Math.sin(E0);
    const n  = Math.sqrt(MU_SUN/(a*a*a));
    const M  = M0 + n*dt;

    // Solve Kepler's equation M = E − e·sin(E)
    let E = M;
    for (let i = 0; i < 50; i++) {
        const dE = (M - E + emag*Math.sin(E))/(1 - emag*Math.cos(E));
        E += dE;
        if (Math.abs(dE) < 1e-12) break;
    }

    // True anomaly and radius at time t
    const f  = 2*Math.atan2(Math.sqrt(1+emag)*Math.sin(E/2), Math.sqrt(1-emag)*Math.cos(E/2));
    const r  = a*(1 - emag*Math.cos(E));
    const rf = r*Math.cos(f), rg = r*Math.sin(f);

    // Rotate from perifocal frame back to ecliptic 3D
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

    // Skip if center hasn't moved more than 15 days from last prefetch
    if (lastPrefetchCenter && Math.abs(dateDiffDays(today, lastPrefetchCenter)) < 15) return;

    horizonsFetchPending = true;
    horizonsRefStatus    = 'fetching';
    lastPrefetchCenter   = today;

    const start = clampDate(dateAddDays(today, -PREFETCH_HALF), HORIZONS_MIN_DATE, HORIZONS_MAX_DATE);
    const stop  = clampDate(dateAddDays(today,  PREFETCH_HALF), HORIZONS_MIN_DATE, HORIZONS_MAX_DATE);

    try {
        const [sunMap, venusMap] = await Promise.all([
            horizonsVecRangeAll('10',  start, stop),
            horizonsVecRangeAll('299', start, stop)
        ]);
        for (const [date, vec] of sunMap) {
            const e = horizonsDailyCache.get(date) || {};
            e.sun = vec;
            horizonsDailyCache.set(date, e);
        }
        for (const [date, vec] of venusMap) {
            const e = horizonsDailyCache.get(date) || {};
            e.venus = vec;
            horizonsDailyCache.set(date, e);
        }
        horizonsRefStatus = 'ok';
    } catch (err) {
        horizonsRefStatus = 'error';
        console.warn('Horizons prefetch failed:', err.message);
    } finally {
        horizonsFetchPending = false;
    }
}

function updateReferenceTelemetry() {
    if (!refEpoch) return;

    const s0 = refEpoch.sun;
    const v0 = refEpoch.venus;

    // Venus initial state relative to Sun (3D)
    const rel0x = v0.x - s0.x, rel0y = v0.y - s0.y, rel0z = v0.z - s0.z;
    const relV0x = v0.vx - s0.vx, relV0y = v0.vy - s0.vy, relV0z = v0.vz - s0.vz;

    // Analytically propagate Venus heliocentric position (3D)
    const vRef = keplerPropagate(rel0x, rel0y, rel0z, relV0x, relV0y, relV0z, simTime);

    // Kepler reference absolute positions
    const sunRefX = s0.x, sunRefY = s0.y, sunRefZ = s0.z;
    const venRefX = s0.x + vRef.x, venRefY = s0.y + vRef.y, venRefZ = s0.z + vRef.z;

    // Actual sim positions
    const s = bodies.Sun;
    const v = bodies.Venus;

    // Kepler drift
    const sunKepDrift = Math.sqrt((s.x-sunRefX)**2 + (s.y-sunRefY)**2 + (s.z-sunRefZ)**2);
    const venKepDrift = Math.sqrt((v.x-venRefX)**2 + (v.y-venRefY)**2 + (v.z-venRefZ)**2);

    // Horizons actual for current sim date
    const today    = simDateString();
    const hEntry   = horizonsDailyCache.get(today);
    const hasHoriz = hEntry && hEntry.sun && hEntry.venus;
    let sunHoriz = null, venHoriz = null;
    if (hasHoriz) {
        const sd = Math.sqrt((s.x-hEntry.sun.x)**2 + (s.y-hEntry.sun.y)**2 + (s.z-hEntry.sun.z)**2);
        const vd = Math.sqrt((v.x-hEntry.venus.x)**2 + (v.y-hEntry.venus.y)**2 + (v.z-hEntry.venus.z)**2);
        sunHoriz = { x: hEntry.sun.x,   y: hEntry.sun.y,   drift: sd };
        venHoriz = { x: hEntry.venus.x, y: hEntry.venus.y, drift: vd };
    }

    function fmtDrift(d) { return d < 1e6 ? d.toFixed(0) + ' km' : (d/AU).toFixed(6) + ' AU'; }

    function fmtRow(name, color, kepX, kepY, simX, simY, kepDrift, horiz) {
        const kx = (kepX/AU).toFixed(4), ky = (kepY/AU).toFixed(4);
        const sx = (simX/AU).toFixed(4), sy = (simY/AU).toFixed(4);
        const kc = kepDrift > 1000 ? 'yellow' : 'emerald';
        let horizRows = '';
        if (horiz) {
            const hx = (horiz.x/AU).toFixed(4), hy = (horiz.y/AU).toFixed(4);
            const hc = horiz.drift > 1000 ? 'yellow' : 'emerald';
            horizRows = `
                <div class="flex justify-between gap-2">
                    <span class="text-green-400">Horizons actual</span>
                    <span class="text-slate-300">${hx}, ${hy} AU</span>
                </div>
                <div class="flex justify-between gap-2">
                    <span class="text-${hc}-400">Drift (Horizons)</span>
                    <span class="text-${hc}-300 font-bold">${fmtDrift(horiz.drift)}</span>
                </div>`;
        }
        return `<div class="space-y-1">
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full inline-block flex-shrink-0" style="background:${color}"></span>
                <span class="font-bold text-slate-200">${name}</span>
            </div>
            <div class="pl-4 space-y-0.5 text-slate-500">
                <div class="flex justify-between gap-2">
                    <span class="text-violet-400">Kepler ref</span>
                    <span class="text-slate-300">${kx}, ${ky} AU</span>
                </div>${horizRows}
                <div class="flex justify-between gap-2">
                    <span class="text-sky-400">Sim actual</span>
                    <span class="text-slate-300">${sx}, ${sy} AU</span>
                </div>
                <div class="flex justify-between gap-2">
                    <span class="text-${kc}-400">Drift (Kepler)</span>
                    <span class="text-${kc}-300 font-bold">${fmtDrift(kepDrift)}</span>
                </div>
            </div>
        </div>`;
    }

    const statusMap = {
        idle:          '',
        fetching:      '<div class="text-[9px] text-yellow-400 animate-pulse mb-1">Fetching Horizons daily data…</div>',
        ok:            `<div class="text-[9px] text-emerald-500 mb-1">Horizons cache: ${horizonsDailyCache.size} days · ${today}</div>`,
        error:         '<div class="text-[9px] text-red-400 mb-1">Horizons fetch failed — CORS proxy needed (localhost:8010)</div>',
        'out-of-range':'<div class="text-[9px] text-slate-600 mb-1">Sim date outside Horizons range (1900–2100)</div>'
    };

    document.getElementById('refTelemetry').innerHTML = [
        statusMap[horizonsRefStatus] || '',
        fmtRow('Sun',   '#fde047', sunRefX, sunRefY, s.x, s.y, sunKepDrift, sunHoriz),
        '<hr class="border-slate-800">',
        fmtRow('Venus', '#fde68a', venRefX, venRefY, v.x, v.y, venKepDrift, venHoriz),
        `<div class="text-[9px] text-slate-600 mt-1">z (Venus Kepler): ${(venRefZ/AU).toFixed(5)} AU</div>`
    ].join('');
}

/* ══════════════════════════════════════════════════════════════════════
   LIGHT-DELAYED POSITION LOOKUP
   Returns the position of body b at sim-time t (interpolated from history)
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
   FORCE COMPUTATION WITH LIGHT-DELAYED GRAVITY
   ══════════════════════════════════════════════════════════════════════ */
function computeForces() {
    const s = bodies.Sun;
    const v = bodies.Venus;

    // Current 3D distance (used to estimate light-travel delay)
    const dx0 = v.x - s.x, dy0 = v.y - s.y, dz0 = v.z - s.z;
    const d0  = Math.sqrt(dx0*dx0 + dy0*dy0 + dz0*dz0);

    const lightDelay = d0 / C;  // seconds

    // Light-delayed position of Sun as seen from Venus
    const sPast = lightDelayedPos(s, simTime - lightDelay);
    // Light-delayed position of Venus as seen from Sun (symmetric)
    const vPast = lightDelayedPos(v, simTime - lightDelay);

    // Force on Venus from Sun's light-delayed position (3D)
    const dxV = sPast.x - v.x, dyV = sPast.y - v.y, dzV = sPast.z - v.z;
    const d2V = dxV*dxV + dyV*dyV + dzV*dzV;
    const dV  = Math.sqrt(d2V);
    const aV  = (d2V > 0) ? (G * s.mass) / d2V : 0;
    v.ax = (dV > 0) ? aV * (dxV / dV) : 0;
    v.ay = (dV > 0) ? aV * (dyV / dV) : 0;
    v.az = (dV > 0) ? aV * (dzV / dV) : 0;

    // Force on Sun from Venus's light-delayed position (3D)
    const dxS = vPast.x - s.x, dyS = vPast.y - s.y, dzS = vPast.z - s.z;
    const d2S = dxS*dxS + dyS*dyS + dzS*dzS;
    const dS  = Math.sqrt(d2S);
    const aS  = (d2S > 0) ? (G * v.mass) / d2S : 0;
    s.ax = (dS > 0) ? aS * (dxS / dS) : 0;
    s.ay = (dS > 0) ? aS * (dyS / dS) : 0;
    s.az = (dS > 0) ? aS * (dzS / dS) : 0;

    // Update HUD light delay display
    document.getElementById('hudDelay').textContent = lightDelay.toFixed(1) + ' s';
    document.getElementById('hudDist').textContent  = (d0 / AU).toFixed(4) + ' AU';
}

/* ══════════════════════════════════════════════════════════════════════
   ELASTIC SOFT-BODY COLLISION
   Triggered when surface-to-surface distance ≤ 0
   Conserves momentum and kinetic energy (e = 1, perfectly elastic)
   ══════════════════════════════════════════════════════════════════════ */
function handleCollision() {
    const s = bodies.Sun;
    const v = bodies.Venus;

    const dx = v.x - s.x, dy = v.y - s.y, dz = v.z - s.z;
    const d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const minD = s.physR + v.physR;

    if (d < minD) {
        lastCollision = true;
        // Normal unit vector (Sun→Venus)
        const nx = dx / d, ny = dy / d, nz = dz / d;

        // Relative velocity along normal (3D)
        const dvx = v.vx - s.vx, dvy = v.vy - s.vy, dvz = v.vz - s.vz;
        const vRel = dvx*nx + dvy*ny + dvz*nz;

        // Only resolve if approaching
        if (vRel < 0) {
            const m1 = s.mass, m2 = v.mass;
            const j = (2 * m1 * m2 / (m1 + m2)) * Math.abs(vRel);

            s.vx -= (j / m1) * nx;  s.vy -= (j / m1) * ny;  s.vz -= (j / m1) * nz;
            v.vx += (j / m2) * nx;  v.vy += (j / m2) * ny;  v.vz += (j / m2) * nz;
        }

        // Push apart so they no longer overlap
        const overlap = minD - d;
        const ratio = s.mass / (s.mass + v.mass);
        s.x -= nx * overlap * (1 - ratio);  s.y -= ny * overlap * (1 - ratio);  s.z -= nz * overlap * (1 - ratio);
        v.x += nx * overlap * ratio;        v.y += ny * overlap * ratio;        v.z += nz * overlap * ratio;

        document.getElementById('hudColl').textContent = 'COLLISION!';
        document.getElementById('hudColl').className = 'mono text-red-400 font-bold';
    } else {
        lastCollision = false;
        document.getElementById('hudColl').textContent = 'None';
        document.getElementById('hudColl').className = 'mono text-slate-600';
    }
}

/* ══════════════════════════════════════════════════════════════════════
   SYMPLECTIC LEAPFROG INTEGRATION
   Substep = 3600 sim-seconds (1 hour) for numerical stability
   ══════════════════════════════════════════════════════════════════════ */
const DT_SUB = 3600; // seconds per substep

function advanceSim(totalDt) {
    const steps = Math.max(1, Math.ceil(totalDt / DT_SUB));
    const dt    = totalDt / steps;

    for (let s = 0; s < steps; s++) {
        // Kick half (3D)
        for (const b of Object.values(bodies)) {
            b.vx += b.ax * (dt / 2);  b.vy += b.ay * (dt / 2);  b.vz += b.az * (dt / 2);
        }
        // Drift (3D)
        for (const b of Object.values(bodies)) {
            b.x += b.vx * dt;  b.y += b.vy * dt;  b.z += b.vz * dt;
        }

        simTime += dt;

        // Record position history for light-delayed gravity (3D)
        if (simTime >= nextHistRecord) {
            nextHistRecord = simTime + HIST_INTERVAL;
            for (const b of Object.values(bodies)) {
                b.posHist.push({ t: simTime, x: b.x, y: b.y, z: b.z });
                while (b.posHist.length > 1 && b.posHist[0].t < simTime - MAX_HIST_DURATION) {
                    b.posHist.shift();
                }
            }
        }

        // Recompute forces (light-delayed)
        computeForces();

        // Kick half (3D)
        for (const b of Object.values(bodies)) {
            b.vx += b.ax * (dt / 2);  b.vy += b.ay * (dt / 2);  b.vz += b.az * (dt / 2);
        }

        // Elastic collision check
        handleCollision();
    }
}

/* ══════════════════════════════════════════════════════════════════════
   TIMER DISPLAY
   Driven entirely by simTime so it scales correctly with timeWarp.
   Uses mean values: 1 year = 365.25 days, 1 month = 30.4375 days.
   ══════════════════════════════════════════════════════════════════════ */
function updateTimer() {
    const SIM_DAY   = 86400;
    const SIM_MONTH = SIM_DAY * 30.4375;
    const SIM_YEAR  = SIM_DAY * 365.25;

    const totalDays  = simTime / SIM_DAY;
    const years      = Math.floor(simTime / SIM_YEAR);
    const remainder  = simTime % SIM_YEAR;
    const months     = Math.floor(remainder / SIM_MONTH);
    const days       = Math.floor((remainder % SIM_MONTH) / SIM_DAY);
    const monthFrac  = (remainder % SIM_MONTH) / SIM_MONTH;

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
    const rows = Object.values(bodies).map(b => {
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
                <div>Vz (km/s): <span class="text-white">${b.vz.toFixed(3)}</span></div>
            </div>
        </div>`;
    });
    document.getElementById('telemetry').innerHTML = rows.join('<hr class="border-slate-800 my-1">');
}

/* ══════════════════════════════════════════════════════════════════════
   RENDERING
   Bodies scale visually with zoom; label font scales too.
   Physical size is used for collision; visual size is clamped for readability.
   ══════════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

// Simple deterministic star field (seeded with fixed values)
const STARS = (() => {
    // Pseudo-random seeded list so it's consistent every run
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
   Camera orbits the origin on a sphere of radius cam.r.
   cam.theta = azimuth (longitude), cam.phi = elevation (latitude).
   project(wx,wy,wz) → { sx, sy, depth } in screen space.
   ══════════════════════════════════════════════════════════════════════ */
function project(wx, wy, wz) {
    const W = canvas.width, H = canvas.height;
    const cT = Math.cos(cam.theta), sT = Math.sin(cam.theta);
    const cP = Math.cos(cam.phi),   sP = Math.sin(cam.phi);

    // Camera eye position
    const ex = cam.r * cP * cT, ey = cam.r * cP * sT, ez = cam.r * sP;

    // Displacement from eye to world point
    const dx = wx - ex, dy = wy - ey, dz = wz - ez;

    // Camera basis:
    //   right   = (-sT,  cT,  0)
    //   up      = (-sP*cT, -sP*sT,  cP)
    //   forward = (-cP*cT, -cP*sT, -sP)  (positive depth = in front)
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

    // Stars
    for (const s of STARS) {
        ctx.beginPath();
        ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.fill();
    }

    // Ecliptic grid — concentric rings at z=0
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

    // Trails from posHist
    for (const b of Object.values(bodies)) {
        if (b.posHist.length < 2) continue;
        ctx.beginPath();
        let first = true;
        for (const h of b.posHist) {
            const p = project(h.x, h.y, h.z);
            if (!p.visible) { first = true; continue; }
            first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
            first = false;
        }
        ctx.strokeStyle = b.color + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Depth-sort bodies (farthest first)
    const bArr = Object.values(bodies).map(b => {
        const p = project(b.x, b.y, b.z);
        return { b, p };
    }).sort((a, z) => z.p.depth - a.p.depth);

    for (const { b, p } of bArr) {
        if (!p.visible) continue;

        // Apparent radius: physR projected at depth p.depth
        // cam.fov * physR / depth gives screen pixels for that physical size
        const physPx = cam.fov * b.physR / p.depth;
        const minPx  = b.name === 'Sun' ? 5 : 2;
        const drawR  = Math.max(minPx, physPx);

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

    // Scale bar (based on cam.r proxy for zoom level)
    const barKm = cam.r * 0.2;   // bar = 20% of camera distance
    const barAU = barKm / AU;
    zoom = cam.fov / cam.r;      // keep zoom in sync for any legacy code
    document.getElementById('scaleLabel').textContent =
        barAU >= 0.01 ? barAU.toFixed(2) + ' AU' : (barKm / 1e6).toFixed(2) + ' M km';
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN LOOP
   ══════════════════════════════════════════════════════════════════════ */
function loop(now) {
    if (!lastRAF) lastRAF = now;
    const realDt = Math.min((now - lastRAF) / 1000, 0.1); // cap 100ms
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
   NASA FETCH
   ══════════════════════════════════════════════════════════════════════ */
document.getElementById('fetchBtn').onclick = async () => {
    const epoch   = document.getElementById('epochDate').value;
    const msgEl   = document.getElementById('apiMsg');
    const dotEl   = document.getElementById('apiDot');
    const btn     = document.getElementById('fetchBtn');

    btn.disabled = true;
    btn.textContent = 'FETCHING…';
    dotEl.className = 'w-2 h-2 rounded-full bg-yellow-400 animate-pulse';
    msgEl.textContent = 'Requesting Sun state vectors…';

    try {
        const sunData   = await horizonsVec('10',  epoch);   // Sun (NAIF 10)
        msgEl.textContent = 'Requesting Venus state vectors…';
        const venusData = await horizonsVec('299', epoch);   // Venus

        msgEl.textContent = `Loaded Sun + Venus for ${epoch}.`;
        dotEl.className   = 'w-2 h-2 rounded-full bg-emerald-400';
        document.getElementById('hudSrc').textContent = `Horizons (${epoch})`;
        epochCalendarDate = new Date(epoch + 'T00:00:00Z');
        initBodies(sunData, venusData);
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
    lastRAF   = null;  // prevent time jump on resume
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
    cam.r = Math.max(1e6, Math.min(2e9, r));
    const norm = cam.r / 2.5e8;
    document.getElementById('zoomSlider').value = Math.max(0.001, Math.min(200, norm));
    document.getElementById('zoomLabel').textContent = cam.r.toExponential(2) + ' km';
}

document.getElementById('zoomSlider').oninput = (e) => {
    setCamR(parseFloat(e.target.value) * 2.5e8);
};

document.getElementById('zIn') .onclick = () => setCamR(cam.r * 0.6);
document.getElementById('zOut').onclick = () => setCamR(cam.r * 1.6);
document.getElementById('zRec').onclick = () => {
    cam.r = 2.5e8; cam.theta = Math.PI/4; cam.phi = Math.PI/5;
    setCamR(cam.r);
};

// Camera view presets (Top = ecliptic-plane view, Side = edge-on)
document.getElementById('camTop') .onclick = () => { cam.phi = Math.PI/2 - 0.01; };
document.getElementById('camSide').onclick = () => { cam.phi = 0.01; };

// Orbit drag — left mouse rotates the camera around the origin
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

// Resize
function resize() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
window.addEventListener('resize', resize);
resize();

/* ══════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════ */
initDefault();
requestAnimationFrame(loop);
