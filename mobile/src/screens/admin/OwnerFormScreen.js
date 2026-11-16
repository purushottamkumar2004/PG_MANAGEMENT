import { useState } from 'react';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import { AdminScreen, ErrorBox, Field, useSubmit } from './ui';
import { digitsOnly, validatePerson } from './validation';

// Add owner: name, phone, password. On success opens the new owner's screen.
export default function OwnerFormScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const { busy, serverError, submit } = useSubmit();

  async function onSave() {
    const e = validatePerson({ name, phone, password });
    setErrors(e);
    if (Object.keys(e).length) return;
    let created;
    const ok = await submit(async () => {
      const res = await adminApi.createOwner({ name: name.trim(), phone, password });
      created = res && res.owner;
    });
    if (ok && created) router.replace(`/admin/owners/${created.id}`);
  }

  return (
    <AdminScreen
      testID="owner-form"
      title={t('admin.owners.add')}
      footer={<BigButton testID="owner-save" label={`✅ ${t('common.save')}`} onPress={onSave} loading={busy} />}
    >
      <Field
        testID="owner-name"
        label={`👤 ${t('admin.field.name')}`}
        value={name}
        onChangeText={setName}
        maxLength={100}
        autoCapitalize="words"
        error={errors.name}
        errorTestID="owner-name-error"
        editable={!busy}
      />
      <Field
        testID="owner-phone"
        label={`📱 ${t('login.phone')}`}
        value={phone}
        onChangeText={(v) => setPhone(digitsOnly(v))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
        placeholder={t('login.phonePlaceholder')}
        error={errors.phone}
        errorTestID="owner-phone-error"
        editable={!busy}
      />
      <Field
        testID="owner-password"
        label={`🔒 ${t('login.password')}`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        maxLength={100}
        placeholder={t('admin.field.passwordHint')}
        error={errors.password}
        errorTestID="owner-password-error"
        editable={!busy}
      />
      <ErrorBox text={serverError} />
    </AdminScreen>
  );
}
