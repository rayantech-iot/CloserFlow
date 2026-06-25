-- CloserFlow v3 - Organisations, Équipes, Super Admin
-- ATTENTION : exécute d'abord ceci SEUL :
--   ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
-- Puis exécute le reste de ce fichier.

-- ============================================
-- 1. TABLE organisations
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. TABLE équipes
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. AJOUT des colonnes org/team aux tables existantes
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id);

ALTER TABLE sheets_config ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE sheets_config ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_sheets_org ON sheets_config(organization_id);

-- ============================================
-- 4. FONCTION : slug automatique
-- ============================================
CREATE OR REPLACE FUNCTION slugify(text)
RETURNS TEXT AS $$
  SELECT lower(regexp_replace(regexp_replace(trim($1), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- ============================================
-- 5. POLITIQUES RLS mises à jour
-- ============================================

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Les profils sont visibles par tous les utilisateurs authentifiés" ON profiles;
DROP POLICY IF EXISTS "Seuls les admins peuvent créer/modifier des profils" ON profiles;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier les profils" ON profiles;

DROP POLICY IF EXISTS "Les admins voient toutes les commandes" ON orders;
DROP POLICY IF EXISTS "Les closers voient les commandes de leur pays" ON orders;
DROP POLICY IF EXISTS "Les closers voient les commandes non attribuées de leur pays" ON orders;
DROP POLICY IF EXISTS "Les admins modifient tout" ON orders;
DROP POLICY IF EXISTS "Un closer modifie ses commandes" ON orders;
DROP POLICY IF EXISTS "Admins suppriment" ON orders;

DROP POLICY IF EXISTS "Historique visible par tous" ON order_history;
DROP POLICY IF EXISTS "Notes visibles par tous" ON order_notes;
DROP POLICY IF EXISTS "Notes ajoutables par tous" ON order_notes;
DROP POLICY IF EXISTS "Audit visible par les admins" ON audit_logs;

DROP POLICY IF EXISTS "Sheets config visible par tous" ON sheets_config;
DROP POLICY IF EXISTS "Sheets config modifiable par les admins" ON sheets_config;

-- PROFILES
CREATE POLICY "Profils visibles par tous les authentifiés"
  ON profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super admin peut tout modifier sur profiles"
  ON profiles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admin modifie tous les profils"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin org peut modifier les profils de son organisation"
  ON profiles FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = profiles.organization_id
    )
  );

CREATE POLICY "Admin org peut créer des profils dans son organisation"
  ON profiles FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = profiles.organization_id
    )
  );

-- ORDERS
CREATE POLICY "Super admin voit toutes les commandes"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin org voit les commandes de son organisation"
  ON orders FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = orders.organization_id
    )
  );

CREATE POLICY "Closer voit les commandes de son organisation et pays"
  ON orders FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'closer'
        AND p.organization_id = orders.organization_id
        AND p.country = orders.country
    )
  );

CREATE POLICY "Closer voit les commandes non attribuées de son pays"
  ON orders FOR SELECT USING (
    claimed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'closer'
        AND p.organization_id = orders.organization_id
        AND p.country = orders.country
    )
  );

CREATE POLICY "Super admin modifie tout"
  ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin org modifie les commandes de son organisation"
  ON orders FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = orders.organization_id
    )
  );

CREATE POLICY "Closer modifie ses commandes dans son pays"
  ON orders FOR UPDATE USING (
    auth.uid() = claimed_by
    AND status NOT IN ('livrée', 'refusée', 'annulée')
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = orders.organization_id
        AND p.country = orders.country
    )
  );

CREATE POLICY "Super admin supprime"
  ON orders FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin org supprime les commandes de son organisation"
  ON orders FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = orders.organization_id
    )
  );

-- HISTORY & NOTES
CREATE POLICY "Historique visible par org"
  ON order_history FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.id = auth.uid()
      WHERE o.id = order_history.order_id
        AND (
          p.role = 'super_admin'
          OR (p.role = 'admin' AND p.organization_id = o.organization_id)
          OR (p.role = 'closer' AND p.organization_id = o.organization_id AND p.country = o.country)
        )
    )
  );

CREATE POLICY "Notes visibles par org"
  ON order_notes FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.id = auth.uid()
      WHERE o.id = order_notes.order_id
        AND (
          p.role = 'super_admin'
          OR (p.role = 'admin' AND p.organization_id = o.organization_id)
          OR (p.role = 'closer' AND p.organization_id = o.organization_id AND p.country = o.country)
        )
    )
  );

CREATE POLICY "Notes ajoutables par org"
  ON order_notes FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.id = auth.uid()
      WHERE o.id = order_notes.order_id
        AND (
          p.role = 'super_admin'
          OR (p.role = 'admin' AND p.organization_id = o.organization_id)
          OR (p.role = 'closer' AND p.organization_id = o.organization_id AND p.country = o.country)
        )
    )
  );

-- AUDIT
CREATE POLICY "Audit visible par super admin et admin org"
  ON audit_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.role = 'admin')
    )
  );

-- SHEETS CONFIG
CREATE POLICY "Sheets visible par org"
  ON sheets_config FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR (p.role = 'admin' AND p.organization_id = sheets_config.organization_id)
        )
    )
  );

CREATE POLICY "Sheets modifiable par super admin"
  ON sheets_config FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Sheets modifiable par admin org"
  ON sheets_config FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = sheets_config.organization_id
    )
  );

-- ORGANIZATIONS
CREATE POLICY "Organisations visibles par tous les authentifiés"
  ON organizations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super admin gère les organisations"
  ON organizations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- TEAMS
CREATE POLICY "Teams visibles par org"
  ON teams FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR (p.role = 'admin' AND p.organization_id = teams.organization_id)
        )
    )
  );

CREATE POLICY "Teams modifiables par super admin"
  ON teams FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Teams modifiables par admin org"
  ON teams FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.organization_id = teams.organization_id
    )
  );
