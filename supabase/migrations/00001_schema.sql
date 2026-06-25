-- CloserFlow - Migration Supabase
-- Exécute ceci dans l'éditeur SQL de Supabase

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'closer');
CREATE TYPE order_status AS ENUM (
  'nouvelle', 'confirmée', 'programmée', 'injoignable',
  'faux_numéro', 'livrée', 'refusée', 'annulée'
);

-- 2. PROFILES (extension de auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'closer',
  avatar_url TEXT,
  phone TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  comments TEXT DEFAULT '',
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'import',
  status order_status NOT NULL DEFAULT 'nouvelle',
  claimed_by UUID REFERENCES profiles(id),
  claimed_at TIMESTAMPTZ,
  sheet_row_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_claimed_by ON orders(claimed_by);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_search ON orders USING gin(
  to_tsvector('french', coalesce(client_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(city,'') || ' ' || coalesce(product,'') || ' ' || coalesce(address,'') || ' ' || coalesce(comments,''))
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. ORDER HISTORY
CREATE TABLE order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT NOT NULL DEFAULT 'Système',
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_history_order ON order_history(order_id, created_at DESC);

ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

-- 5. ORDER NOTES
CREATE TABLE order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_notes_order ON order_notes(order_id, created_at DESC);

ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;

-- 6. AUDIT LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT NOT NULL,
  user_role user_role,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. SHEETS CONFIG (Google Sheets integration)
CREATE TABLE sheets_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  sheet_gid TEXT DEFAULT '0',
  last_synced TIMESTAMPTZ,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  column_mapping JSONB DEFAULT '{
    "clientName": "A",
    "phone": "B",
    "city": "C",
    "address": "D",
    "product": "E",
    "quantity": "F",
    "price": "G",
    "comments": "H",
    "orderDate": "I"
  }',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sheets_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Les profils sont visibles par tous les utilisateurs authentifiés"
  ON profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Seuls les admins peuvent créer/modifier des profils"
  ON profiles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Seuls les admins peuvent modifier les profils"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ORDERS
CREATE POLICY "Toutes les commandes sont visibles par tous"
  ON orders FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Les admins peuvent tout modifier"
  ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Un closer peut modifier une commande s'il en est responsable et qu'elle n'est pas finalisée"
  ON orders FOR UPDATE USING (
    auth.uid() = claimed_by
    AND status NOT IN ('livrée', 'refusée', 'annulée')
  );

CREATE POLICY "Seuls les admins peuvent supprimer"
  ON orders FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- HISTORY & NOTES
CREATE POLICY "Historique visible par tous"
  ON order_history FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Notes visibles par tous"
  ON order_notes FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Notes ajoutables par tous"
  ON order_notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- AUDIT
CREATE POLICY "Audit visible par les admins"
  ON audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SHEETS CONFIG
CREATE POLICY "Sheets config visible par tous"
  ON sheets_config FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sheets config modifiable par les admins"
  ON sheets_config FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TRIGGER: updated_at automatique
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FONCTION: recherche full-text
-- ============================================
CREATE OR REPLACE FUNCTION search_orders(search_query TEXT)
RETURNS SETOF orders AS $$
  SELECT *
  FROM orders
  WHERE to_tsvector('french', coalesce(client_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(city,'') || ' ' || coalesce(product,'') || ' ' || coalesce(address,'') || ' ' || coalesce(comments,''))
  @@ plainto_tsquery('french', search_query)
  ORDER BY created_at DESC;
$$ LANGUAGE sql STABLE;

-- ============================================
-- FONCTION: stats dashboard
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'nouvelle', COUNT(*) FILTER (WHERE status = 'nouvelle'),
    'confirmée', COUNT(*) FILTER (WHERE status = 'confirmée'),
    'programmée', COUNT(*) FILTER (WHERE status = 'programmée'),
    'injoignable', COUNT(*) FILTER (WHERE status = 'injoignable'),
    'faux_numéro', COUNT(*) FILTER (WHERE status = 'faux_numéro'),
    'livrée', COUNT(*) FILTER (WHERE status = 'livrée'),
    'refusée', COUNT(*) FILTER (WHERE status = 'refusée'),
    'annulée', COUNT(*) FILTER (WHERE status = 'annulée'),
    'today', COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'week', COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)),
    'month', COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))
  ) INTO result FROM orders;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
