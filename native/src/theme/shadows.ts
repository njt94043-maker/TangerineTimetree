import { ViewStyle } from 'react-native';

export type ShadowIntensity = 'subtle' | 'normal' | 'strong';

const SHADOW_CONFIG = {
  subtle: { offset: 3, radius: 7 },
  normal: { offset: 6, radius: 14 },
  strong: { offset: 8, radius: 18 },
} as const;

export function neuRaisedStyle(intensity: ShadowIntensity = 'normal'): ViewStyle {
  const config = SHADOW_CONFIG[intensity];
  return {
    backgroundColor: '#111118',
    borderRadius: 16,
    elevation: config.offset,
    shadowColor: '#000000',
    shadowOffset: { width: config.offset, height: config.offset },
    shadowOpacity: 0.8,
    shadowRadius: config.radius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  };
}

export function neuInsetStyle(_intensity: ShadowIntensity = 'normal'): ViewStyle {
  return {
    backgroundColor: '#0c0c12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  };
}
