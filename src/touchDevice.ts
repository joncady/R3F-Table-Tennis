export const usesTouchControls = () => navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
