import { useState } from 'react';
import type { SpongeThickness } from './engine';
export const PADDLE_COLORS = {
  red: '#d92d43',
  blue: '#2384df',
  green: '#27b86b',
  pink: '#f259ae',
  violet: '#a35ce0',
} as const;
export type PaddleColor = keyof typeof PADDLE_COLORS;
export interface Equipment {
  color: PaddleColor;
  sponge: SpongeThickness;
}
export const DEFAULT_EQUIPMENT: Equipment = { color: 'red', sponge: 1.9 };
export function readEquipment(): Equipment {
  try {
    const saved = JSON.parse(
      localStorage.getItem('table-tennis-equipment') || 'null',
    );
    if (
      saved &&
      Object.prototype.hasOwnProperty.call(PADDLE_COLORS, saved.color) &&
      [1.7, 1.9, 2.1].includes(saved.sponge)
    )
      return { color: saved.color, sponge: saved.sponge };
  } catch {
    /* A blocked or malformed preference must not stop play. */
  }
  return { ...DEFAULT_EQUIPMENT };
}
export function useEquipment() {
  const [equipment, setEquipment] = useState(readEquipment);
  const save = (value: Equipment) => {
    setEquipment(value);
    try {
      localStorage.setItem('table-tennis-equipment', JSON.stringify(value));
    } catch {
      /* Session preferences still work without storage. */
    }
  };
  return [equipment, save] as const;
}
