# 🌍 Geodesy Engine — A Mathematical Earth

An interactive, first-principles 3D model of planet Earth, built directly from the equations of **geodesy, potential theory, and rotational dynamics** — not from a texture-mapped sphere. Every visual element on screen is driven by a real formula: the ellipsoid shape, the surface coloring, the geoid bumps, and the force vectors at any point you select.

**[▶ Live Demo](#)** &nbsp;·&nbsp; **[📄 Full Mathematical Derivation](#)** &nbsp;·&nbsp; https://earth-clone-luuz.vercel.app/

---

## What this is

Most "3D Earth" demos are a sphere with a satellite photo wrapped around it. This project instead treats Earth as the object of a geophysics textbook:

> Start from Laplace's equation for the gravitational potential, solve it in spherical harmonics, derive the reference ellipsoid as an equipotential surface of gravity + rotation, and render the result.

The result is a small (single HTML file, zero build step) WebGL app where sliders map directly onto physical parameters — flattening `f`, the dynamic form factor `J₂`, Somigliana's normal gravity `γ(φ)` — rather than onto arbitrary visual knobs.

---

## Highlights for a presentation

- 🔵 **Reference ellipsoid, not a sphere** — toggle between the spherical approximation and the true WGS84 oblate spheroid (`a = 6378.137 km`, `b = 6356.752 km`, `f = 1/298.257`), with an exaggeration slider because the true flattening is invisible to the eye.
- 🌡️ **Surface color = real physics** — every point on the mesh is shaded by **Somigliana's equation** for normal gravity `γ(φ)`, computed live, not a pre-baked texture.
- 🗻 **Geoid undulation toggle** — displaces the surface by `N(φ,λ) = T/γ` (Bruns' formula) using a simplified long-wavelength harmonic model (`J₃`, `J₄`, `C₂₂`, `S₂₂`), showing the "lumpy potato" shape of Earth's true equipotential surface, magnified for visibility.
- 🎯 **Click-and-inspect field point** — drag a latitude/longitude marker anywhere and get a live instrument readout:
  - geodetic vs. geocentric latitude (`φ` vs. `ψ`) and the **deflection of the vertical**
  - the prime-vertical radius of curvature `N(φ)`
  - normal gravity `γ(φ)`
  - centrifugal acceleration `a_cent = ω²r cos φ`
  - three drawn vectors: gravitational, centrifugal, and effective gravity (`g_eff = g_grav + a_cent`)
- ⚖️ **Honest about exaggeration** — every place the visualization magnifies something for visibility (flattening, geoid height, centrifugal vector, deflection angle) is explicitly labeled with the true value alongside it.

---

## The math behind each piece

| On screen | Governing equation |
|---|---|
| Ellipsoid shape | $\dfrac{X^2+Y^2}{a^2}+\dfrac{Z^2}{b^2}=1$, flattening $f=\dfrac{a-b}{a}$ |
| Latitude conversion | $\tan\psi = (1-e^2)\tan\phi$ |
| Gravity shading | Somigliana: $\gamma(\phi)=\dfrac{a\gamma_e\cos^2\phi+b\gamma_p\sin^2\phi}{\sqrt{a^2\cos^2\phi+b^2\sin^2\phi}}$ |
| Geoid bump | Bruns' formula: $N=T/\gamma$, with $T$ from a truncated spherical-harmonic expansion of $V(r,\phi,\lambda)$ |
| Centrifugal vector | $\mathbf{a}_{\text{cent}}=\boldsymbol{\Omega}\times(\boldsymbol{\Omega}\times\mathbf{r})$, magnitude $\omega^2 r\cos\phi$ |
| Effective gravity | $\mathbf{g}_{\text{eff}}=\mathbf{g}_{\text{grav}}+\mathbf{a}_{\text{cent}}=\nabla W$ |

*(Derivations, the full spherical-harmonic potential, PREM density profiling, the hydrostatic pressure equation, and precession/nutation/Chandler wobble are covered in the companion document — see link above.)*

---

## Tech stack

- **Three.js r128** (WebGL, loaded from cdnjs — no build step, no `npm install`)
- Vanilla JavaScript — all physics functions (`normalGravity`, `geocentricLat`, `geoidUndulation`, `centrifugalAccel`, …) are pure functions you can read top to bottom in one file
- Custom lightweight orbit camera (drag + scroll) — no external controls library
- Single self-contained `.html` file

## Run it

No installation needed — it's one static file:

```bash
open earth_3d_model.html   # or just double-click it / drag into a browser
```

## Controls

| Action | Effect |
|---|---|
| Drag | Orbit camera |
| Scroll | Zoom |
| **Figure of the Earth** buttons | Sphere ⇄ true ellipsoid |
| **Flattening exaggeration** slider | Magnify `a − b` for visibility |
| **Geoid undulation** toggle + slider | Show/scale the `N(φ,λ)` bump map |
| **Shade by normal gravity** toggle | Color mesh by `γ(φ)` vs. flat gray |
| **Field sample point** sliders | Move the marker; live readout + vector arrows update |

---

## Known simplifications

This is a pedagogical/visual model, not a geodetic production tool:

- The geoid model uses only 4 low-degree harmonic terms (`J₃`, `J₄`, `C₂₂`, `S₂₂`) as an illustrative stand-in for the full EGM2008 field.
- `J₂` is intentionally excluded from the geoid bump, since the reference ellipsoid already absorbs it by construction (Clairaut's theorem) — only the *residual* potential should shape the geoid.
- Rotation in the scene is a visual rate, not real sidereal `ω` (which is far too slow to animate meaningfully).
- Precession, nutation, and Chandler wobble (multi-year to multi-century timescales) are described mathematically in the companion document but are not animated in the 3D scene.

---

## Project structure

```
.
├── earth_3d_model.html          # the interactive 3D model (this is the whole app)
├── Earth_Mathematical_Model.md  # full derivations: geodesy, potential theory, PREM, rotation
└── README.md                    # this file
```

---

## Credits

Built as a first-principles mathematical model of Earth — geometry from geodesy, shading from Somigliana's gravity formula, and surface deformation from spherical-harmonic potential theory.
