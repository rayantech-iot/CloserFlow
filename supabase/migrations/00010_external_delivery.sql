-- Migration: Ajout du champ external_delivery_name sur orders
-- Permet au closer d'assigner une commande à un livreur externe (hors app)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_delivery_name TEXT;
