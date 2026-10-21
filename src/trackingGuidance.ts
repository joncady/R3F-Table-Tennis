import type {Landmark} from './poseTracking';
export function bodyGuidance(points: Landmark[], frameAge: number) {
  if (frameAge > 500) return 'Camera frames are delayed. Try brighter, even lighting or close other camera apps.';
  const shoulders=[points[11],points[12]];
  if (shoulders.some(p=>!p || (p.visibility??0)<.65)) return 'Keep both shoulders visible. Try more even lighting and avoid covering your body.';
  if (shoulders.some(p=>p.x<.04||p.x>.96||p.y<.04||p.y>.96)) return 'Your shoulders are near the camera edge. Step toward the center of the picture.';
  if (Math.abs(shoulders[0].x-shoulders[1].x)<.06) return 'You look small in the camera. Move a little closer while keeping your hands visible.';
  return 'Shoulders visible. Keep your paddle wrist and free hand in the picture.';
}
