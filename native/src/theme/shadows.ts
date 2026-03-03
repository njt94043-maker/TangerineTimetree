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
    backgroundColor: '#252538',
    borderRadius: 16,
    elevation: config.offset,
    shadowColor: '#0a0a14',
    shadowOffset: { width: config.offset, height: config.offset },
    shadowOpacity: 0.7,
    shadowRadius: config.radius,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(55,55,80,0.25)',
    borderLeftColor: 'rgba(55,55,80,0.25)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(10,10,20,0.3)',
    borderBottomColor: 'rgba(10,10,20,0.3)',
  };
}

export function neuInsetStyle(intensity: ShadowIntensity = 'normal'): ViewStyle {
  return {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(10,10,20,0.5)',
    borderLeftColor: 'rgba(10,10,20,0.5)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(55,55,80,0.2)',
    borderBottomColor: 'rgba(55,55,80,0.2)',
  };
}
