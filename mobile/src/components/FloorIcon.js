import { StyleSheet, Text, View } from 'react-native';
import Tile from './Tile';
import { t } from '../i18n';
import { colors, font } from '../theme';

export default function FloorIcon({ floorNumber, freeBeds, onPress, testID = 'floor-icon' }) {
  const title = floorNumber === 0 ? t('floor.ground') : t('floor.title', { number: floorNumber });
  const freeText = t('floor.free', { free: freeBeds });
  return (
    <Tile testID={testID} onPress={onPress} accessibilityLabel={`${title}, ${freeText}`} style={styles.box}>
      <View style={styles.numberWrap}>
        <Text style={styles.number}>{floorNumber === 0 ? 'G' : floorNumber}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.badge, { backgroundColor: freeBeds > 0 ? colors.vacant : colors.unknown }]}>
        <Text style={styles.badgeText}>{freeText}</Text>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  numberWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 6,
    borderBottomColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontSize: font.huge, fontWeight: '800', color: colors.text },
  title: { flex: 1, fontSize: font.large, fontWeight: '700', color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  badgeText: { color: '#FFFFFF', fontSize: font.body, fontWeight: '700' },
});
