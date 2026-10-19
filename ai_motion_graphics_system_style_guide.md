# AI Motion Graphics System & Style Guide: Mid-Century Kinetic Poster (Remotion + DaVinci Resolve Free)

## 1. Visual Aesthetic Overview
This system blends **1950s Mid-Century Modern Travel Posters** with **Venezuelan Kinetic Art (Cinetismo)** and **Tropical Brutalist Architecture**, specifically engineered to frame, complement, and respect a live-action **Talking Head (chest/head-up)** subject.
* **Core Look:** Flat vector illustration, zero gradients, sharp geometric facets, stark shading, and high-contrast warm/cool color blocking.
* **Key Motifs:** Cruz-Diez style optical color stripes, Gego/Soto style wireframe parabolic meshes, sweeping brutalist architectural frames, and faceted mountain topography.
* **Integration Philosophy:** Graphics never obscure the speaker's face or eyes. They emerge from behind the shoulders, frame the edges, or appear in dedicated dynamic visual zones synced to `.srt` timestamps.

---

## 2. Color Palette (Strict Hex Codes)
All generated SVG and HTML elements must strictly adhere to this vintage, sun-baked palette. Exported from `src/styles/palette.ts`:

```typescript
export const PALETTE = {
  transparent: "transparent", // Required for DaVinci Resolve alpha overlays
  skyTeal: "#1D6376",         // Deep vintage teal background / primary card fill
  creamPaper: "#F3D7A6",      // Typography, clouds, highlights, and primary strokes
  warmOchre: "#DDA059",       // Mid-tone mountain facets & architecture
  terracotta: "#B64B26",      // Shadow mountain facets & earthy accents
  deepRust: "#7A2E18",        // Deep earth shadows & callout borders
  forestGreen: "#1D422E",     // Lush foliage & mountain base shadows
  abyssalBlue: "#12202F",     // Deepest structural shadows & dark text backing
  concreteGrey: "#C5B49A",    // Brutalist roads, viaducts, and structural frames
  barrioBlue: "#9DB8C4",      // Modular hillside homes, sky reflections & steel wire accents
  kineticRed: "#D9381E",      // Optical stripe accent 1 (High Alert / Key Point)
  kineticGreen: "#007A53",    // Optical stripe accent 2 (Growth / Secondary Point)
  kineticBlue: "#1B4D89",     // Optical stripe accent 3 (Technical / Structural)
} as const;
```

---

## 3. Talking-Head Spatial Architecture (Subject-Respecting Layout)

### §3-V Vertical 9:16 Canvas Grid (1080x1920) — Primary Standard
For short-form vertical video (TikTok, Instagram Reels, YouTube Shorts, LinkedIn), compositions render at **1080x1920**. Safe zones dynamically adapt to UI overlay margins and subject tracking bounding boxes.

1. **The Subject Exclusion Zone (Vertical):**
   * **Bounding Box:** `X: 180px to 900px`, `Y: 420px to 1420px` (or tracked via YOLOv8 `subjectTrack` samples).
   * **Rule:** Solid graphics, heavy brutalist blocks, or high-contrast cards must never obscure the speaker's face and eyes (`Y: 420px to 980px`).
2. **Active Motion Graphic Zones (9:16):**
   * **Zone T (Canopy / Header):** `X: 60px to 1020px`, `Y: 120px to 400px` — Reserved for `PosterTitleCard`, `ViaductProgress`, and chapter headers.
   * **Zone L (Left Shoulder Flank):** `X: 30px to 260px`, `Y: 420px to 1420px` — Used for `AvilaPeak`, `PetareHill`, and kinetic accent badges.
   * **Zone R (Right Shoulder Flank):** `X: 820px to 1050px`, `Y: 420px to 1420px` — Used for `HyparNet`, `CruzDiezBadge`, and Gego mesh callouts.
   * **Zone B (Lower Third / Captions):** `X: 60px to 1020px`, `Y: 1440px to 1720px` — Accommodates `BrutalistLowerThird` and `KineticCaption`.
   * **Zone FULL:** Full 1080x1920 canvas for mode `plate` (cutaway posters) or `ForegroundFrame` (chest stone wall & foliage).
3. **Platform Safe Margins:**
   * **TikTok / Instagram Reels:** Top: `108px`, Bottom: `260px` (profile/caption bar), Right: `130px` (like/comment buttons).
   * **Clean / Raw:** `60px` all sides.

