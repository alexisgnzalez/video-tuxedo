from __future__ import annotations

import os
import wave
import struct
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SFX_DIR = BASE_DIR / "motion-studio" / "public" / "sfx"
FOLEY_DIR = SFX_DIR / "foley"
SFX_DIR.mkdir(parents=True, exist_ok=True)
FOLEY_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 44100


def save_wav(filepath: Path | str, samples: np.ndarray, sample_rate: int = SAMPLE_RATE):
    """Saves 1D float numpy array (-1.0 to 1.0) as 16-bit PCM WAV."""
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767.0).astype(np.int16)
    
    with wave.open(str(filepath), "wb") as wf:
        wf.setnchannels(1)  # mono
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(int_samples.tobytes())


def synth_paper_snap(variant: int = 1) -> np.ndarray:
    """Crisp vintage cardstock snap (80ms - 110ms)."""
    np.random.seed(100 + variant * 33)
    duration = 0.09 + (variant - 1) * 0.01
    num_samples = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    
    # Noise burst
    noise = np.random.uniform(-1.0, 1.0, num_samples)
    
    # Sharp exponential decay
    decay_rate = 55.0 + (variant * 5.0)
    envelope = np.exp(-decay_rate * t)
    
    # High-pass / band-pass filter approximation with resonant peaks (cardstock snap)
    snap_freq = 2800.0 + (variant - 2.5) * 220.0
    body_resonance = np.sin(2 * np.pi * snap_freq * t) * np.exp(-70.0 * t)
    
    out = (noise * envelope * 0.7) + (body_resonance * 0.3)
    # Fast initial click
    click_len = int(0.004 * SAMPLE_RATE)
    out[:click_len] += np.random.uniform(0.5, 1.0, click_len)
    
    # Normalize
    out = out / (np.max(np.abs(out)) + 1e-6)
    return out * 0.85


def synth_brutal_thud(variant: int = 1) -> np.ndarray:
    """Low-end mechanical architectural stamp (180ms - 240ms)."""
    np.random.seed(200 + variant * 41)
    duration = 0.22 + (variant - 1) * 0.015
    num_samples = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    
    # Pitch drop from ~130Hz down to ~42Hz
    start_freq = 135.0 + (variant - 2.5) * 12.0
    end_freq = 42.0 + (variant - 2.5) * 4.0
    freq_sweep = start_freq * np.exp(-18.0 * t) + end_freq
    phase = 2 * np.pi * np.cumsum(freq_sweep) / SAMPLE_RATE
    
    sub_thud = np.sin(phase) * np.exp(-14.0 * t)
    
    # Overdrive sub-harmonics for weight
    sub_thud = np.tanh(sub_thud * 1.5)
    
    # Low-end noise impact transient
    noise_env = np.exp(-45.0 * t)
    noise_impact = np.random.uniform(-0.4, 0.4, num_samples) * noise_env
    
    out = (sub_thud * 0.75) + (noise_impact * 0.25)
    out = out / (np.max(np.abs(out)) + 1e-6)
    return out * 0.90


def synth_wire_swish(variant: int = 1) -> np.ndarray:
    """Metallic springy ruled-surface whoosh (150ms - 210ms)."""
    np.random.seed(300 + variant * 29)
    duration = 0.18 + (variant - 1) * 0.012
    num_samples = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    
    # Metallic wire whoosh sweep: rises then drops
    f_center = 1200.0 + (variant - 2.5) * 140.0
    sweep = f_center + 900.0 * np.sin(np.pi * t / duration)
    phase = 2 * np.pi * np.cumsum(sweep) / SAMPLE_RATE
    
    wire_whistle = np.sin(phase) * np.sin(np.pi * t / duration)
    # Add metallic harmonic
    wire_whistle += 0.4 * np.sin(phase * 2.3) * np.sin(np.pi * t / duration)
    
    # Air whoosh noise
    noise = np.random.uniform(-1.0, 1.0, num_samples)
    noise_env = (np.sin(np.pi * t / duration) ** 2) * 0.5
    
    out = (wire_whistle * 0.55) + (noise * noise_env * 0.45)
    out = out / (np.max(np.abs(out)) + 1e-6)
    return out * 0.80


