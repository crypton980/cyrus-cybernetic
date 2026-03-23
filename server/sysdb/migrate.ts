/**
 * System Database Migration Helper
 *
 * Runs idempotent SQL statements to equip the system_database table with:
 * - New columns (search_vector, is_deleted, checksum) if they don't exist
 * - pg_trgm extension for trigram (fuzzy) similarity search
 * - GIN index on search_vector for fast PostgreSQL full-text search
 * - GIN trigram indexes on label and value for fuzzy matching
 * - A PostgreSQL TRIGGER that auto-updates search_vector on INSERT/UPDATE
 * - A backfill for existing rows
 *
 * Safe to re-run on every startup (all statements are IF NOT EXISTS / idempotent).
 */

import { pool } from "../db";

export async function runSysdbMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── Extensions ──────────────────────────────────────────────────────────
    // pg_trgm provides similarity() and trigram GIN indexes for fuzzy search.
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // ── Column additions (idempotent) ────────────────────────────────────────
    await client.query(`
      ALTER TABLE system_database
        ADD COLUMN IF NOT EXISTS search_vector TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS is_deleted    INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS checksum      TEXT NOT NULL DEFAULT ''
    `);

    // ── B-tree indexes ───────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_record_type_idx
        ON system_database (record_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_source_module_idx
        ON system_database (source_module)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_user_id_idx
        ON system_database (user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_created_at_idx
        ON system_database (created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_type_created_idx
        ON system_database (record_type, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_is_deleted_idx
        ON system_database (is_deleted)
        WHERE is_deleted = 0
    `);

    // ── GIN index on search_vector (tsvector stored as text) ─────────────────
    // We maintain the tsvector in a TEXT column and cast at query time; the GIN
    // index is on the *cast* expression so FTS queries hit it.
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_fts_idx
        ON system_database
        USING GIN (to_tsvector('english', coalesce(label,'') || ' ' || coalesce(value,'') || ' ' || coalesce(tags,'')))
    `);

    // ── GIN trigram indexes for fuzzy matching ────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_label_trgm_idx
        ON system_database USING GIN (label gin_trgm_ops)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS sysdb_value_trgm_idx
        ON system_database USING GIN (value gin_trgm_ops)
    `);

    // ── Trigger function: auto-update search_vector + checksum on write ───────
    await client.query(`
      CREATE OR REPLACE FUNCTION sysdb_update_search_vector()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.search_vector := (
          setweight(to_tsvector('english', unaccent(coalesce(NEW.label, ''))), 'A') ||
          setweight(to_tsvector('english', unaccent(coalesce(NEW.value, ''))), 'B') ||
          setweight(to_tsvector('english', unaccent(coalesce(NEW.tags,  ''))), 'C')
        )::text;
        NEW.checksum := encode(
          sha256((NEW.record_type || '|' || NEW.label || '|' || coalesce(NEW.value,''))::bytea),
          'hex'
        );
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS sysdb_search_vector_trigger ON system_database
    `);
    await client.query(`
      CREATE TRIGGER sysdb_search_vector_trigger
        BEFORE INSERT OR UPDATE ON system_database
        FOR EACH ROW EXECUTE FUNCTION sysdb_update_search_vector()
    `);

    // ── Backfill existing rows (runs quickly in one UPDATE) ───────────────────
    await client.query(`
      UPDATE system_database SET updated_at = now() WHERE search_vector = '' OR checksum = ''
    `);

    console.log("[SysDB Migration] All indexes, trigger, and extensions are up to date");
  } catch (err: any) {
    // Log but don't crash the server — the app works without the advanced indexes
    console.error("[SysDB Migration] Warning (non-fatal):", err?.message || err);
  } finally {
    client.release();
  }
}
