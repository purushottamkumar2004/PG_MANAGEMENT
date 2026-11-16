import { ApiError } from '../../api/client';
import { adminApi } from '../../api/admin';

// The contract has no "get one building/floor" endpoint: both come from the
// owner's building list (GET /api/admin/owners/:ownerId/buildings).
export async function loadBuilding(ownerId, buildingId) {
  const res = await adminApi.listBuildings(ownerId);
  const building = ((res && res.buildings) || []).find((b) => b.id === buildingId);
  if (!building) throw new ApiError('NOT_FOUND', 'Building not found', 404);
  return { building: { ...building, floors: building.floors || [] } };
}

export async function loadFloor(ownerId, buildingId, floorId) {
  const { building } = await loadBuilding(ownerId, buildingId);
  const floor = building.floors.find((f) => f.id === floorId);
  if (!floor) throw new ApiError('NOT_FOUND', 'Floor not found', 404);
  return { building, floor: { ...floor, rooms: floor.rooms || [] } };
}
