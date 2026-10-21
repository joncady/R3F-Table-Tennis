export async function startPlaytestRecording(options: {
  sample: () => unknown;
  tick: (seconds: number) => void;
  finished: (video: Blob, report: unknown) => void;
  error: (message: string) => void;
}) {
  if (
    !navigator.mediaDevices?.getDisplayMedia ||
    typeof MediaRecorder === 'undefined'
  )
    throw Error('Screen recording is unavailable in this browser. Try Chrome.');
  // Called directly from the desktop click so the browser capture chooser has user activation.
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: true,
  });
  let recorder: MediaRecorder;
  try {
    const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 5000000,
    });
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const chunks: BlobPart[] = [],
    rows: unknown[] = [],
    startedAt = new Date().toISOString(),
    start = performance.now();
  let stopping = false;
  const sample = () => {
    try {
      const t = (performance.now() - start) / 1000;
      rows.push(JSON.parse(JSON.stringify({ t, data: options.sample() })));
      options.tick(t);
    } catch {
      options.error('Recording continues; motion data could not be sampled.');
    }
  };
  const timer = setInterval(sample, 100);
  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    if (recorder.state !== 'inactive') recorder.stop();
  };
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onerror = () => {
    options.error(
      'Recording encountered an error; saving the captured portion.',
    );
    stop();
  };
  recorder.onstop = () => {
    stopping = true;
    clearInterval(timer);
    const duration = (performance.now() - start) / 1000,
      hasAudio = stream.getAudioTracks().length > 0;
    stream.getTracks().forEach((t) => t.stop());
    options.finished(
      new Blob(chunks, { type: recorder.mimeType || 'video/webm' }),
      {
        version: 1,
        kind: 'full-playtest',
        startedAt,
        duration,
        hasAudio,
        rows,
      },
    );
  };
  stream
    .getVideoTracks()
    .forEach((track) => track.addEventListener('ended', stop));
  try {
    recorder.start(1000);
    sample();
  } catch (e) {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  return stop;
}
