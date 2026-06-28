-- CloserFlow v7 - Simplification RLS, single org, plus de super_admin

-- Supprimer toutes les anciennes policies (org-scoped et autres)
DROP POLICY IF EXISTS "Profils visibles par org" ON profiles;
DROP POLICY IF EXISTS "Profils visibles par tous les authentifiés" ON profiles;
DROP POLICY IF EXISTS "Super admin peut tout modifier sur profiles" ON profiles;
DROP POLICY IF EXISTS "Super admin modifie tous les profils" ON profiles;
DROP POLICY IF EXISTS "Admin org peut modifier les profils de son organisation" ON profiles;
DROP POLICY IF EXISTS "Admin org peut créer des profils dans son organisation" ON profiles;
DROP POLICY IF EXISTS "Seuls les admins peuvent créer/modifier des profils" ON profiles;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier les profils" ON profiles;

DROP POLICY IF EXISTS "Super admin voit toutes les commandes" ON orders;
DROP POLICY IF EXISTS "Admin org voit les commandes de son organisation" ON orders;
DROP POLICY IF EXISTS "Closer voit les commandes de son organisation et pays" ON orders;
DROP POLICY IF EXISTS "Closer voit les commandes non attribuées de son pays" ON orders;
DROP POLICY IF EXISTS "Les closers voient les commandes de leur pays" ON orders;
DROP POLICY IF EXISTS "Les closers voient les commandes non attribuées de leur pays" ON orders;
DROP POLICY IF EXISTS "Les admins voient toutes les commandes" ON orders;
DROP POLICY IF EXISTS "Super admin modifie tout" ON orders;
DROP POLICY IF EXISTS "Admin org modifie les commandes de son organisation" ON orders;
DROP POLICY IF EXISTS "Closer modifie ses commandes dans son pays" ON orders;
DROP POLICY IF EXISTS "Un closer modifie ses commandes" ON orders;
DROP POLICY IF EXISTS "Les admins modifient tout" ON orders;
DROP POLICY IF EXISTS "Super admin supprime" ON orders;
DROP POLICY IF EXISTS "Admin org supprime les commandes de son organisation" ON orders;
DROP POLICY IF EXISTS "Admins suppriment" ON orders;

DROP POLICY IF EXISTS "Historique visible par org" ON order_history;
DROP POLICY IF EXISTS "Historique visible par tous" ON order_history;
DROP POLICY IF EXISTS "Notes visibles par org" ON order_notes;
DROP POLICY IF EXISTS "Notes visibles par tous" ON order_notes;
DROP POLICY IF EXISTS "Notes ajoutables par org" ON order_notes;
DROP POLICY IF EXISTS "Notes ajoutables par tous" ON order_notes;

DROP POLICY IF EXISTS "Audit visible par super admin et admin org" ON audit_logs;
DROP POLICY IF EXISTS "Audit visible par les admins" ON audit_logs;

DROP POLICY IF EXISTS "Sheets visible par org" ON sheets_config;
DROP POLICY IF EXISTS "Sheets visible par les admins" ON sheets_config;
DROP POLICY IF EXISTS "Sheets modifiable par super admin" ON sheets_config;
DROP POLICY IF EXISTS "Sheets modifiable par admin org" ON sheets_config;
DROP POLICY IF EXISTS "Sheets config visible par tous" ON sheets_config;
DROP POLICY IF EXISTS "Sheets config modifiable par les admins" ON sheets_config;

DROP POLICY IF EXISTS "Teams visibles par org" ON teams;
DROP POLICY IF EXISTS "Teams visibles par tous" ON teams;
DROP POLICY IF EXISTS "Teams modifiables par super admin" ON teams;
DROP POLICY IF EXISTS "Teams modifiables par admin org" ON teams;
DROP POLICY IF EXISTS "Teams modifiable par les admins" ON teams;

DROP POLICY IF EXISTS "Organisations visibles par tous les authentifiés" ON organizations;
DROP POLICY IF EXISTS "Super admin gère les organisations" ON organizations;

-- ============================================
-- NoUVELLES POLICIES SIMPLIFIÉES
-- ============================================

-- PROFILES
CREATE POLICY "Profils visibles par tous"
  ON profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins peuvent modifier les profils"
  ON profiles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins modifient les profils"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ORDERS
CREATE POLICY "Admins voient toutes les commandes"
  ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Closers voient commandes pays ou équipe"
  ON orders FOR SELECT USING (
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'closer'
        AND (p.country = orders.country OR p.team_id = orders.team_id)
    )
  );

CREATE POLICY "Admins modifient tout"
  ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Closers modifient leurs commandes"
  ON orders FOR UPDATE USING (
    auth.uid() = claimed_by
    AND status NOT IN ('livrée', 'refusée', 'annulée')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'closer')
  );

CREATE POLICY "Admins suppriment"
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

-- SHEETS
CREATE POLICY "Sheets visible par les admins"
  ON sheets_config FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Sheets modifiable par les admins"
  ON sheets_config FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- TEAMS
CREATE POLICY "Teams visible par tous"
  ON teams FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Teams modifiable par les admins"
  ON teams FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
