// src/hooks/usePhaseTimer.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { triggerRestCompleteAlert } from '../utils/restAlert';

export const usePhaseTimer = ({ onPhaseComplete } = {}) => {
  const [phase, setPhase] = useState('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const endTimeRef = useRef(null);
  const rafRef = useRef(null);
  const onPhaseCompleteRef = useRef(onPhaseComplete);
  useEffect(() => { onPhaseCompleteRef.current = onPhaseComplete; }, [onPhaseComplete]);

  const [sequence, setSequence] = useState([]);
  const [sequenceIndex, setSequenceIndex] = useState(0);

  const startPhaseTimer = useCallback((newPhase, seconds) => {
    setPhase(newPhase);
    setTimeLeft(seconds);
    endTimeRef.current = Date.now() + seconds * 1000;
    setIsRunning(true);
  }, []);

  const updateTimeLeft = useCallback(() => {
    if (endTimeRef.current === null) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
    setTimeLeft(remaining);

    if (remaining === 0) {
      setIsRunning(false);
      const completedPhase = phase;
      setPhase('idle');
      endTimeRef.current = null;

      if (completedPhase === 'rest') {
        triggerRestCompleteAlert();
      }

      // Advance sequence if active
      if (sequence.length > 0 && sequenceIndex < sequence.length - 1) {
        const nextIndex = sequenceIndex + 1;
        setSequenceIndex(nextIndex);
        const next = sequence[nextIndex];
        startPhaseTimer(next.phase, next.seconds);
      } else {
        if (sequence.length > 0) {
          setSequence([]);
          setSequenceIndex(0);
        }
        onPhaseCompleteRef.current?.(completedPhase);
      }
    }
  }, [phase, sequence, sequenceIndex, startPhaseTimer]);

  // RAF loop
  useEffect(() => {
    if (isRunning) {
      const loop = () => {
        updateTimeLeft();
        if (endTimeRef.current !== null) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, updateTimeLeft]);

  const startSequence = useCallback((phases) => {
    if (!phases || phases.length === 0) return;
    setSequence(phases);
    setSequenceIndex(0);
    const first = phases[0];
    startPhaseTimer(first.phase, first.seconds);
  }, [startPhaseTimer]);

  const addTime = useCallback((seconds) => {
    if (endTimeRef.current !== null) {
      endTimeRef.current += seconds * 1000;
      updateTimeLeft();
    } else {
      startPhaseTimer(phase, seconds);
    }
  }, [phase, startPhaseTimer, updateTimeLeft]);

  const skip = useCallback(() => {
    endTimeRef.current = Date.now();
    updateTimeLeft();
  }, [updateTimeLeft]);

  const pause = useCallback(() => {
    setIsRunning(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const resume = useCallback(() => {
    if (endTimeRef.current !== null && timeLeft > 0) {
      setIsRunning(true);
    }
  }, [timeLeft]);

  return {
    phase,
    timeLeft,
    isRunning,
    startPhaseTimer,
    startSequence,
    addTime,
    skip,
    pause,
    resume,
    sequenceIndex,
    sequenceLength: sequence.length,
  };
};