# Universal Digital Twin Engine (UDTE)

CPSC 4990 Independent Study — Qusai Quresh, University of Lethbridge, April 2026

Live site: **https://quequsai.github.io/UDTE/**

---

## Simulations

**[Sun-Venus Simulation](https://quequsai.github.io/UDTE/sun-venus/)**
Two-body orbital simulation of the Sun and Venus. Uses a symplectic leapfrog integrator, light-delayed gravity (forces computed from retarded positions d/c seconds in the past), and real initial conditions pulled live from the NASA JPL Horizons API. Compares simulated positions against the analytic Kepler solution in real time.

**[N-Body Solar System](https://quequsai.github.io/UDTE/n-body/)**
Full ten-body solar system simulation (Sun through Pluto) built on the same physics engine. Every body gravitationally influences every other, with light-delayed gravity and elastic collision detection throughout. Initial conditions fetched from NASA JPL Horizons for any user-specified epoch.

**[Barnes-Hut Engine](https://quequsai.github.io/UDTE/barnes-hut/)**
Precision gravity engine using the Barnes-Hut O(N log N) tree algorithm for force approximation. Supports custom satellite launches and real-time orbital dynamics.

---

## Report & Docs

**[Final Report](https://quequsai.github.io/UDTE/report/)**
Full write-up covering the drift analysis methodology, Monte Carlo stability testing across six timestep configurations (dt = 100 s to 20,000 s), performance benchmarks, and the broader reflections on CS, physics, and Gödel that came out of building this.

**[Technical Docs](https://quequsai.github.io/UDTE/docs/)**
Deep-dive documentation on the physics and numerics:
- *Numerical Insights* — leapfrog integration layer by layer, Kepler drift vs Horizons drift, substep trade-off table, parallelisation Big-O analysis
- *Kinematics & N-Body* — 1PN Einstein-Infeld-Hoffmann equations (JPL DE440 formulation), IAS15 integrator, Barnes-Hut and FMM force computation, SIMD vectorisation, Kahan compensated summation, Mercury perihelion validation

---

## Physics

- Leapfrog (Störmer-Verlet) symplectic integrator — conserves a modified total energy exactly over arbitrary timescales
- Light-delayed gravity — gravitational forces use retarded source positions (d/c seconds in the past) rather than instantaneous positions
- Initial conditions from NASA JPL Horizons, J2000 mean ecliptic frame
- Drift benchmarked against both the analytic Kepler solution (integration error) and NASA Horizons ephemeris (physical model gap)
- Monte Carlo stability testing: 20 runs per timestep with random perturbations (σ = 100 km position, σ = 0.001 km/s velocity)
- Six timestep values benchmarked: 100 s, 1,000 s, 3,600 s, 7,200 s, 14,000 s, 20,000 s

---

## Stack

JavaScript (vanilla) · HTML/CSS · Tailwind CSS · NASA JPL Horizons API · Cloudflare Workers (CORS proxy) · GitHub Pages · Python (drift analysis & Monte Carlo)
