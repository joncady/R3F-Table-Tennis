import "fake-indexeddb/auto";
import { build } from "esbuild";
import assert from "node:assert/strict";
const bundle = await build({
  entryPoints: ["src/recordingStore.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const store = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const row = await store.createRecording("video/webm", true);
await store.appendRecording(row.id, "video", new Blob(["header"]), 1);
await store.appendRecording(
  row.id,
  "data",
  new Blob([JSON.stringify([{ t: 0, data: { score: [0, 0] } }])]),
  1,
);
await store.appendRecording(row.id, "video", new Blob(["second-chunk"]), 2);
await store.appendRecording(
  row.id,
  "data",
  new Blob([JSON.stringify([{ t: 1, data: { score: [1, 0] } }])]),
  2,
);
const interrupted = (await store.listRecordings()).find((r) => r.id === row.id);
assert.equal(
  interrupted.status,
  "recording",
  "Unfinished captures remain discoverable after recorder loss",
);
assert.equal(interrupted.videoChunks, 2);
assert.equal(interrupted.dataChunks, 2);
async function collect(row, kind) {
  const parts = [];
  await store.writeRecording(row, kind, {
    async write(part) {
      parts.push(part);
    },
    async close() {},
  });
  return new Blob(parts).text();
}
assert.equal(await collect(interrupted, "video"), "headersecond-chunk");
const report = JSON.parse(await collect(interrupted, "data"));
assert.equal(report.rows.length, 2);
assert.deepEqual(report.rows[1].data.score, [1, 0]);
assert.equal(report.hasAudio, true);
let aborted = false;
await assert.rejects(() =>
  store.writeRecording(interrupted, "video", {
    async write() {
      throw Error("Disk full");
    },
    async close() {
      assert.fail("must not close failed export");
    },
    async abort() {
      aborted = true;
    },
  }),
);
assert.ok(aborted);
assert.equal(
  await collect(interrupted, "video"),
  "headersecond-chunk",
  "Failed export retains the recoverable source",
);
const completed = await store.finishRecording(row.id, 2.5, false);
assert.equal(completed.status, "complete");
assert.equal(completed.duration, 2.5);
await store.deleteRecording(row.id);
assert.equal((await store.listRecordings()).length, 0);
await assert.rejects(
  () =>
    store.writeRecording(completed, "video", {
      async write() {},
      async close() {},
    }),
  /missing/,
  "Deleting removes the chunk data too",
);
// Streaming backpressure: a slow writer receives one blob at a time.
const long = await store.createRecording("video/webm", false);
for (let i = 0; i < 120; i++)
  await store.appendRecording(long.id, "video", new Blob([String(i) + ","]), i);
const saved = await store.finishRecording(long.id, 120, false);
let writing = false,
  count = 0;
await store.writeRecording(saved, "video", {
  async write() {
    assert.equal(writing, false);
    writing = true;
    await new Promise((r) => setImmediate(r));
    count++;
    writing = false;
  },
  async close() {
    assert.equal(count, 120);
  },
});
await store.deleteRecording(long.id);
console.log(
  "Passed: incremental durable chunks/telemetry, interrupted recovery, ordered exports, export-failure retry, one-chunk disk backpressure and complete deletion.",
);
