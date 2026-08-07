// src/components/workout/SwipeUnlockOverlay.jsx
import { useState, useRef, useEffect } from 'react';

export default function SwipeUnlockOverlay({ onUnlock }) {
  const [showSlider, setShowSlider] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thumbX, setThumbX] = useState(0);       // pixel offset from left of track
  const trackRef = useRef(null);
  const thumbSize = 56;                           // circle diameter in px
  const threshold = 0.8;                          // 80% of track width to unlock

  // Wake Lock
  useEffect(() => {
    let wakeLock = null;
    async function requestWakeLock() {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        // not supported or denied – nothing we can do
      }
    }
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  // Convert touch/mouse clientX to local X relative to the track
  const getTrackLeft = () => trackRef.current?.getBoundingClientRect().left ?? 0;
  const getTrackWidth = () => trackRef.current?.getBoundingClientRect().width ?? 300;

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  const startDrag = (e) => {
    if (!showSlider) return;
    setDragging(true);
    // Set initial position based on current touch/click
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const trackLeft = getTrackLeft();
    setThumbX(clamp(clientX - trackLeft, 0, getTrackWidth() - thumbSize));
  };

  const onDrag = (e) => {
    if (!dragging) return;
    e.preventDefault(); // prevent scroll on mobile while dragging
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const trackLeft = getTrackLeft();
    setThumbX(clamp(clientX - trackLeft, 0, getTrackWidth() - thumbSize));
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    const trackWidth = getTrackWidth();
    if (thumbX / trackWidth >= threshold) {
      // Unlock!
      onUnlock();
    } else {
      // Snap back to start
      setThumbX(0);
    }
  };

  // Touch / pointer event handlers on the slider track
  const handleTrackStart = (e) => {
    // Only allow drag to start if the slider is visible
    if (!showSlider) return;
    startDrag(e);
  };

  // When the screen is first touched, reveal the slider
  const handleScreenTap = () => {
    if (!showSlider) {
      setShowSlider(true);
    }
  };

  return (
    <div
      onClick={handleScreenTap}
      onTouchStart={handleScreenTap}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {showSlider && (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <p style={{ color: '#888', marginBottom: '20px', fontSize: '1rem' }}>
            Slide to unlock
          </p>
          <div
            ref={trackRef}
            onTouchStart={handleTrackStart}
            onTouchMove={onDrag}
            onTouchEnd={endDrag}
            onMouseDown={handleTrackStart}
            onMouseMove={onDrag}
            onMouseUp={endDrag}
            style={{
              width: '80%',
              maxWidth: '300px',
              height: '8px',
              backgroundColor: '#333',
              borderRadius: '4px',
              margin: '0 auto',
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${thumbX}px`,
                transform: 'translate(-50%, -50%)',
                width: `${thumbSize}px`,
                height: `${thumbSize}px`,
                borderRadius: '50%',
                backgroundColor: '#4ade80',
                transition: dragging ? 'none' : 'left 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#111',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                userSelect: 'none',
              }}
            >
              ➔
            </div>
          </div>
        </div>
      )}
      {!showSlider && (
        <p style={{ color: '#666', fontSize: '0.9rem' }}>Tap to wake</p>
      )}
    </div>
  );
}