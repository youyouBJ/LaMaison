import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { floorPlanColors } from '../utils/floorPlanLayout';
import type { FloorTableStatus, FloorTableVisualShape, FloorPlanReservation } from '../types/floor';

interface Props {
  label: number;
  capacity: number;
  visualShape: FloorTableVisualShape;
  status: FloorTableStatus;
  selected: boolean;
  // Coordonnées en pourcentage (0–100) des dimensions du canvas
  x: number;
  y: number;
  w: number;
  h: number;
  canvasW: number;
  canvasH: number;
  onPress: () => void;
  reservation?: FloorPlanReservation | null;
}

interface StatusStyle {
  bg: string;
  border: string;
  text: string;
}

function statusStyle(status: FloorTableStatus): StatusStyle {
  switch (status) {
    case 'free':
      return {
        bg:     floorPlanColors.statusFreeBg,
        border: floorPlanColors.statusFree,
        text:   floorPlanColors.statusFreeText,
      };
    case 'reserved':
      return {
        bg:     floorPlanColors.statusReservedBg,
        border: floorPlanColors.statusReserved,
        text:   floorPlanColors.statusReservedText,
      };
    case 'occupied':
      return {
        bg:     floorPlanColors.statusOccupiedBg,
        border: floorPlanColors.statusOccupied,
        text:   floorPlanColors.statusOccupiedText,
      };
    case 'unavailable':
      return {
        bg:     floorPlanColors.statusUnavailableBg,
        border: floorPlanColors.statusUnavailable,
        text:   floorPlanColors.statusUnavailableText,
      };
  }
}

export default function FloorTable({
  label,
  capacity,
  visualShape,
  status,
  selected,
  x,
  y,
  w,
  h,
  canvasW,
  canvasH,
  onPress,
  reservation,
}: Props): React.JSX.Element {
  const px = (x / 100) * canvasW;
  const py = (y / 100) * canvasH;
  const pw = (w / 100) * canvasW;
  const ph = (h / 100) * canvasH;

  const { bg, border, text } = statusStyle(status);
  const isDiamond = visualShape === 'diamond';
  const isRound   = visualShape === 'round';

  const borderRadius = isRound
    ? Math.min(pw, ph) / 2
    : isDiamond
    ? 4
    : 5;

  const borderColor = selected ? floorPlanColors.selectionBorder : border;
  const borderWidth = selected ? 2.5 : 1.5;

  const minDim   = Math.min(pw, ph);
  const fontSize = Math.max(8, Math.min(14, minDim * 0.34));

  // Ombre portée — plus intense pour la sélection
  const shadowColor   = selected ? floorPlanColors.selectionShadow : 'rgba(0,0,0,0.65)';
  const shadowRadius  = selected ? 10 : 4;
  const shadowOpacity = selected ? 1   : 0.55;
  const elevation     = selected ? 12  : 3;

  return (
    <TouchableOpacity
      style={[
        styles.wrapper,
        {
          left:         px,
          top:          py,
          width:        pw,
          height:       ph,
          borderRadius,
          // L'ombre est sur le wrapper (pas de overflow:hidden ici)
          shadowColor,
          shadowOffset:  { width: 0, height: selected ? 0 : 2 },
          shadowOpacity,
          shadowRadius,
          elevation,
        },
        isDiamond && styles.diamond,
      ]}
      onPress={onPress}
      activeOpacity={0.70}
      accessibilityRole="button"
      accessibilityLabel={`Table ${label}, ${capacity} couvert${capacity > 1 ? 's' : ''}, ${status}`}
      accessibilityState={{ selected }}
    >
      {/* Fond + bordure + contenu — overflow:hidden pour clipping propre */}
      <View
        style={[
          styles.cell,
          {
            borderRadius,
            backgroundColor: bg,
            borderColor,
            borderWidth,
          },
        ]}
      >
        {/* Reflet subtil en haut de la table pour donner du relief */}
        <View style={[styles.topSheen, { borderRadius }]} />

        <Text
          style={[
            styles.number,
            { fontSize, color: text },
            isDiamond && styles.diamondText,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>

        {/* Nombre de couverts si réservation et table assez grande */}
        {reservation && !isDiamond && minDim > 22 ? (
          <Text
            style={[
              styles.hint,
              { fontSize: Math.max(6, fontSize - 3), color: text },
            ]}
            numberOfLines={1}
          >
            {reservation.partySize}p
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  diamond: {
    transform: [{ rotate: '45deg' }],
  },
  cell: {
    width:          '100%',
    height:         '100%',
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  // Reflet très subtil sur le bord haut, comme un plan de travail éclairé
  topSheen: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  number: {
    fontFamily: 'Inter_600SemiBold',
    textAlign:  'center',
  },
  diamondText: {
    transform: [{ rotate: '-45deg' }],
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    textAlign:  'center',
    opacity:    0.80,
  },
});
