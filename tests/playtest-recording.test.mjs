import "fake-indexeddb/auto";
import { build } from "esbuild";
import assert from "node:assert/strict";
const bundle = await build({
  entryPoints: ["src/playtestRecording.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { startPlaytestRecording } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
let now = 0,
  interval,
  ended,
  stopped = 0,
  outputs = [],
  constraints,
  current,
  errors = [];
Object.defineProperty(globalThis, "performance", {
  value: { now: () => now },
  configurable: true,
});
const track = {
  stop() {
    stopped++;
  },
  addEventListener(name, fn) {
    assert.equal(name, "ended");
    ended = fn;
  },
};
const stream = {
  getTracks: () => [track],
  getVideoTracks: () => [track],
  getAudioTracks: () => [],
};
Object.defineProperty(globalThis, "navigator", {
  value: {
    mediaDevices: {
      getDisplayMedia: async (opts) => {
        constraints = opts;
        return stream;
      },
    },
  },
  configurable: true,
});
globalThis.setInterval = (fn) => {
  interval = fn;
  return 1;
};
globalThis.clearInterval = () => {};
globalThis.MediaRecorder = class {
  static isTypeSupported() {
    return true;
  }
  constructor() {
    this.mimeType = "video/webm";
    this.state = "inactive";
    current = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    assert.equal(this.state, "recording");
    this.state = "inactive";
    this.ondataavailable({ data: new Blob(["captured-video"]) });
    this.onstop();
  }
};
const live = { score: [0, 0] },
  options = {
    sample: () => live,
    tick() {},
    error(message) {
      errors.push(message);
    },
    finished: (row) => outputs.push(row),
  };
async function finished(count) {
  for (let i = 0; i < 500 && outputs.length < count; i++)
    await new Promise((r) => setImmediate(r));
  assert.equal(outputs.length, count);
  return outputs.at(-1);
}
const stop = await startPlaytestRecording(options);
assert.equal(constraints.audio, true);
assert.equal(constraints.video.frameRate, 30);
live.score[0] = 1;
now = 65000;
interval();
assert.equal(outputs.length, 0, "no fixed duration cutoff");
stop();
stop();
const first = await finished(1);
assert.equal(first.status, "complete");
assert.equal(first.videoChunks, 1);
assert.equal(first.dataChunks, 1);
assert.equal(first.duration, 65);
assert.equal(stopped, 1);
await startPlaytestRecording(options);
ended();
await finished(2);
assert.equal(
  outputs[1].status,
  "complete",
  "Browser Stop sharing finalizes capture",
);
await startPlaytestRecording(options);
current.ondataavailable({ data: new Blob(["previously-saved"]) });
await new Promise((r) => setTimeout(r, 10));
current.onerror();
await finished(3);
assert.equal(outputs[2].status, "interrupted");
assert.match(errors.at(-1), /recoverable/);
await startPlaytestRecording(options);
current.ondataavailable({ data: new Blob([new Uint8Array(17 * 1024 * 1024)]) });
await finished(4);
assert.equal(outputs[3].status, "interrupted");
assert.match(errors.at(-1), /could not keep up/);
assert.ok(
  outputs[3].bytes < 1024,
  "Overflow does not retain the oversized video blob",
);
// Once a write fails, later queued chunks must not create a corrupt gap.
let writes = 0,
  releaseFailure;
const prefixStorage = {
  async create() {
    return { id: "prefix", mime: "video/webm" };
  },
  async append() {
    writes++;
    if (writes === 1)
      await new Promise((_resolve, reject) => {
        releaseFailure = () => reject(Error("Quota"));
      });
  },
  async finish(_id, duration, interrupted) {
    return {
      id: "prefix",
      duration,
      status: interrupted ? "interrupted" : "complete",
    };
  },
};
await startPlaytestRecording(options, prefixStorage);
current.ondataavailable({ data: new Blob(["first"]) });
current.ondataavailable({ data: new Blob(["second"]) });
await new Promise((r) => setImmediate(r));
releaseFailure();
await finished(5);
assert.equal(
  writes,
  1,
  "A failed chunk must not be followed by later chunks with a gap",
);
assert.equal(outputs[4].status, "interrupted");

let stoppedOnError = false;
const broken = {
  async create() {
    throw Error("Storage denied");
  },
  async append() {},
  async finish() {},
};
const before = stopped;
await assert.rejects(
  () => startPlaytestRecording(options, broken),
  /Storage denied/,
);
stoppedOnError = stopped > before;
assert.ok(stoppedOnError, "Storage setup failure stops capture tracks");
navigator.mediaDevices.getDisplayMedia = async () => {
  throw Object.assign(Error("Cancelled"), { name: "NotAllowedError" });
};
await assert.rejects(() => startPlaytestRecording(options), {
  name: "NotAllowedError",
});
console.log(
  "Passed: durable recorder output, full-length capture, user/browser stop, recorder failure recovery, bounded pending bytes, storage setup cleanup and chooser cancellation.",
);
