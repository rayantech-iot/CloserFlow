-- CloserFlow v6 - RLS profiles org-scopée

-- Ancienne policy trop permissive
DROP POLICY IF EXISTS "Profils visibles par tous les authentifiés" ON profiles;

-- Nouvelle policy : super_admin voit tout, admin voit sa propre org, closer voit sa propre org
CREATE POLICY "Profils visibles par org"
  ON profiles FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'
      )
      OR
      organization_id = (
        SELECT p2.organization_id FROM profiles p2 WHERE p2.id = auth.uid()
      )
    )
  );
