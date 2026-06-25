-- CloserFlow v5 - team_id sur les commandes + RLS par équipe
-- Permet aux closers de voir les commandes importées par leur équipe

ALTER TABLE orders ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_orders_team ON orders(team_id);

-- Nouvelle politique RLS : le closer voit aussi les commandes de son équipe
DROP POLICY IF EXISTS "Closer voit les commandes de son organisation et pays" ON orders;
DROP POLICY IF EXISTS "Closer voit les commandes non attribuées de son pays" ON orders;

CREATE POLICY "Closer voit les commandes de son organisation et pays"
  ON orders FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'closer'
        AND p.organization_id = orders.organization_id
        AND (
          p.country = orders.country
          OR (p.team_id IS NOT NULL AND p.team_id = orders.team_id)
        )
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
        AND (
          p.country = orders.country
          OR (p.team_id IS NOT NULL AND p.team_id = orders.team_id)
        )
    )
  );
