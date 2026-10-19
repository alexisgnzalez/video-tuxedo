# Visual Component & Sound Effects Registry

> **Notice**: Automatically generated from `registry.json`. Do not edit manually. Run `npm run build:registry` to update.

---

## 1. Visual Component Registry (13 Components)

| Asset ID | Category | Default Zone | Component Path | Description | SFX Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PosterTitleCard` | Header / Title | `Zone T` | `src/assets/components/PosterTitleCard.tsx` | Iconic Caracas mid-century travel poster header on skyTeal with Soto vibration lines and scalloped clouds. | `SFX_PAPER_SNAP` |
| `AvilaFacetCard` | Information Card | `Zone T` | `src/assets/components/AvilaFacetCard.tsx` | Faceted mountain-topped brutalist card containing staggered bullet points with typewriter clack sync. | `SFX_PAPER_SNAP` |
| `BrutalistLowerThird` | Typography / Identity | `Zone B` | `src/assets/components/BrutalistLowerThird.tsx` | Heavy concrete and terracotta lower third slab with vertical optical stripe accent spine. | `SFX_BRUTAL_THUD` |
| `CruzDiezBadge` | Kinetic Accent | `Zone R` | `src/assets/components/CruzDiezBadge.tsx` | Octagonal or circular moiré optical stripe badge with rotating Physichromie bands and title tag. | `SFX_PAPER_SNAP` |
| `ViaductProgress` | Header / Timeline | `Zone T` | `src/assets/components/ViaductProgress.tsx` | Elevated concrete viaduct highway tracking video chapters with an animated marker node. | `SFX_WIRE_SWISH` |
| `GegoMeshPointer` | Connector / Pointer | `Zone L` | `src/assets/components/GegoMeshPointer.tsx` | Parabolic ruled-surface wireframe mesh connecting speaker shoulder to callout card. | `SFX_WIRE_SWISH` |
| `CruzDiezWall` | Divider / Accent | `Zone B` | `src/assets/components/CruzDiezWall.tsx` | Architectural Physichromie stripe wall with vertical columns and a 45° diagonal center slice. | `SFX_KINETIC_HUM` |
| `AvilaPeak` | Monument / Badge | `Zone L` | `src/assets/components/AvilaPeak.tsx` | Faceted mountain summit with Hotel Humboldt monument tower and stepped 12fps entrance. | `SFX_BRUTAL_THUD` |
| `PetareHill` | Illustration / Structure | `Zone L` | `src/assets/components/PetareHill.tsx` | Procedural hillside community of modular cubic houses with dark windows and zig-zag stairs. | `SFX_BRUTAL_THUD` |
| `ViaductSweep` | Illustration / Movement | `Zone FULL` | `src/assets/components/ViaductSweep.tsx` | Curving elevated concrete viaduct with pillars, Gego hanging nets, vintage car and cyclist. | `SFX_WIRE_SWISH` |
| `HyparNet` | Sculpture / Accent | `Zone R` | `src/assets/components/HyparNet.tsx` | Hyperbolic paraboloid ruled wire mesh on concrete poles or rotating wireframe polyhedron. | `SFX_WIRE_SWISH` |
| `ForegroundFrame` | Framing | `Zone B` | `src/assets/components/ForegroundFrame.tsx` | Stone masonry wall and lush tropical foliage framing the lower chest and shoulders. | `SFX_PAPER_SNAP` |
| `KineticCaption` | Captions | `Zone B` | `src/assets/components/KineticCaption.tsx` | Brutalist word-by-word active highlighted captions synced with speech timecodes. | `SFX_TYPE_CLACK` |

---

## 2. Sound Effects (SFX) Registry (5 Instruments)

*Rule: Every visual entrance or kinetic event pairs with an `<Audio src={staticFile('sfx/[id]_v[1..4].wav')} />` tag.*

| SFX ID | Sonic Character | Default Vol | Variants | Trigger Rule |
| :--- | :--- | :--- | :--- | :--- |
| `SFX_PAPER_SNAP` | Crisp vintage cardstock snap | `0.35` | `4x` | Trigger on frame 0 of Zone L/R card entrances. |
| `SFX_BRUTAL_THUD` | Low-end mechanical architectural stamp | `0.4` | `4x` | Trigger when BrutalistLowerThird or heavy architecture locks in. |
| `SFX_WIRE_SWISH` | Metallic springy ruled-surface whoosh | `0.3` | `4x` | Trigger when GegoMeshPointer, HyparNet, or Viaduct lines draw on. |
| `SFX_TYPE_CLACK` | Mechanical letterpress clack | `0.25` | `4x` | Trigger per word or bullet reveal on kinetic emphasis. |
| `SFX_KINETIC_HUM` | Warm analog synth optical shimmer | `0.2` | `4x` | Trigger during continuous Cruz-Diez / Soto moiré shifts. |
