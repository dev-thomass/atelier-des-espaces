-- Sprint 2 additions for documents (chantier, dates, retenue garantie)
-- Run each statement once. If a column already exists, skip that statement.

ALTER TABLE documents
  ADD COLUMN chantier_id VARCHAR(64) NULL AFTER client_id;

ALTER TABLE documents
  ADD COLUMN date_visite DATE NULL AFTER date_echeance;

ALTER TABLE documents
  ADD COLUMN date_debut_travaux DATE NULL AFTER date_visite;

ALTER TABLE documents
  ADD COLUMN duree_estimee INT NULL AFTER date_debut_travaux;

ALTER TABLE documents
  ADD COLUMN duree_unite VARCHAR(20) NULL AFTER duree_estimee;

ALTER TABLE documents
  ADD COLUMN retenue_garantie_pct DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER remise_valeur;

ALTER TABLE documents
  ADD COLUMN retenue_garantie_montant DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER retenue_garantie_pct;

CREATE INDEX idx_chantier ON documents (chantier_id);