---

### A. 1920x1080 Horizontal Canvas Grid (Legacy Widescreen)
1. **The Subject Exclusion Zone (Center Mass):**
   * **Bounding Box:** `X: 600px to 1320px`, `Y: 180px to 1080px`.
   * **Rule:** Never place solid background cards, dense typography, or high-frequency moiré patterns directly over the speaker's face (`Y: 200px to 650px`, `X: 750px to 1170px`).
2. **Active Motion Graphic Zones:**
   * **Zone L (Left Shoulder Wing):** `X: 80px to 620px`, `Y: 150px to 850px` — Primary zone for kinetic cards, lists, and architectural diagrams.
   * **Zone R (Right Shoulder Wing):** `X: 1300px to 1840px`, `Y: 150px to 850px` — Secondary zone for counter-balancing geometry, callouts, or dual-comparisons.
   * **Zone T (Kinetic Canopy / Header):** `X: 100px to 1820px`, `Y: 40px to 160px` — Reserved for sweeping viaduct paths, Soto sky rhythms, and chapter headers.
   * **Zone B (Brutalist Lower Third / Captions):** `X: 260px to 1660px`, `Y: 820px to 1000px` — Sits over the speaker's lower chest/shoulders. Uses high-contrast `abyssalBlue` or `concreteGrey` geometric slabs with kinetic borders so `.srt` captions and lower-thirds remain 100% legible.
3. **Asymmetric Shift Mode:**
   * Pass a prop `subjectPosition: 'center' | 'left' | 'right'` to compositions. If `'left'` (`X: 450px`), expand **Zone R** (`X: 960px to 1820px`) for large visual demonstrations.

### B. 3-Layer Depth Sandwich (For DaVinci Resolve Free Version)
Since DaVinci Resolve Free does not include the Studio "Magic Mask" AI rotoscoping tool, we achieve subject-respecting depth using three distinct rendering modes:
1. **Mode 1: Transparent Foreground Overlay (`z-foreground`)**
   * Background is `transparent`. Graphics spawn in Zones L, R, T, and B.
   * *Use case:* Drop directly on **Video Track 2** above your talking head on **Video Track 1** in DaVinci Resolve. Zero rotoscoping required.
2. **Mode 2: Kinetic Cutout Frame (`z-frame`)**
   * The talking head video is placed *inside* a geometric Mid-Century poster cutout (e.g., an octagon, brutalist arch, or Cruz-Diez striped badge) on the left, while the rest of the canvas is a full-screen animated poster.
3. **Mode 3: Background Plate (`z-background`)**
   * Full-screen `skyTeal` and faceted mountains for moments when the speaker is keyed out (via Green Screen or Runway/Rembg pre-processing) or when cutting away to 100% full-screen B-roll graphics.

---

## 4. Core Visual Elements & SVG Construction Rules
Construct all visuals using layered, modular `<svg>` components rather than raster images:

### A. The Kinetic Sky & Clouds (Soto Effect)
* **Base:** Solid `skyTeal` background (or localized card fill) with flat, geometric pill/arch cream clouds (`creamPaper`).
* **Overlay:** A repeating `<pattern>` of thin vertical lines (`strokeWidth="2"`, `stroke="#F3D7A6"`) masking upper graphic zones to create an optical vibration effect.

### B. Faceted Topography & Brutalist Frames
* **Mountains (El Ávila):** Construct using angular, intersecting `<polygon>` shapes. Never use smooth curves for rocks. Alternate fills between `warmOchre`, `terracotta`, and `forestGreen` to simulate harsh tropical sunlight from the left.
* **Modular Blocks (Petare / Brutalism):** Create grid-based generators of overlapping rectangles in `terracotta`, `warmOchre`, and `creamPaper`, punctuated by tiny dark square windows (`abyssalBlue`), used as sidebars or data containers.

### C. Kinetic Art & Wireframe Structures
* **Physichromie Accents (Cruz-Diez):** Create `<svg>` masks filled with repeating vertical and $45^\circ$ diagonal stripes cycling through `kineticRed`, `kineticGreen`, `kineticBlue`, and `creamPaper`. Use these as progress bars, borders, or emphasis highlights behind key terms.
* **Hyperbolic Meshes (Gego/Villanueva):** Use `<path>` elements with `fill="none"` and thin `creamPaper` or `abyssalBlue` strokes. Interpolate control points mathematically to create 3D-looking saddle/parabola grids that frame the speaker's shoulders.

