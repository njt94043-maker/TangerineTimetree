import { TextStyle } from 'react-native';
import { COLORS } from './colors';

export const FONTS = {
  body: 'Karla_400Regular',
  bodyBold: 'Karla_700Bold',
  mono: 'JetBrainsMono_700Bold',
  monoRegular: 'JetBrainsMono_400Regular',
} as const;

export const LABEL: TextStyle = {
  fontFamily: FONTS.bodyBold,
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 2,
  color: COLORS.textDim,
};

export const DATA_VALUE: TextStyle = {
  fontFamily: FONTS.mono,
  fontWeight: 'bold',
  fontSize: 24,
};

export const BODY: TextStyle = {
  fontFamily: FONTS.body,
  fontSize: 12,
  color: COLORS.text,
};

export const BODY_BOLD: TextStyle = {
  fontFamily: FONTS.bodyBold,
  fontSize: 12,
  color: COLORS.text,
};
