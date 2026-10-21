import {
  appendRecording,
  createRecording,
  finishRecording,
  type SavedRecording,
} from "./recordingStore";
export async function startPlaytestRecording(
  options: {
    sample: () => unknown;
    tick: (seconds: number) => void;
    finished: (recording: SavedRecording) => void;
    error: (message: string) => void;
  },
  storage = {
    create: createRecording,
    append: appendRecording,
    finish: finishRecording,
  },
) {
  if (
    !navigator.mediaDevices?.getDisplayMedia ||
    typeof MediaRecorder === "undefined"
  )
    throw Error("Screen recording is unavailable in this browser. Try Chrome.");
  // Keep capture chooser activation synchronous with the developer-menu click.
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: true,
  });
  let recorder: MediaRecorder, saved: SavedRecording;
  try {
    const mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 5000000,
    });
    saved = await storage.create(
      recorder.mimeType || "video/webm",
      stream.getAudioTracks().length > 0,
    );
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const start = performance.now();
  let rows: unknown[] = [],
    stopping = false,
    failed = false,
    storageFailed = false,
    pendingBytes = 0,
    queue = Promise.resolve();
  const elapsed = () => (performance.now() - start) / 1000;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    if (recorder.state !== "inactive") recorder.stop();
  };
  const enqueue = (kind: "video" | "data", blob: Blob) => {
    if (failed) return;
    pendingBytes += blob.size;
    if (pendingBytes > 16 * 1024 * 1024) {
      failed = true;
      options.error(
        "Recording stopped because local storage could not keep up. Saved chunks remain in Recordings.",
      );
      stop();
      return;
    }
    const duration = elapsed();
    queue = queue
      .then(() => {
        if (!storageFailed)
          return storage.append(saved.id, kind, blob, duration);
      })
      .catch(() => {
        storageFailed = true;
        if (!failed) {
          failed = true;
          options.error(
            "Recording stopped: local storage is full or unavailable. Recover saved chunks in Recordings.",
          );
          stop();
        }
      })
      .finally(() => {
        pendingBytes -= blob.size;
      });
  };
  const flush = () => {
    if (!rows.length) return;
    const batch = rows;
    rows = [];
    enqueue(
      "data",
      new Blob([JSON.stringify(batch)], { type: "application/json" }),
    );
  };
  const sample = () => {
    try {
      const t = elapsed();
      rows.push(JSON.parse(JSON.stringify({ t, data: options.sample() })));
      if (rows.length >= 100) flush();
      options.tick(t);
    } catch {
      options.error("Recording continues; motion data could not be sampled.");
    }
  };
  const timer = setInterval(sample, 100);
  recorder.ondataavailable = (e) => {
    if (e.data.size) enqueue("video", e.data);
  };
  recorder.onerror = () => {
    failed = true;
    options.error(
      "Recording encountered an error. Previously saved chunks remain recoverable.",
    );
    stop();
  };
  recorder.onstop = () => {
    stopping = true;
    clearInterval(timer);
    const duration = elapsed();
    stream.getTracks().forEach((t) => t.stop());
    flush();
    void queue.then(async () => {
      try {
        const row = await storage.finish(saved.id, duration, failed);
        options.finished(row);
      } catch {
        options.error(
          "Recording stopped. Reopen Recordings to recover the chunks saved before the storage error.",
        );
        options.finished({ ...saved, duration, status: "interrupted" });
      }
    });
  };
  stream
    .getVideoTracks()
    .forEach((track) => track.addEventListener("ended", stop));
  try {
    recorder.start(1000);
    sample();
  } catch (e) {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    await storage.finish(saved.id, elapsed(), true);
    throw e;
  }
  return stop;
}
