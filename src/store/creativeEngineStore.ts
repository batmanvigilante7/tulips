import { create } from 'zustand';
import type { GestureType } from '../types';

type HandId = 'left' | 'right';

interface CreativeEngineState {
  gestures: Record<HandId, GestureType>;
  setGestures: (gestures: Record<string, string>) => void;
  resetGestures: () => void;
}

const idleGestures: Record<HandId, GestureType> = {
  left: 'none',
  right: 'none'
};

function toGestureType(value: string | undefined): GestureType {
  switch (value) {
    case 'open':
    case 'fist':
    case 'pinch':
    case 'victory':
    case 'point':
    case 'together':
    case 'apart':
    case 'thumbs_up':
      return value;
    default:
      return 'none';
  }
}

export const useCreativeEngineStore = create<CreativeEngineState>((set) => ({
  gestures: idleGestures,
  setGestures: (gestures) => {
    set({
      gestures: {
        left: toGestureType(gestures.left),
        right: toGestureType(gestures.right)
      }
    });
  },
  resetGestures: () => set({ gestures: idleGestures })
}));


