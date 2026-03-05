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
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderLeftColor: 'rgba(255,255,255,0.04)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.3)',
    borderBottomColor: 'rgba(0,0,0,0.3)',
  };
}

export function neuInsetStyle(intensity: ShadowIntensity = 'normal'): ViewStyle {
  return {
    backgroundColor: '#0c0c12',
    borderRadius: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.5)',
    borderLeftColor: 'rgba(0,0,0,0.5)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.03)',
    borderBottomColor: 'rgba(255,255,255,0.03)',
  };
}
