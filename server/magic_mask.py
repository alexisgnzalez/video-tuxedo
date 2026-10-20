"""
Video Tuxedo - Magic Mask & Rotoscoping Engine (Tool 3)
Powered by Segment Anything 2.1 (SAM 2.1) on Apple Silicon MPS.
Exports Apple ProRes 4444 with native 10-bit Alpha channel (.mov)
for seamless drag-and-drop compositing in DaVinci Resolve Free.
Includes hardware-accelerated ProRes VideoToolbox encoding and smart stroke interpretation.
"""

import os
import sys
import time
import math
import base64
import subprocess
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable, Tuple

import cv2
import numpy as np
import torch
import imageio_ffmpeg
from ultralytics import SAM, YOLO
from ultralytics.models.sam import SAM2VideoPredictor


_MODEL_CACHE: Dict[str, Any] = {}
_HARDWARE_PRORES_CACHE: Optional[bool] = None

DOWNLOADS_DIR = Path.home() / "Downloads"
BASE_DIR = Path(__file__).resolve().parent.parent
SAM_MODEL_PATH = BASE_DIR / "sam2.1_t.pt"
YOLO_SEG_PATH = BASE_DIR / "yolov8m-seg.pt"
if not YOLO_SEG_PATH.exists():
    YOLO_SEG_PATH = BASE_DIR / "yolov8n-seg.pt"


