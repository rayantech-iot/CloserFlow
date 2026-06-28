-- ============================================================
-- Migration 00009: Fix RLS infinite recursion on profiles
-- ============================================================
-- Supprime les sous-requêtes récursives sur profiles en utilisant
-- une fonction SECURITY DEFINER qui contourne RLS.
-- À exécuter dans le SQL Editor Supabase.
-- ============================================================

-- 1. Fonction utilitaire qui vérifie le rôle admin sans passer par RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 2. Fonction utilitaire qui vérifie closer sans passer par RLS
CREATE OR REPLACE FUNCTION public.is_closer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'closer');
$$;

-- 3. Fonction utilitaire qui vérifie delivery_person sans passer par RLS
CREATE OR REPLACE FUNCTION public.is_delivery_person()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'delivery_person');
$$;

-- ============================================================
-- Re-création des politiques sur profiles
-- ============================================================
DROP POLICY IF EXISTS "Profils visibles par tous" ON profiles;
DROP POLICY IF EXISTS "Profils visibles par tous les authentifiés" ON profiles;
DROP POLICY IF EXISTS "Profils visibles par org" ON profiles;
DROP POLICY IF EXISTS "Admins peuvent modifier les profils" ON profiles;
DROP POLICY IF EXISTS "Admins modifient les profils" ON profiles;
DROP POLICY IF EXISTS "Super admin peut tout modifier sur profiles" ON profiles;

CREATE POLICY "Profils visibles par tous"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins peuvent modifier les profils"
  ON profiles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins modifient les profils"
  ON profiles FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- Re-création des politiques sur orders
-- ============================================================
DROP POLICY IF EXISTS "Tout le monde peut voir les commandes" ON orders;
DROP POLICY IF EXISTS "Admin peut tout faire sur commandes" ON orders;
DROP POLICY IF EXISTS "Closer peut voir commandes de son pays" ON orders;
DROP POLICY IF EXISTS "Closer peut modifier commandes de son pays" ON orders;
DROP POLICY IF EXISTS "Delivery peut voir commandes prêtes" ON orders;
DROP POLICY IF EXISTS "Delivery peut modifier ses commandes" ON orders;
DROP POLICY IF EXISTS "Personne ne peut supprimer de commandes" ON orders;
DROP POLICY IF EXISTS "Closer peut voir commandes de son équipe" ON orders;
DROP POLICY IF EXISTS "Closer peut modifier commandes de son équipe" ON orders;

-- Admin voit tout
CREATE POLICY "Admin voit tout sur commandes"
  ON orders FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin modifie tout sur commandes"
  ON orders FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin update tout sur commandes"
  ON orders FOR UPDATE
  USING (public.is_admin());

-- Closer voit commandes de son pays ou équipe
CREATE POLICY "Closer voit commandes"
  ON orders FOR SELECT
  USING (
    public.is_closer() AND (
      country = (SELECT country FROM profiles WHERE id = auth.uid())
      OR team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Closer modifie commandes"
  ON orders FOR UPDATE
  USING (
    public.is_closer() AND (
      country = (SELECT country FROM profiles WHERE id = auth.uid())
      OR team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Delivery person voir commandes prêtes
CREATE POLICY "Delivery voit commandes prêtes"
  ON orders FOR SELECT
  USING (
    public.is_delivery_person() AND (
      (ready_for_delivery = true AND delivery_person_id IS NULL)
      OR delivery_person_id = auth.uid()
    )
  );

CREATE POLICY "Delivery modifie ses commandes"
  ON orders FOR UPDATE
  USING (public.is_delivery_person() AND delivery_person_id = auth.uid());

-- Personne ne supprime
CREATE POLICY "Personne ne supprime de commandes"
  ON orders FOR DELETE
  USING (false);

-- ============================================================
-- Re-création des politiques sur sheets_config
-- ============================================================
DROP POLICY IF EXISTS "Sheets visibles par les admins" ON sheets_config;
DROP POLICY IF EXISTS "Admins peuvent gérer sheets" ON sheets_config;

CREATE POLICY "Sheets visibles par les admins"
  ON sheets_config FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins peuvent gérer sheets"
  ON sheets_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Re-création des politiques sur teams
-- ============================================================
DROP POLICY IF EXISTS "Équipes visibles par tous" ON teams;
DROP POLICY IF EXISTS "Admins gèrent les équipes" ON teams;

CREATE POLICY "Équipes visibles par tous"
  ON teams FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins gèrent les équipes"
  ON teams FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Re-création des politiques sur order_history
-- ============================================================
DROP POLICY IF EXISTS "Historique visible par tous" ON order_history;
DROP POLICY IF EXISTS "Admins gèrent historique" ON order_history;

CREATE POLICY "Historique visible par tous"
  ON order_history FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins gèrent historique"
  ON order_history FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Re-création des politiques sur order_notes
-- ============================================================
DROP POLICY IF EXISTS "Notes visibles par tous" ON order_notes;
DROP POLICY IF EXISTS "Admins gèrent notes" ON order_notes;

CREATE POLICY "Notes visibles par tous"
  ON order_notes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins gèrent notes"
  ON order_notes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Re-création des politiques sur audit_logs
-- ============================================================
DROP POLICY IF EXISTS "Logs visibles par admin" ON audit_logs;
DROP POLICY IF EXISTS "Admins gèrent logs" ON audit_logs;

CREATE POLICY "Logs visibles par admin"
  ON audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins gèrent logs"
  ON audit_logs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Nettoyage des anciennes politiques qui pourraient traîner
-- ============================================================
DROP POLICY IF EXISTS "Profils visibles par tous les authentifiés" ON profiles;
DROP POLICY IF EXISTS "Profils visibles par org" ON profiles;
DROP POLICY IF EXISTS "Super admin peut tout modifier sur profiles" ON profiles;
DROP POLICY IF EXISTS "Tout le monde peut voir les commandes" ON orders;
DROP POLICY IF EXISTS "Admin peut tout faire sur commandes" ON orders;
DROP POLICY IF EXISTS "Closer peut voir commandes de son pays" ON orders;
DROP POLICY IF EXISTS "Closer peut modifier commandes de son pays" ON orders;
DROP POLICY IF EXISTS "Delivery peut voir commandes prêtes" ON orders;
DROP POLICY IF EXISTS "Delivery peut modifier ses commandes" ON orders;
DROP POLICY IF EXISTS "Personne ne peut supprimer de commandes" ON orders;
DROP POLICY IF EXISTS "Closer peut voir commandes de son équipe" ON orders;
DROP POLICY IF EXISTS "Closer peut modifier commandes de son équipe" ON orders;
DROP POLICY IF EXISTS "Équipes visibles par tous" ON teams;
DROP POLICY IF EXISTS "Admins gèrent les équipes" ON teams;
DROP POLICY IF EXISTS "Historique visible par tous" ON order_history;
DROP POLICY IF EXISTS "Admins gèrent historique" ON order_history;
DROP POLICY IF EXISTS "Notes visibles par tous" ON order_notes;
DROP POLICY IF EXISTS "Admins gèrent notes" ON order_notes;
DROP POLICY IF EXISTS "Logs visibles par admin" ON audit_logs;
DROP POLICY IF EXISTS "Admins gèrent logs" ON audit_logs;
DROP POLICY IF EXISTS "Sheets visibles par les admins" ON sheets_config;
DROP POLICY IF EXISTS "Admins peuvent gérer sheets" ON sheets_config;
