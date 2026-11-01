-- Custom guards that Drizzle cannot express in the schema file.

-- 1. transaction_log is append-only: block UPDATE and DELETE.
CREATE OR REPLACE FUNCTION block_log_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'transaction_log is append-only (% blocked)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER transaction_log_append_only
  BEFORE UPDATE OR DELETE ON transaction_log
  FOR EACH ROW EXECUTE FUNCTION block_log_changes();
--> statement-breakpoint

-- 2. Owner/building scope must stay consistent (multi-owner isolation, D-15).
CREATE OR REPLACE FUNCTION check_manager_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM building b WHERE b.id = NEW.building_id AND b.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'manager.owner_id must match the owner of manager.building_id' USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER manager_scope_check
  BEFORE INSERT OR UPDATE OF owner_id, building_id ON manager
  FOR EACH ROW EXECUTE FUNCTION check_manager_scope();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_tenant_scope() RETURNS trigger AS $$
BEGIN
  IF NEW.bed_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM bed bd
    JOIN room r ON r.id = bd.room_id
    JOIN floor f ON f.id = r.floor_id
    WHERE bd.id = NEW.bed_id AND f.building_id = NEW.building_id
  ) THEN
    RAISE EXCEPTION 'tenant.bed_id must belong to tenant.building_id' USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER tenant_scope_check
  BEFORE INSERT OR UPDATE OF bed_id, building_id ON tenant
  FOR EACH ROW EXECUTE FUNCTION check_tenant_scope();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_log_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant t WHERE t.id = NEW.tenant_id AND t.building_id = NEW.building_id)
     OR NOT EXISTS (SELECT 1 FROM manager m WHERE m.id = NEW.manager_id AND m.building_id = NEW.building_id) THEN
    RAISE EXCEPTION 'transaction_log tenant and manager must belong to its building' USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER transaction_log_scope_check
  BEFORE INSERT ON transaction_log
  FOR EACH ROW EXECUTE FUNCTION check_log_scope();
