# Video Tuxedo 🐧🎬

A collection of tools and utilities designed to make your video editing workflow smoother, faster, and more enjoyable.

## 🚀 Overview

**Video Tuxedo** is a modular suite of video editing helper tools. From automating repetitive editing tasks to bridging gaps in free editing software, Video Tuxedo is built to streamline your video production pipeline.

> 📝 **Notice**: This README is continuously updated every time a new feature or tool is added to the project.

---

## ✨ Features & Tools

### 1. 🎙️ Auto Subtitles for DaVinci Resolve Free *(New!)*
Automatic speech-to-text is normally locked behind the paid DaVinci Resolve Studio edition. This tool brings fast, free, and accurate subtitles to **DaVinci Resolve Free** users without needing any subscription or cloud API keys.

- **Local AI Transcription**: Powered by `faster-whisper` running 100% locally and privately on your machine.
- **Waveform-Aligned Silence Splitting**: Subtitle cues are automatically split on audio pauses and speech bursts (word-level precision), eliminating awkward lingering subtitles over silent waveform gaps.
- **Pacing Control**: Select between *Natural* (4–6 words), *Punchy/Reels* (2–4 words), and *Broadcast* (7–10 words), with instant re-segmentation.
- **Universal Input**: Select files via drag-and-drop, file browser, or direct macOS directory path (`.mp4`, `.mov`, `.mkv`, `.webm`, `.mp3`, `.wav`, `.m4a`, `.aac`).
- **Real-Time Waveform & Video Sync**: Built-in player with synchronized audio waveform visualizer and click-to-seek subtitle navigation.
- **Interactive Editor**: Edit subtitle text in-line, adjust cues, and add/delete subtitle blocks before exporting.
- **DaVinci-Optimized .SRT Export**: Exports strict SubRip (`.srt`) files formatted specifically to import seamlessly into DaVinci Resolve Free's subtitle tracks (`ST1`). Automatically writes directly to `~/Downloads/`.

#### 💡 How to Import into DaVinci Resolve Free:
1. Open your project in DaVinci Resolve and switch to the **Edit** page (`Shift + 4`).
2. Go to **File > Import > Subtitle...** (or drag the exported `.srt` file into the **Media Pool**).
3. Drag the subtitle clip onto your timeline to automatically create an orange **Subtitle Track (ST1)**.
4. Select the subtitle track and customize the font, size, outline, and background box in the **Inspector** tab.

---

### 2. ✂️ Silence Cutter & Jump Cuts *(New!)*
Automatically detect dead air, pauses, and breath gaps in any video, removing them with surgical precision to produce jump-cut edits.

- **100% Free & Local Silero VAD**: Powered by Silero Voice Activity Detection running entirely offline on your Mac. Analyzes 1 hour of audio in ~3 seconds with zero cloud fees or API keys.
- **100% Lossless DaVinci Resolve Timeline (FCP 7 XML, FCPXML & CMX 3600 EDL)**:
  - Generates native timeline sequences that reference your original camera master file directly.
  - Automatically maps every take to **Video Track 1 (V1)** and synchronized audio to a single clean **Audio Track 1 (A1)** with linked clips.
  - Defaults vertical smartphone resolution to Full HD **1080x1920** (9:16) with sample-accurate timecodes.
  - **Zero re-encoding, zero compression, and 100% original camera sensor quality and bit depth preserved.**
- **✨ Cut-Synchronized Subtitles (.SRT)**:
  - Subtitle timecodes are automatically re-calculated and shifted to match the jump-cut timeline.
  - Drop the generated `.srt` directly into DaVinci Resolve's `ST1` track, and all subtitles snap onto the cut frames automatically!
- **⚡ Hardware-Accelerated Single Video (.MP4)**:
  - Renders all active speech takes into a single seamless video using Apple Silicon `h264_videotoolbox` hardware encoding in seconds.
- **📦 Multipart Takes Package (.ZIP & Folder)**:
  - Slices each speech take into an individual clip (`take_01.mp4`, `take_02.mp4`...) and bundles a ZIP for easy organization and sharing.
- **🎧 Live In-Browser Jump-Cut Preview**:
  - Built-in video player dynamically skips silences in real time so you can preview the jump-cut pacing before exporting.
