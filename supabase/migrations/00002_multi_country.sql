-- CloserFlow v2 - Migration multi-pays / équipes
-- Exécute ceci DANS L'ORDRE après la migration 00001

-- ============================================
-- 1. AJOUT colonne country aux tables existantes
-- ============================================

-- Chaque closer est rattaché à un pays/équipe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);

-- Chaque commande est rattachée à un pays
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);

-- Chaque sheet peut être lié à un pays spécifique
ALTER TABLE sheets_config ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE sheets_config ADD COLUMN IF NOT EXISTS sheet_timezone TEXT DEFAULT 'Africa/Abidjan';

-- ============================================
-- 2. MISE À JOUR des RLS pour le multi-pays
-- ============================================

-- Supprimer les anciennes policies sur orders
DROP POLICY IF EXISTS "Toutes les commandes sont visibles par tous" ON orders;
DROP POLICY IF EXISTS "Les admins peuvent tout modifier" ON orders;
DROP POLICY IF EXISTS "Un closer peut modifier une commande s'il en est responsable et qu'elle n'est pas finalisée" ON orders;
DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer" ON orders;

-- Nouvelle politique : les admins voient TOUT
CREATE POLICY "Les admins voient toutes les commandes"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Nouvelle politique : les closers ne voient que les commandes de LEUR pays
CREATE POLICY "Les closers voient les commandes de leur pays"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'closer' AND profiles.country = orders.country)
  );

-- Nouvelle politique : les closers peuvent voir les commandes non attribuées de leur pays
CREATE POLICY "Les closers voient les commandes non attribuées de leur pays"
  ON orders FOR SELECT USING (
    claimed_by IS NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'closer' AND profiles.country = orders.country)
  );

-- Admins peuvent tout modifier
CREATE POLICY "Les admins modifient tout"
  ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Closers modifient les commandes de leur pays dont ils sont responsables
CREATE POLICY "Un closer modifie ses commandes"
  ON orders FOR UPDATE USING (
    auth.uid() = claimed_by
    AND status NOT IN ('livrée', 'refusée', 'annulée')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND profiles.country = orders.country)
  );

-- Admins peuvent supprimer
CREATE POLICY "Admins suppriment"
  ON orders FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 3. FONCTION : stats par pays
-- ============================================

CREATE OR REPLACE FUNCTION get_stats_by_country(target_country TEXT DEFAULT NULL)
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
  ) INTO result FROM orders
  WHERE (target_country IS NULL OR country = target_country);
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. FONCTION : stats par closer dans un pays/période
-- ============================================

CREATE OR REPLACE FUNCTION get_closer_stats(
  target_country TEXT DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  country TEXT,
  total_claimed BIGINT,
  livree BIGINT,
  refusee BIGINT,
  programmee BIGINT,
  injoignable BIGINT,
  taux_livraison NUMERIC,
  avg_closing_time_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.country,
    COUNT(o.id)::BIGINT AS total_claimed,
    COUNT(o.id) FILTER (WHERE o.status = 'livrée')::BIGINT AS livree,
    COUNT(o.id) FILTER (WHERE o.status = 'refusée')::BIGINT AS refusee,
    COUNT(o.id) FILTER (WHERE o.status = 'programmée')::BIGINT AS programmee,
    COUNT(o.id) FILTER (WHERE o.status = 'injoignable')::BIGINT AS injoignable,
    CASE WHEN COUNT(o.id) > 0
      THEN ROUND(COUNT(o.id) FILTER (WHERE o.status = 'livrée')::NUMERIC / COUNT(o.id) * 100, 1)
      ELSE 0
    END AS taux_livraison,
    COALESCE(
      ROUND(AVG(
        CASE WHEN o.status IN ('livrée', 'refusée', 'annulée') AND o.claimed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (o.updated_at - o.claimed_at)) / 3600
          ELSE NULL
        END
      )::NUMERIC, 1), 0
    ) AS avg_closing_time_hours
  FROM profiles p
  LEFT JOIN orders o ON o.claimed_by = p.id
    AND (target_country IS NULL OR o.country = target_country)
    AND (date_from IS NULL OR o.created_at >= date_from)
    AND (date_to IS NULL OR o.created_at <= date_to)
  WHERE p.role = 'closer'
    AND (target_country IS NULL OR p.country = target_country)
  GROUP BY p.id, p.display_name, p.country
  ORDER BY total_claimed DESC;
END;
$$ LANGUAGE plpgsql STABLE;