def get_torch_device() -> str:
    """Returns 'mps' on Apple Silicon if available, otherwise 'cpu'."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def is_hardware_prores_available() -> bool:
    """Detects if Apple Silicon VideoToolbox ProRes 4444 encoder is supported."""
    global _HARDWARE_PRORES_CACHE
    if _HARDWARE_PRORES_CACHE is not None:
        return _HARDWARE_PRORES_CACHE

    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        res = subprocess.run([ffmpeg_exe, "-encoders"], capture_output=True, text=True, timeout=5)
        _HARDWARE_PRORES_CACHE = "prores_videotoolbox" in res.stdout
    except Exception:
        _HARDWARE_PRORES_CACHE = False

    return _HARDWARE_PRORES_CACHE


def get_yolo_seg_model():
    """Loads and caches YOLO Segmentation model instance for instant person rotoscoping."""
    global _MODEL_CACHE
    device = get_torch_device()
    cache_key = f"yolo_seg_{device}"

    if cache_key not in _MODEL_CACHE:
        if not YOLO_SEG_PATH.exists():
            raise FileNotFoundError(f"YOLO-seg checkpoint not found at {YOLO_SEG_PATH}")
        print(f"🧠 Loading YOLO-Seg on {device.upper()} ({YOLO_SEG_PATH.name})...")
        model = YOLO(str(YOLO_SEG_PATH))
        _MODEL_CACHE[cache_key] = model
        print("✅ YOLO-Seg model ready in memory.")

    return _MODEL_CACHE[cache_key]


def get_sam_model():
    """Loads and caches SAM 2.1 Tiny model instance for arbitrary objects."""
    global _MODEL_CACHE
    device = get_torch_device()
    cache_key = f"sam_{device}"

    if cache_key not in _MODEL_CACHE:
        if not SAM_MODEL_PATH.exists():
            raise FileNotFoundError(f"SAM 2.1 model checkpoint not found at {SAM_MODEL_PATH}")
        print(f"🧠 Loading SAM 2.1 on {device.upper()} ({SAM_MODEL_PATH.name})...")
        model = SAM(str(SAM_MODEL_PATH))
        _MODEL_CACHE[cache_key] = model
        print("✅ SAM 2.1 model ready in memory.")

    return _MODEL_CACHE[cache_key]


def get_video_info(media_path: str) -> Dict[str, Any]:
    """Inspects video resolution, framerate, duration and frame count."""
    cap = cv2.VideoCapture(media_path)
    if not cap.isOpened():
        raise ValueError(f"Unable to open media file: {media_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0.0

    cap.release()
    return {
        "width": width,
        "height": height,
        "fps": round(fps, 3),
        "total_frames": total_frames,
        "duration": round(duration, 3),
    }


def extract_frame_at_timestamp(media_path: str, timestamp_s: float = 0.0) -> Dict[str, Any]:
    """
    Extracts a single high-resolution video frame at the given timestamp in seconds.
    Returns RGB image and Base64-encoded JPEG for immediate client rendering.
    """
    if not os.path.exists(media_path):
        raise FileNotFoundError(f"Media file not found: {media_path}")

    cap = cv2.VideoCapture(media_path)
    if not cap.isOpened():
        raise ValueError(f"Unable to open media file: {media_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0.0

    target_frame = max(0, min(int(round(timestamp_s * fps)), total_frames - 1))
    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)

    ret, frame_bgr = cap.read()
    cap.release()

    if not ret or frame_bgr is None:
        raise RuntimeError(f"Could not read frame at timestamp {timestamp_s}s (frame {target_frame})")

    height, width = frame_bgr.shape[:2]

    # Encode to JPEG for fast browser transmission
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
    ret_enc, jpeg_bytes = cv2.imencode(".jpg", frame_bgr, encode_param)
    if not ret_enc:
        raise RuntimeError("Failed to encode video frame to JPEG")

    b64_str = base64.b64encode(jpeg_bytes).decode("utf-8")
    data_uri = f"data:image/jpeg;base64,{b64_str}"

    return {
        "timestamp_s": round(timestamp_s, 3),
        "frame_idx": target_frame,
        "total_frames": total_frames,
        "width": width,
        "height": height,
        "fps": round(fps, 3),
        "duration": round(duration, 3),
        "image_data_uri": data_uri,
    }


def smart_filter_points(
    points: List[List[float]],
    labels: List[int],
    width: int,
    height: int,
    max_pos: int = 10,
    max_neg: int = 6,
) -> Tuple[List[List[float]], List[int]]:
    """
    Filters and transforms user stroke points to prevent SAM point explosion:
    1. If the user drew a closed outline/loop around the subject, automatically
       computes true interior points inside the polygon plus boundary negatives.
    2. Subsamples long dense strokes (e.g. 200+ points) down to max_pos / max_neg
       evenly spaced prompt points to ensure peak SAM 2.1 inference accuracy.
    """
    if not points or not labels:
        return [], []

    pos_pts = [p for p, l in zip(points, labels) if l == 1]
    neg_pts = [p for p, l in zip(points, labels) if l == 0]

    # 1. Detect if pos_pts form a closed loop (user traced the subject perimeter)
    is_loop = False
    if len(pos_pts) >= 8:
        pts_arr = np.array(pos_pts, dtype=np.float32)
        start_pt = pts_arr[0]
        end_pt = pts_arr[-1]
        dist_ends = float(np.linalg.norm(start_pt - end_pt))

        x_min, y_min = float(np.min(pts_arr[:, 0])), float(np.min(pts_arr[:, 1]))
        x_max, y_max = float(np.max(pts_arr[:, 0])), float(np.max(pts_arr[:, 1]))
        bbox_diag = float(np.linalg.norm([x_max - x_min, y_max - y_min]))

        # If endpoints are close relative to bounding box diameter, it's a closed loop
        if bbox_diag > 40 and dist_ends < (0.35 * bbox_diag):
            is_loop = True

    if is_loop:
        poly_mask = np.zeros((height, width), dtype=np.uint8)
        c_arr = np.array(pos_pts, dtype=np.int32)
        cv2.fillPoly(poly_mask, [c_arr], 255)
        dist_map = cv2.distanceTransform(poly_mask, cv2.DIST_L2, 5)

        interior_pts = []
        x_min, y_min = int(np.min(c_arr[:, 0])), int(np.min(c_arr[:, 1]))
        x_max, y_max = int(np.max(c_arr[:, 0])), int(np.max(c_arr[:, 1]))

        y_steps = np.linspace(y_min + 15, y_max - 15, max_pos)
        for y_val in y_steps:
            y_int = int(y_val)
            if 0 <= y_int < height:
                row = dist_map[y_int, :]
                if np.max(row) > 10:
                    best_x = int(np.argmax(row))
                    interior_pts.append([best_x, y_int])

        if len(interior_pts) >= 2:
            margin = max(50, int(0.12 * bbox_diag))
            auto_neg = [
                [max(20, x_min - margin), max(20, y_min - margin)],
                [min(width - 20, x_max + margin), max(20, y_min - margin)],
                [max(20, x_min - margin), min(height - 20, y_max + margin)],
                [min(width - 20, x_max + margin), min(height - 20, y_max + margin)],
                [int((x_min + x_max) / 2), max(20, y_min - margin)],
            ]
            all_neg = neg_pts[:max_neg] + auto_neg
            return interior_pts[:max_pos] + all_neg, [1] * len(interior_pts[:max_pos]) + [0] * len(all_neg)

    # 2. Standard uniform path downsampling
    def subsample(pts_list, max_n):
        if len(pts_list) <= max_n:
            return pts_list
        indices = np.linspace(0, len(pts_list) - 1, max_n, dtype=int)
        return [pts_list[i] for i in indices]

    filtered_pos = subsample(pos_pts, max_pos)
    filtered_neg = subsample(neg_pts, max_neg)

    return filtered_pos + filtered_neg, [1] * len(filtered_pos) + [0] * len(filtered_neg)


def refine_alpha_mask(raw_mask: np.ndarray) -> np.ndarray:
    """
    Takes a raw 0-255 alpha mask and removes jagged pixel stair-stepping and halo edges.
    Optimized for Apple Silicon Neural Engine / CPU:
    1. Erode 1-2px inward so background colors don't bleed onto shoulder/hair edges.
    2. Apply Gaussian feathering to anti-alias the silhouette edge.
    3. Crush faint noise (<18) to 0 and boost core (>230) to 255 for a solid body matte.
    """
    if raw_mask is None or raw_mask.size == 0:
        return raw_mask

    # 1. Erode 1-2px inward so background colors don't bleed onto shoulder/hair edges
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded = cv2.erode(raw_mask, kernel, iterations=1)

    # 2. Apply Gaussian feathering to anti-alias the silhouette edge
    feathered = cv2.GaussianBlur(eroded, (5, 5), sigmaX=1.4)

    # 3. Crush faint noise (<18) to 0 and boost core (>230) to 255 for a solid body matte
    refined = np.clip((feathered.astype(np.float32) - 18.0) * (255.0 / 212.0), 0, 255).astype(np.uint8)
    return refined


def apply_mask_refinements(
    mask_uint8: np.ndarray,
    feather: int = 3,
    expand: int = 0,
    invert: bool = False,
    apply_halo_removal: bool = True,
) -> np.ndarray:
    """
    Applies edge refinement controls:
    - invert: inverts alpha polarity if background was selected.
    - expand: positive values expand mask (dilation), negative shrink mask (choke/erosion).
    - feather: gaussian blur radius to soften hard edges (hair, silhouettes).
    - apply_halo_removal: applies anti-halo erosion and Gaussian anti-aliasing curve.
    """
    processed = mask_uint8.copy()

    # Invert mask if requested
    if invert:
        processed = 255 - processed

    # Anti-halo edge smoothing & core matte boost
    if apply_halo_removal:
        processed = refine_alpha_mask(processed)

    # Expand or shrink (choke)
    if expand != 0:
        kernel_size = 2 * abs(expand) + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        if expand > 0:
            processed = cv2.dilate(processed, kernel, iterations=1)
        else:
            processed = cv2.erode(processed, kernel, iterations=1)

    # Feathering (soft edge blend)
    if feather > 0:
        k = 2 * feather + 1
        processed = cv2.GaussianBlur(processed, (k, k), 0)

    return processed


def segment_frame_preview(
    media_path: str,
    timestamp_s: float,
    points: Optional[List[List[float]]] = None,
    labels: Optional[List[int]] = None,
    bbox: Optional[List[float]] = None,
    feather: int = 3,
    expand: int = 0,
    invert: bool = False,
    target_type: str = "person",
) -> Dict[str, Any]:
    """
    Executes single-frame segmentation on designated video frame:
    - 'person': Uses YOLO-Seg on Apple Silicon MPS for instant full-body segmentation (10ms).
    - 'object': Uses SAM 2.1 Tiny for arbitrary products and objects.
    """
    cap = cv2.VideoCapture(media_path)
    if not cap.isOpened():
        raise ValueError(f"Unable to open media: {media_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    target_frame = max(0, min(int(round(timestamp_s * fps)), total_frames - 1))
    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
    ret, frame_bgr = cap.read()
    cap.release()

    if not ret or frame_bgr is None:
        raise RuntimeError(f"Could not read frame at {timestamp_s}s")

    h, w = frame_bgr.shape[:2]
    device = get_torch_device()
    t0 = time.time()

    if target_type == "person":
        model = get_yolo_seg_model()
        results = model(frame_bgr, classes=[0], device=device, verbose=False)

        if results and results[0].masks is not None and len(results[0].masks.data) > 0:
            masks_data = results[0].masks.data
            boxes = results[0].boxes.xyxy.cpu().numpy()
            n_people = len(boxes)

            if n_people == 1:
                chosen_idx = 0
            else:
                # Score detections against user input points/box
                scores = []
                for b in boxes:
                    sc = 0.0
                    if points and labels:
                        for p, lbl in zip(points, labels):
                            px, py = p[0], p[1]
                            if b[0] <= px <= b[2] and b[1] <= py <= b[3]:
                                sc += 3.0 if lbl == 1 else -4.0
                    elif bbox and len(bbox) == 4:
                        ix1, iy1 = max(b[0], bbox[0]), max(b[1], bbox[1])
                        ix2, iy2 = min(b[2], bbox[2]), min(b[3], bbox[3])
                        inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
                        union = (b[2] - b[0]) * (b[3] - b[1]) + (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) - inter
                        sc = inter / union if union > 0 else 0.0
                    else:
                        sc = float((b[2] - b[0]) * (b[3] - b[1]))
                    scores.append(sc)
                chosen_idx = int(np.argmax(scores))

            m_np = masks_data[chosen_idx].cpu().numpy()
            m_full = cv2.resize((m_np * 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_LINEAR)
            raw_mask = (m_full > 127).astype(np.uint8) * 255
        else:
            raw_mask = np.zeros((h, w), dtype=np.uint8)

    else:
        # Object / Product mode: SAM 2.1
        model = get_sam_model()
        results = None

        if bbox and len(bbox) == 4:
            results = model(frame_bgr, bboxes=[bbox], device=device)
        elif points and labels:
            filt_pts, filt_lbls = smart_filter_points(points, labels, width=w, height=h)
            if filt_pts:
                results = model(frame_bgr, points=[filt_pts], labels=[filt_lbls], device=device)

        if not results or results[0].masks is None or len(results[0].masks.data) == 0:
            raw_mask = np.zeros((h, w), dtype=np.uint8)
        else:
            raw_mask = (results[0].masks.data[0].cpu().numpy().astype(np.uint8)) * 255

    inference_time_ms = int((time.time() - t0) * 1000)
    refined_mask = apply_mask_refinements(raw_mask, feather=feather, expand=expand, invert=invert)

    # 1. 8-Bit Grayscale Alpha Mask PNG
    _, mask_png_bytes = cv2.imencode(".png", refined_mask)
    mask_b64 = base64.b64encode(mask_png_bytes).decode("utf-8")

    # 2. DaVinci Magic Mask Magenta Overlay (#E91E63 @ 45% opacity) applied strictly to subject
    overlay = frame_bgr.copy()
    magenta_bgr = np.array([99, 30, 233], dtype=np.uint8)
    alpha_norm = (refined_mask.astype(np.float32) / 255.0)[:, :, np.newaxis]
    tinted = (overlay.astype(np.float32) * 0.55 + magenta_bgr * 0.45).astype(np.uint8)
    blended = (overlay.astype(np.float32) * (1.0 - alpha_norm) + tinted.astype(np.float32) * alpha_norm).astype(np.uint8)
    _, overlay_bytes = cv2.imencode(".jpg", blended, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    overlay_b64 = base64.b64encode(overlay_bytes).decode("utf-8")

    # 3. Transparent RGBA Cutout PNG
    b, g, r = cv2.split(frame_bgr)
    rgba = cv2.merge([b, g, r, refined_mask])
    _, cutout_bytes = cv2.imencode(".png", rgba)
    cutout_b64 = base64.b64encode(cutout_bytes).decode("utf-8")

    coverage_pct = round(float(np.mean(refined_mask > 128) * 100), 2)

    return {
        "status": "success",
        "target_type": target_type,
        "inference_time_ms": inference_time_ms,
        "coverage_pct": coverage_pct,
        "mask_data_uri": f"data:image/png;base64,{mask_b64}",
        "overlay_data_uri": f"data:image/jpeg;base64,{overlay_b64}",
        "cutout_data_uri": f"data:image/png;base64,{cutout_b64}",
        "is_inverted": invert,
    }


def rotoscope_and_render_video(
    media_path: str,
    points: Optional[List[List[float]]] = None,
    labels: Optional[List[int]] = None,
    bbox: Optional[List[float]] = None,
    export_mode: str = "prores_alpha",  # "prores_alpha", "matte", "green_screen", "blur"
    feather: int = 3,
    expand: int = 0,
    invert: bool = False,
    target_type: str = "person",
    start_time: float = 0.0,
    end_time: Optional[float] = None,
    output_filename: Optional[str] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> Dict[str, Any]:
    """
    Rotoscope and encode video with hardware-accelerated Apple ProRes 4444:
    - 'person': Instant person tracking via YOLO-Seg on Apple Silicon MPS (16-30 FPS).
    - 'object': High-precision object tracking via SAM 2.1 Video Predictor.
    """
    if not os.path.exists(media_path):
        raise FileNotFoundError(f"Media file not found: {media_path}")

    info = get_video_info(media_path)
    fps = info["fps"]
    width = info["width"]
    height = info["height"]
    duration = info["duration"]

    actual_start = max(0.0, float(start_time))
    actual_end = min(duration, float(end_time)) if end_time is not None and end_time > actual_start else duration
    clip_duration = max(0.5, actual_end - actual_start)
    expected_frames = max(1, int(round(clip_duration * fps)))

    stem = Path(media_path).stem
    ext = ".mov" if export_mode == "prores_alpha" else ".mp4"
    if not output_filename:
        out_name = f"{stem}_magic_mask_{export_mode}{ext}"
    else:
        out_name = output_filename if output_filename.endswith(ext) else f"{output_filename}{ext}"

    output_path = DOWNLOADS_DIR / out_name
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    device = get_torch_device()
    use_hw_prores = is_hardware_prores_available()

    print(f"🎬 Starting Magic Mask Tracking & Render for {stem}...")
    print(f"   Target: {target_type.upper()} | Mode: {export_mode} | Range: {actual_start:.2f}s -> {actual_end:.2f}s ({expected_frames} frames)")
    print(f"   Resolution: {width}x{height} | Device: {device.upper()} | HW ProRes: {use_hw_prores}")

    temp_clip_path = None
    temp_proxy_path = None

    try:
        # 1. Prepare sub-range video slice if requested
        if actual_start > 0.05 or actual_end < (duration - 0.05):
            temp_clip_path = str(Path(media_path).parent / f"temp_slice_{int(time.time())}_{stem}.mp4")
            slice_cmd = [
                ffmpeg_exe, "-y",
                "-noautorotate",
                "-ss", str(actual_start),
                "-i", media_path,
                "-t", str(clip_duration),
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
                "-c:a", "copy",
                temp_clip_path,
            ]
            subprocess.run(slice_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            source_video = temp_clip_path
            sliced_info = get_video_info(source_video)
            fps = sliced_info["fps"]
            width = sliced_info["width"]
            height = sliced_info["height"]
            expected_frames = max(1, sliced_info["total_frames"])
        else:
            source_video = media_path

        # 2. Build FFmpeg command with Hardware VideoToolbox ProRes 4444 acceleration
        if export_mode == "prores_alpha":
            if use_hw_prores:
                ffmpeg_cmd = [
                    ffmpeg_exe, "-y",
                    "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
                    "-i", source_video,
                    "-map", "0:v", "-map", "1:a?",
                    "-c:v", "prores_videotoolbox", "-profile:v", "4", "-pix_fmt", "bgra",
                    "-c:a", "copy",
                    str(output_path),
                ]
            else:
                ffmpeg_cmd = [
                    ffmpeg_exe, "-y",
                    "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
                    "-i", source_video,
                    "-map", "0:v", "-map", "1:a?",
                    "-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le",
                    "-c:a", "copy",
                    str(output_path),
                ]
        elif export_mode == "matte":
            ffmpeg_cmd = [
                ffmpeg_exe, "-y",
                "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
                "-map", "0:v",
                "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
                str(output_path),
            ]
        elif export_mode == "green_screen":
            ffmpeg_cmd = [
                ffmpeg_exe, "-y",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
                "-i", source_video,
                "-map", "0:v", "-map", "1:a?",
                "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                "-c:a", "copy",
                str(output_path),
            ]
        elif export_mode == "blur":
            ffmpeg_cmd = [
                ffmpeg_exe, "-y",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
                "-i", source_video,
                "-map", "0:v", "-map", "1:a?",
                "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                "-c:a", "copy",
                str(output_path),
            ]
        else:
            raise ValueError(f"Unknown export mode: {export_mode}")

        proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        t_start = time.time()
        frame_idx = 0

        # 3. Tracking Engine Selection
        if target_type == "person":
            # --- HIGH SPEED PERSON TRACKING VIA YOLO-SEG (16-30 FPS) ---
            model = get_yolo_seg_model()
            cap_full = cv2.VideoCapture(source_video)
            tracked_box = None
            last_valid_mask = None

            while True:
                if cancel_check and cancel_check():
                    proc.kill()
                    raise InterruptedError("Tracking cancelled by user.")

                ret_full, orig_bgr = cap_full.read()
                if not ret_full or orig_bgr is None:
                    break

                frame_idx += 1
                res = model(orig_bgr, classes=[0], device=device, verbose=False)

                if res and res[0].masks is not None and len(res[0].masks.data) > 0:
                    masks_data = res[0].masks.data
                    boxes = res[0].boxes.xyxy.cpu().numpy()

                    if tracked_box is None:
                        # Initial detection matching
                        if points and labels:
                            scs = []
                            for b in boxes:
                                sc = sum(3.0 if lbl == 1 else -4.0 for p, lbl in zip(points, labels) if b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3])
                                scs.append(sc)
                            chosen_idx = int(np.argmax(scs))
                        elif bbox and len(bbox) == 4:
                            ious = []
                            for b in boxes:
                                ix1, iy1 = max(b[0], bbox[0]), max(b[1], bbox[1])
                                ix2, iy2 = min(b[2], bbox[2]), min(b[3], bbox[3])
                                inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
                                union = (b[2] - b[0]) * (b[3] - b[1]) + (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) - inter
                                ious.append(inter / union if union > 0 else 0.0)
                            chosen_idx = int(np.argmax(ious))
                        else:
                            areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in boxes]
                            chosen_idx = int(np.argmax(areas))
                        tracked_box = boxes[chosen_idx]
                    else:
                        # Frame-to-frame box IoU tracking
                        ious = []
                        for b in boxes:
                            ix1, iy1 = max(b[0], tracked_box[0]), max(b[1], tracked_box[1])
                            ix2, iy2 = min(b[2], tracked_box[2]), min(b[3], tracked_box[3])
                            inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
                            union = (b[2] - b[0]) * (b[3] - b[1]) + (tracked_box[2] - tracked_box[0]) * (tracked_box[3] - tracked_box[1]) - inter
                            ious.append(inter / union if union > 0 else 0.0)

                        best_iou = max(ious) if ious else 0.0
                        if best_iou > 0.15:
                            chosen_idx = int(np.argmax(ious))
                            tracked_box = boxes[chosen_idx]
                        elif len(boxes) == 1:
                            chosen_idx = 0
                            tracked_box = boxes[0]
                        else:
                            chosen_idx = int(np.argmax(ious))

                    m_np = masks_data[chosen_idx].cpu().numpy()
                    m_full = cv2.resize((m_np * 255).astype(np.uint8), (width, height), interpolation=cv2.INTER_LINEAR)
                    raw_mask = (m_full > 127).astype(np.uint8) * 255
                    last_valid_mask = raw_mask.copy()
                else:
                    raw_mask = last_valid_mask.copy() if last_valid_mask is not None else np.zeros((height, width), dtype=np.uint8)

                mask_refined = apply_mask_refinements(raw_mask, feather=feather, expand=expand, invert=invert)

                if export_mode == "prores_alpha":
                    bgra_frame = cv2.merge([orig_bgr[:, :, 0], orig_bgr[:, :, 1], orig_bgr[:, :, 2], mask_refined])
                    proc.stdin.write(bgra_frame.tobytes())
                elif export_mode == "matte":
                    proc.stdin.write(mask_refined.tobytes())
                elif export_mode == "green_screen":
                    alpha_f = (mask_refined.astype(np.float32) / 255.0)[:, :, np.newaxis]
                    green_bg = np.array([0, 255, 0], dtype=np.uint8)
                    comp = (orig_bgr.astype(np.float32) * alpha_f + green_bg * (1.0 - alpha_f)).astype(np.uint8)
                    proc.stdin.write(comp.tobytes())
                elif export_mode == "blur":
                    blurred_bg = cv2.GaussianBlur(orig_bgr, (45, 45), 0)
                    alpha_f = (mask_refined.astype(np.float32) / 255.0)[:, :, np.newaxis]
                    comp = (orig_bgr.astype(np.float32) * alpha_f + blurred_bg.astype(np.float32) * (1.0 - alpha_f)).astype(np.uint8)
                    proc.stdin.write(comp.tobytes())

                elapsed = time.time() - t_start
                cur_fps = round(frame_idx / elapsed, 2) if elapsed > 0 else 0.0
                percent = min(99.0, round((frame_idx / expected_frames) * 100, 1))
                remaining_frames = max(0, expected_frames - frame_idx)
                eta_s = round(remaining_frames / cur_fps, 1) if cur_fps > 0 else 0.0

                if progress_callback and (frame_idx % 2 == 0 or frame_idx == expected_frames):
                    progress_callback({
                        "frame": frame_idx,
                        "total_frames": expected_frames,
                        "percent": percent,
                        "fps": cur_fps,
                        "eta_s": eta_s,
                        "elapsed_s": round(elapsed, 1),
                    })

            cap_full.release()

        else:
            # --- SAM 2.1 VIDEO PREDICTOR FOR ARBITRARY OBJECTS ---
            if points and labels:
                filt_pts, filt_lbls = smart_filter_points(points, labels, width=width, height=height)
            else:
                filt_pts, filt_lbls = [], []

            need_proxy = (width > 1280 or height > 1280)
            if need_proxy:
                proxy_max = 960
                scale_factor = proxy_max / max(width, height)
                proxy_w = int(round(width * scale_factor / 2.0)) * 2
                proxy_h = int(round(height * scale_factor / 2.0)) * 2
                temp_proxy_path = str(Path(media_path).parent / f"temp_proxy_{int(time.time())}_{stem}.mp4")

                proxy_cmd = [
                    ffmpeg_exe, "-y",
                    "-i", source_video,
                    "-vf", f"scale={proxy_w}:{proxy_h}",
                    "-c:v", "h264_videotoolbox", "-b:v", "4M",
                    "-an",
                    temp_proxy_path,
                ]
                res_p = subprocess.run(proxy_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if res_p.returncode != 0:
                    proxy_cmd[5] = "libx264"
                    proxy_cmd[6] = "-preset"
                    proxy_cmd.insert(7, "ultrafast")
                    subprocess.run(proxy_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                scale_x = proxy_w / width
                scale_y = proxy_h / height
                tracking_points = [[[int(p[0] * scale_x), int(p[1] * scale_y)] for p in filt_pts]] if filt_pts else None
                tracking_labels = [filt_lbls] if filt_lbls else None
                tracking_source = temp_proxy_path
            else:
                tracking_points = [filt_pts] if filt_pts else None
                tracking_labels = [filt_lbls] if filt_lbls else None
                tracking_source = source_video

            predictor = SAM2VideoPredictor(overrides=dict(model=str(SAM_MODEL_PATH), imgsz=640, device=device))
            cap_full = cv2.VideoCapture(source_video)

            results_gen = predictor(
                source=tracking_source,
                points=tracking_points,
                labels=tracking_labels,
                stream=True,
            )

            for r in results_gen:
                if cancel_check and cancel_check():
                    proc.kill()
                    raise InterruptedError("Tracking cancelled by user.")

                ret_full, orig_bgr = cap_full.read()
                if not ret_full or orig_bgr is None:
                    orig_bgr = r.orig_img
                    if orig_bgr is None:
                        continue

                frame_idx += 1

                if r.masks is not None and len(r.masks.data) > 0:
                    raw_mask = (r.masks.data[0].cpu().numpy().astype(np.uint8)) * 255
                    if need_proxy:
                        raw_mask = cv2.resize(raw_mask, (width, height), interpolation=cv2.INTER_LINEAR)
                else:
                    raw_mask = np.zeros((height, width), dtype=np.uint8)

                mask_refined = apply_mask_refinements(raw_mask, feather=feather, expand=expand, invert=invert)

                if export_mode == "prores_alpha":
                    bgra_frame = cv2.merge([orig_bgr[:, :, 0], orig_bgr[:, :, 1], orig_bgr[:, :, 2], mask_refined])
                    proc.stdin.write(bgra_frame.tobytes())
                elif export_mode == "matte":
                    proc.stdin.write(mask_refined.tobytes())
                elif export_mode == "green_screen":
                    alpha_f = (mask_refined.astype(np.float32) / 255.0)[:, :, np.newaxis]
                    green_bg = np.array([0, 255, 0], dtype=np.uint8)
                    comp = (orig_bgr.astype(np.float32) * alpha_f + green_bg * (1.0 - alpha_f)).astype(np.uint8)
                    proc.stdin.write(comp.tobytes())
                elif export_mode == "blur":
                    blurred_bg = cv2.GaussianBlur(orig_bgr, (45, 45), 0)
                    alpha_f = (mask_refined.astype(np.float32) / 255.0)[:, :, np.newaxis]
                    comp = (orig_bgr.astype(np.float32) * alpha_f + blurred_bg.astype(np.float32) * (1.0 - alpha_f)).astype(np.uint8)
                    proc.stdin.write(comp.tobytes())

                elapsed = time.time() - t_start
                cur_fps = round(frame_idx / elapsed, 2) if elapsed > 0 else 0.0
                percent = min(99.0, round((frame_idx / expected_frames) * 100, 1))
                remaining_frames = max(0, expected_frames - frame_idx)
                eta_s = round(remaining_frames / cur_fps, 1) if cur_fps > 0 else 0.0

                if progress_callback and (frame_idx % 2 == 0 or frame_idx == expected_frames):
                    progress_callback({
                        "frame": frame_idx,
                        "total_frames": expected_frames,
                        "percent": percent,
                        "fps": cur_fps,
                        "eta_s": eta_s,
                        "elapsed_s": round(elapsed, 1),
                    })

            cap_full.release()

        stdout, stderr = proc.communicate()
        if proc.returncode != 0:
            err_msg = stderr.decode()[-600:] if stderr else "Unknown error"
            raise RuntimeError(f"FFmpeg encoding failed with code {proc.returncode}: {err_msg}")

    finally:
        for temp_p in [temp_clip_path, temp_proxy_path]:
            if temp_p and os.path.exists(temp_p):
                try:
                    os.remove(temp_p)
                except OSError:
                    pass

    total_time = round(time.time() - t_start, 2)
    file_size_mb = round(os.path.getsize(output_path) / (1024 * 1024), 2) if output_path.exists() else 0.0

    print(f"🎉 Rotoscope complete in {total_time}s ({frame_idx} frames)!")
    print(f"   Saved to: {output_path} ({file_size_mb} MB)")

    davinci_guide = (
        "1. Open DaVinci Resolve Free and drag the exported ProRes 4444 file into your Media Pool.\n"
        "2. Place your background video, graphics, or text on Video Track 1 (V1).\n"
        "3. Drag this transparent ProRes 4444 clip onto Video Track 2 (V2) directly above it.\n"
        "4. Your subject appears with transparent background—no keying, green screen, or Studio license needed!"
    )

    return {
        "status": "success",
        "output_path": str(output_path),
        "filename": output_path.name,
        "file_size_mb": file_size_mb,
        "frames_rendered": frame_idx,
        "render_time_s": total_time,
        "export_mode": export_mode,
        "davinci_guide": davinci_guide,
    }
