import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './reducedMotion';

export type SoundCue =
  | 'tap'
  | 'scan'
  | 'cartAdd'
  | 'cartRemove'
  | 'waiterCall'
  | 'ticketSent'
  | 'kitchenReady'
  | 'served';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private listeners = new Set<(enabled: boolean) => void>();

  constructor() {
    if (typeof window !== 'undefined' && prefersReducedMotion()) {
      this.enabled = false;
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    this.listeners.forEach((fn) => fn(this.enabled));
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) {
      this.play('tap');
    }
    return this.enabled;
  }

  public subscribe(fn: (enabled: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public play(cue: SoundCue): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;

      switch (cue) {
        case 'tap': {
          // Subtle tactile wood/ceramic click
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(65, now + 0.035);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }
        case 'scan': {
          // Optical QR scan confirmation glide
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(740, now);
          osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.09);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }
        case 'cartAdd': {
          // Warm marimba-style pop
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.07);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }
        case 'cartRemove': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.06);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.075);
          break;
        }
        case 'waiterCall': {
          // Two-note warm table call chime (E5 -> A5)
          this.playTone(ctx, 659.25, now, 0.16, 0.09, 'sine');
          this.playTone(ctx, 880.0, now + 0.11, 0.28, 0.1, 'sine');
          break;
        }
        case 'ticketSent': {
          // Crisp order dispatch double-pulse (D5 -> G5)
          this.playTone(ctx, 587.33, now, 0.1, 0.08, 'triangle');
          this.playTone(ctx, 783.99, now + 0.09, 0.22, 0.09, 'sine');
          break;
        }
        case 'kitchenReady': {
          // Classic kitchen pass service bell (B5 + harmonic E6)
          this.playTone(ctx, 987.77, now, 0.35, 0.09, 'sine');
          this.playTone(ctx, 1318.51, now + 0.04, 0.42, 0.07, 'sine');
          break;
        }
        case 'served': {
          // Warm completion triad (C5 -> E5 -> G5)
          this.playTone(ctx, 523.25, now, 0.18, 0.07, 'sine');
          this.playTone(ctx, 659.25, now + 0.07, 0.22, 0.07, 'sine');
          this.playTone(ctx, 783.99, now + 0.14, 0.34, 0.09, 'sine');
          break;
        }
      }
    } catch {
      // Ignore Web Audio errors when autoplay is blocked
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}

export const soundFX = new SoundEngine();

export const soundEffects = {
  isEnabled: () => soundFX.isEnabled(),
  toggle: () => soundFX.toggle(),
  playClick: () => soundFX.play('tap'),
  playPop: () => soundFX.play('cartAdd'),
  playWaiterCall: () => soundFX.play('waiterCall'),
  playOrderSent: () => soundFX.play('ticketSent'),
  playKitchenReady: () => soundFX.play('kitchenReady'),
};

export function useSoundEffects() {
  const [enabled, setEnabled] = useState<boolean>(() => soundFX.isEnabled());

  useEffect(() => {
    return soundFX.subscribe(setEnabled);
  }, []);

  return {
    soundEnabled: enabled,
    toggleSound: () => soundFX.toggle(),
    playSound: (cue: SoundCue) => soundFX.play(cue),
  };
}

