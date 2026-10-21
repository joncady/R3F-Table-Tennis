import type { PhonePose } from './phoneMotion';
import type { BodyControl } from './useWebcamBody';
import type { PlayerInput } from './engine';
export const rotationCues = [
  'Hold your normal paddle grip still. Keep the phone visible.',
  'Tilt the screen forward, then backward. Keep your wrist in place.',
  'Turn the screen left, then right. Keep your wrist in place.',
  'Roll the phone like turning a key, then return to your normal grip.',
  'Make two slow forehand swings. Keep the phone visible.',
  'Make two slow backhand swings. Keep the phone visible.',
];
export function rotationStage(seconds: number) {
  return seconds < 5 ? -1 : Math.min(5, Math.floor((seconds - 5) / 5));
}
export async function recordOrientationTrial(options: {
  video: HTMLVideoElement;
  game: HTMLCanvasElement;
  preview: HTMLCanvasElement;
  sample: () => {
    phone: PhonePose | null;
    body: BodyControl;
    input: PlayerInput;
    hand: string;
    pivot: number;
  };
  status: (text: string) => void;
  done: () => void;
}) {
  const { video, game, preview, sample, status, done } = options;
  if (!video.videoWidth) throw Error('Enable the webcam before recording.');
  if (typeof MediaRecorder === 'undefined' || !preview.captureStream)
    throw Error('Recording is unavailable in this browser.');
  preview.width = 1280;
  preview.height = 600;
  const ctx = preview.getContext('2d');
  if (!ctx) throw Error('Recording canvas is unavailable.');
  const stream = preview.captureStream(20),
    mime = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 1800000 } : undefined,
    ),
    chunks: BlobPart[] = [],
    rows: unknown[] = [];
  let frame = 0,
    lastStage = -2,
    lastRow = -Infinity,
    finished = false;
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    void (async () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      try {
        status('Saving recording…');
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const report = {
          version: 1,
          kind: 'paddle-orientation',
          createdAt: new Date().toISOString(),
          duration: (performance.now() - start) / 1000,
          partial: performance.now() - start < 34900,
          cues: rotationCues,
          video: encoded,
          rows,
        };
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(report)], { type: 'application/json' }),
          ),
          link = document.createElement('a');
        link.href = url;
        link.download = `paddle-orientation-${Date.now()}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status(
          `Trial complete — recording saved to Downloads (${rows.length} samples). Tell me when done.`,
        );
        speak('Trial complete. You can stop.');
      } catch (e) {
        status(`Could not save trial: ${String(e)}`);
      } finally {
        done();
      }
    })();
  };
  const start = performance.now();
  recorder.start(1000);
  const draw = () => {
    const now = performance.now(),
      t = (now - start) / 1000,
      stage = rotationStage(t),
      cue =
        stage < 0
          ? 'Get into position. Recording starts in five seconds.'
          : rotationCues[stage];
    if (stage !== lastStage) {
      lastStage = stage;
      speak(cue);
    }
    status(
      `${stage < 0 ? 'Get ready' : `Step ${stage + 1}/6`}: ${cue} · ${Math.max(0, Math.ceil((stage < 0 ? 5 : 5 + (stage + 1) * 5) - t))}s`,
    );
    ctx.fillStyle = '#102a34';
    ctx.fillRect(0, 0, 1280, 600);
    ctx.save();
    ctx.translate(640, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, 640, 480);
    ctx.restore();
    ctx.drawImage(game, 640, 0, 640, 480);
    ctx.fillStyle = '#d8f47c';
    ctx.font = '22px system-ui';
    ctx.fillText('WEBCAM · mirrored', 16, 28);
    ctx.fillText('GAME PADDLE', 656, 28);
    ctx.fillText(
      `${t.toFixed(1)}s · ${stage < 0 ? 'GET READY' : `STEP ${stage + 1}/6`}`,
      20,
      520,
    );
    ctx.font = '19px system-ui';
    ctx.fillText(cue, 20, 555);
    if (now - lastRow >= 30) {
      lastRow = now;
      rows.push(JSON.parse(JSON.stringify({ t, stage, ...sample() })));
    }
    if (t >= 35) {
      if (!finished) {
        finished = true;
        recorder.stop();
      }
      return;
    }
    frame = requestAnimationFrame(draw);
  };
  draw();
  return () => {
    if (!finished) {
      finished = true;
      recorder.stop();
    }
  };
}
