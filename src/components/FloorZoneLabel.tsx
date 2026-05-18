import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { floorPlanColors } from '../utils/floorPlanLayout';
import type { FloorZoneKey } from '../types/floor';

interface Props {
  lines: string[];
  x: number;        // % de la largeur du canvas
  y: number;        // % de la hauteur du canvas
  rotation: number; // degrés
  zone: FloorZoneKey;
  canvasW: number;
  canvasH: number;
}

export default function FloorZoneLabel({
  lines,
  x,
  y,
  rotation,
  canvasW,
  canvasH,
}: Props): React.JSX.Element {
  const px = (x / 100) * canvasW;
  const py = (y / 100) * canvasH;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrapper,
        {
          left:      px,
          top:       py,
          transform: [{ rotate: `${rotation}deg` }],
        },
      ]}
    >
      <View style={styles.capsule}>
        {lines.map((line, i) => (
          <Text key={i} style={[styles.line, i > 0 && styles.lineAfterFirst]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  capsule: {
    backgroundColor:   floorPlanColors.labelBg,
    borderWidth:       1,
    borderColor:       floorPlanColors.labelBorder,
    borderRadius:      8,
    paddingHorizontal: 9,
    paddingVertical:   5,
    alignItems:        'center',
    // Ombre pour que le label ressort sur le fond sombre
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius:  4,
    elevation:     4,
  },
  line: {
    fontFamily:    'Inter_600SemiBold',
    fontSize:      9,
    color:         floorPlanColors.labelText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign:     'center',
    lineHeight:    13,
  },
  lineAfterFirst: {
    opacity: 0.85,
  },
});
