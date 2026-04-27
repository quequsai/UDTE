# Universal Digital Twin Engine (UDTE)

CPSC 4990 Independent Study — Qusai Quresh, University of Lethbridge, April 2026

Live site: **https://quequsai.github.io/UDTE/**

---

## What's here

**[Sun-Venus Simulation](https://quequsai.github.io/UDTE/sun-venus/)**
Two-body orbital simulation of the Sun and Venus. Uses a symplectic leapfrog integrator, light-delayed gravity, and real initial conditions from the NASA JPL Horizons API. Compares against the analytic Kepler solution in real time.

**[N-Body Solar System](https://quequsai.github.io/UDTE/n-body/)**
Ten-body solar system simulation (Sun through Pluto) built on the same physics engine. Every body gravitationally influences every other body, with light-delayed gravity throughout.

**[Final Report](https://quequsai.github.io/UDTE/report/)**
Full write-up covering the drift analysis methodology, Monte Carlo stability testing across six timestep configurations (dt = 100 s to 20,000 s), and what building this from scratch taught me about the intersection of CS, physics, and mathematical incompleteness.

---

## Physics

- Leapfrog (Stormer-Verlet) integrator — symplectic, conserves energy long-term
- Light-delayed gravity — forces computed from retarded positions (distance / c seconds in the past)
- Initial conditions from NASA JPL Horizons at epoch 1800-01-01, J2000 ecliptic frame
- Drift benchmarked against analytic Kepler solution and NASA Horizons ephemeris
- Monte Carlo stability: 20 runs per timestep with perturbations (σ = 100 km position, 0.001 km/s velocity)
