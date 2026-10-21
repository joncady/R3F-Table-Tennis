import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { PhoneMotionBuffer, PhonePose } from './phoneMotion';
import { markerPayload } from './sessionMarker';
export type { PhonePose } from './phoneMotion';
export default function usePhoneController(
  onCommand: (command: string) => void,
  relayOverride?: string,
  screenFace = false,
) {
  const [status, setStatus] = useState('Relay not paired');
  const [connected, setConnected] = useState(false),
    [aligned, setAligned] = useState(false),
    [syncing, setSyncing] = useState(false),
    [markerRequest, setMarkerRequest] = useState<
      'idle' | 'requesting' | 'shown' | 'error'
    >('idle');
  const markerNonce = useRef(''),
    awaitingSync = useRef(false),
    syncTimer = useRef<ReturnType<typeof setTimeout>>(),
    markerTimer = useRef<ReturnType<typeof setTimeout>>();
  const invalidateAlignment = () => {
    setAligned(false);
    setSyncing(false);
    setMarkerRequest('idle');
    clearTimeout(markerTimer.current);
    awaitingSync.current = false;
    clearTimeout(syncTimer.current);
  };
  const [pairing, setPairing] = useState<{
    phoneUrl: string;
    certificateUrl?: string;
    qr: string;
    sessionCode?: string;
    marker?: string;
  } | null>(null);
  const pose = useRef<PhonePose | null>(null),
    socket = useRef<WebSocket | null>(null),
    generation = useRef(0);
  const gameStatus = useRef('');
  const motion = useRef(new PhoneMotionBuffer());
  const handler = useRef(onCommand);
  handler.current = onCommand;
  const pair = async () => {
    invalidateAlignment();
    markerNonce.current = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    motion.current.reset();
    const attempt = ++generation.current;
    socket.current?.close();
    pose.current = null;
    setConnected(false);
    setStatus('Connecting to controller relay…');
    try {
      const response = await fetch(
        `${(relayOverride || import.meta.env.VITE_RELAY_HTTP || 'http://127.0.0.1:8787').replace(/\/$/, '')}/session`,
        { method: 'POST' },
      );
      if (!response.ok) throw Error('Relay rejected pairing');
      const session = await response.json();
      const controllerUrl = new URL(session.phoneUrl);
      controllerUrl.searchParams.set('v', __APP_VERSION__);
      session.phoneUrl = controllerUrl.href;
      if (screenFace) {
        const url = new URL(session.phoneUrl),
          hash = url.hash.slice(1),
          params = hash.includes('=')
            ? new URLSearchParams(hash)
            : new URLSearchParams({ room: hash });
        params.set('face', 'screen');
        params.set('marker', markerNonce.current);
        url.hash = params.toString();
        session.phoneUrl = url.href;
      }
      const qr = await QRCode.toDataURL(session.phoneUrl, {
        width: 200,
        margin: 1,
      });
      if (attempt !== generation.current) return;
      setPairing({
        phoneUrl: session.phoneUrl,
        certificateUrl: session.certificateUrl,
        sessionCode: session.room.slice(-6),
        qr,
        ...(screenFace
          ? { marker: markerPayload(session.room, markerNonce.current) }
          : {}),
      });
      const ws = new WebSocket(
        `${session.wsUrl || 'ws://127.0.0.1:8787/'}?room=${session.room}&role=host&host=${session.host}`,
      );
      socket.current = ws;
      let latestSequence = -1;
      ws.onopen = () => {
        setStatus('Scan QR on your phone');
        ws.send(JSON.stringify({ type: 'hello' }));
        if (gameStatus.current)
          ws.send(
            JSON.stringify({
              type: 'game-status',
              message: gameStatus.current,
            }),
          );
      };
      ws.onmessage = (e) => {
        if (attempt !== generation.current) return;
        const m = JSON.parse(e.data);
        if (m.type === 'alignment-start' && m.nonce === markerNonce.current) {
          invalidateAlignment();
          setMarkerRequest('shown');
          handler.current('alignment-start');
        } else if (
          m.type === 'screen-aligned' &&
          m.nonce === markerNonce.current &&
          awaitingSync.current
        ) {
          clearTimeout(syncTimer.current);
          awaitingSync.current = false;
          setSyncing(false);
          setAligned(true);
          handler.current('screen-aligned');
        } else if (m.type === 'status') {
          latestSequence = -1;
          invalidateAlignment();
          setConnected(m.connected);
          setStatus(m.connected ? 'Phone connected' : 'Waiting for phone');
          if (!m.connected) {
            pose.current = null;
            motion.current.reset();
            handler.current('disconnected');
          }
        } else if (
          m.type === 'motion' &&
          ['x', 'y', 'yaw', 'pitch', 'roll'].every((k) => Number.isFinite(m[k]))
        ) {
          if (Number.isSafeInteger(m.seq)) {
            if (m.seq <= latestSequence) return;
            latestSequence = m.seq;
          }
          pose.current = { ...m, received: performance.now() };
          motion.current.push(pose.current!);
        } else if (m.type === 'probe' && ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'probe', id: m.id, sent: m.sent }));
        else if (
          [
            'grip-ready',
            'grip-failed',
            'start',
            'toss',
            'pause',
            'recenter',
            'suspend',
            'stop-recording',
          ].includes(m.type)
        ) {
          if (m.type === 'recenter') motion.current.reset();
          handler.current(m.type);
        }
      };
      ws.onclose = () => {
        if (attempt === generation.current) {
          invalidateAlignment();
          setConnected(false);
          pose.current = null;
          setStatus('Relay disconnected · pair again');
          handler.current('disconnected');
        }
      };
      ws.onerror = () =>
        setStatus(
          'Relay unavailable · check your connection and retry pairing',
        );
    } catch {
      if (attempt === generation.current)
        setStatus(
          'Relay unavailable. Retry pairing; for local development run npm run controller',
        );
    }
  };
  const syncScreen = () => {
    if (socket.current?.readyState !== WebSocket.OPEN || awaitingSync.current)
      return;
    awaitingSync.current = true;
    setSyncing(true);
    socket.current.send(
      JSON.stringify({ type: 'sync-screen', nonce: markerNonce.current }),
    );
    syncTimer.current = setTimeout(() => {
      awaitingSync.current = false;
      setSyncing(false);
    }, 3000);
  };
  const showMarker = () => {
    invalidateAlignment();
    if (socket.current?.readyState !== WebSocket.OPEN || !connected) {
      setMarkerRequest('error');
      return;
    }
    setMarkerRequest('requesting');
    socket.current.send(
      JSON.stringify({ type: 'show-marker', nonce: markerNonce.current }),
    );
    markerTimer.current = setTimeout(() => setMarkerRequest('error'), 5000);
  };
  const align = () => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ type: 'align' }));
  };
  const calibrateGrip = () => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ type: 'calibrate-grip' }));
  };
  const reportStatus = (message: string) => {
    gameStatus.current = message;
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ type: 'game-status', message }));
  };
  const impact = (strength: number, opponent = false) => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(
        JSON.stringify({
          type: opponent ? 'opponent-hit' : 'impact',
          strength,
        }),
      );
  };
  useEffect(
    () => () => {
      generation.current++;
      clearTimeout(syncTimer.current);
      clearTimeout(markerTimer.current);
      socket.current?.close();
    },
    [],
  );
  return {
    aligned,
    syncing,
    syncScreen,
    showMarker,
    markerRequest,
    diagnostics: () => ({
      phoneAgeMs: pose.current
        ? Math.round(performance.now() - pose.current.received)
        : -1,
      bufferDelayMs: Math.round(motion.current.delay),
    }),
    align,
    calibrateGrip,
    reportStatus,
    status,
    connected,
    pairing,
    pose,
    pair,
    impact,
    samplePose: (now: number) => motion.current.sample(now),
  };
}
