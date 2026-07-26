import { useState, useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  /** When true, the splash begins its exit animation and calls onComplete when done */
  ready?: boolean;
  /** Called after the exit animation finishes — unmount the splash in the parent */
  onComplete?: () => void;
  /** Minimum display time in ms before exit can begin (default: 1800) */
  minDisplayMs?: number;
}

export function SplashScreen({ ready = false, minDisplayMs = 1800, onComplete }: SplashScreenProps) {
  const [canExit, setCanExit] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Enforce minimum display time so the animation plays out
  useEffect(() => {
    const timer = setTimeout(() => setCanExit(true), minDisplayMs);
    return () => clearTimeout(timer);
  }, [minDisplayMs]);

  // Begin exit when both ready + min time elapsed
  useEffect(() => {
    if (ready && canExit && !exiting) {
      setExiting(true);
    }
  }, [ready, canExit, exiting]);

  // Fire onComplete after exit animation
  useEffect(() => {
    if (exiting && onComplete) {
      const timer = setTimeout(onComplete, 600);
      return () => clearTimeout(timer);
    }
  }, [exiting, onComplete]);

  return (
    <div className={`splash ${exiting ? 'splash--exit' : ''}`}>
      <div className="splash__content">
        {/* Logo with drop-in animation */}
        <div className="splash__icon">
          <div className="splash__warm-glow" />
          <img
            src="/logo-512.png"
            alt="The Green Tangerine"
            className="splash__logo"
            width={150}
            height={150}
          />

          {/* Juice splat particles */}
          <div className="splash__splat">
            <span className="splash__drop" />
            <span className="splash__drop" />
            <span className="splash__drop" />
            <span className="splash__drop" />
            <span className="splash__drop" />
            <span className="splash__drop" />
          </div>
        </div>

        {/* Band name — words reveal upward */}
        <div className="splash__title">
          <span className="splash__word splash__word--the">The</span>
          <span className="splash__word splash__word--green">Green</span>
          <span className="splash__word splash__word--tangerine">Tangerine</span>
        </div>

        {/* App name with expanding lines */}
        <div className="splash__tagline">
          <span className="splash__tagline-line" />
          <span className="splash__tagline-text">Timetree</span>
          <span className="splash__tagline-line" />
        </div>

        {/* Loading indicator */}
        <div className="splash__dots">
          <span className="splash__dot" />
          <span className="splash__dot" />
          <span className="splash__dot" />
        </div>
      </div>
    </div>
  );
}
