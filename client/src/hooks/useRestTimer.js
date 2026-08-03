// src/hooks/useRestTimer.js
import { useState, useEffect } from 'react';
import { triggerRestCompleteAlert } from '../utils/restAlert';

export const useRestTimer = () => {
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isRestTimerRunning && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (restTimeLeft === 0 && isRestTimerRunning) {
      setIsRestTimerRunning(false);
      triggerRestCompleteAlert();
    }
    return () => clearInterval(interval);
  }, [isRestTimerRunning, restTimeLeft]);

  const addRestTime = (seconds) => {
    setRestTimeLeft(prev => prev + seconds);
    setIsRestTimerRunning(true);
  };

  const startRestTimer = (seconds) => {
    setRestTimeLeft(seconds);
    setIsRestTimerRunning(true);
  };

  const togglePauseRestTimer = () => {
    if (restTimeLeft > 0) {
      setIsRestTimerRunning(prev => !prev);
    }
  };

  const skipRest = () => {
    setRestTimeLeft(0);
    setIsRestTimerRunning(false);
  };

  return {
    restTimeLeft,
    isRestTimerRunning,
    addRestTime,
    startRestTimer,
    togglePauseRestTimer,
    skipRest,
  };
};