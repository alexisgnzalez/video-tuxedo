/**
 * Tuxedo Editor EDL (Edit Decision List) Math & Operations
 * Non-destructive manipulation of timeline clips: split, remove, move, trim.
 */

export function getTimelineDuration(clips) {
  if (!clips || clips.length === 0) return 0;
  return clips.reduce((acc, c) => acc + Math.max(0, c.srcOut - c.srcIn), 0);
}

export function srcToTimeline(clips, srcTime) {
  if (!clips || clips.length === 0) return 0;
  let offset = 0;
  for (const c of clips) {
    if (srcTime >= c.srcIn && srcTime <= c.srcOut) {
      return offset + (srcTime - c.srcIn);
    }
    offset += Math.max(0, c.srcOut - c.srcIn);
  }
  return 0;
}

export function timelineToSrc(clips, tlTime) {
  if (!clips || clips.length === 0) return 0;
  let offset = 0;
  for (const c of clips) {
    const dur = Math.max(0, c.srcOut - c.srcIn);
    if (tlTime <= offset + dur) {
      const rel = tlTime - offset;
      return c.srcIn + rel;
    }
    offset += dur;
  }
  return clips[clips.length - 1].srcOut;
}

export function splitClipAt(clips, tlTime) {
  const newClips = [];
  let offset = 0;
  let didSplit = false;

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const dur = Math.max(0, c.srcOut - c.srcIn);

    if (!didSplit && tlTime > offset + 0.1 && tlTime < offset + dur - 0.1) {
      const splitSrc = c.srcIn + (tlTime - offset);
      // Left slice
      newClips.push({
        id: `${c.id}_a`,
        srcIn: c.srcIn,
        srcOut: Math.round(splitSrc * 1000) / 1000,
      });
      // Right slice
      newClips.push({
        id: `${c.id}_b`,
        srcIn: Math.round(splitSrc * 1000) / 1000,
        srcOut: c.srcOut,
      });
      didSplit = true;
    } else {
      newClips.push({ ...c });
    }
    offset += dur;
  }

  return { clips: newClips, didSplit };
}

export function removeClip(clips, clipId) {
  if (!clips || clips.length <= 1) return clips; // Maintain at least 1 clip
  return clips.filter(c => c.id !== clipId);
}

export function moveClip(clips, fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= clips.length || toIdx < 0 || toIdx >= clips.length) {
    return clips;
  }
  const result = [...clips];
  const [removed] = result.splice(fromIdx, 1);
  result.splice(toIdx, 0, removed);
  return result;
}

export function trimClip(clips, clipId, side, deltaSec, maxDuration = 999999) {
  return clips.map(c => {
    if (c.id !== clipId) return c;
    const dur = c.srcOut - c.srcIn;
    const minDur = 0.2; // At least 200ms

    if (side === 'in') {
      const newIn = Math.max(0, Math.min(c.srcOut - minDur, c.srcIn + deltaSec));
      return { ...c, srcIn: Math.round(newIn * 1000) / 1000 };
    } else {
      const newOut = Math.max(c.srcIn + minDur, Math.min(maxDuration, c.srcOut + deltaSec));
      return { ...c, srcOut: Math.round(newOut * 1000) / 1000 };
    }
  });
}
