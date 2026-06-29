-- Migration: Correction doublons + organisation_id nullable
-- 1. Supprimer la FK et NOT NULL sur organization_id (plus utilisé)
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_organization_id_fkey;
ALTER TABLE teams ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE teams ALTER COLUMN organization_id SET DEFAULT NULL;

-- 2. Contrainte unique sur sheet_row_id pour éviter les doublons
-- Supprime d'abord les doublons existants (garde le plus récent)
DELETE FROM orders a USING orders b
WHERE a.sheet_row_id = b.sheet_row_id
  AND a.created_at < b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_sheet_row_id ON orders(sheet_row_id) WHERE sheet_row_id IS NOT NULL;
