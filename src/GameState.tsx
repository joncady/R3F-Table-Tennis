import { Center, Text3D, useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { vec3 } from "@react-three/rapier";
import { useState } from "react";
import { PlayState, useGame, useGameDispatch } from "./StateProvider";
import { Controls } from "./constants";

const GameState = () => {
    const { score: { player1, player2 }, ball, playState, player1Paddle, player2Paddle } = useGame();
    const dispatch = useGameDispatch();

    const [swinging, setIsSwinging] = useState(false);

    document.addEventListener("mousedown", () => {
        if (!swinging) {
            setIsSwinging(true);
        }
    })
    document.addEventListener("mouseup", () => {
        if (swinging) {
            setIsSwinging(false);
        }
    });

    const spacePressed = useKeyboardControls<Controls>(state => state.space);

    // TODO: Add sounds when ball is hit
    // const playPingPongSound = () => {
    //     const ping = new Audio(pingSound);
    //     ping.currentTime = 0;
    //     ping.play();
    // }

    // TODO: Handle hitting ping pong ball
    // const handlePaddle = () => {
    // values.current[0] = lerp(values.current[0], (pointer.x * Math.PI) / 5, 0.2)

    // if (clicking) {
    //   values.current[1] = lerp(values.current[1], 2, 0.2)
    //   // values.current[2] = lerp(values.current[2], -1, 0.2)
    //   api.rotation.set(0, -0.5, values.current[1])
    // } else {
    //   values.current[1] = lerp(values.current[1], (pointer.x * Math.PI) / 5, 0.2)
    //   api.rotation.set(0, 0, values.current[1])
    // }

    // if (!paddleRef.current) return
    // if (!clicking) {
    //   paddleRef.current.rotation.x = lerp(paddleRef.current.rotation.x, 0, 0.2)
    //   paddleRef.current.rotation.y = values.current[0]
    // } else {
    //   // model.current.rotation.z = lerp(model.current.rotation.z, 1, 0.2)
    //   paddleRef.current.rotation.x = lerp(paddleRef.current.rotation.x, -1, 0.2)
    // }
    // }

    useFrame(({ pointer }) => {
        if (player1Paddle?.current && player2Paddle?.current && ball?.current) {
            // Always track paddle to mouse
            player1Paddle?.current?.setTranslation(vec3({ x: pointer.x * 10, y: pointer.y * 5, z: 3 }), false)

            // Play state
            if (playState === PlayState.RESET) {
                if (spacePressed) {
                    ball.current.applyImpulse(vec3({ x: 0, y: -0.05, z: 0.05 }), true);
                    dispatch({ type: 'setGameState', playState: PlayState.SERVING })
                }
            } else {
                // const [x, y, z] = vec3(player1Paddle.current.translation())
                // ball.current.setTranslation(vec3({ x: x, y: y, z: z - 0.5 }), false);
                // TODO: Handle serving
                // if (spacePressed) {
                //     ball.current.applyImpulse(vec3({ x: 0, y: 0.001, z: 0 }), true)
                //     dispatch({ type: 'setGameState', playState: PlayState.SERVING })
                // }       
            }
        }
    });

    return (
        <group position={[0, 3, 0]}>
            <Center position={[-3, 0, 0]}>
                <Text3D font={'./fonts/lato_black.json'} size={0.5}>
                    P1 - {player1}
                    <meshStandardMaterial color="black" />
                </Text3D>
            </Center>

            <Center position={[3, 0, 0]}>
                <Text3D font={'./fonts/lato_black.json'} size={0.5}>
                    P2 - {player2}
                    <meshStandardMaterial color={"black"} />
                </Text3D>
            </Center>
        </group>
    )
}

export default GameState;