import { useRef } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { GLTF } from 'three-stdlib'
import { Vector3 } from '@react-three/fiber';
import * as React from 'react';
import { RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useGameDispatch } from './StateProvider';

interface GLTFAction extends THREE.AnimationClip {
  name: string;
}

type GLTFResult = GLTF & {
  nodes: {
    Object_4: THREE.Mesh
    Object_6: THREE.Mesh
    Object_8: THREE.Mesh
    Object_10: THREE.Mesh
    Object_12: THREE.Mesh
    Object_14: THREE.Mesh
    Object_16: THREE.Mesh
    Object_18: THREE.Mesh
  }
  materials: {
    Madera_paleta: THREE.MeshStandardMaterial
    Esponja_paleta: THREE.MeshStandardMaterial
    Goma_roja: THREE.MeshStandardMaterial
    Mango_paleta: THREE.MeshStandardMaterial
    Goma_negra: THREE.MeshStandardMaterial
    protector_de_goma: THREE.MeshStandardMaterial
  }
  animations: GLTFAction[]
}

const Paddle = ({ position, isPlayer }: { position?: Vector3, isPlayer?: boolean }) => {
  const { nodes, materials } = useGLTF('/models/ping_pong_paddle.glb') as GLTFResult
  const dispatch = useGameDispatch();
  // Can add controls
  const paddleRef = useRef<RapierRigidBody>(null);

  React.useEffect(() => {
    if (paddleRef.current) {
      dispatch({ type: 'setPaddleRef', player: isPlayer ? 'player1' : 'player2', mesh: paddleRef})
    }
  }, []);  

  return (
    <RigidBody type="kinematicPosition" ref={paddleRef} position={isPlayer ? undefined : position}>
    <mesh dispose={null} >
      <group scale={0.05} position={[0, -0.3, 0]}>
        <mesh geometry={nodes.Object_4.geometry} material={materials.Madera_paleta} position={[0, 9.437, 0]} />
        <mesh geometry={nodes.Object_6.geometry} material={materials.Esponja_paleta} position={[0, 10.608, 0.268]} rotation={[-Math.PI, 0, -Math.PI]} scale={[-1, 1, 1]} />
        <mesh geometry={nodes.Object_8.geometry} material={materials.Goma_roja} position={[0, 10.608, 0.368]} rotation={[-Math.PI, 0, -Math.PI]} scale={[-1, 1, 1]} />
        <mesh geometry={nodes.Object_10.geometry} material={materials.Mango_paleta} position={[0.001, -0.039, 0.477]} rotation={[-Math.PI, 0, -Math.PI]} scale={[-1, 1, 1]} />
        <mesh geometry={nodes.Object_12.geometry} material={materials.Mango_paleta} position={[0.001, -0.039, -0.477]} />
        <mesh geometry={nodes.Object_14.geometry} material={materials.Esponja_paleta} position={[0, 10.608, -0.268]} />
        <mesh geometry={nodes.Object_16.geometry} material={materials.Goma_negra} position={[0, 10.608, -0.368]} />
        <mesh geometry={nodes.Object_18.geometry} material={materials.protector_de_goma} position={[0, 9.437, 0]} />
      </group>
    </mesh>
    </RigidBody>
  )
}

useGLTF.preload('/models/ping_pong_paddle.glb')

export default Paddle;