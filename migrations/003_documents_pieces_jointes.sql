-- Add attachments metadata to documents
-- Run once. If the column already exists, skip this statement.

ALTER TABLE documents
  ADD COLUMN pieces_jointes JSON NULL AFTER lignes;
