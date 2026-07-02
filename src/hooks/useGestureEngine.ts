import { useMemo } from 'react';
import { GestureEngine } from '../gestures/GestureEngine';

export function useGestureEngine() {
  return useMemo(() => new GestureEngine(), []);
}
export default useGestureEngine;
