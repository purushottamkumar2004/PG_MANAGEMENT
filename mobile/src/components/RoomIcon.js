import { StyleSheet, Text, View } from 'react-native';
import Tile from './Tile';
import { t } from '../i18n';
import { colors, font } from '../theme';

// 2-bed rooms are square, 3-bed rooms are wider. The bed pips and the
// "N beds" text say the same thing, so shape is never the only signal.
export default function RoomIcon({ roomNumber, bedCapacity, onPress, testID = 'room-icon' }) {
  const capacity = bedCapacity === 3 ? 3 : 2;
  const title = t('room.title', { number: roomNumber });
  const bedsText = t('room.beds', { count: capacity });
  return (
    <Tile
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${title}, ${bedsText}`}
      style={[styles.box, capacity === 3 ? styles.wide : styles.square]}
    >
      <Text style={styles.number} numberOfLines={1}>
        {roomNumber}
      </Text>
      <View style={styles.pips}>
        {Array.from({ length: capacity }).map((_, i) => (
          <View key={i} testID={`${testID}-pip`} style={styles.pip} />
        ))}
      </View>
      <Text style={styles.beds}>{bedsText}</Text>
    </Tile>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 120,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.textMuted,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
  },
  square: { width: 120 },
  wide: { width: 168 },
  number: { fontSize: font.title, fontWeight: '800', color: colors.text },
  pips: { flexDirection: 'row', gap: 6 },
  pip: { width: 24, height: 12, borderRadius: 4, backgroundColor: colors.textMuted },
  beds: { fontSize: font.small, fontWeight: '600', color: colors.textMuted },
});
