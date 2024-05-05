import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { GLTF } from 'three-stdlib'
import { RigidBody } from '@react-three/rapier';

interface GLTFAction extends THREE.AnimationClip {
  name: string;
}

type GLTFResult = GLTF & {
  nodes: {
    Object_4: THREE.Mesh
    Object_5: THREE.Mesh
    Object_7: THREE.Mesh
    Object_8: THREE.Mesh
    Object_10: THREE.Mesh
    Object_12: THREE.Mesh
    Object_14: THREE.Mesh
    Object_15: THREE.Mesh
    Object_17: THREE.Mesh
  }
  materials: {
    Material: THREE.MeshStandardMaterial
    ['Material.001']: THREE.MeshStandardMaterial
    ['Material.002']: THREE.MeshStandardMaterial
    ['Material.004']: THREE.MeshStandardMaterial
    ['Material.003']: THREE.MeshStandardMaterial
  }
  animations: GLTFAction[]
}

// type ContextType = Record<string, React.ForwardRefExoticComponent<JSX.IntrinsicElements['mesh']>>

export function Table(props: JSX.IntrinsicElements['group']) {  
  const { nodes, materials } = useGLTF('public/models/table_tennis_table.glb') as GLTFResult
  
  return (
    <RigidBody position={[0, 1.5, 0]} type="fixed" restitution={1} onCollisionEnter={({ manifold }) => {
      console.log(
        "Collision at world position ",
        manifold.solverContactPoint(0)
      );}}>
    <mesh>
    <group {...props} dispose={null} position={[0, -1.4, 0]}>
      {/* Table top */}
      <group position={[0, 1.444, 0]} >
        <mesh geometry={nodes.Object_4.geometry} material={materials.Material} castShadow />
        <mesh geometry={nodes.Object_5.geometry} material={materials['Material.001']} castShadow />
      </group>
      <mesh geometry={nodes.Object_7.geometry} material={materials['Material.002']} castShadow />
      <mesh geometry={nodes.Object_8.geometry} material={materials['Material.004']} castShadow />
      <mesh geometry={nodes.Object_10.geometry} material={materials['Material.002']} castShadow />
      <mesh geometry={nodes.Object_12.geometry} material={materials['Material.001']} castShadow />
      <mesh geometry={nodes.Object_14.geometry} material={materials['Material.003']} castShadow />
      <mesh geometry={nodes.Object_15.geometry} material={materials['Material.001']} castShadow />
      <mesh geometry={nodes.Object_17.geometry} material={materials['Material.002']} castShadow />
    </group>
    </mesh>
    </RigidBody>
  )
}

useGLTF.preload('public/models/table_tennis_table.glb')
