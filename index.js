import midiConverter from 'midi-converter';
import {
  createRequire
} from "module";
const require = createRequire(
  import.meta.url);
const config = require('./config.json')
import {
  readFile,
  writeFile
} from 'fs/promises';
let bpm = 120; // default midi bpm
let midiPath = process.argv[2];
let mp3Offset = +process.argv[3];
if (!midiPath)
  throw new Error("you must include a file to parse! Usage: node . <path/to/your/mid.mid> <mp3 offset(optional)>");
const midi = await (async () => {
  let data = await readFile(midiPath, 'binary');
  let result = midiConverter.midiToJson(data)
  return result
})(midiPath);
const ticksPerBeat = midi.header.ticksPerBeat;
let offset = 0;
midi.tracks[0].forEach(event => {
  if (event.subtype === "setTempo") {
    bpm = 60000 / (event.microsecondsPerBeat / 1000 * 4)
  }
  let tickLength = 60000 / (ticksPerBeat * bpm);
  offset += event.deltaTime * tickLength;
  event.offset = offset;
})
let notes = midi.tracks[0].filter(note => (note.subtype === "noteOn"));
if (mp3Offset) {
  let midiOffset = notes[0].offset;
  notes.forEach(note => note.offset = note.offset + mp3Offset - midiOffset)
}
let bpmByOffset = (a, b) => {
  let beatsnapDivider = Math.abs(a - b) > config.stream_threshold_ms ? 2 : 4;
  return 60000 / (Math.abs(a - b) * beatsnapDivider)
}
let timingPoints = [];
notes.forEach((note, index) => {
  let obj = {
    offset: note.offset,
    bpm: index === 0 ? 120 : bpmByOffset(note.offset, notes[index - 1].offset)
  }
  timingPoints.push(obj)
})
let maxBpm = 400;
timingPoints = timingPoints.filter(point => point.bpm < maxBpm);
let output = '';
if (config.output.bookmarks) {
  output += 'Bookmarks: '
  timingPoints.forEach(point => output += `${point.offset},`)
  output = output.replace(/,$/, '\r\n')
}
let extraData = config.extraData // extra data from .osu file
timingPoints.forEach(point => {
  output += `\n${point.offset},${60000 / point.bpm},${extraData}`;
});
await writeFile('output.txt', output);