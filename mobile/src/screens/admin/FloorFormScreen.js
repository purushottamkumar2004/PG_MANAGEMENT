import { useState } from 'react';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import { AdminScreen, ErrorBox, Field, useSubmit } from './ui';
import { digitsOnly, validateFloorNumber } from './validation';

// Add a floor: just the number (0 = ground floor).
export default function FloorFormScreen({ buildingId }) {
  const [number, setNumber] = useState('');
  const [errors, setErrors] = useState({});
  const { busy, serverError, submit } = useSubmit();

  async function onSave() {
    const e = validateFloorNumber(number);
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await submit(() => adminApi.createFloor(buildingId, Number(number)), {
      CONFLICT: 'admin.error.floorExists',
    });
    if (ok) router.back();
  }

  return (
    <AdminScreen
      testID="floor-form"
      title={t('admin.floors.add')}
      footer={<BigButton testID="floor-save" label={`✅ ${t('common.save')}`} onPress={onSave} loading={busy} />}
    >
      <Field
        testID="floor-number"
        label={`🪜 ${t('admin.field.floorNumber')}`}
        value={number}
        onChangeText={(v) => setNumber(digitsOnly(v))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
        placeholder={t('admin.field.floorHint')}
        error={errors.floorNumber}
        errorTestID="floor-number-error"
        editable={!busy}
      />
      <ErrorBox text={serverError} />
    </AdminScreen>
  );
}
