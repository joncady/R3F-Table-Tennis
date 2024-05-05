import { RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { useGameDispatch } from "./StateProvider";

const Ball = () => {
    const dispatch = useGameDispatch();
    const pingPongBallRef = useRef<RapierRigidBody>(null);

    useEffect(() => {
        dispatch({ type: 'setBallRef', mesh: pingPongBallRef })
    }, []);

    return (
        <RigidBody ref={pingPongBallRef} mass={0.8} position={[0, 2.5, -1.5]} type="kinematicVelocity">
            <mesh castShadow>
                <sphereGeometry args={[0.1]} />
                <meshStandardMaterial color={"white"} />
            </mesh>
        </RigidBody>
    )
}

export default Ball;