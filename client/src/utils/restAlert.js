// src/utils/restAlert.js
export const triggerRestCompleteAlert = () => {
  const enableHaptics = localStorage.getItem('enableHaptics') === 'true';
  const enableAudio = localStorage.getItem('enableAudioChime') === 'true';

  // 1. Mobile Haptic Vibration
  if (enableHaptics && typeof window !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  // 2. Synthesized Sound Effect
  if (enableAudio) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.22);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.22);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }
};