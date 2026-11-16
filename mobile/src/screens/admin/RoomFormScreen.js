import { useState } from 'react';
import { router } from 'expo-router';
import BigButton from '../../components/BigButton';
import { adminApi } from '../../api/admin';
import { t } from '../../i18n';
import { AdminScreen, CapacityPicker, ErrorBox, Field, useSubmit } from './ui';
import { validateRoom } from './validation';

// Add a room: number + 2-bed / 3-bed tiles. The backend creates beds A/B(/C).
export default function RoomFormScreen({ floorId }) {
  const [roomNumber, setRoomNumber] = useState('');
  const [bedCapacity, setBedCapacity] = useState(null);
  const [errors, setErrors] = useState({});
  const { busy, serverError, submit } = useSubmit();

  async function onSave() {
    const e = validateRoom({ roomNumber, bedCapacity });
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await submit(
      () => adminApi.createRoom(floorId, { room_number: roomNumber.trim(), bed_capacity: bedCapacity }),
      { CONFLICT: 'admin.error.roomExists' }
    );
    if (ok) router.back();
  }

  return (
    <AdminScreen
      testID="room-form"
      title={t('admin.rooms.add')}
      footer={<BigButton testID="room-save" label={`✅ ${t('common.save')}`} onPress={onSave} loading={busy} />}
    >
      <Field
        testID="room-number"
        label={`🚪 ${t('admin.field.roomNumber')}`}
        value={roomNumber}
        onChangeText={setRoomNumber}
        maxLength={10}
        autoCapitalize="characters"
        placeholder="101"
        error={errors.roomNumber}
        errorTestID="room-number-error"
        editable={!busy}
      />
      <CapacityPicker value={bedCapacity} onChange={setBedCapacity} error={errors.bedCapacity} />
      <ErrorBox text={serverError} />
    </AdminScreen>
  );
}
