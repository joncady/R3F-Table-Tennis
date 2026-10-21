import { useEffect, useRef, useState } from 'react';
export default function useDiagnostics(
  enabled: boolean,
  sample: () => Record<string, string | number>,
) {
  const reader = useRef(sample);
  reader.current = sample;
  const [stats, setStats] = useState<Record<string, string | number>>({});
  useEffect(() => {
    if (!enabled) return;
    setStats({ browserFps: 0, slowFrames: 0, ...reader.current() });
    let frame = 0,
      count = 0,
      last = performance.now(),
      slow = 0,
      previous = last;
    const loop = (now: number) => {
      count++;
      if (now - previous > 50) slow++;
      previous = now;
      if (now - last >= 1000) {
        setStats({
          browserFps: Math.round((count * 1000) / (now - last)),
          slowFrames: slow,
          ...reader.current(),
        });
        count = 0;
        slow = 0;
        last = now;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);
  return stats;
}
