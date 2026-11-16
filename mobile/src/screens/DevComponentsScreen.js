import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BuildingIcon from '../components/BuildingIcon';
import FloorIcon from '../components/FloorIcon';
import RoomIcon from '../components/RoomIcon';
import BedIcon from '../components/BedIcon';
import { BED_STATUS_LIST } from '../components/bedStatus';
import { t } from '../i18n';
import { colors, font } from '../theme';

const noop = () => {};

// Dev-only catalogue of every icon in every state. The route is only
// registered when __DEV__ is true (see src/app/_layout.js).
export default function DevComponentsScreen() {
  return (
    <SafeAreaView style={styles.safe} testID="dev-components-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('dev.title')}</Text>

        <Text style={styles.section}>{t('dev.buildings')}</Text>
        <BuildingIcon testID="dev-building-photo" name="Shanti PG" photoUrl="https://picsum.photos/600/300" freeBeds={4} totalBeds={24} onPress={noop} />
        <BuildingIcon testID="dev-building-placeholder" name="Sai Residency" freeBeds={0} totalBeds={18} onPress={noop} />

        <Text style={styles.section}>{t('dev.floors')}</Text>
        <FloorIcon testID="dev-floor-ground" floorNumber={0} freeBeds={2} onPress={noop} />
        <FloorIcon testID="dev-floor-full" floorNumber={3} freeBeds={0} onPress={noop} />

        <Text style={styles.section}>{t('dev.rooms')}</Text>
        <View style={styles.row}>
          <RoomIcon testID="dev-room-2" roomNumber="101" bedCapacity={2} onPress={noop} />
          <RoomIcon testID="dev-room-3" roomNumber="102" bedCapacity={3} onPress={noop} />
        </View>

        <Text style={styles.section}>{t('dev.beds')}</Text>
        <View style={styles.row}>
          {BED_STATUS_LIST.map((status, i) => (
            <BedIcon key={status} testID={`dev-bed-${status}`} label={'ABCDE'[i]} status={status} onPress={noop} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  title: { fontSize: font.title, fontWeight: '800', color: colors.text },
  section: { fontSize: font.large, fontWeight: '700', color: colors.textMuted, marginTop: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