- **Interactive Proportional Visual Cut Map**:
  - Visual timeline bar showing green speech takes and striped terracotta silence cuts. Click any block to seek instantly.
- **Automatic Downloads**:
  - All rendered videos, takes ZIPs, timelines, and subtitles are automatically saved directly to your macOS `~/Downloads/` directory.

#### 💡 How to Import Timelines into DaVinci Resolve:
1. **Via DaVinci XML (.xml) — Recommended**:
   - In DaVinci Resolve, go to **File > Import > Timeline...** and select the `*_cuts.xml` file.
   - In the *Load XML...* popup dialog, make sure **"Automatically import source clips into media pool"** is checked.
   - **Resolution for vertical/smartphone videos:** Uncheck *"Use project settings"* if you want DaVinci to adopt the default Full HD vertical resolution (`1080x1920`). If your timeline ever opens as horizontal, right-click the timeline in the Media Pool > **Timelines > Timeline Settings...** > check **"Use Vertical Resolution"**.
2. **Via FCPXML (.fcpxml)**: In DaVinci Resolve, go to **File > Import > Timeline...** and select the `*_cuts.fcpxml` file.
3. **Via EDL (.edl)**: In DaVinci Resolve, go to **File > Import > Timeline... > EDL...** and select the `*_cuts.edl` file.
4. **Add Synced Subtitles**: Go to **File > Import > Subtitle...** and select your `*_cut_subtitles.srt` file. Track `ST1` will populate with subtitles matching every jump cut!

---

### 3. 🪄 Magic Mask & AI Rotoscoper *(New!)*
Point-and-click AI rotoscoper inspired by DaVinci Resolve Studio's Magic Mask. Paint simple strokes over any subject—talking heads, people, products, or objects—and the AI tracks and segments it across every video frame.

- **100% Offline SAM 2.1 Engine**: Class-agnostic visual segmentation powered by Meta's Segment Anything 2.1 Tiny (`sam2.1_t.pt`), accelerated locally by Apple Silicon MPS (`torch`).
- **Interactive In-Browser Canvas**:
  - Green brush for foreground (Keep Subject), Red brush for background (Exclude).
  - Multi-size brushes (8px, 20px, 45px), unlimited Undo, and single-click clear.
  - Live segmentation preview in **~350ms** with 3 selectable display styles:
    - **DaVinci Magenta Glow**: Classic DaVinci Resolve Magic Mask stroke overlay.
    - **Cutout Transparency**: Real-time RGBA cutout displayed over an alpha checkerboard.
    - **B&W Matte**: High-contrast black & white luminance mask preview.
- **Edge Refinements (Feather & Choke)**:
  - **Feather (Softness)**: Gaussian sub-pixel edge blur to eliminate harsh pixel borders around hair and silhouettes.
  - **Expand / Shrink (Choke)**: Morphological dilation/erosion to remove halo fringes or expand borders.
- **Selective Range Clipping**:
  - `[ Set In ]` and `[ Set Out ]` scrubber points or instant `[ 5s Clip ]` button for rapid testing and focused rotoscoping.
- **⚡ Native Apple ProRes 4444 (.MOV) with 10-Bit Alpha**:
  - **Zero intermediate PNG files**: Direct BGRA memory piping into high-fidelity QuickTime ProRes 4444 (`yuva444p10le / yuva444p12le`) with original synchronized audio.
  - Directly importable into **DaVinci Resolve Free** onto Video Track 2 (`V2`) above Video Track 1 (`V1`) with native transparency—no keying, green screen, or Studio license required!
- **Additional Export Formats**:
  - **Black & White Alpha Matte (.MP4)**: Clean luminance mask for DaVinci Resolve Color page External Matte or Fusion inputs.
  - **Chroma Green Screen (.MP4)**: Subject composited over pure `#00FF00` green for universal chroma keying.
  - **Cinematic Background Blur (.MP4)**: Subject stays razor sharp while the background is smoothly blurred for portrait depth-of-field.
- **Automatic Downloads**:
  - Rendered files save automatically directly to your macOS `~/Downloads/` directory.

