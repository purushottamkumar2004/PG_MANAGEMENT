import { request } from './client';

// Admin setup endpoints (docs/API_CONTRACT.md "Admin setup", T-03b).
// Each function sends exactly the body the contract describes; callers build it.
const enc = encodeURIComponent;

export const adminApi = {
  listOwners: () => request('/api/admin/owners'),
  createOwner: ({ name, phone, password }) =>
    request('/api/admin/owners', { method: 'POST', body: { name, phone, password } }),
  updateOwner: (ownerId, patch) => request(`/api/admin/owners/${enc(ownerId)}`, { method: 'PATCH', body: patch }),

  listBuildings: (ownerId) => request(`/api/admin/owners/${enc(ownerId)}/buildings`),
  createBuilding: (ownerId, body) =>
    request(`/api/admin/owners/${enc(ownerId)}/buildings`, { method: 'POST', body }),
  updateBuilding: (buildingId, patch) =>
    request(`/api/admin/buildings/${enc(buildingId)}`, { method: 'PATCH', body: patch }),

  createFloor: (buildingId, floorNumber) =>
    request(`/api/admin/buildings/${enc(buildingId)}/floors`, {
      method: 'POST',
      body: { floor_number: floorNumber },
    }),
  createRoom: (floorId, { room_number, bed_capacity }) =>
    request(`/api/admin/floors/${enc(floorId)}/rooms`, { method: 'POST', body: { room_number, bed_capacity } }),

  createManager: (buildingId, { name, phone, password }) =>
    request(`/api/admin/buildings/${enc(buildingId)}/manager`, { method: 'POST', body: { name, phone, password } }),
  updateManager: (managerId, patch) =>
    request(`/api/admin/managers/${enc(managerId)}`, { method: 'PATCH', body: patch }),
};
