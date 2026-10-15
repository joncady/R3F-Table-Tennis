import { RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { PlayState, useGame, useGameDispatch } from "./StateProvider";
import { pingPongSound } from "./helper";

const Ball = () => {
    const dispatch = useGameDispatch();
    const pingPongBallRef = useRef<RapierRigidBody>(null);
    const { playState} = useGame();

    useEffect(() => {
        dispatch({ type: 'setBallRef', mesh: pingPongBallRef })
    }, [pingPongBallRef, dispatch]);

    const values = useRef([false]);

    return (
        <RigidBody name="ball" ref={pingPongBallRef} position={[0, 2.5, -1.5]} type="fixed" onContactForce={({ other }) => {
            if (playState === PlayState.RALLY) {
                pingPongSound();
                if (!values.current[0] && other.rigidBodyObject?.name === 'ground') {
                    values.current[0] = true;
                    dispatch({ type: 'updateScore', player: 'player1' });
                    dispatch({ type: 'setGameState', playState: PlayState.SERVING})
                }
            } else {
                values.current[0] = false;
            }
        }}>
            <mesh castShadow>
                <sphereGeometry args={[0.1]} />
                <meshStandardMaterial color={"white"} />
            </mesh>
        </RigidBody>
    )
}

export default Ball;