import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BedIcon from '../../components/BedIcon';
import BigButton from '../../components/BigButton';
import PlaceHeader from '../../components/PlaceHeader';
import { ErrorBanner, ErrorView, LoadingView } from '../../components/LoadState';
import { structureApi } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useSession } from '../../session/SessionContext';
import { floorTitle, formatDate, formatMonth, formatRupees, maskAadhaar, placeText, telUrl } from '../../format';
import { t } from '../../i18n';
import { colors, font, MIN_TOUCH } from '../../theme';

function Row({ label, value, testID }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text testID={testID} style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

function CurrentMonth({ current }) {
  if (!current) {
    return (
      <View style={styles.card} testID="current-month">
        <Text testID="current-month-none" style={styles.muted}>
          {t('bedDetail.noBill')}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.card} testID="current-month">
      <Text style={styles.cardTitle}>{t('bedDetail.thisMonth', { month: formatMonth(current.month) })}</Text>
      <Row label={t('bedDetail.due')} value={formatRupees(current.amount_due)} testID="month-due" />
      <Row label={t('bedDetail.paid')} value={formatRupees(current.amount_paid)} testID="month-paid" />
      <Row
        label={t('bedDetail.status')}
        value={t(`payment.status.${current.payment_status}`)}
        testID="month-status"
      />
      {current.payment_date ? (
        <Row label={t('bedDetail.paidOn')} value={formatDate(current.payment_date)} testID="month-paid-on" />
      ) : null}
    </View>
  );
}

function TenantDetails({ tenant }) {
  const tel = telUrl(tenant.phone);
  return (
    <>
      <View style={styles.card}>
        <Text testID="tenant-name" style={styles.name}>
          👤 {tenant.name}
        </Text>
        {tel ? (
          <Pressable
            testID="tenant-phone"
            onPress={() => Linking.openURL(tel)}
            accessibilityRole="link"
            accessibilityLabel={t('bedDetail.callLabel', { name: tenant.name })}
            style={({ pressed }) => [styles.call, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.callText}>{t('bedDetail.call', { phone: tenant.phone })}</Text>
          </Pressable>
        ) : null}
        {tenant.age !== null && tenant.age !== undefined ? (
          <Row label={t('bedDetail.age')} value={String(tenant.age)} testID="tenant-age" />
        ) : null}
        <Row label={t('bedDetail.rent')} value={formatRupees(tenant.monthly_rent)} testID="tenant-rent" />
        <Row label={t('bedDetail.deposit')} value={formatRupees(tenant.deposit)} testID="tenant-deposit" />
        <Row label={t('bedDetail.startDate')} value={formatDate(tenant.start_date)} testID="tenant-start" />
        <Row label={t('bedDetail.aadhaar')} value={maskAadhaar(tenant.aadhaar_last4)} testID="tenant-aadhaar" />
      </View>
      <CurrentMonth current={tenant.current_month} />
    </>
  );
}

// One bed. Vacant: manager sees "Add tenant" (disabled until T-07).
// Occupied: tenant details, read-only. Owner never sees action buttons (D-02).
export default function BedDetailScreen({ bedId }) {
  const { user } = useSession();
  const isManager = !!user && user.role === 'manager';
  const state = useApiData(() => structureApi.bed(bedId), bedId);
  const { data, error, loading, refreshing, refresh, retry } = state;
  const bed = data ? data.bed : null;
  const tenant = data ? data.tenant : null;

  const place = bed
    ? placeText([
        bed.building_name,
        floorTitle(bed.floor_number),
        t('room.title', { number: bed.room_number }),
        t('bed.title', { label: bed.bed_label }),
      ])
    : '';

  let body;
  if (!data && loading) body = <LoadingView />;
  else if (!data && error) body = <ErrorView error={error} onRetry={retry} />;
  else
    body = (
      <>
        {error ? <ErrorBanner error={error} onRetry={retry} /> : null}
        <ScrollView
          testID="bed-detail-scroll"
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
        >
          <View style={styles.iconWrap}>
            <BedIcon testID="bed-detail-icon" label={bed.bed_label} status={bed.status} />
          </View>
          {tenant ? (
            <TenantDetails tenant={tenant} />
          ) : (
            <View style={styles.vacant}>
              <Text testID="bed-free" style={styles.freeText}>
                {t('bedDetail.free')}
              </Text>
              {isManager ? (
                <>
                  <BigButton testID="add-tenant-button" label={t('bedDetail.addTenant')} disabled onPress={() => {}} />
                  <Text testID="add-tenant-soon" style={styles.muted}>
                    {t('bedDetail.comingSoon')}
                  </Text>
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </>
    );

  return (
    <SafeAreaView style={styles.safe} testID="bed-detail-screen" edges={['top', 'bottom']}>
      <PlaceHeader place={place} />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, flexGrow: 1 },
  iconWrap: { alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: font.large, fontWeight: '800', color: colors.text },
  name: { fontSize: font.title, fontWeight: '800', color: colors.text },
  call: {
    minHeight: MIN_TOUCH,
    borderRadius: 14,
    backgroundColor: colors.vacant,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  callText: { color: '#FFFFFF', fontSize: font.large, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 32 },
  rowLabel: { fontSize: font.body, color: colors.textMuted, fontWeight: '600' },
  rowValue: { fontSize: font.large, color: colors.text, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  vacant: { alignItems: 'stretch', gap: 12 },
  freeText: { fontSize: font.title, fontWeight: '800', color: colors.vacant, textAlign: 'center' },
  muted: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
});