---

## 5. Typography, `.SRT` Sync & Texture Overlay

* **Headers:** Geometric, wide-tracked Art Deco/Mid-Century sans-serif (`font-family: 'Montserrat', 'Futura', sans-serif`). All-caps, `fontWeight: 800`, `letterSpacing: '0.15em'`, color `creamPaper`, with a hard-edge drop shadow (`4px 4px 0px #12202F`).
* **Subheaders / Labels:** Monospace or clean geometric sans (`fontWeight: 600`), `letterSpacing: '0.2em'`, housed inside solid `terracotta` or `abyssalBlue` rectangular tags.
* **`.SRT` Driven Triggers:**
  * Parse the input `.srt` file into an array of `{ id, startFrame, endFrame, text, keywords }`.
  * Do not just display subtitles—use specific keywords or timestamps in the `.srt` to automatically trigger `<Sequence from={startFrame} durationInFrames={duration}>` blocks that spawn relevant assets from the **Asset Library**.
* **Vintage Print Texture (Crucial):**
  * For full-screen graphics: Apply a global `<AbsoluteFill>` containing an `<svg>` `<feTurbulence type="fractalNoise" baseFrequency="0.8" />` with `mix-blend-mode: multiply` and `opacity: 0.12`.
  * For transparent overlays: Scope the noise filter strictly inside the `<svg>` `<defs>` of the individual graphic cards using `<feComposite operator="in" in2="SourceGraphic" />` so the transparent background remains 100% clean alpha (`rgba(0,0,0,0)`) for DaVinci Resolve.

---

## 6. Remotion Animation & Audio Sync Principles

1. **Poster-Feel Framerate vs. Smooth Optical Motion:**
   * Step character/object entrances using `const steppedFrame = Math.floor(frame / 2) * 2;` to simulate a stylized **12fps–15fps** vintage poster animation.
   * Keep kinetic optical stripe shifts (`x` offset interpolation) at native **30fps/60fps** for smooth moiré shimmering.
2. **Snappy Brutalist Springs:**
   * All UI cards, architectural blocks, and text banners must enter using a unified Remotion spring configuration:
     ```typescript
     export const KINETIC_SPRING = { damping: 14, mass: 0.8, stiffness: 160 };
     ```
3. **Geometric Reveal:**
   * Animate elements entering the scene via `clip-path` polygon wipes (`polygon(0 0, 100% 0, 100% 100%, 0 100%)`) or staggered `spring` scale-ups along the Y-axis, accompanied by an automatic `<Audio />` SFX trigger on frame `0` of the `<Sequence>`.
4. **Path Following:**
   * Use `@remotion/paths` (`getPointAtLength`, `getTangentAtLength`) to animate indicator nodes, vintage cars, or pointer arrows along sweeping brutalist S-curves pointing toward the speaker or key text.

---

## 7. Persistent Asset & Sound Library System (IDE Architecture)
To ensure that every new graphic and sound you create is saved and reused across future videos, enforce this directory structure and manifest registry in your project:

### A. Recommended Folder Structure
```text
remotion-kinetic-studio/
├── public/
│   ├── sfx/                        # Persistent Sound Effects Library (.wav)
│   └── input/                      # Current video's .mp4, .wav, and .srt files
├── src/
│   ├── styles/
│   │   ├── palette.ts              # Strict Hex Palette & Spring configs
│   │   └── safeZones.ts            # Talking-head layout coordinates
│   ├── assets/
│   │   ├── components/             # Reusable SVG Kinetic Components (.tsx)
│   │   ├── sfx/                    # Audio wrapper components
│   │   └── REGISTRY.md             # AI-readable catalog of all saved assets & SFX
│   ├── utils/
│   │   └── srtParser.ts            # Converts .srt into frame-accurate triggers
│   └── videos/
│       └── [video-slug]/           # Individual video timelines & compositions
```

### B. The Asset & Sound Registry (`REGISTRY.md` Schema)
Every time the AI generates a new reusable visual component or you add a sound effect, append it to the tables below so future prompts can import existing assets before building from scratch:

