import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, KeyboardControlsEntry, OrbitControls } from '@react-three/drei'
import Game from './Game'
import { Controls } from './constants'
import { GameStateProvider } from './StateProvider'

function App() {
  const map = useMemo<KeyboardControlsEntry<Controls>[]>(() => [
    { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
    { name: Controls.back, keys: ['ArrowDown', 'KeyS'] },
    { name: Controls.space, keys: ['Space']}
  ], [])

  return (
    <GameStateProvider>
      <Canvas style={{ width: "100%", height: "100%" }} shadows camera={{
        position: [0, 2.5, 4]
      }}>
        <OrbitControls />
        <ambientLight />
        <directionalLight position={[-5, 5, 5]} castShadow />
        <KeyboardControls map={map}>
          <Game />
        </KeyboardControls>
      </Canvas>
    </GameStateProvider>
  )
}

export default App
