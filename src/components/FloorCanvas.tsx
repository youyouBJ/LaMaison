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

const CANVAS_ASPECT = 100 / 103; // légèrement plus large que haut
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

  const canvasH    = availableHeight;
  const canvasW    = Math.max(MIN_CANVAS_W, canvasH / CANVAS_ASPECT);
  const effectiveW = Math.max(canvasW, scrollW);

  return (
    // frameShadow : porte l'ombre — séparé du clip pour iOS
    <View style={styles.frameShadow}>
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
            <View style={[styles.canvas, { width: effectiveW, height: canvasH }]}>

              {/* 1 — Halo chaud central : donne de la profondeur sans gradient */}
              {renderWarmthOverlay(effectiveW, canvasH)}

              {/* 2 — Zones colorées */}
              {renderZones(LA_MAISON_FLOOR_ZONES, effectiveW, canvasH)}

              {/* 3 — Éléments architecturaux */}
              {renderArchElements(LA_MAISON_ARCH_ELEMENTS, effectiveW, canvasH)}

              {/* 4 — Grille très discrète */}
              {renderGrid(effectiveW, canvasH)}

              {/* 5 — Labels de zones */}
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

              {/* 6 — Tables interactives */}
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

              {/* 7 — Encadrement interne décoratif (dernier = par-dessus tout) */}
              {renderInnerFrame(effectiveW, canvasH)}

            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Halo chaud central ───────────────────────────────────────────────────────
// Simule un léger éclairage ambiant warm en centre de plan, sans librairie gradient.

function renderWarmthOverlay(cw: number, ch: number): React.ReactNode {
  return (
    <View
      pointerEvents="none"
      style={{
        position:        'absolute',
        left:            cw * 0.14,
        top:             ch * 0.06,
        width:           cw * 0.72,
        height:          ch * 0.88,
        borderRadius:    cw * 0.36,
        backgroundColor: floorPlanColors.canvasWarmOverlay,
      }}
    />
  );
}

// ─── Zones visuelles ──────────────────────────────────────────────────────────

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
        borderWidth:     0.5,
        borderColor:     zone.strokeColor,
        borderRadius:    zone.borderRadius,
      }}
    />
  ));
}

// ─── Éléments architecturaux ──────────────────────────────────────────────────

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
        // Reflet or sur le bord supérieur des comptoirs (lumière ambiante)
        borderTopWidth:  el.type === 'counter' ? 0.5 : 0,
        borderTopColor:  floorPlanColors.counterHighlight,
        borderLeftWidth:   0,
        borderRightWidth:  0,
        borderBottomWidth: 0,
      }}
    />
  ));
}

// ─── Grille discrète ──────────────────────────────────────────────────────────

function renderGrid(width: number, height: number): React.ReactNode {
  const step = 80; // pas augmenté → moins de lignes → plus aéré
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

// ─── Encadrement interne décoratif ────────────────────────────────────────────
// Fine ligne or à l'intérieur du canvas, comme un cadre d'oeuvre encadrée.

function renderInnerFrame(cw: number, ch: number): React.ReactNode {
  return (
    <View
      pointerEvents="none"
      style={{
        position:    'absolute',
        top:         5,
        left:        5,
        width:       cw - 10,
        height:      ch - 10,
        borderWidth:  0.5,
        borderColor:  floorPlanColors.canvasInnerBorder,
        borderRadius: 8,
      }}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  frameShadow: {
    flex:          1,
    borderRadius:  10,
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius:  16,
    elevation:     12,
  },
  frameClip: {
    flex:         1,
    borderRadius: 10,
    overflow:     'hidden',
    borderWidth:   1,
    borderColor:   floorPlanColors.canvasBorder,
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
