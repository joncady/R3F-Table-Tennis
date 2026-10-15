import pingSound from './resources/ping.mp3'

export const pingPongSound = () => {
    const ping = new Audio(pingSound);
    ping.currentTime = 0;
    ping.play();
}