import { RigidBody } from "@react-three/rapier";

const Ground = () => {


    return (
        <RigidBody type="fixed">
            <mesh rotation={[-0.5 * Math.PI, 0, 0]} receiveShadow position={[0, 0, 0]}>
                <planeGeometry args={[10, 10, 1, 1]} />
                <meshStandardMaterial />
            </mesh>
        </RigidBody>
    )

}

export default Ground;