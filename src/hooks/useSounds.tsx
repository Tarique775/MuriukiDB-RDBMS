import { useState, useCallback, useEffect, useRef } from 'react';

// Sound settings storage key
const STORAGE_KEY = 'muriukidb-sounds-enabled';

// Musical notes in Hz
const NOTES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.00,
  B5: 987.77,
  C6: 1046.50,
};

export function useSounds() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  });

  const audioContextRef = useRef<AudioContext | null>(null);

  // Lazily initialize AudioContext on first sound play
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    
    // Resume if suspended (autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  // Toggle enabled state
  const toggleEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  // Play a single tone with envelope
  const playTone = useCallback((
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3,
    attackTime: number = 0.01,
    decayTime: number = 0.1
  ) => {
    if (!enabled) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // ADSR envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + attackTime + decayTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, [enabled, getAudioContext]);

  // Play frequency sweep
  const playSweep = useCallback((
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3
  ) => {
    if (!enabled) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, [enabled, getAudioContext]);

  // XP Gain - Quick ascending ding
  const playXP = useCallback(() => {
    if (!enabled) return;
    playSweep(400, 800, 0.1, 'sine', 0.2);
  }, [enabled, playSweep]);

  // Success - Two-note chord (C5 + E5)
  const playSuccess = useCallback(() => {
    if (!enabled) return;
    playTone(NOTES.C5, 0.15, 'sine', 0.2);
    playTone(NOTES.E5, 0.15, 'sine', 0.15);
  }, [enabled, playTone]);

  // Error - Descending buzz
  const playError = useCallback(() => {
    if (!enabled) return;
    playSweep(300, 150, 0.2, 'square', 0.15);
  }, [enabled, playSweep]);

  // Achievement - Celebratory arpeggio (C5→E5→G5→C6)
  const playAchievement = useCallback(() => {
    if (!enabled) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6];
    const noteLength = 0.1;
    
    notes.forEach((freq, i) => {
      const startTime = ctx.currentTime + i * noteLength;
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, startTime + noteLength + 0.05);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + noteLength + 0.1);
    });
  }, [enabled, getAudioContext]);

  // Rank Up - Epic power-up sweep with harmonics
  const playRankUp = useCallback(() => {
    if (!enabled) return;
    
    const ctx = getAudioContext();
    if (!ctx) return;

    // Main sweep
    playSweep(200, 800, 0.4, 'sine', 0.25);
    
    // Harmonic overlay
    setTimeout(() => {
      playSweep(400, 1200, 0.3, 'sine', 0.15);
    }, 100);
    
    // Final chord
    setTimeout(() => {
      playTone(NOTES.C5, 0.2, 'sine', 0.2);
      playTone(NOTES.E5, 0.2, 'sine', 0.15);
      playTone(NOTES.G5, 0.2, 'sine', 0.15);
    }, 350);
  }, [enabled, getAudioContext, playSweep, playTone]);

  // Click - Short subtle tick
  const playClick = useCallback(() => {
    if (!enabled) return;
    playTone(800, 0.02, 'sine', 0.1);
  }, [enabled, playTone]);

  // Listen for game events (achievements, rank ups)
  useEffect(() => {
    const handleAchievement = () => playAchievement();
    const handleRankUp = () => playRankUp();

    window.addEventListener('muriukidb:achievement', handleAchievement);
    window.addEventListener('muriukidb:rankup', handleRankUp);

    return () => {
      window.removeEventListener('muriukidb:achievement', handleAchievement);
      window.removeEventListener('muriukidb:rankup', handleRankUp);
    };
  }, [playAchievement, playRankUp]);

  return {
    enabled,
    setEnabled: toggleEnabled,
    playXP,
    playSuccess,
    playError,
    playAchievement,
    playRankUp,
    playClick,
  };
}

// Export type for context
export type SoundsContextType = ReturnType<typeof useSounds>;
