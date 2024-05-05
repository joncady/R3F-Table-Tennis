import { RapierRigidBody } from "@react-three/rapier";
import { createContext, Dispatch, ReactNode, RefObject, useContext, useReducer } from "react";
import { Action, gameStateReducer } from "./reducer";

export enum PlayState {
    RESET,
    SERVING,
    RALLY
}

const defaultState: DefaultState = {
    score: {
        player1: 0,
        player2: 0
    },
    serving: 'player2',
    started: 'player2',
    playState: PlayState.RESET
}

const GameContext = createContext<DefaultState>(defaultState);

const GameDispatchContext = createContext<Dispatch<Action>>(() => { });


export function useGame() {
    return useContext(GameContext);
}

export function useGameDispatch() {
    return useContext(GameDispatchContext);
}

export interface DefaultState {
    score: {
        player1: number;
        player2: number;
    };
    serving: 'player1' | 'player2';
    started: 'player1' | 'player2';
    playState: PlayState;
    player1Paddle?: RefObject<RapierRigidBody>;
    player2Paddle?: RefObject<RapierRigidBody>;
    ball?: RefObject<RapierRigidBody>
}

export const GameStateProvider = ({ children }: { children: ReactNode }) => {

    const [state, dispatch] = useReducer(
        gameStateReducer,
        defaultState
    )
    return (
        <GameContext.Provider value={state}>
            <GameDispatchContext.Provider value={dispatch}>
                {children}
            </GameDispatchContext.Provider>
        </GameContext.Provider>
    )
}