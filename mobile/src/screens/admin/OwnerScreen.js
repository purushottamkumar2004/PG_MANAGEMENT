import { useState } from 'react';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import {
  AdminScreen,
  EmptyText,
  ErrorBox,
  ListRow,
  LoadState,
  OnOffRow,
  SectionTitle,
  adminErrorText,
  confirmAction,
  useAdminData,
} from './ui';

// The contract has no "get one owner" endpoint, so the owner comes from the list.
async function loadOwner(ownerId) {
  const [ownersRes, buildingsRes] = await Promise.all([adminApi.listOwners(), adminApi.listBuildings(ownerId)]);
  const owner = ((ownersRes && ownersRes.owners) || []).find((o) => o.id === ownerId);
  if (!owner) throw new ApiError('NOT_FOUND', 'Owner not found', 404);
  return { owner, buildings: (buildingsRes && buildingsRes.buildings) || [] };
}

// One owner: on/off switch (asks first), buildings, "+ Building".
export default function OwnerScreen({ ownerId }) {
  const { data, error, loading, refreshing, reload, refresh, setData } = useAdminData(() => loadOwner(ownerId));
  const [toggling, setToggling] = useState(false);
  const [actionError, setActionError] = useState(null);
  const owner = data && data.owner;

  function onToggle() {
    if (!owner || toggling) return;
    const next = !owner.is_active;
    confirmAction({
      title: next ? t('admin.owner.confirmOnTitle') : t('admin.owner.confirmOffTitle'),
      message: next
        ? t('admin.owner.confirmOn', { name: owner.name })
        : t('admin.owner.confirmOff', { name: owner.name }),
      confirmLabel: next ? t('admin.switchOn') : t('admin.switchOff'),
      onConfirm: async () => {
        setActionError(null);
        setToggling(true);
        try {
          const res = await adminApi.updateOwner(ownerId, { is_active: next });
          const updated = res && res.owner;
          setData((d) => ({ ...d, owner: { ...d.owner, ...(updated || { is_active: next }) } }));
        } catch (err) {
          setActionError(adminErrorText((err && err.code) || 'INTERNAL'));
        }
        setToggling(false);
      },
    });
  }

  return (
    <AdminScreen
      testID="owner-screen"
      title={owner ? owner.name : t('admin.owner.title')}
      subtitle={owner ? `📱 ${owner.phone}` : null}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        owner ? (
          <BigButton
            testID="add-building-button"
            label={`➕ ${t('admin.buildings.add')}`}
            onPress={() => router.push(`/admin/owners/${ownerId}/buildings/new`)}
          />
        ) : null
      }
    >
      <LoadState loading={loading} error={error} data={data} onRetry={reload} />
      {data && error ? <ErrorBox text={adminErrorText(error)} onRetry={reload} /> : null}
      {owner ? (
        <>
          <OnOffRow
            testID="owner-active"
            label={t('admin.owner.account')}
            value={owner.is_active}
            onToggle={onToggle}
            busy={toggling}
          />
          <ErrorBox text={actionError} testID="owner-action-error" />
          <SectionTitle>🏢 {t('admin.buildings.title')}</SectionTitle>
          {data.buildings.length === 0 ? (
            <EmptyText testID="buildings-empty">{t('admin.buildings.empty')}</EmptyText>
          ) : (
            data.buildings.map((b) => (
              <ListRow
                key={b.id}
                testID={`building-row-${b.id}`}
                icon="🏢"
                title={b.name}
                detail={b.manager ? `🧑‍💼 ${b.manager.name}` : t('admin.manager.none')}
                onPress={() => router.push(`/admin/owners/${ownerId}/buildings/${b.id}`)}
              />
            ))
          )}
        </>
      ) : null}
    </AdminScreen>
  );
}
