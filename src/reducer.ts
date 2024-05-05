import { RapierRigidBody } from "@react-three/rapier"
import { RefObject } from "react"
import { DefaultState, PlayState } from "./StateProvider"

export type Action = |
{
    type: 'updateScore',
    player: string
} |
{
    type: 'setBallRef',
    mesh: RefObject<RapierRigidBody>
} | {
    type: 'setPaddleRef',
    player: 'player1' | 'player2',
    mesh: RefObject<RapierRigidBody>
} | {
    type: 'setGameState',
    playState: PlayState
}

export const gameStateReducer = (state: DefaultState, action: Action): DefaultState => {
    switch (action.type) {
        // Score
        case 'updateScore': {
            return {
                ...state
            }
        }
        case 'setBallRef': {
            return {
                ...state,
                ball: action.mesh
            }
        }
        case 'setPaddleRef': {
            if (action.player === 'player1') {
                state.player1Paddle = action.mesh;
            } else {
                state.player2Paddle = action.mesh;
            }
            return {
                ...state
            }
        }
        case 'setGameState': {
            return {
                ...state,
                playState: action.playState
            }
        }
        // Keep track of ball touches
        default: {
            return state;
        }
    }

}