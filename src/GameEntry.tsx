import { lazy, useState } from 'react';
const App = lazy(() => import('./App')),
  WebcamGame = lazy(() => import('./WebcamGame')),
  PoseLab = lazy(() => import('./PoseLab')),
  Multiplayer = lazy(() => import('./Multiplayer')),
  TrialLab = lazy(() => import('./TrialLab')),
  Demo = lazy(() => import('./Demo')),
  Replay = lazy(() => import('./Replay'));
export default function GameEntry() {
  const query = new URLSearchParams(location.search),
    initial =
      query.has('mouse') || query.has('legacy')
        ? 'mouse'
        : query.has('webcam')
          ? 'webcam'
          : '';
  const [mode, setMode] = useState(initial);
  if (
    query.has('pose') &&
    ['localhost', '127.0.0.1'].includes(location.hostname)
  )
    return <PoseLab />;
  if (query.has('multiplayer')) return <Multiplayer />;
  if (query.has('lab')) return <TrialLab />;
  if (query.has('demo')) return <Demo />;
  if (query.has('replay')) return <Replay />;
  if (mode === 'mouse') return <App mouseOnly />;
  if (mode === 'webcam') return <WebcamGame />;
  const choose = (next: string) => {
    history.replaceState(null, '', `?${next}`);
    setMode(next);
  };
  return (
    <main className="mode-picker">
      <small>TABLE / TENNIS</small>
      <h1>Pick your paddle.</h1>
      <p>Play the AI. First to 11, win by two.</p>
      <div>
        <button onClick={() => choose('mouse')}>
          <strong>Mouse + keyboard</strong>
          <span>Swing with the mouse. Move with WASD. Space to toss.</span>
        </button>
        <button onClick={() => choose('webcam')}>
          <strong>Phone + webcam</strong>
          <span>
            Your phone is the paddle. Your webcam tracks movement and your
            tossing hand.
          </span>
        </button>
      </div>
      <p>F fullscreen · Escape to pause</p>
    </main>
  );
}
