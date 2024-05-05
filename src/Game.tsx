
import Ball from "./PingPongBall"
import Paddle from "./PingPongPaddle"
import { Table } from "./PingPongTable"
import Ground from "./Ground"
import GameState from './GameState'
import { Physics } from "@react-three/rapier"
import { Suspense } from "react"

const Game = () => {
    return (
        <>
            <GameState />
            {/* <Physics
                iterations={20}
                tolerance={0.0001}                
                defaultContactMaterial={{
                    contactEquationRelaxation: 1,
                    contactEquationStiffness: 1e7,
                    friction: 0.9,
                    frictionEquationRelaxation: 2,
                    frictionEquationStiffness: 1e7,
                    restitution: 0.7,
                }}
                gravity={[0, -40, 0]}
                allowSleep={false}> */}
            <Suspense>
                <Physics debug>
                    {/* <Debug color="black" scale={1.1}> */}
                    <Table />
                    <Ball />
                    <Paddle isPlayer={true} />
                    <Paddle isPlayer={false} position={[0, 2, -3]} />
                    <Ground />
                </Physics>
            </Suspense>
            {/* </Debug> */}
            {/* </Physics> */}
        </>
    )
}

export default Game