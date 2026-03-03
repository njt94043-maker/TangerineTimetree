export const COLORS = {
  // Neumorphic base (same as Budget)
  background: '#1e1e2e',
  card: '#252538',
  cardLight: '#2a2a40',
  text: '#c8c8d8',
  textDim: '#6a6a80',
  textMuted: '#44445a',
  danger: '#ef5350',
  warning: '#ffb74d',
  success: '#66bb6a',

  // TGT Brand
  teal: '#1abc9c',
  tealDark: '#16a085',
  orange: '#f39c12',
  orangeDark: '#e67e22',
  purple: '#bb86fc',

  // Calendar — synced with Tangerine Timetree
  calGig: '#00e676',
  calPractice: '#bb86fc',
  calAvailable: '#333344',
  calAway: '#ff5252',
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
