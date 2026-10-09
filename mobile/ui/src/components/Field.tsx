import { StyleSheet, View } from 'react-native';
import { SPACE } from '../theme/tokens';
import { Body, Description } from './Typography';

const styles = StyleSheet.create({ field: { gap: SPACE.XS } });

/** One named value. A screen reader hears the name and the value together. */
export function Field({ name, value }: { name: string; value: string }) {
  return (
    <View accessible style={styles.field}>
      <Description>{name}</Description>
      <Body>{value}</Body>
    </View>
  );
}