#### 💡 How to Use ProRes 4444 Alpha in DaVinci Resolve Free:
1. In DaVinci Resolve, drag the exported `*_magic_mask_prores_alpha.mov` into your **Media Pool**.
2. Place your background video, graphics, b-roll, or animated text on **Video Track 1 (V1)**.
3. Drag the ProRes 4444 clip onto **Video Track 2 (V2)** directly above it.
4. Your subject appears with 100% native transparency—no green screen or Studio license needed!

---

### 4. 📐 Motion Graphics Studio (Remotion + DaVinci Resolve Free) *(New!)*
A procedural motion graphics engine and interactive web studio inspired by **1950s Caracas Mid-Century Modern Travel Posters** (*"El Ávila y su cinetismo"*, *"Petare y su modernismo"*), **Venezuelan Kinetic Art** (Cruz-Diez, Soto, Gego), and **Tropical Brutalism** (Villanueva). Engineered specifically for **9:16 vertical short-form video** (TikTok, Reels, Shorts) to frame and complement talking-head creators.

- **Subject-Respecting Safe Zones**:
  - Dynamically respects the speaker's face, eyes, and chest using an Exclusion Zone (`X: 180–900, Y: 420–1420`).
  - Active graphic placement across designated zones: **Zone T** (Canopy/Header), **Zone L** (Left Shoulder Flank), **Zone R** (Right Shoulder Flank), **Zone B** (Lower Third / Captions), and **Zone FULL** (Full-bleed poster plate).
  - Platform margin presets for **TikTok / Reels** (clearing UI buttons & captions) or **Clean / Raw**.
  - Optional YOLOv8 AI subject tracking to dynamically adapt zones across movement.
- **13 Modular Kinetic Components**:
  - `PosterTitleCard`: Iconic mid-century travel poster header on skyTeal with Soto vibration lines and cream clouds.
  - `AvilaFacetCard`: Brutalist mountain-top information card with staggered bullet points.
  - `BrutalistLowerThird`: Heavy concrete and terracotta lower-third slab with animated optical stripe spine.
  - `CruzDiezBadge`: Rotating circular/octagonal moiré stripe badge with Physichromie color cycling.
  - `ViaductProgress`: Elevated concrete viaduct highway tracking video chapters with an animated marker node.
  - `GegoMeshPointer`: Parabolic ruled-surface wireframe mesh connecting speaker shoulder to callout cards.
  - `CruzDiezWall`: Architectural Physichromie wall with vertical columns and a 45° diagonal slice.
  - `AvilaPeak`: Faceted mountain summit with Hotel Humboldt monument tower and stepped 12fps entrance.
  - `PetareHill`: Procedural hillside community of modular cubic homes with dark windows and zig-zag staircases.
  - `ViaductSweep`: Sweeping elevated concrete viaduct with pillars, Gego hanging nets, vintage car, and cyclist.
  - `HyparNet`: Hyperbolic paraboloid ruled wire mesh or rotating wireframe polyhedron.
  - `ForegroundFrame`: Stone masonry wall and tropical foliage framing the lower chest and shoulders.
  - `KineticCaption`: Brutalist word-by-word active highlighted captions synced with speech timecodes.
- **Offline Spanish Speech-to-Visual Rule Engine**:
  - Automatically drafts a complete Scene Plan JSON from subtitles (`.srt`) or auto-transcribes via local Whisper.
  - Spanish lexicon triggers appropriate visual metaphors (e.g., "crecimiento / comunidad / modular" → `PetareHill`; "conectar / camino / progreso" → `ViaductSweep` or `ViaductProgress`; "cinético / arte / color" → `CruzDiezWall`; "clave / primero" → `AvilaFacetCard`).
- **Physical Modeling SFX Synthesis**:
  - 20 synthesized `.wav` audio files (4 round-robin acoustic variants per instrument) generated with zero cloud dependencies:
    - `SFX_PAPER_SNAP`: Crisp vintage cardstock snap & card flip.
    - `SFX_BRUTAL_THUD`: Heavy low-end mechanical architectural stamp.
    - `SFX_WIRE_SWISH`: Metallic springy ruled-surface whoosh.
    - `SFX_TYPE_CLACK`: Mechanical letterpress typewriter clack.
    - `SFX_KINETIC_HUM`: Warm analog synth optical shimmer.
  - Drop-in custom foley slot (`public/sfx/user_foley_*.wav`) for user field recordings.
