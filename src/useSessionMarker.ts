import { useEffect, useRef, useState } from 'react';
import { MarkerGate, markerFacingCamera } from './sessionMarker';
export default function useSessionMarker(
  video: React.RefObject<HTMLVideoElement>,
  expected: string | undefined,
  enabled: boolean,
  onSeen: () => void,
) {
  const [status, setStatus] = useState('Show the phone marker to your webcam.'),
    callback = useRef(onSeen);
  callback.current = onSeen;
  useEffect(() => {
    if (!enabled || !expected) return;
    const worker = new Worker(new URL('./marker.worker.ts', import.meta.url), {
        type: 'module',
      }),
      gate = new MarkerGate();
    let busy = false,
      ended = false,
      matched = false;
    setStatus(
      'Point the phone screen toward the webcam. Move it closer if the marker is small.',
    );
    worker.onmessage = ({ data }) => {
      busy = false;
      if (ended || matched) return;
      if (data.error) {
        setStatus('Marker scanner failed. Retry enabling webcam.');
        return;
      }
      const facing = data.location && markerFacingCamera(data.location);
      if (data.data && data.data !== expected)
        setStatus('Different session marker. Reopen this game’s pairing link.');
      else if (data.data === expected && !facing)
        setStatus(
          'Marker found. Face the screen straight at webcam, top edge up.',
        );
      else if (data.data === expected)
        setStatus('Matching session. Hold steady…');
      if (gate.update(performance.now(), expected, data.data, !!facing)) {
        matched = true;
        setStatus('Marker verified. Synchronizing phone…');
        callback.current();
      }
    };
    worker.onerror = () => {
      busy = false;
      setStatus('Marker scanner failed. Reload to retry.');
    };
    const timer = setInterval(() => {
      const source = video.current;
      if (ended || busy || matched || !source || source.readyState < 2) return;
      busy = true;
      void createImageBitmap(source, {
        resizeWidth: 1280,
        resizeHeight: Math.round(
          (1280 * source.videoHeight) / source.videoWidth,
        ),
      })
        .then((bitmap) => {
          if (ended) {
            bitmap.close();
            return;
          }
          worker.postMessage({ bitmap }, [bitmap]);
        })
        .catch(() => {
          busy = false;
        });
    }, 150);
    return () => {
      ended = true;
      clearInterval(timer);
      worker.terminate();
    };
  }, [video, expected, enabled]);
  return status;
}
