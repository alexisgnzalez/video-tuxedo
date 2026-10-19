import { CaptionCue, CaptionWord } from '../types';

export interface ParsedSrtCue extends CaptionCue {
  startFrame: number;
  endFrame: number;
  durationInFrames: number;
  keywords: string[];
}

/** Parses standard SRT timestamp "00:01:23,456" into seconds */
export function srtTimeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/** Converts seconds to frame number rounded at specified fps */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

/** Extracts clean uppercase keywords removing common Spanish stop words */
const SPANISH_STOP_WORDS = new Set([
  'EL', 'LA', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS',
  'Y', 'O', 'PERO', 'DE', 'DEL', 'A', 'AL', 'EN', 'POR', 'PARA',
  'CON', 'SIN', 'SOBRE', 'QUE', 'COMO', 'SI', 'NO', 'ES', 'SON',
  'SE', 'ME', 'TE', 'LE', 'NOS', 'LES', 'SU', 'SUS', 'MI', 'MIS',
  'TU', 'TUS', 'ESTE', 'ESTA', 'ESTOS', 'ESTAS', 'ESE', 'ESA'
]);

export function extractKeywords(text: string): string[] {
  const words = text
    .toUpperCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'¡¿]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SPANISH_STOP_WORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Parses raw SRT string content into frame-accurate cue objects.
 */
export function parseSrt(srtContent: string, fps: number = 30): ParsedSrtCue[] {
  if (!srtContent || !srtContent.trim()) return [];

  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const result: ParsedSrtCue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = 1;
    let cueId = parseInt(lines[0].trim(), 10);
    if (isNaN(cueId)) {
      // Sometimes cue index line is missing
      timeLineIdx = 0;
      cueId = i + 1;
    }

    const timeLine = lines[timeLineIdx] || '';
    const arrowIdx = timeLine.indexOf('-->');
    if (arrowIdx === -1) continue;

    const startStr = timeLine.substring(0, arrowIdx).trim();
    const endStr = timeLine.substring(arrowIdx + 3).trim();

    const startSeconds = srtTimeToSeconds(startStr);
    const endSeconds = srtTimeToSeconds(endStr);

    const textLines = lines.slice(timeLineIdx + 1);
    const cleanText = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

    const startFrame = secondsToFrames(startSeconds, fps);
    const endFrame = Math.max(startFrame + 1, secondsToFrames(endSeconds, fps));

    // Approximate word timestamps across cue duration if word-level data isn't present
    const rawWords = cleanText.split(/\s+/).filter(Boolean);
    const cueDur = Math.max(0.1, endSeconds - startSeconds);
    const wordDur = cueDur / Math.max(1, rawWords.length);

    const words: CaptionWord[] = rawWords.map((word, wIdx) => ({
      text: word,
      start: startSeconds + wIdx * wordDur,
      end: startSeconds + (wIdx + 1) * wordDur,
    }));

    result.push({
      id: cueId,
      start: startSeconds,
      end: endSeconds,
      startFrame,
      endFrame,
      durationInFrames: endFrame - startFrame,
      text: cleanText,
      words,
      keywords: extractKeywords(cleanText),
    });
  }

  return result;
}
