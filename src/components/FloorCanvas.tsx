import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  floorPlanColors,
  LA_MAISON_FLOOR_ZONES,
  LA_MAISON_ARCH_ELEMENTS,
} from '../utils/floorPlanLayout';
import type { FloorZoneDefinition, FloorArchElement } from '../utils/floorPlanLayout';
import FloorTable from './FloorTable';
import FloorZoneLabel from './FloorZoneLabel';
import type { FloorTableWithState, FloorLabelLayout } from '../types/floor';

// Ratio hauteur/largeur du canvas.
// 100/103 ≈ 0.97 → le canvas est légèrement plus large que haut.
const CANVAS_ASPECT = 100 / 103;
const MIN_CANVAS_W  = 620;

interface Props {
  tables: FloorTableWithState[];
  labels: FloorLabelLayout[];
  selectedTableId: number | null;
  onTablePress: (table: FloorTableWithState) => void;
  availableWidth: number;
  availableHeight: number;
}

export default function FloorCanvas({
  tables,
  labels,
  selectedTableId,
  onTablePress,
  availableWidth,
  availableHeight,
}: Props): React.JSX.Element {
  const [scrollW, setScrollW] = useState(availableWidth);

  const canvasH  = availableHeight;
  const canvasW  = Math.max(MIN_CANVAS_W, canvasH / CANVAS_ASPECT);
  const effectiveW = Math.max(canvasW, scrollW);

  return (
    // frameShadow : porte l'ombre (pas d'overflow hidden → ombre visible sur iOS)
    <View style={styles.frameShadow}>
      {/* frameClip : porte le border radius + le clip du contenu */}
      <View style={styles.frameClip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setScrollW(e.nativeEvent.layout.width)}
          contentContainerStyle={{ width: effectiveW }}
          style={styles.scrollOuter}
          scrollEnabled={canvasW > availableWidth}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ height: canvasH }}
            scrollEnabled={false}
            style={styles.scrollInner}
          >
            {/* ── Canvas principal ─────────────────────────────────────── */}
            <View style={[styles.canvas, { width: effectiveW, height: canvasH }]}>

              {/* 1 — Zones colorées (couche de fond) */}
              {renderZones(LA_MAISON_FLOOR_ZONES, effectiveW, canvasH)}

              {/* 2 — Éléments architecturaux : comptoirs + séparateurs */}
              {renderArchElements(LA_MAISON_ARCH_ELEMENTS, effectiveW, canvasH)}

              {/* 3 — Grille très discrète */}
              {renderGrid(effectiveW, canvasH)}

              {/* 4 — Labels de zones (sous les tables) */}
              {labels.map((lbl) => (
                <FloorZoneLabel
                  key={lbl.id}
                  lines={lbl.lines}
                  x={lbl.x}
                  y={lbl.y}
                  rotation={lbl.rotation}
                  zone={lbl.zone}
                  canvasW={effectiveW}
                  canvasH={canvasH}
                />
              ))}

              {/* 5 — Tables (couche interactive au premier plan) */}
              {tables.map((t) => (
                <FloorTable
                  key={t.id}
                  label={t.id}
                  capacity={t.capacity}
                  visualShape={t.shape}
                  status={t.computedStatus}
                  selected={selectedTableId === t.id}
                  x={t.x}
                  y={t.y}
                  w={t.w}
                  h={t.h}
                  canvasW={effectiveW}
                  canvasH={canvasH}
                  onPress={() => onTablePress(t)}
                  reservation={t.reservation}
                />
              ))}

            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Zones visuelles ─────────────────────────────────────────────────────────

function renderZones(
  zones: FloorZoneDefinition[],
  cw: number,
  ch: number,
): React.ReactNode {
  return zones.map((zone) => (
    <View
      key={zone.key}
      pointerEvents="none"
      style={{
        position:        'absolute',
        left:            (zone.x / 100) * cw,
        top:             (zone.y / 100) * ch,
        width:           (zone.w / 100) * cw,
        height:          (zone.h / 100) * ch,
        backgroundColor: zone.fillColor,
        borderWidth:     1,
        borderColor:     zone.strokeColor,
        borderRadius:    zone.borderRadius,
      }}
    />
  ));
}

// ─── Éléments architecturaux ─────────────────────────────────────────────────

function renderArchElements(
  elements: FloorArchElement[],
  cw: number,
  ch: number,
): React.ReactNode {
  return elements.map((el, i) => (
    <View
      key={`arch-${i}`}
      pointerEvents="none"
      style={{
        position:        'absolute',
        left:            (el.x / 100) * cw,
        top:             (el.y / 100) * ch,
        width:           (el.w / 100) * cw,
        height:          (el.h / 100) * ch,
        backgroundColor: el.color,
        borderRadius:    el.borderRadius ?? 0,
      }}
    />
  ));
}

// ─── Grille discrète ─────────────────────────────────────────────────────────

function renderGrid(width: number, height: number): React.ReactNode {
  const step = 64; // pas en points — moins fréquente que la version précédente
  const lines: React.ReactElement[] = [];

  for (let x = step; x < width; x += step) {
    lines.push(
      <View
        key={`gv${x}`}
        pointerEvents="none"
        style={[styles.gridLine, { left: x, top: 0, width: 1, height }]}
      />,
    );
  }
  for (let y = step; y < height; y += step) {
    lines.push(
      <View
        key={`gh${y}`}
        pointerEvents="none"
        style={[styles.gridLine, { left: 0, top: y, width, height: 1 }]}
      />,
    );
  }
  return lines;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Porte l'ombre (séparé du clip pour que l'ombre soit visible sur iOS)
  frameShadow: {
    flex:          1,
    borderRadius:  10,
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius:  16,
    elevation:     12,
  },
  // Clips le contenu au borderRadius + porte la bordure visible
  frameClip: {
    flex:        1,
    borderRadius: 10,
    overflow:    'hidden',
    borderWidth:  1,
    borderColor:  floorPlanColors.canvasBorder,
  },
  scrollOuter: {
    flex: 1,
  },
  scrollInner: {
    flex: 1,
  },
  canvas: {
    backgroundColor: floorPlanColors.canvasBg,
    position:        'relative',
    overflow:        'hidden',
  },
  gridLine: {
    position:        'absolute',
    backgroundColor: floorPlanColors.gridLine,
  },
});
