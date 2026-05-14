export const colors = {
  background:               '#F5F0E8',
  surface:                  '#FFFFFF',
  surfaceWarm:              '#FBF5ED',

  primary:                  '#2C1810',
  primaryLight:             '#5C3317',
  border:                   '#E8DDD0',
  borderLight:              '#F0EAE0',

  cta:                      '#8B1A1A',
  ctaLight:                 '#F9ECEC',
  gold:                     '#B8973A',
  goldLight:                '#F7F0DC',
  sand:                     '#C4A882',
  sandLight:                '#D4C4A8',

  statusFree:               '#2D6A4F',
  statusFreeLight:          '#E8F5F0',
  statusReserved:           '#B8973A',
  statusReservedLight:      '#F7F0DC',
  statusOccupied:           '#8B1A1A',
  statusOccupiedLight:      '#FBF0F0',
  statusUnavailable:        '#9B9B9B',
  statusUnavailableLight:   '#F0EEEC',

  textPrimary:              '#2C1810',
  textSecondary:            '#5C3317',
  textMuted:                '#C4A882',
  textOnDark:               '#F5F0E8',
};

export const typography = {
  display:    { fontFamily: 'PlayfairDisplay_700Bold',     fontSize: 32 },
  h1:         { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 24 },
  h2:         { fontFamily: 'Inter_600SemiBold',           fontSize: 18 },
  body:       { fontFamily: 'Inter_400Regular',            fontSize: 15 },
  bodyMedium: { fontFamily: 'Inter_500Medium',             fontSize: 15 },
  small:      { fontFamily: 'Inter_400Regular',            fontSize: 13 },
  label:      { fontFamily: 'Inter_500Medium',             fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  stat:       { fontFamily: 'Inter_600SemiBold',           fontSize: 28 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
};
