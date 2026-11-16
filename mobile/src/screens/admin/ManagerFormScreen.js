import { useState } from 'react';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import { AdminScreen, ErrorBox, Field, LoadState, useAdminData, useSubmit } from './ui';
import { loadBuilding } from './loaders';
import { digitsOnly, validatePerson } from './validation';

// Add the building's manager, or edit the existing one (name, phone, new password).
function Form({ building }) {
  const manager = building.manager;
  const editing = !!manager;
  const [name, setName] = useState(manager ? manager.name : '');
  const [phone, setPhone] = useState(manager ? manager.phone : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const { busy, serverError, submit } = useSubmit();

  async function onSave() {
    const e = validatePerson({ name, phone, password }, { passwordOptional: editing });
    setErrors(e);
    if (Object.keys(e).length) return;
    const n = name.trim();

    if (editing) {
      // Only changed fields are sent; an empty password keeps the old one.
      const patch = {};
      if (n !== manager.name) patch.name = n;
      if (phone !== manager.phone) patch.phone = phone;
      if (password) patch.password = password;
      if (Object.keys(patch).length === 0) {
        router.back();
        return;
      }
      const ok = await submit(() => adminApi.updateManager(manager.id, patch));
      if (ok) router.back();
      return;
    }

    const ok = await submit(() => adminApi.createManager(building.id, { name: n, phone, password }));
    if (ok) router.back();
  }

  return (
    <AdminScreen
      testID="manager-form"
      title={editing ? t('admin.manager.edit') : t('admin.manager.add')}
      subtitle={`🏢 ${building.name}`}
      footer={<BigButton testID="manager-save" label={`✅ ${t('common.save')}`} onPress={onSave} loading={busy} />}
    >
      <Field
        testID="manager-name-input"
        label={`👤 ${t('admin.field.name')}`}
        value={name}
        onChangeText={setName}
        maxLength={100}
        autoCapitalize="words"
        error={errors.name}
        errorTestID="manager-name-error"
        editable={!busy}
      />
      <Field
        testID="manager-phone-input"
        label={`📱 ${t('login.phone')}`}
        value={phone}
        onChangeText={(v) => setPhone(digitsOnly(v))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
        placeholder={t('login.phonePlaceholder')}
        error={errors.phone}
        errorTestID="manager-phone-error"
        editable={!busy}
      />
      <Field
        testID="manager-password-input"
        label={`🔒 ${editing ? t('admin.field.newPassword') : t('login.password')}`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        maxLength={100}
        placeholder={editing ? t('admin.field.keepPassword') : t('admin.field.passwordHint')}
        error={errors.password}
        errorTestID="manager-password-error"
        editable={!busy}
      />
      <ErrorBox text={serverError} />
    </AdminScreen>
  );
}

export default function ManagerFormScreen({ ownerId, buildingId }) {
  const { data, error, loading, reload } = useAdminData(() => loadBuilding(ownerId, buildingId));
  if (!data) {
    return (
      <AdminScreen testID="manager-form-loading" title={t('admin.manager.title')}>
        <LoadState loading={loading} error={error} data={data} onRetry={reload} />
      </AdminScreen>
    );
  }
  return <Form building={data.building} key={data.building.id} />;
}