def synth_type_clack(variant: int = 1) -> np.ndarray:
    """Mechanical letterpress clack (40ms - 60ms)."""
    np.random.seed(400 + variant * 19)
    duration = 0.055 + (variant - 1) * 0.005
    num_samples = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    
    # Initial metal slug impact click (2ms)
    slug_click = np.zeros(num_samples)
    click_samples = int(0.003 * SAMPLE_RATE)
    slug_click[:click_samples] = np.random.uniform(0.6, 1.0, click_samples)
    
    # Key strike ping (~3400Hz)
    ping_freq = 3400.0 + (variant - 2.5) * 260.0
    ping = np.sin(2 * np.pi * ping_freq * t) * np.exp(-110.0 * t)
    
    # Platen thump (~240Hz)
    thump = np.sin(2 * np.pi * 240.0 * t) * np.exp(-75.0 * t)
    
    out = (slug_click * 0.4) + (ping * 0.35) + (thump * 0.25)
    out = out / (np.max(np.abs(out)) + 1e-6)
    return out * 0.75


def synth_kinetic_hum(variant: int = 1) -> np.ndarray:
    """Warm analog synth optical shimmer (1.5s - 2.0s loopable hum)."""
    np.random.seed(500 + variant * 53)
    duration = 1.8
    num_samples = int(duration * SAMPLE_RATE)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    
    base_f = 110.0 + (variant - 2.5) * 3.0  # ~A2
    # LFO tremolo
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t)
    
    # Warm rich analog harmonics: fundamental + 2nd + 3rd + 5th
    fund = np.sin(2 * np.pi * base_f * t)
    h2 = 0.5 * np.sin(2 * np.pi * (base_f * 2) * t + 0.3)
    h3 = 0.25 * np.sin(2 * np.pi * (base_f * 3) * t + 0.8)
    h5 = 0.12 * np.sin(2 * np.pi * (base_f * 5) * t)
    
    # Subtle analog chorus detune
    detune = 0.3 * np.sin(2 * np.pi * (base_f * 1.008) * t)
    
    tone = (fund + h2 + h3 + h5 + detune) * (0.8 + 0.2 * lfo)
    
    # Smooth fade-in and fade-out for seamless looping
    fade_len = int(0.05 * SAMPLE_RATE)
    fade_in = np.linspace(0, 1, fade_len)
    fade_out = np.linspace(1, 0, fade_len)
    tone[:fade_len] *= fade_in
    tone[-fade_len:] *= fade_out
    
    out = tone / (np.max(np.abs(tone)) + 1e-6)
    return out * 0.65


SFX_GENERATORS = {
    "sfx_paper_snap": synth_paper_snap,
    "sfx_brutal_thud": synth_brutal_thud,
    "sfx_wire_swish": synth_wire_swish,
    "sfx_type_clack": synth_type_clack,
    "sfx_kinetic_hum": synth_kinetic_hum,
}


def generate_all_sfx(force_overwrite: bool = True) -> int:
    """
    Generates all 20 SFX variant WAV files into motion-studio/public/sfx/.
    If custom user foley exists in public/sfx/foley/<name>.wav, shifts that sample.
    """
    count = 0
    for base_name, gen_fn in SFX_GENERATORS.items():
        # Check if custom user foley sample exists
        foley_sample_path = FOLEY_DIR / f"{base_name}.wav"
        has_foley = foley_sample_path.exists()
        
        for v in range(1, 5):
            out_file = SFX_DIR / f"{base_name}_v{v}.wav"
            if out_file.exists() and not force_overwrite:
                continue
                
            if has_foley:
                # Load foley file and apply subtle pitch/eq variant
                try:
                    with wave.open(str(foley_sample_path), "rb") as wf:
                        n_frames = wf.getnframes()
                        raw_data = wf.readframes(n_frames)
                        samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32767.0
                        # Slight pitch variation by resampling
                        pitch_factor = 1.0 + (v - 2.5) * 0.03
                        indices = np.arange(0, len(samples), pitch_factor)
                        indices = indices[indices < len(samples)].astype(int)
                        samples = samples[indices]
                        save_wav(out_file, samples)
                        count += 1
                        continue
                except Exception as e:
                    print(f"⚠️ Error reading foley sample {foley_sample_path}: {e}")
            
            # Procedural synthesis fallback
            samples = gen_fn(variant=v)
            save_wav(out_file, samples)
            count += 1
            
    print(f"✅ Generated {count} SFX variant files in {SFX_DIR}")
    return count


if __name__ == "__main__":
    generate_all_sfx(force_overwrite=True)
