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
  - Automatically maps every take to **Video Track 1 (V1)** and synchronized audio to **Audio Tracks 1 & 2 (A1 & A2)** with linked clips.
  - Preserves vertical smartphone resolution (e.g. `720x1280` or `1080x1920`) and sample-accurate timecodes.
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
   - **Resolution for vertical/smartphone videos:** Uncheck *"Use project settings"* if you want DaVinci to adopt the vertical resolution from the XML. If your timeline ever opens as horizontal, right-click the timeline in the Media Pool > **Timelines > Timeline Settings...** > check **"Use Vertical Resolution"**.
2. **Via FCPXML (.fcpxml)**: In DaVinci Resolve, go to **File > Import > Timeline...** and select the `*_cuts.fcpxml` file.
3. **Via EDL (.edl)**: In DaVinci Resolve, go to **File > Import > Timeline... > EDL...** and select the `*_cuts.edl` file.
4. **Add Synced Subtitles**: Go to **File > Import > Subtitle...** and select your `*_cut_subtitles.srt` file. Track `ST1` will populate with subtitles matching every jump cut!

---

### 🔮 Roadmap & Upcoming Tools

- [x] **Auto Subtitles for DaVinci Resolve Free** (Waveform-aligned Whisper AI speech-to-text)
- [x] **Silence Cutter & Jump Cuts** (100% Lossless DaVinci FCPXML/EDL, Single/Multipart MP4, Synced SRT)
- [ ] **AI Video Background Remover**: Automated video rotoscoping without a green screen, exporting transparent ProRes 4444 or alpha matte masks for DaVinci.

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