- **Interactive In-Browser Studio UI**:
  - Live preview powered by bundled `@remotion/player`.
  - Multi-lane interactive timeline (Track 1 Headers, Track 2 Left Flank, Track 3 Right Flank, Track 4 Lower Thirds, Track 5 Audio SFX).
  - Component Inspector: live edit props, titles, subtitles, bullets, colors, and SFX triggers.
  - Asset Library sidebar: one-click preview and insertion of any component from the registry.
- **⚡ Apple ProRes 4444 (.MOV) with 10-Bit Alpha**:
  - Headless Remotion rendering engine exports QuickTime ProRes 4444 (`yuva444p10le`) with synchronized SFX audio.
  - Zero green screen, zero keying, and 100% native transparency.
  - Rendered files save automatically directly to your macOS `~/Downloads/` directory.

#### 💡 How to Use Motion Overlays in DaVinci Resolve Free:
1. Drag the exported `*_motion_overlay.mov` into your **Media Pool**.
2. Place your talking head video clip on **Video Track 1 (V1)** and its audio on **Audio Track 1 (A1)**.
3. Drag the motion overlay clip onto **Video Track 2 (V2)** directly above your footage. Its synchronized sound effects will automatically populate **Audio Track 2 (A2)**.
4. The graphics, posters, and animations appear with 100% native transparency over your video with no keying or paid Studio license required!

### 5. 🎬 Tuxedo Editor (End-to-End Creator Studio) *(New!)*
Complete all-in-one studio: Upload, non-destructive silence cuts, local Whisper subtitles with Gemini Flash comedic polish, AI subject rotoscoping for 3-layer sandwich visual effects, and multi-style kinetic motion graphics.

- **Non-Destructive EDL Timeline**: Split clips, drag to reorder, trim in/out handles with instant scrubbing.
- **Audio Micro-Crossfades**: Eliminates zero-crossing clicks and pops between jump-cut speech boundaries with 15ms hardware audio fades.
- **Local Whisper & Gemini Flash Polish**: High-speed speech transcription mapped across the edited timeline with optional free Gemini Flash proofreading (preserving audio synchronization).
- **3-Layer Sandwich VFX**: AI speaker matte extraction with YOLO-Seg / SAM 2.1 placing big bold headlines and stickers directly behind your shoulders.
- **Pluggable Style Registry**: Comedic Storytelling (*StoryTuxedo*), *Caracas Mid-Century Kinetic*, and *Clean Minimalist*.
- **Multi-Format Export**: Full-composite 1080x1920 MP4 with 9:16 safe zones, Apple ProRes 4444 Alpha transparent overlays, ProRes 422 HQ broadcast master, SubRip (.SRT) files, and complete Project Backup ZIPs.

---

### 🔮 Roadmap & Upcoming Tools

- [x] **Auto Subtitles for DaVinci Resolve Free** (Waveform-aligned Whisper AI speech-to-text)
- [x] **Silence Cutter & Jump Cuts** (100% Lossless DaVinci FCPXML/EDL, Single/Multipart MP4, Synced SRT)
- [x] **Magic Mask & AI Rotoscoper** (Apple ProRes 4444 10-bit Alpha, B&W Matte, Green Screen, Blur)
- [x] **Motion Graphics Studio** (Caracas Mid-Century Kinetic Poster, 9:16 Vertical, Remotion, ProRes 4444 Alpha)
- [x] **Tuxedo Editor (End-to-End)** (Non-Destructive EDL, Whisper AI, 3-Layer Sandwich VFX, Multi-Style Graphics)
- [ ] **AI Video Eye Contact Fix**: Local gaze redirection for talking head videos.

---

## 🛠️ Getting Started

### Prerequisites
- Python 3.9+
- macOS / Linux / Windows

### Quick Start
Clone the repository and run the launcher:

```bash
git clone https://github.com/alexisgnzalez/video-tuxedo.git
cd video-tuxedo

# Launch with one command (creates virtualenv & installs dependencies automatically)
./run.sh
```

Or run manually:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server.app:app --host 127.0.0.1 --port 8000 --reload
```

Then open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## 📄 License

MIT
