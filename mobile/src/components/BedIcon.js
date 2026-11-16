import { StyleSheet, Text, View } from 'react-native';
import Tile from './Tile';
import { bedStatusStyle } from './bedStatus';
import { t } from '../i18n';
import { font } from '../theme';

export default function BedIcon({ label, status, onPress, testID = 'bed-icon' }) {
  const s = bedStatusStyle(status);
  const statusText = t(s.labelKey);
  return (
    <Tile
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${t('bed.title', { label })}, ${statusText}`}
      style={[styles.box, { backgroundColor: s.background, borderColor: s.border }]}
    >
      <View style={styles.symbolWrap}>
        <Text testID={`${testID}-symbol`} style={[styles.symbol, { color: s.text }]}>
          {s.symbol}
        </Text>
      </View>
      <Text style={[styles.label, { color: s.text }]}>{label}</Text>
      <Text testID={`${testID}-status`} style={[styles.status, { color: s.text }]} numberOfLines={1}>
        {statusText}
      </Text>
    </Tile>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 104,
    height: 104,
    borderRadius: 16,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  symbolWrap: { position: 'absolute', top: 4, right: 8 },
  symbol: { fontSize: font.large, fontWeight: '800' },
  label: { fontSize: font.huge, fontWeight: '800' },
  status: { fontSize: font.small, fontWeight: '700' },
});
