/**
 * Trims an MP3 to the first N seconds by copying whole MP3 frames.
 * MP3 frames are independently decodable, so a frame-boundary cut
 * produces a valid, shorter file.
 * Usage: node scripts/trim-mp3.mjs <in> <out> <seconds>
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inFile, outFile, secondsArg] = process.argv;
const seconds = Number(secondsArg) || 60;

const data = readFileSync(inFile);
const bytesPerSecond = 0; // computed from frames
const VIEW = new DataView(data.buffer, data.byteOffset, data.byteLength);

// Bitrate table ( MPEG1 Layer III, kbps )
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const SAMPLE_RATES = {
  3: [44100, 48000, 32000], // MPEG1
  2: [22050, 24000, 16000], // MPEG2
  0: [11025, 12000, 8000], // MPEG2.5
};

let offset = 0;
let duration = 0;
let endOffset = data.length;

// Skip ID3v2 tag if present.
if (data.length > 10 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
  const size = ((data[6] & 0x7f) << 21) | ((data[7] & 0x7f) << 14) | ((data[8] & 0x7f) << 7) | (data[9] & 0x7f);
  offset = 10 + size;
}

while (offset < data.length - 4) {
  // Find frame sync.
  if (data[offset] !== 0xff || (data[offset + 1] & 0xe0) !== 0xe0) {
    offset++;
    continue;
  }
  const b1 = data[offset + 1];
  const b2 = data[offset + 2];
  const versionBits = (b1 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
  const layerBits = (b1 >> 1) & 0x03; // 1 = Layer III
  const bitrateIndex = (b2 >> 4) & 0x0f;
  const sampleRateIndex = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;

  if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    offset++; // not a valid Layer III frame header
    continue;
  }

  const sampleRates = SAMPLE_RATES[versionBits] ?? SAMPLE_RATES[3];
  const sampleRate = sampleRates[sampleRateIndex];
  const bitrate = (BITRATES[bitrateIndex] ?? 0) * 1000;
  if (!bitrate || !sampleRate) {
    offset++;
    continue;
  }

  const samplesPerFrame = versionBits === 3 ? 1152 : 576;
  const frameLength = Math.floor((samplesPerFrame / 8) * (bitrate / sampleRate)) + padding;
  if (frameLength < 4) {
    offset++;
    continue;
  }

  duration += samplesPerFrame / sampleRate;
  offset += frameLength;

  if (duration >= seconds) {
    endOffset = offset;
    break;
  }
}

const trimmed = data.subarray(0, endOffset);
writeFileSync(outFile, trimmed);
console.log(
  `Trimmed ${inFile} (${(data.length / 1024 / 1024).toFixed(2)} MB) -> ${outFile} (${(trimmed.length / 1024 / 1024).toFixed(2)} MB), ~${Math.min(duration, seconds).toFixed(1)}s of audio kept.`
);
