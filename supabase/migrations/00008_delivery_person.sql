-- CloserFlow v8 - Ajout du rôle livreur (delivery_person)
-- EXÉCUTER EN DEUX TEMPS À CAUSE DE L'ALTER TYPE ENUM:
-- 1. Exécuter l'ALTER TYPE d'abord
-- 2. Puis le reste

-- ============================================
-- ÉTAPE 1 (exécuter d'abord) :
-- ============================================
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delivery_person';

-- ============================================
-- ÉTAPE 2 (ensuite tout ce qui suit) :
-- ============================================

-- Ajout des colonnes livraison sur orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_person_id UUID REFERENCES profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_for_delivery BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS claimed_by_delivery_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_person ON orders(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_orders_ready_for_delivery ON orders(ready_for_delivery) WHERE ready_for_delivery = true;

-- Supprimer les anciennes policies SELECT et UPDATE pour les recréer
DROP POLICY IF EXISTS "Closers voient commandes pays ou équipe" ON orders;
DROP POLICY IF EXISTS "Closers modifient leurs commandes" ON orders;

-- Closers: voient commandes pays ou équipe (exclut aussi les livreurs)
CREATE POLICY "Closers voient commandes pays ou équipe"
  ON orders FOR SELECT USING (
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'delivery_person'))
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'closer'
        AND (p.country = orders.country OR p.team_id = orders.team_id)
    )
  );

-- Livreurs: voient les commandes prêtes non attribuées, ou leurs propres livraisons
CREATE POLICY "Livreurs voient commandes prêtes"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'delivery_person')
    AND (
      (ready_for_delivery = true AND delivery_person_id IS NULL)
      OR delivery_person_id = auth.uid()
    )
  );

-- Closers: modifient leurs commandes
CREATE POLICY "Closers modifient leurs commandes"
  ON orders FOR UPDATE USING (
    auth.uid() = claimed_by
    AND status NOT IN ('livrée', 'refusée', 'annulée')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'closer')
  );

-- Livreurs: modifient leurs livraisons
CREATE POLICY "Livreurs modifient leurs livraisons"
  ON orders FOR UPDATE USING (
    delivery_person_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'delivery_person')
  );
