// Mocked responses shaped exactly like docs/API_CONTRACT.md "Structure read" (T-04).

export const buildingsRes = {
  buildings: [
    { id: 'b1', name: 'Sai Residency', address: 'Hinjewadi, Pune', photo_url: null, total_beds: 6, occupied_beds: 6, free_beds: 0 },
    { id: 'b2', name: 'Shanti PG', address: 'Kothrud, Pune', photo_url: 'https://example.com/shanti.jpg', total_beds: 10, occupied_beds: 4, free_beds: 6 },
  ],
};

export const floorsRes = {
  building: { id: 'b2', name: 'Shanti PG' },
  floors: [
    { id: 'f0', floor_number: 0, total_beds: 4, free_beds: 2 },
    { id: 'f1', floor_number: 1, total_beds: 6, free_beds: 4 },
  ],
};

export const managerFloorsRes = {
  building: { id: 'b1', name: 'Sai Residency' },
  floors: [{ id: 'f9', floor_number: 1, total_beds: 6, free_beds: 0 }],
};

export const roomsRes = {
  floor: { id: 'f1', floor_number: 1, building_id: 'b2' },
  rooms: [
    { id: 'r1', room_number: '101', bed_capacity: 3, free_beds: 1 },
    { id: 'r2', room_number: '102', bed_capacity: 2, free_beds: 2 },
  ],
};

export const bedsRes = {
  room: { id: 'r1', room_number: '101', bed_capacity: 3, floor_id: 'f1', floor_number: 1, building_id: 'b2' },
  beds: [
    { id: 'bedA', bed_label: 'A', status: 'partial', tenant: { id: 't1', name: 'Rahul Verma' } },
    { id: 'bedB', bed_label: 'B', status: 'vacant', tenant: null },
    { id: 'bedC', bed_label: 'C', status: 'overdue', tenant: { id: 't2', name: 'Amit Kumar' } },
  ],
};

const bedBase = { room_id: 'r1', room_number: '101', floor_number: 1, building_id: 'b2', building_name: 'Shanti PG' };

export const occupiedBedRes = {
  bed: { id: 'bedA', bed_label: 'A', status: 'partial', ...bedBase },
  tenant: {
    id: 't1',
    name: 'Rahul Verma',
    phone: '9876500002',
    age: 24,
    aadhaar_last4: '5678',
    monthly_rent: 7000,
    deposit: 125000,
    start_date: '2026-10-01',
    current_month: { month: '2026-11', amount_due: 7000, amount_paid: 3000, payment_status: 'partial', payment_date: '2026-11-02' },
  },
};

export const occupiedNoRowBedRes = {
  bed: { id: 'bedC', bed_label: 'C', status: 'overdue', ...bedBase },
  tenant: {
    id: 't2',
    name: 'Amit Kumar',
    phone: '9876500001',
    age: null,
    aadhaar_last4: null,
    monthly_rent: 8000,
    deposit: 8000,
    start_date: '2026-09-15',
    current_month: null,
  },
};

export const vacantBedRes = {
  bed: { id: 'bedB', bed_label: 'B', status: 'vacant', ...bedBase },
  tenant: null,
};