#### 1. Visual Component Registry
| Asset ID | Component Path | Category | Default Zone | Props Interface | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PosterTitleCard` | `src/assets/components/PosterTitleCard.tsx` | Header / Title | `Zone T` | `{ title: string; subtitle?: string; width?: number; height?: number }` | Iconic Caracas mid-century travel poster header on skyTeal with Soto vibration lines and scalloped clouds. |
| `AvilaFacetCard` | `src/assets/components/AvilaFacetCard.tsx` | Background / Card | `Zone T` | `{ heading: string; bullets: string[]; width?: number }` | Angular mountain-topped brutalist information card with staggered typewriter sync. |
| `BrutalistLowerThird` | `src/assets/components/BrutalistLowerThird.tsx` | Typography | `Zone B` | `{ text: string; subtext?: string; category?: string }` | Heavy concrete/terracotta slab with animated optical stripe spine. |
| `CruzDiezBadge` | `src/assets/components/CruzDiezBadge.tsx` | Kinetic Accent | `Zone R` | `{ title: string; subtitle?: string; size?: number }` | Circular/octagonal moiré stripe frame with rotating Physichromie bands. |
| `ViaductProgress` | `src/assets/components/ViaductProgress.tsx` | Header / Timeline | `Zone T` | `{ progress: number; chapters: string[]; activeChapterIndex?: number }` | Elevated concrete viaduct highway across top tracking video chapters with marker node. |
| `GegoMeshPointer` | `src/assets/components/GegoMeshPointer.tsx` | Connector | `Zone L` | `{ start: [number,number]; end: [number,number]; lineCount?: number }` | Parabolic ruled-surface wireframe mesh connecting speaker shoulder to callout card. |
| `CruzDiezWall` | `src/assets/components/CruzDiezWall.tsx` | Divider / Accent | `Zone B` | `{ width?: number; height?: number; speed?: number }` | Architectural Physichromie stripe wall with vertical columns and a 45° diagonal center slice. |
| `AvilaPeak` | `src/assets/components/AvilaPeak.tsx` | Monument / Badge | `Zone L` | `{ label?: string; sublabel?: string; width?: number; height?: number }` | Faceted mountain summit with Hotel Humboldt monument tower and stepped 12fps entrance. |
| `PetareHill` | `src/assets/components/PetareHill.tsx` | Illustration / Structure | `Zone L` | `{ width?: number; height?: number; seed?: number }` | Procedural hillside community of modular cubic houses with dark windows and zig-zag stairs. |
| `ViaductSweep` | `src/assets/components/ViaductSweep.tsx` | Illustration / Movement | `Zone FULL` | `{ width?: number; height?: number; showCyclist?: boolean }` | Curving elevated concrete viaduct with pillars, Gego hanging nets, vintage car and cyclist. |
| `HyparNet` | `src/assets/components/HyparNet.tsx` | Sculpture / Accent | `Zone R` | `{ width?: number; height?: number; variant?: 'hypar' | 'icosa' }` | Hyperbolic paraboloid ruled wire mesh on concrete poles or rotating wireframe polyhedron. |
| `ForegroundFrame` | `src/assets/components/ForegroundFrame.tsx` | Framing | `Zone B` | `{ width?: number; height?: number; showStoneWall?: boolean; showFoliage?: boolean }` | Stone masonry wall and lush tropical foliage framing the lower chest and shoulders. |
| `KineticCaption` | `src/assets/components/KineticCaption.tsx` | Captions | `Zone B` | `{ width?: number }` | Brutalist active word-by-word highlighted captions synced to speech cues. |

#### 2. Sound Effects (SFX) Registry
*Rule: Physical modeling SFX system with 4 round-robin acoustic variants per instrument (20 `.wav` files in `public/sfx/`) + custom foley drop-in slot.*

| SFX ID | File Paths (`public/sfx/`) | Variants | Sonic Character | Trigger Rule |
| :--- | :--- | :--- | :--- | :--- |
| `SFX_PAPER_SNAP` | `paper_snap_01..04.wav` | 4 | Crisp vintage cardstock snap & card flip | Trigger on frame `0` of Zone L/R card entrances. |
| `SFX_BRUTAL_THUD` | `brutal_thud_01..04.wav` | 4 | Low-end mechanical architectural stamp | Trigger when BrutalistLowerThird or heavy architecture locks in. |
| `SFX_WIRE_SWISH` | `wire_swish_01..04.wav` | 4 | Metallic springy ruled-surface whoosh | Trigger when GegoMeshPointer, HyparNet, or Viaduct lines draw on. |
| `SFX_TYPE_CLACK` | `type_clack_01..04.wav` | 4 | Mechanical letterpress clack | Trigger per word or bullet reveal on kinetic emphasis. |
| `SFX_KINETIC_HUM` | `kinetic_hum_01..04.wav` | 4 | Warm analog synth optical shimmer | Trigger during continuous Cruz-Diez / Soto moiré shifts. |
| `CUSTOM_FOLEY` | `user_foley_*.wav` | slot | User drop-in field recording / custom sound | Drop into `public/sfx/` to override procedural sounds. |

---

## 8. DaVinci Resolve (Free Version) Delivery Workflow
Because DaVinci Resolve Free on Windows/Linux does not natively decode ProRes 4444 in all wrappers and lacks Studio AI masking, use these exact Remotion export pipelines:

### Option A: Transparent Alpha Overlay (Recommended for Talking Head)
Render your Remotion composition with `background: "transparent"` into a **WebM (VP9 with Alpha)** or **QuickTime PNG / ProRes 4444** container, with all synced SFX baked into the audio track:
```bash
npx remotion render src/index.ts TalkingHeadOverlay out/overlay.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le
```
*(If DaVinci Resolve Free on your OS rejects `.mov` ProRes 4444, render an **Image Sequence (`--sequence --image-format=png`)** + separate `.wav` audio via `npx remotion render ... out/audio.wav`, then drag the PNG folder into DaVinci Resolve's Media Pool as a single clip—Resolve Free supports PNG alpha sequences natively with zero quality loss).*

### Option B: Multiply / Screen Blend Overlays
For pure kinetic line art (`GegoMeshPointer`) or full-screen vintage paper grain overlays, render standard `.mp4` (H.264) on a solid `#000000` or `#FFFFFF` background and set the clip's **Composite Mode** in DaVinci Resolve's Inspector to **Screen** or **Multiply**.

