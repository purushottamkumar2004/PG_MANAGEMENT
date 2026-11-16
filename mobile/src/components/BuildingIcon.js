import { Image, StyleSheet, Text, View } from 'react-native';
import Tile from './Tile';
import { t } from '../i18n';
import { colors, font } from '../theme';

export default function BuildingIcon({ name, photoUrl, freeBeds, totalBeds, onPress, testID = 'building-icon' }) {
  const freeText = t('building.free', { free: freeBeds, total: totalBeds });
  const hasFree = freeBeds > 0;
  return (
    <Tile
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${name}, ${freeText}`}
      style={styles.card}
    >
      {photoUrl ? (
        <Image testID={`${testID}-photo`} source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View testID={`${testID}-placeholder`} style={[styles.photo, styles.placeholder]}>
          <Text style={styles.placeholderIcon}>🏢</Text>
        </View>
      )}
      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <View
          testID={`${testID}-badge`}
          style={[styles.badge, { backgroundColor: hasFree ? colors.vacant : colors.unknown }]}
        >
          <Text style={styles.badgeText}>{freeText}</Text>
        </View>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 140 },
  placeholder: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 64 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  name: { flex: 1, fontSize: font.large, fontWeight: '700', color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: font.body, fontWeight: '700' },
});
