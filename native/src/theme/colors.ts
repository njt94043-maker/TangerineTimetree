export const COLORS = {
  // Unified palette — matches web/mockup
  background: '#08080c',
  card: '#111118',
  cardLight: '#16161f',
  text: '#d0d0dc',
  textDim: '#7a7a94',
  textMuted: '#4a4a60',
  danger: '#ff5252',
  warning: '#ffb74d',
  success: '#00e676',

  // TGT Brand
  teal: '#1abc9c',
  tealDark: '#16a085',
  orange: '#f39c12',
  orangeDark: '#d4850b',
  purple: '#bb86fc',
  green: '#00e676',
  greenDark: '#00c853',

  // Calendar — synced with Tangerine Timetree
  calGig: '#00e676',
  calPractice: '#bb86fc',
  calAvailable: '#4a4a60',
  calAway: '#ff5252',

  // Depth
  border: '#2a2a3a',
  inset: '#0a0a10',
} as const;

// PDF template colors (light background, professional look)
export const PDF_COLORS = {
  headerBg: '#1abc9c',
  headerText: '#ffffff',
  accentRule: '#f39c12',
  tableHeaderBg: '#f39c12',
  tableHeaderText: '#ffffff',
  totalBarBg: '#f39c12',
  totalBarText: '#ffffff',
  footerBg: '#1abc9c',
  footerText: '#ffffff',
  bodyText: '#333333',
  labelText: '#666666',
} as const;
