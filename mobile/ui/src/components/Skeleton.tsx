import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useUi } from '../context/ui-context';
import { runMotion } from '../logic/motion';
import { MOTION, OPACITY, RADIUS, SPACE } from '../theme/tokens';

const styles = StyleSheet.create({
  line: { borderRadius: RADIUS.BADGE },
  group: { gap: SPACE.MD },
});

interface SkeletonLineProps {
  width: DimensionValue;
  height: number;
}

/** A placeholder the size of the text it stands for. It pulses unless motion is reduced. */
export function SkeletonLine({ width, height }: SkeletonLineProps) {
  const { colors, reduceMotion } = useUi();
  const opacity = useRef(new Animated.Value(OPACITY.FULL)).current;

  useEffect(() => {
    const fade = (toValue: number) =>
      Animated.timing(opacity, { toValue, duration: MOTION.SKELETON_MS, useNativeDriver: true });
    return runMotion(
      !reduceMotion,
      () => opacity.setValue(OPACITY.FULL),
      () => Animated.loop(Animated.sequence([fade(OPACITY.SKELETON_LOW), fade(OPACITY.FULL)])),
    );
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[styles.line, { width, height, opacity, backgroundColor: colors.skeleton }]}
    />
  );
}

/** Reads as one "loading" element instead of a row of unnamed boxes. */
export function SkeletonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.group}
    >
      {children}
    </View>
  );
}
