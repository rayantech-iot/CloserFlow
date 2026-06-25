-- CloserFlow v6 - RLS profiles org-scopée

-- Ancienne policy trop permissive
DROP POLICY IF EXISTS "Profils visibles par tous les authentifiés" ON profiles;

-- Nouvelle policy :
--   - Chacun voit son propre profil
--   - Super admin voit tout
--   - Admin/closer voit les profils de sa propre organisation
CREATE POLICY "Profils visibles par org"
  ON profiles FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.organization_id = profiles.organization_id)
    )
  );
