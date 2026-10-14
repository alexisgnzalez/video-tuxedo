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

### 🔮 Roadmap & Upcoming Tools

- [ ] **Silence Cutter & Jump Cuts**: Automatically detect audio dead air and pauses, cutting them with lossless stream copy or exporting DaVinci Resolve timeline edits (`.fcpxml` / `.edl`).
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
