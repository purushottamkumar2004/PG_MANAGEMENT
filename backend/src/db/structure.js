// Creates a building with floors, rooms and auto-created beds (A, B, C).
// Used by the seed now and by admin setup (T-03b) later.
import { building, floor, room, bed } from './schema.js';

const LABELS = ['A', 'B', 'C'];

export async function createBuildingStructure(tx, { owner_id, name, address = null, photo_url = null, floors }) {
  const [b] = await tx.insert(building).values({ owner_id, name, address, photo_url }).returning();
  const beds = [];
  for (const f of floors) {
    const [fl] = await tx.insert(floor).values({ building_id: b.id, floor_number: f.number }).returning();
    for (const r of f.rooms) {
      const [rm] = await tx.insert(room).values({ floor_id: fl.id, room_number: r.number, bed_capacity: r.capacity }).returning();
      const rows = await tx.insert(bed)
        .values(LABELS.slice(0, r.capacity).map((bed_label) => ({ room_id: rm.id, bed_label })))
        .returning();
      beds.push(...rows.map((x) => ({ ...x, room_number: r.number, floor_number: f.number })));
    }
  }
  return { building: b, beds };
}