---

## 9. Master Prompt Template for AI Code Generation (Google Flash AI / Antigravity IDE)

Copy and paste the prompt below into your IDE chat whenever you start a new video or scene:

> **System Prompt:**
> "Act as my Lead Creative Technologist & Motion Graphics Director specializing in Remotion, React, TypeScript, and procedural SVG art.
> 
> **Context & Inputs:**
> 1. Read `@remotion_kinetic_style_guide.md` and `@src/assets/REGISTRY.md` before writing any code.
> 2. I am providing a talking-head video (`1920x1080`, chest-up subject in the center) along with its `.srt` subtitle file and transcript.
> 
> **Strict Execution Rules:**
> 1. **Respect the Subject:** Never place solid shapes or text inside the Subject Exclusion Zone (`X: 600–1320, Y: 180–820`). Place all visual callouts in `Zone L` (`X: 80–620`), `Zone R` (`X: 1300–1840`), `Zone T` (`Y: 40–160`), or `Zone B` (`Y: 820–1000`). Keep the root composition background `transparent` unless a full-screen cutaway is explicitly requested.
> 2. **Visual Style:** Strictly follow the 'Venezuelan Mid-Century Kinetic Poster' style. Use ONLY flat SVG shapes (`<path>`, `<polygon>`, `<rect>`, `<line>`) with zero color gradients, strict `PALETTE` hex codes, Cruz-Diez optical stripes, Gego parabolic meshes, and scoped `<feTurbulence>` paper grain.
> 3. **Asset & Sound Reuse:** Check `REGISTRY.md` first. Reuse existing components and attach `<Audio />` tags from `public/sfx/` to every `<Sequence>` entrance.
> 4. **Auto-Save New Assets:** If you create a new visual motif or graphic widget for this video, extract it as a clean, typed, reusable component in `src/assets/components/[ComponentName].tsx` and output the exact Markdown row to append to `REGISTRY.md` so my library grows automatically.
> 5. **SRT Sync:** Convert the `.srt` timestamps into exact frame numbers (`fps = 30`) and orchestrate `<Sequence>` blocks that dynamically illustrate my spoken points."