import { useState } from 'react';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import { AdminScreen, ErrorBox, Field, LoadState, useAdminData, useSubmit } from './ui';
import { loadBuilding } from './loaders';
import { validateBuilding } from './validation';

// Add or edit a building: name, address, photo URL (plain https link, T-03c later).
function Form({ ownerId, building }) {
  const editing = !!building;
  const [name, setName] = useState(building ? building.name : '');
  const [address, setAddress] = useState(building && building.address ? building.address : '');
  const [photoUrl, setPhotoUrl] = useState(building && building.photo_url ? building.photo_url : '');
  const [errors, setErrors] = useState({});
  const { busy, serverError, submit } = useSubmit();

  async function onSave() {
    const e = validateBuilding({ name, address, photoUrl });
    setErrors(e);
    if (Object.keys(e).length) return;
    const a = address.trim();
    const p = photoUrl.trim();

    if (editing) {
      // Empty fields are sent as null so they can be cleared.
      const body = { name: name.trim(), address: a || null, photo_url: p || null };
      const ok = await submit(() => adminApi.updateBuilding(building.id, body));
      if (ok) router.back();
      return;
    }

    // Create: optional fields are left out when empty.
    const body = { name: name.trim() };
    if (a) body.address = a;
    if (p) body.photo_url = p;
    let created;
    const ok = await submit(async () => {
      const res = await adminApi.createBuilding(ownerId, body);
      created = res && res.building;
    });
    if (ok && created) router.replace(`/admin/owners/${ownerId}/buildings/${created.id}`);
  }

  return (
    <AdminScreen
      testID="building-form"
      title={editing ? t('admin.building.edit') : t('admin.buildings.add')}
      footer={<BigButton testID="building-save" label={`✅ ${t('common.save')}`} onPress={onSave} loading={busy} />}
    >
      <Field
        testID="building-name"
        label={`🏢 ${t('admin.field.buildingName')}`}
        value={name}
        onChangeText={setName}
        maxLength={100}
        autoCapitalize="words"
        error={errors.name}
        errorTestID="building-name-error"
        editable={!busy}
      />
      <Field
        testID="building-address"
        label={`📍 ${t('admin.field.address')}`}
        value={address}
        onChangeText={setAddress}
        maxLength={200}
        multiline
        error={errors.address}
        errorTestID="building-address-error"
        editable={!busy}
      />
      <Field
        testID="building-photo"
        label={`🖼️ ${t('admin.field.photoUrl')}`}
        value={photoUrl}
        onChangeText={setPhotoUrl}
        maxLength={500}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="https://…"
        error={errors.photoUrl}
        errorTestID="building-photo-error"
        editable={!busy}
      />
      <ErrorBox text={serverError} />
    </AdminScreen>
  );
}

export function NewBuildingScreen({ ownerId }) {
  return <Form ownerId={ownerId} />;
}

export function EditBuildingScreen({ ownerId, buildingId }) {
  const { data, error, loading, reload } = useAdminData(() => loadBuilding(ownerId, buildingId));
  if (!data) {
    return (
      <AdminScreen testID="building-form-loading" title={t('admin.building.edit')}>
        <LoadState loading={loading} error={error} data={data} onRetry={reload} />
      </AdminScreen>
    );
  }
  return <Form ownerId={ownerId} building={data.building} key={data.building.id} />;
}
