# Spécification Fonctionnelle et Technique
# Module Devis & Factures

**Version:** 1.0
**Date:** 25/12/2024
**Projet:** Atelier des Espaces

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Modèle de données](#2-modèle-de-données)
3. [Règles de calcul](#3-règles-de-calcul)
4. [Numérotation automatique](#4-numérotation-automatique)
5. [Architecture API](#5-architecture-api)
6. [Parcours utilisateur](#6-parcours-utilisateur)
7. [Génération PDF](#7-génération-pdf)
8. [Lien public & QR Code](#8-lien-public--qr-code)
9. [Fonctions avancées](#9-fonctions-avancées)
10. [Sécurité](#10-sécurité)
11. [Annexes](#11-annexes)

---

## 1. Vue d'ensemble

### 1.1 Objectif

Permettre à l'entreprise Thomas Bonnardel EI de créer, gérer et envoyer des devis et factures professionnels en **2 à 5 minutes**, avec génération PDF fidèle au modèle de référence.

### 1.2 Périmètre fonctionnel

| Fonction | Description |
|----------|-------------|
| Gestion clients | CRUD clients avec historique documents |
| Devis | Création, envoi, suivi statut, signature |
| Factures | Création directe ou conversion depuis devis |
| PDF | Génération pro avec QR code et mentions légales |
| Lien public | Accès client sans authentification |
| Relances | Notifications automatiques/manuelles |
| Modèles | Templates réutilisables |
| Export | CSV, archivage PDF |

### 1.3 Stack technique

Intégration native dans l'existant :
- **Frontend:** React 18 + Vite + Radix UI + Tailwind CSS
- **Backend:** Express.js + Node.js
- **Database:** MySQL
- **PDF:** `@react-pdf/renderer` (serveur) + `qrcode`
- **State:** TanStack Query + React Hook Form + Zod
- **Email:** Nodemailer (existant)

---

## 2. Modèle de données

### 2.1 Schéma entité-relation

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
│   clients   │───1:N─│    documents    │───1:N─│ document_lignes  │
└─────────────┘       └─────────────────┘       └──────────────────┘
                              │
                              │1:N
                              ▼
                      ┌─────────────────┐
                      │   paiements     │
                      └─────────────────┘

┌─────────────────┐   ┌─────────────────┐
│  parametres     │   │ document_modeles│
└─────────────────┘   └─────────────────┘
```

### 2.2 Table `clients`

```sql
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Identification
  type ENUM('particulier', 'professionnel') NOT NULL DEFAULT 'particulier',
  nom VARCHAR(255) NOT NULL,                    -- Nom ou raison sociale
  prenom VARCHAR(100),                          -- Si particulier
  email VARCHAR(255),
  telephone VARCHAR(20),

  -- Adresse
  adresse_ligne1 VARCHAR(255),
  adresse_ligne2 VARCHAR(255),
  code_postal VARCHAR(10),
  ville VARCHAR(100),
  pays VARCHAR(100) DEFAULT 'France',

  -- Informations légales (professionnel)
  siret VARCHAR(20),
  tva_intracom VARCHAR(20),                     -- N° TVA intracommunautaire

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_nom (nom),
  INDEX idx_email (email)
);
```

### 2.3 Table `documents`

```sql
CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Identification
  type ENUM('devis', 'facture', 'avoir') NOT NULL,
  numero VARCHAR(20) NOT NULL UNIQUE,           -- D202500001, F202500001, A202500001
  reference_externe VARCHAR(100),               -- Référence client optionnelle

  -- Relations
  client_id INT NOT NULL,
  devis_origine_id INT,                         -- Si facture issue d'un devis
  facture_origine_id INT,                       -- Si avoir lié à une facture
  modele_id INT,                                -- Si créé depuis un modèle

  -- Dates
  date_emission DATE NOT NULL,
  date_validite DATE,                           -- Devis uniquement (30j par défaut)
  date_echeance DATE,                           -- Facture uniquement

  -- Statut
  statut ENUM(
    'brouillon',
    'envoye',
    'vu',                                       -- Client a ouvert le lien
    'accepte',                                  -- Devis signé
    'refuse',
    'expire',
    'paye',
    'paye_partiel',
    'annule'
  ) NOT NULL DEFAULT 'brouillon',

  -- Montants calculés (stockés pour performance)
  total_ht DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tva DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_ttc DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_remise DECIMAL(12,2) NOT NULL DEFAULT 0,
  acompte_demande DECIMAL(12,2) DEFAULT 0,      -- Acompte demandé sur devis
  net_a_payer DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- TVA
  tva_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  mention_tva VARCHAR(255) DEFAULT 'TVA non applicable, art. 293 B du CGI',

  -- Remise globale
  remise_type ENUM('pourcentage', 'montant'),
  remise_valeur DECIMAL(12,2) DEFAULT 0,

  -- Conditions
  conditions_paiement TEXT,                     -- "Paiement à réception" etc.
  modes_paiement JSON,                          -- ["virement", "cheque", "especes", "cb"]
  iban VARCHAR(34),
  bic VARCHAR(11),

  -- Notes
  notes_internes TEXT,                          -- Visibles admin uniquement
  notes_client TEXT,                            -- Affichées sur le document
  objet VARCHAR(500),                           -- Objet du devis/facture

  -- Signature (devis)
  signature_nom VARCHAR(255),
  signature_date DATETIME,
  signature_ip VARCHAR(45),
  signature_hash VARCHAR(64),                   -- SHA256 du document signé

  -- Lien public
  token_public VARCHAR(64) UNIQUE,              -- Token pour accès sans auth
  token_expire_at DATETIME,

  -- PDF
  pdf_path VARCHAR(500),                        -- Chemin fichier généré
  pdf_generated_at DATETIME,

  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(100),

  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
  FOREIGN KEY (devis_origine_id) REFERENCES documents(id) ON DELETE SET NULL,
  FOREIGN KEY (facture_origine_id) REFERENCES documents(id) ON DELETE SET NULL,

  INDEX idx_type_statut (type, statut),
  INDEX idx_client (client_id),
  INDEX idx_date_emission (date_emission),
  INDEX idx_token (token_public)
);
```

### 2.4 Table `document_lignes`

```sql
CREATE TABLE document_lignes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,

  -- Position et hiérarchie
  ordre INT NOT NULL DEFAULT 0,
  type ENUM('section', 'ligne', 'sous_total', 'texte') NOT NULL DEFAULT 'ligne',
  section_id INT,                               -- Parent si sous-ligne (1.1, 1.2...)
  numero_affiche VARCHAR(10),                   -- "1", "1.1", "2", etc.

  -- Contenu
  designation VARCHAR(500) NOT NULL,
  description TEXT,                             -- Description détaillée optionnelle

  -- Quantités et prix
  quantite DECIMAL(10,3) DEFAULT 1,
  unite VARCHAR(20) DEFAULT 'u',                -- u, h, m², m³, ml, forfait, lot...
  prix_unitaire_ht DECIMAL(12,2) DEFAULT 0,

  -- Remise ligne
  remise_type ENUM('pourcentage', 'montant'),
  remise_valeur DECIMAL(12,2) DEFAULT 0,

  -- TVA ligne (si TVA applicable)
  taux_tva DECIMAL(5,2) DEFAULT 0,              -- 0, 5.5, 10, 20

  -- Totaux calculés
  total_ht DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tva DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_ttc DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES document_lignes(id) ON DELETE SET NULL,

  INDEX idx_document_ordre (document_id, ordre)
);
```

### 2.5 Table `paiements`

```sql
CREATE TABLE paiements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,

  -- Paiement
  date_paiement DATE NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  mode ENUM('virement', 'cheque', 'especes', 'cb', 'autre') NOT NULL,
  reference VARCHAR(100),                       -- N° chèque, référence virement...

  -- Notes
  notes TEXT,

  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),

  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,

  INDEX idx_document (document_id)
);
```

### 2.6 Table `document_modeles`

```sql
CREATE TABLE document_modeles (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Identification
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('devis', 'facture') NOT NULL,

  -- Contenu template
  lignes JSON NOT NULL,                         -- Array de lignes pré-remplies
  conditions_paiement TEXT,
  modes_paiement JSON,
  notes_client TEXT,
  tva_applicable BOOLEAN DEFAULT FALSE,

  -- Métadonnées
  actif BOOLEAN DEFAULT TRUE,
  ordre INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_type_actif (type, actif)
);
```

### 2.7 Table `parametres_documents`

```sql
CREATE TABLE parametres_documents (
  cle VARCHAR(100) PRIMARY KEY,
  valeur TEXT NOT NULL,
  description VARCHAR(500),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Données initiales
INSERT INTO parametres_documents (cle, valeur, description) VALUES
('entreprise_nom', 'Thomas Bonnardel', 'Nom de l''entreprise'),
('entreprise_activite', 'Design - Rénovation', 'Activité'),
('entreprise_adresse', '944 Chemin de Tardinaou', 'Adresse'),
('entreprise_cp', '13190', 'Code postal'),
('entreprise_ville', 'Allauch', 'Ville'),
('entreprise_telephone', '06 95 07 10 84', 'Téléphone'),
('entreprise_email', 'thomasromeo.bonnardel@gmail.com', 'Email'),
('entreprise_siren', '992 454 694', 'SIREN'),
('entreprise_siret', '', 'SIRET (optionnel)'),
('entreprise_forme_juridique', 'EI', 'Forme juridique'),
('entreprise_logo_url', '', 'URL du logo'),
('devis_validite_jours', '30', 'Durée de validité des devis en jours'),
('facture_echeance_jours', '30', 'Délai de paiement factures en jours'),
('numero_devis_prefixe', 'D', 'Préfixe numéros devis'),
('numero_facture_prefixe', 'F', 'Préfixe numéros factures'),
('numero_avoir_prefixe', 'A', 'Préfixe numéros avoirs'),
('numero_annee_format', 'YYYY', 'Format année dans numéro'),
('numero_compteur_digits', '5', 'Nombre de chiffres compteur'),
('tva_applicable_defaut', 'false', 'TVA applicable par défaut'),
('mention_tva_defaut', 'TVA non applicable, art. 293 B du CGI', 'Mention TVA par défaut'),
('modes_paiement_defaut', '["virement", "cheque"]', 'Modes de paiement par défaut'),
('iban', '', 'IBAN pour virements'),
('bic', '', 'BIC'),
('conditions_paiement_defaut', 'Paiement à réception de facture', 'Conditions par défaut'),
('mention_legale_pied', 'Thomas Bonnardel EI - 944 Chemin de Tardinaou 13190 Allauch\nSIREN 992 454 694', 'Mention légale pied de page');
```

### 2.8 Table `document_historique`

```sql
CREATE TABLE document_historique (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,

  -- Événement
  evenement ENUM(
    'creation',
    'modification',
    'envoi',
    'vu',
    'relance',
    'signature',
    'refus',
    'expiration',
    'paiement',
    'paiement_partiel',
    'annulation',
    'conversion_facture',
    'pdf_genere'
  ) NOT NULL,

  -- Détails
  details JSON,                                 -- Données contextuelles
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),

  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,

  INDEX idx_document_date (document_id, created_at)
);
```

---

## 3. Règles de calcul

### 3.1 Calcul d'une ligne

```javascript
/**
 * Calcule les totaux d'une ligne de document
 */
function calculerLigne(ligne) {
  // Base HT
  const baseHT = arrondir(ligne.quantite * ligne.prix_unitaire_ht, 2);

  // Remise ligne
  let remise = 0;
  if (ligne.remise_valeur > 0) {
    if (ligne.remise_type === 'pourcentage') {
      remise = arrondir(baseHT * ligne.remise_valeur / 100, 2);
    } else {
      remise = ligne.remise_valeur;
    }
  }

  const totalHT = arrondir(baseHT - remise, 2);

  // TVA
  const totalTVA = arrondir(totalHT * ligne.taux_tva / 100, 2);
  const totalTTC = arrondir(totalHT + totalTVA, 2);

  return { totalHT, totalTVA, totalTTC, remise };
}
```

### 3.2 Calcul du document complet

```javascript
/**
 * Calcule tous les totaux d'un document
 */
function calculerDocument(document, lignes) {
  // Somme des lignes (exclure sections et textes)
  const lignesCalculables = lignes.filter(l => l.type === 'ligne');

  let totalHT = 0;
  let totalTVA = 0;
  let totalRemiseLignes = 0;

  for (const ligne of lignesCalculables) {
    const calcul = calculerLigne(ligne);
    totalHT += calcul.totalHT;
    totalTVA += calcul.totalTVA;
    totalRemiseLignes += calcul.remise;
  }

  // Remise globale
  let remiseGlobale = 0;
  if (document.remise_valeur > 0) {
    if (document.remise_type === 'pourcentage') {
      remiseGlobale = arrondir(totalHT * document.remise_valeur / 100, 2);
    } else {
      remiseGlobale = document.remise_valeur;
    }
  }

  const totalHTApresRemise = arrondir(totalHT - remiseGlobale, 2);

  // Recalcul TVA si remise globale
  let totalTVAFinal = totalTVA;
  if (remiseGlobale > 0 && document.tva_applicable) {
    // Redistribuer la remise au prorata des taux TVA
    totalTVAFinal = recalculerTVAAvecRemise(lignesCalculables, remiseGlobale);
  }

  const totalTTC = arrondir(totalHTApresRemise + totalTVAFinal, 2);
  const totalRemise = arrondir(totalRemiseLignes + remiseGlobale, 2);

  // Acomptes/paiements reçus
  const totalPaiements = document.paiements?.reduce((sum, p) => sum + p.montant, 0) || 0;
  const netAPayer = arrondir(totalTTC - totalPaiements, 2);

  return {
    total_ht: totalHTApresRemise,
    total_tva: totalTVAFinal,
    total_ttc: totalTTC,
    total_remise: totalRemise,
    net_a_payer: netAPayer
  };
}

/**
 * Arrondi bancaire à 2 décimales
 */
function arrondir(valeur, decimales = 2) {
  const facteur = Math.pow(10, decimales);
  return Math.round(valeur * facteur) / facteur;
}
```

### 3.3 Sous-totaux de section

```javascript
/**
 * Calcule le sous-total d'une section
 */
function calculerSousTotal(lignes, sectionId) {
  return lignes
    .filter(l => l.section_id === sectionId && l.type === 'ligne')
    .reduce((sum, l) => sum + l.total_ht, 0);
}
```

### 3.4 Gestion des taux TVA multiples

```javascript
/**
 * Ventilation TVA par taux
 */
function ventilationTVA(lignes) {
  const ventilation = {};

  for (const ligne of lignes.filter(l => l.type === 'ligne')) {
    const taux = ligne.taux_tva || 0;
    if (!ventilation[taux]) {
      ventilation[taux] = { base_ht: 0, montant_tva: 0 };
    }
    ventilation[taux].base_ht += ligne.total_ht;
    ventilation[taux].montant_tva += ligne.total_tva;
  }

  return ventilation;
}
```

---

## 4. Numérotation automatique

### 4.1 Format

Le format de numérotation est : `{PREFIXE}{ANNEE}{COMPTEUR}`

| Type | Préfixe | Exemple |
|------|---------|---------|
| Devis | D | D202500001 |
| Facture | F | F202500001 |
| Avoir | A | A202500001 |

### 4.2 Règles

1. **Séquence continue** : Les numéros sont attribués de manière séquentielle, sans trou
2. **Annuel** : Le compteur repart à 1 chaque année
3. **Immuable** : Une fois attribué, le numéro ne peut être modifié
4. **Chronologique** : Pas de numéro avec date antérieure au dernier émis

### 4.3 Implémentation

```javascript
/**
 * Génère le prochain numéro de document
 * @param {string} type - 'devis', 'facture', 'avoir'
 * @returns {string} Numéro généré
 */
async function genererNumero(type) {
  const prefixes = {
    devis: 'D',
    facture: 'F',
    avoir: 'A'
  };

  const prefixe = prefixes[type];
  const annee = new Date().getFullYear();

  // Transaction pour éviter les doublons
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // Récupérer le dernier numéro de l'année
    const [rows] = await connection.query(`
      SELECT numero FROM documents
      WHERE type = ? AND numero LIKE ?
      ORDER BY numero DESC LIMIT 1
      FOR UPDATE
    `, [type, `${prefixe}${annee}%`]);

    let compteur = 1;
    if (rows.length > 0) {
      const dernierNumero = rows[0].numero;
      compteur = parseInt(dernierNumero.slice(-5)) + 1;
    }

    const numero = `${prefixe}${annee}${compteur.toString().padStart(5, '0')}`;

    await connection.commit();
    return numero;

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

---

## 5. Architecture API

### 5.1 Endpoints

#### Clients

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/clients` | Liste clients (pagination, recherche) | Admin |
| GET | `/api/clients/:id` | Détail client avec documents | Admin |
| POST | `/api/clients` | Créer client | Admin |
| PUT | `/api/clients/:id` | Modifier client | Admin |
| DELETE | `/api/clients/:id` | Supprimer client (si aucun document) | Admin |
| GET | `/api/clients/:id/documents` | Documents d'un client | Admin |

#### Documents

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/documents` | Liste documents (filtres, pagination) | Admin |
| GET | `/api/documents/:id` | Détail document complet | Admin |
| POST | `/api/documents` | Créer document | Admin |
| PUT | `/api/documents/:id` | Modifier document | Admin |
| DELETE | `/api/documents/:id` | Supprimer brouillon uniquement | Admin |
| POST | `/api/documents/:id/dupliquer` | Dupliquer document | Admin |
| POST | `/api/documents/:id/convertir` | Convertir devis en facture | Admin |
| POST | `/api/documents/:id/envoyer` | Envoyer par email | Admin |
| POST | `/api/documents/:id/relancer` | Envoyer relance | Admin |
| GET | `/api/documents/:id/pdf` | Télécharger PDF | Admin |
| POST | `/api/documents/:id/pdf/regenerer` | Regénérer PDF | Admin |
| GET | `/api/documents/:id/historique` | Historique événements | Admin |

#### Lignes

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/documents/:id/lignes` | Ajouter ligne(s) | Admin |
| PUT | `/api/documents/:id/lignes/:ligneId` | Modifier ligne | Admin |
| DELETE | `/api/documents/:id/lignes/:ligneId` | Supprimer ligne | Admin |
| PUT | `/api/documents/:id/lignes/reorder` | Réordonner lignes | Admin |

#### Paiements

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/api/documents/:id/paiements` | Enregistrer paiement | Admin |
| DELETE | `/api/documents/:id/paiements/:paiementId` | Supprimer paiement | Admin |

#### Accès public (client)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/public/documents/:token` | Voir document | Public |
| POST | `/api/public/documents/:token/accepter` | Accepter devis | Public |
| POST | `/api/public/documents/:token/refuser` | Refuser devis | Public |
| GET | `/api/public/documents/:token/pdf` | Télécharger PDF | Public |

#### Modèles

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/document-modeles` | Liste modèles | Admin |
| POST | `/api/document-modeles` | Créer modèle | Admin |
| PUT | `/api/document-modeles/:id` | Modifier modèle | Admin |
| DELETE | `/api/document-modeles/:id` | Supprimer modèle | Admin |

#### Paramètres

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/parametres-documents` | Tous paramètres | Admin |
| PUT | `/api/parametres-documents` | Maj batch paramètres | Admin |

#### Stats & Export

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/documents/stats` | Statistiques CA, impayés... | Admin |
| GET | `/api/documents/export` | Export CSV | Admin |

### 5.2 Schémas de validation (Zod)

```typescript
// schemas/documents.ts

import { z } from 'zod';

export const ClientSchema = z.object({
  type: z.enum(['particulier', 'professionnel']).default('particulier'),
  nom: z.string().min(1).max(255),
  prenom: z.string().max(100).optional(),
  email: z.string().email().optional(),
  telephone: z.string().max(20).optional(),
  adresse_ligne1: z.string().max(255).optional(),
  adresse_ligne2: z.string().max(255).optional(),
  code_postal: z.string().max(10).optional(),
  ville: z.string().max(100).optional(),
  pays: z.string().max(100).default('France'),
  siret: z.string().max(20).optional(),
  tva_intracom: z.string().max(20).optional(),
  notes: z.string().optional(),
});

export const DocumentLigneSchema = z.object({
  type: z.enum(['section', 'ligne', 'sous_total', 'texte']).default('ligne'),
  section_id: z.number().int().optional(),
  designation: z.string().min(1).max(500),
  description: z.string().optional(),
  quantite: z.number().min(0).default(1),
  unite: z.string().max(20).default('u'),
  prix_unitaire_ht: z.number().min(0).default(0),
  remise_type: z.enum(['pourcentage', 'montant']).optional(),
  remise_valeur: z.number().min(0).default(0),
  taux_tva: z.number().min(0).max(100).default(0),
});

export const DocumentSchema = z.object({
  type: z.enum(['devis', 'facture', 'avoir']),
  client_id: z.number().int(),
  reference_externe: z.string().max(100).optional(),
  date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_validite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tva_applicable: z.boolean().default(false),
  mention_tva: z.string().optional(),
  remise_type: z.enum(['pourcentage', 'montant']).optional(),
  remise_valeur: z.number().min(0).default(0),
  acompte_demande: z.number().min(0).default(0),
  conditions_paiement: z.string().optional(),
  modes_paiement: z.array(z.string()).optional(),
  notes_internes: z.string().optional(),
  notes_client: z.string().optional(),
  objet: z.string().max(500).optional(),
  lignes: z.array(DocumentLigneSchema).optional(),
});

export const PaiementSchema = z.object({
  date_paiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montant: z.number().positive(),
  mode: z.enum(['virement', 'cheque', 'especes', 'cb', 'autre']),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export const SignatureSchema = z.object({
  nom: z.string().min(1).max(255),
  accepte: z.boolean(),
  commentaire: z.string().optional(),
});
```

### 5.3 Exemple de réponse API

```json
// GET /api/documents/42

{
  "id": 42,
  "type": "devis",
  "numero": "D202500010",
  "statut": "envoye",
  "date_emission": "2025-12-08",
  "date_validite": "2026-01-07",

  "client": {
    "id": 5,
    "type": "professionnel",
    "nom": "ENTREPRISE GALAND",
    "adresse_ligne1": "14 rue pierre beranger",
    "code_postal": "13012",
    "ville": "Marseille",
    "siret": "951 402 437 00028"
  },

  "lignes": [
    {
      "id": 101,
      "type": "section",
      "numero_affiche": "1",
      "designation": "Installation électrique",
      "ordre": 0,
      "sous_total_ht": 330.00
    },
    {
      "id": 102,
      "type": "ligne",
      "section_id": 101,
      "numero_affiche": "1.1",
      "designation": "Dépose ancienne installation",
      "quantite": 1,
      "unite": "u",
      "prix_unitaire_ht": 50.00,
      "total_ht": 50.00,
      "ordre": 1
    },
    {
      "id": 103,
      "type": "ligne",
      "section_id": 101,
      "numero_affiche": "1.2",
      "designation": "Installation bandeau LED",
      "quantite": 2,
      "unite": "u",
      "prix_unitaire_ht": 75.00,
      "total_ht": 150.00,
      "ordre": 2
    },
    {
      "id": 104,
      "type": "ligne",
      "section_id": 101,
      "numero_affiche": "1.3",
      "designation": "Raccordement électrique LED",
      "quantite": 2,
      "unite": "u",
      "prix_unitaire_ht": 40.00,
      "total_ht": 80.00,
      "ordre": 3
    },
    {
      "id": 105,
      "type": "ligne",
      "section_id": 101,
      "numero_affiche": "1.4",
      "designation": "Raccordement électrique spot extérieur",
      "quantite": 1,
      "unite": "u",
      "prix_unitaire_ht": 50.00,
      "total_ht": 50.00,
      "ordre": 4
    }
  ],

  "totaux": {
    "total_ht": 330.00,
    "total_tva": 0,
    "total_ttc": 330.00,
    "total_remise": 0,
    "net_a_payer": 330.00
  },

  "tva_applicable": false,
  "mention_tva": "TVA non applicable, art. 293 B du CGI",

  "modes_paiement": ["virement", "cheque"],

  "token_public": "abc123xyz...",
  "lien_public": "https://atelier-des-espaces.fr/devis/abc123xyz",

  "paiements": [],

  "historique": [
    { "evenement": "creation", "created_at": "2025-12-08T10:00:00Z" },
    { "evenement": "envoi", "created_at": "2025-12-08T10:15:00Z" }
  ]
}
```

---

## 6. Parcours utilisateur

### 6.1 Création rapide d'un devis (2-5 min)

```
┌────────────────────────────────────────────────────────────────────┐
│                     CRÉATION DE DEVIS                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Étape 1: Client                                   [30 sec]        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  🔍 Rechercher client existant...  [▼]                       │ │
│  │  ─────────────────────────────────                           │ │
│  │  ○ ENTREPRISE GALAND - 13012 Marseille                       │ │
│  │  ○ DUPONT Jean - 13001 Marseille                             │ │
│  │  + Créer nouveau client                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Étape 2: Lignes                                   [2-3 min]       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  [+ Section] [+ Ligne] [Importer modèle ▼]                   │ │
│  │                                                               │ │
│  │  ▼ 1. Installation électrique                      330,00 €  │ │
│  │    │ 1.1 Dépose ancienne installation   1 u × 50€    50,00 € │ │
│  │    │ 1.2 Installation bandeau LED       2 u × 75€   150,00 € │ │
│  │    │ 1.3 Raccordement LED               2 u × 40€    80,00 € │ │
│  │    └ 1.4 Raccord. spot extérieur        1 u × 50€    50,00 € │ │
│  │                                                               │ │
│  │  [+ Ajouter section ou ligne...]                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Étape 3: Options                                  [30 sec]        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Validité: 30 jours [▼]    Acompte: [    0   ] €             │ │
│  │  Modes paiement: ☑ Virement  ☑ Chèque  ☐ CB  ☐ Espèces      │ │
│  │  Notes client: [                                        ]     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │           RÉCAPITULATIF                                    │   │
│  │           Total HT:        330,00 €                        │   │
│  │           Net à payer:     330,00 €                        │   │
│  │           TVA non applicable, art. 293 B du CGI            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  [Prévisualiser PDF]  [Sauver brouillon]  [Envoyer au client →]   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 États et transitions

```
                    ┌─────────────┐
                    │  BROUILLON  │
                    └──────┬──────┘
                           │ Envoyer
                           ▼
                    ┌─────────────┐
              ┌─────│   ENVOYÉ    │─────┐
              │     └──────┬──────┘     │
              │            │ Client     │
              │            │ ouvre      │
              │            ▼            │
              │     ┌─────────────┐     │
              │     │     VU      │     │
              │     └──────┬──────┘     │
              │            │            │
         ┌────┴────┐       │       ┌────┴────┐
         ▼         │       │       │         ▼
   ┌─────────┐     │       │       │   ┌─────────┐
   │ REFUSÉ  │     │       │       │   │ EXPIRÉ  │
   └─────────┘     │       │       │   └─────────┘
                   │       │       │
                   │       ▼       │
                   │ ┌─────────────┐│
                   │ │  ACCEPTÉ    ││
                   │ │  (signé)    ││
                   │ └──────┬──────┘│
                   │        │       │
                   │        │ Convertir
                   │        ▼       │
                   │ ┌─────────────┐│
                   └─│  FACTURE    │┘
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌───────────┐ ┌───────────┐ ┌───────────┐
        │PAYE_PARTIE│ │   PAYÉ    │ │  ANNULÉ   │
        └───────────┘ └───────────┘ └───────────┘
                                          │
                                          ▼
                                    ┌───────────┐
                                    │   AVOIR   │
                                    └───────────┘
```

### 6.3 Interface liste des documents

```
┌──────────────────────────────────────────────────────────────────────────┐
│  DEVIS & FACTURES                                     [+ Nouveau ▼]      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Devis] [Factures] [Avoirs] [Tous]     🔍 Rechercher...   [Filtres ▼]  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ● D202500010   ENTREPRISE GALAND      08/12/2025     330,00 €      │  │
│  │   Envoyé                              Expire: 07/01/2026           │  │
│  │   Installation électrique                           [⋮]            │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ ○ D202500009   MARTIN Sophie          05/12/2025   1 250,00 €      │  │
│  │   Accepté ✓                           Signé le 06/12              │  │
│  │   Rénovation salle de bain                          [⋮]            │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ ○ F202500003   DURAND Pierre          01/12/2025   2 800,00 €      │  │
│  │   🔴 En retard (15j)                  Éch: 10/12/2025             │  │
│  │   Aménagement cuisine                               [⋮]            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Affichage 1-10 sur 47                              [< 1 2 3 4 5 >]     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  📊 Ce mois: 5 devis (8 500€) • 3 factures (6 200€) • 1 impayé    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Vue publique client (signature devis)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                        Thomas Bonnardel                                  │
│                       Design - Rénovation                                │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Bonjour ENTREPRISE GALAND,                                            │
│                                                                          │
│   Voici votre devis n° D202500010 du 08/12/2025                         │
│   Valide jusqu'au 07/01/2026                                            │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                                                                │    │
│   │     [📄 Prévisualisation PDF intégrée]                        │    │
│   │                                                                │    │
│   │                                                                │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│                         Net à payer: 330,00 €                           │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │  Pour accepter ce devis, veuillez renseigner:                  │    │
│   │                                                                │    │
│   │  Nom complet: [_________________________________]              │    │
│   │                                                                │    │
│   │  ☑ J'accepte les conditions et le montant du devis            │    │
│   │                                                                │    │
│   │  [        Accepter et signer        ]  [Refuser]               │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   [📥 Télécharger le PDF]                                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Génération PDF

### 7.1 Stack technique

```javascript
// Dépendances à ajouter
// npm install @react-pdf/renderer qrcode
```

### 7.2 Structure du template PDF

Le PDF reproduit fidèlement le modèle de référence :

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [LOGO]                                                         │
│  Thomas Bonnardel                              DEVIS            │
│  Design - Rénovation                           n° D202500010    │
│  944 Chemin de Tardinaou                                        │
│  13190 Allauch                                 En date du:      │
│  📞 06 95 07 10 84                             08/12/2025       │
│  ✉ thomasromeo.bonnardel@gmail.com            Valide jusqu'au: │
│  SIREN: 992 454 694                            07/01/2026       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                           CLIENT                                │
│           ┌────────────────────────────────────┐                │
│           │ ENTREPRISE GALAND                  │                │
│           │ 14 rue pierre beranger             │                │
│           │ 13012 Marseille                    │                │
│           │ SIRET: 951 402 437 00028           │                │
│           └────────────────────────────────────┘                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ N°  │ Désignation              │ Qté │ U │ P.U HT │ Tot │   │
│  ├─────┼──────────────────────────┼─────┼───┼────────┼─────┤   │
│  │ 1   │ Installation électrique  │     │   │        │     │   │
│  │ 1.1 │ Dépose ancienne install. │  1  │ u │  50,00 │  50 │   │
│  │ 1.2 │ Installation bandeau LED │  2  │ u │  75,00 │ 150 │   │
│  │ 1.3 │ Raccordement LED         │  2  │ u │  40,00 │  80 │   │
│  │ 1.4 │ Raccord. spot extérieur  │  1  │ u │  50,00 │  50 │   │
│  │     │                          │     │   │  Sect. │ 330 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  MODES DE PAIEMENT           ┌─────────────────────────────┐   │
│  ┌──────────────────────┐    │ Total HT:        330,00 €   │   │
│  │ 🏦 Virement bancaire │    │ ═══════════════════════════ │   │
│  │ 📝 Chèque            │    │ Net à payer:     330,00 €   │   │
│  └──────────────────────┘    │ TVA non applicable...       │   │
│                              └─────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Mention "Bon pour Accord", date et signature            │   │
│  │                                                         │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [QR]  Scannez le code QR pour retrouver votre devis en ligne  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Thomas Bonnardel EI - 944 Chemin de Tardinaou...   Page 1/1   │
│  SIREN 992 454 694                          Devis n°D202500010 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Composant React-PDF

```jsx
// src/components/pdf/DevisFacturePDF.jsx

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Enregistrer les polices
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Inter-Medium.ttf', fontWeight: 'medium' },
    { src: '/fonts/Inter-SemiBold.ttf', fontWeight: 'semibold' },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 'bold' },
  ],
});

// Couleurs du thème
const colors = {
  primary: '#1e5a8a',      // Bleu foncé (en-têtes, accents)
  primaryLight: '#e8f0f5', // Bleu clair (fond section)
  text: '#333333',
  textLight: '#666666',
  border: '#e0e0e0',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    paddingTop: 30,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: colors.text,
  },

  // En-tête
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  entrepriseInfo: {
    flex: 1,
  },
  entrepriseNom: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },
  entrepriseActivite: {
    fontSize: 10,
    color: colors.textLight,
    marginBottom: 8,
  },
  entrepriseAdresse: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  entrepriseContact: {
    fontSize: 9,
    marginTop: 6,
    lineHeight: 1.4,
  },

  // Bloc Document
  documentBloc: {
    alignItems: 'flex-end',
  },
  documentType: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  documentNumero: {
    fontSize: 11,
    color: colors.primary,
    marginBottom: 8,
  },
  documentDates: {
    fontSize: 9,
    textAlign: 'right',
    lineHeight: 1.5,
  },

  // Bloc Client
  clientSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  clientLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: 'semibold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  clientBox: {
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 4,
    minWidth: 250,
  },
  clientNom: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  clientAdresse: {
    fontSize: 9,
    lineHeight: 1.4,
  },

  // Tableau lignes
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    color: colors.white,
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: 'semibold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowSection: {
    backgroundColor: colors.primaryLight,
  },

  // Colonnes
  colNumero: { width: '8%' },
  colDesignation: { width: '44%' },
  colQte: { width: '10%', textAlign: 'center' },
  colUnite: { width: '8%', textAlign: 'center' },
  colPrixU: { width: '15%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 'semibold',
    color: colors.primary,
  },
  sousTotal: {
    textAlign: 'right',
    fontSize: 9,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    padding: 4,
    marginTop: 2,
  },

  // Footer tableau
  totauxSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  modesPaiement: {
    flex: 1,
  },
  modesPaiementTitre: {
    fontSize: 10,
    fontWeight: 'semibold',
    color: colors.primary,
    marginBottom: 8,
  },
  modesPaiementBox: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 4,
  },
  modePaiementItem: {
    fontSize: 9,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },

  totauxBox: {
    width: 200,
    marginLeft: 40,
  },
  totauxLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  netAPayer: {
    backgroundColor: colors.primary,
    color: colors.white,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontWeight: 'bold',
    fontSize: 11,
    marginTop: 4,
  },
  mentionTVA: {
    fontSize: 8,
    fontStyle: 'italic',
    color: colors.textLight,
    marginTop: 6,
    textAlign: 'right',
  },

  // Zone signature
  signatureSection: {
    marginTop: 20,
  },
  signatureBox: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 80,
    borderRadius: 4,
  },
  signatureLabel: {
    fontSize: 9,
    color: colors.textLight,
  },

  // QR Code
  qrSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qrCode: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  qrText: {
    fontSize: 8,
    color: colors.textLight,
  },

  // Pied de page
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: colors.textLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: 'right',
  },
});

const DevisFacturePDF = ({ document, entreprise, qrCodeDataUrl }) => {
  const isDevis = document.type === 'devis';
  const typeLabel = {
    devis: 'DEVIS',
    facture: 'FACTURE',
    avoir: 'AVOIR',
  }[document.type];

  // Grouper les lignes par section
  const lignesGroupees = grouperLignesParSection(document.lignes);

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* EN-TÊTE */}
        <View style={styles.header}>
          <View style={styles.entrepriseInfo}>
            <Text style={styles.entrepriseNom}>{entreprise.nom}</Text>
            <Text style={styles.entrepriseActivite}>{entreprise.activite}</Text>
            <Text style={styles.entrepriseAdresse}>
              {entreprise.adresse}{'\n'}
              {entreprise.cp} {entreprise.ville}
            </Text>
            <Text style={styles.entrepriseContact}>
              📞 {entreprise.telephone}{'\n'}
              ✉ {entreprise.email}{'\n'}
              SIREN : {entreprise.siren}
            </Text>
          </View>

          <View style={styles.documentBloc}>
            <Text style={styles.documentType}>{typeLabel}</Text>
            <Text style={styles.documentNumero}>n° {document.numero}</Text>
            <Text style={styles.documentDates}>
              En date du : {formatDate(document.date_emission)}{'\n'}
              {isDevis && `Valide jusqu'au : ${formatDate(document.date_validite)}`}
              {!isDevis && document.date_echeance && `Échéance : ${formatDate(document.date_echeance)}`}
            </Text>
          </View>
        </View>

        {/* BLOC CLIENT */}
        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>CLIENT</Text>
          <View style={styles.clientBox}>
            <Text style={styles.clientNom}>{document.client.nom}</Text>
            <Text style={styles.clientAdresse}>
              {document.client.adresse_ligne1}
              {document.client.adresse_ligne2 && `\n${document.client.adresse_ligne2}`}
              {'\n'}{document.client.code_postal} {document.client.ville}
              {document.client.siret && `\nSIRET : ${document.client.siret}`}
            </Text>
          </View>
        </View>

        {/* TABLEAU DES LIGNES */}
        <View style={styles.table}>
          {/* En-tête tableau */}
          <View style={styles.tableHeader}>
            <Text style={styles.colNumero}>N°</Text>
            <Text style={styles.colDesignation}>Désignation</Text>
            <Text style={styles.colQte}>Qté.</Text>
            <Text style={styles.colUnite}>Unité</Text>
            <Text style={styles.colPrixU}>Prix U. HT</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>

          {/* Lignes groupées par section */}
          {lignesGroupees.map((groupe, idx) => (
            <View key={idx}>
              {/* Titre section */}
              {groupe.section && (
                <View style={[styles.tableRow, styles.tableRowSection]}>
                  <Text style={styles.colNumero}>{groupe.section.numero_affiche}</Text>
                  <Text style={[styles.colDesignation, styles.sectionTitle]}>
                    {groupe.section.designation}
                  </Text>
                  <Text style={styles.colQte}></Text>
                  <Text style={styles.colUnite}></Text>
                  <Text style={styles.colPrixU}></Text>
                  <Text style={styles.colTotal}></Text>
                </View>
              )}

              {/* Sous-lignes */}
              {groupe.lignes.map((ligne, ligneIdx) => (
                <View key={ligneIdx} style={styles.tableRow}>
                  <Text style={styles.colNumero}>{ligne.numero_affiche}</Text>
                  <Text style={styles.colDesignation}>{ligne.designation}</Text>
                  <Text style={styles.colQte}>{ligne.quantite}</Text>
                  <Text style={styles.colUnite}>{ligne.unite}</Text>
                  <Text style={styles.colPrixU}>{formatMontant(ligne.prix_unitaire_ht)}</Text>
                  <Text style={styles.colTotal}>{formatMontant(ligne.total_ht)}</Text>
                </View>
              ))}

              {/* Sous-total section */}
              {groupe.section && (
                <Text style={styles.sousTotal}>
                  {groupe.section.designation} : {formatMontant(groupe.sousTotal)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* MODES DE PAIEMENT + TOTAUX */}
        <View style={styles.totauxSection}>
          <View style={styles.modesPaiement}>
            <Text style={styles.modesPaiementTitre}>MODES DE PAIEMENT</Text>
            <View style={styles.modesPaiementBox}>
              {document.modes_paiement?.map((mode, idx) => (
                <Text key={idx} style={styles.modePaiementItem}>
                  {getModeIcon(mode)} {getModeLabel(mode)}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.totauxBox}>
            <View style={styles.totauxLigne}>
              <Text>Total HT</Text>
              <Text>{formatMontant(document.total_ht)}</Text>
            </View>

            {document.tva_applicable && (
              <View style={styles.totauxLigne}>
                <Text>TVA</Text>
                <Text>{formatMontant(document.total_tva)}</Text>
              </View>
            )}

            {document.total_remise > 0 && (
              <View style={styles.totauxLigne}>
                <Text>Remise</Text>
                <Text>-{formatMontant(document.total_remise)}</Text>
              </View>
            )}

            <View style={styles.netAPayer}>
              <Text>Net à payer</Text>
              <Text>{formatMontant(document.net_a_payer)}</Text>
            </View>

            <Text style={styles.mentionTVA}>{document.mention_tva}</Text>
          </View>
        </View>

        {/* ZONE SIGNATURE (devis uniquement) */}
        {isDevis && (
          <View style={styles.signatureSection}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>
                Mention "Bon pour Accord", date et signature
              </Text>
            </View>
          </View>
        )}

        {/* QR CODE */}
        {qrCodeDataUrl && (
          <View style={styles.qrSection}>
            <Image style={styles.qrCode} src={qrCodeDataUrl} />
            <Text style={styles.qrText}>
              Scannez le code QR pour retrouver votre {isDevis ? 'devis' : 'facture'} en ligne
            </Text>
          </View>
        )}

        {/* PIED DE PAGE */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            {entreprise.nom} {entreprise.forme_juridique} - {entreprise.adresse} {entreprise.cp} {entreprise.ville}
            {'\n'}SIREN {entreprise.siren}
          </Text>
          <Text style={styles.footerRight}>
            Page <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            {'\n'}{typeLabel} n°{document.numero}
          </Text>
        </View>

      </Page>
    </Document>
  );
};

// Helpers
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR');
}

function formatMontant(valeur) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(valeur || 0);
}

function getModeIcon(mode) {
  const icons = {
    virement: '🏦',
    cheque: '📝',
    especes: '💵',
    cb: '💳',
    autre: '📋',
  };
  return icons[mode] || '•';
}

function getModeLabel(mode) {
  const labels = {
    virement: 'Virement bancaire',
    cheque: 'Chèque',
    especes: 'Espèces',
    cb: 'Carte bancaire',
    autre: 'Autre',
  };
  return labels[mode] || mode;
}

function grouperLignesParSection(lignes) {
  const groupes = [];
  let groupeActuel = { section: null, lignes: [], sousTotal: 0 };

  for (const ligne of lignes) {
    if (ligne.type === 'section') {
      if (groupeActuel.section || groupeActuel.lignes.length > 0) {
        groupes.push(groupeActuel);
      }
      groupeActuel = { section: ligne, lignes: [], sousTotal: 0 };
    } else if (ligne.type === 'ligne') {
      groupeActuel.lignes.push(ligne);
      groupeActuel.sousTotal += ligne.total_ht || 0;
    }
  }

  if (groupeActuel.section || groupeActuel.lignes.length > 0) {
    groupes.push(groupeActuel);
  }

  return groupes;
}

export default DevisFacturePDF;
```

### 7.4 Endpoint génération PDF

```javascript
// server.js - Ajout endpoint PDF

import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';

app.get('/api/documents/:id/pdf', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le document complet
    const document = await getDocumentComplet(id);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Récupérer les paramètres entreprise
    const entreprise = await getParametresEntreprise();

    // Générer QR code
    const lienPublic = `${process.env.PUBLIC_BASE_URL}/documents/${document.token_public}`;
    const qrCodeDataUrl = await QRCode.toDataURL(lienPublic, {
      width: 120,
      margin: 1,
      color: { dark: '#1e5a8a' },
    });

    // Générer le PDF
    const pdfBuffer = await renderToBuffer(
      <DevisFacturePDF
        document={document}
        entreprise={entreprise}
        qrCodeDataUrl={qrCodeDataUrl}
      />
    );

    // Sauvegarder le fichier
    const filename = `${document.type}-${document.numero}.pdf`;
    const filepath = path.join(uploadsDir, 'documents', filename);
    await fs.writeFile(filepath, pdfBuffer);

    // Mettre à jour le document
    await pool.query(`
      UPDATE documents
      SET pdf_path = ?, pdf_generated_at = NOW()
      WHERE id = ?
    `, [filepath, id]);

    // Log historique
    await logHistorique(id, 'pdf_genere');

    // Envoyer le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erreur génération PDF:', error);
    res.status(500).json({ error: 'Erreur génération PDF' });
  }
});
```

---

## 8. Lien public & QR Code

### 8.1 Génération du token

```javascript
import crypto from 'crypto';

/**
 * Génère un token unique pour l'accès public
 */
function genererTokenPublic() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * URL publique du document
 */
function getLienPublic(token) {
  return `${process.env.PUBLIC_BASE_URL}/documents/${token}`;
}
```

### 8.2 Endpoint public

```javascript
// Accès public au document (sans authentification)
app.get('/api/public/documents/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await pool.query(`
      SELECT d.*, c.nom as client_nom, c.email as client_email
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      WHERE d.token_public = ?
        AND (d.token_expire_at IS NULL OR d.token_expire_at > NOW())
        AND d.statut != 'brouillon'
    `, [token]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé ou expiré' });
    }

    const document = rows[0];

    // Marquer comme vu (première visite)
    if (document.statut === 'envoye') {
      await pool.query(`
        UPDATE documents SET statut = 'vu' WHERE id = ?
      `, [document.id]);

      await logHistorique(document.id, 'vu', {
        ip: req.ip,
        user_agent: req.get('user-agent'),
      });
    }

    // Récupérer les lignes
    const [lignes] = await pool.query(`
      SELECT * FROM document_lignes
      WHERE document_id = ?
      ORDER BY ordre
    `, [document.id]);

    res.json({
      ...document,
      lignes,
      client: {
        nom: document.client_nom,
        email: document.client_email,
      },
    });

  } catch (error) {
    console.error('Erreur accès document public:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Accepter un devis
app.post('/api/public/documents/:token/accepter', async (req, res) => {
  try {
    const { token } = req.params;
    const { nom } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Nom requis pour la signature' });
    }

    const [rows] = await pool.query(`
      SELECT * FROM documents
      WHERE token_public = ? AND type = 'devis'
        AND statut IN ('envoye', 'vu')
        AND (date_validite IS NULL OR date_validite >= CURDATE())
    `, [token]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé ou non acceptable' });
    }

    const document = rows[0];

    // Générer hash signature
    const signatureData = `${document.id}|${nom}|${new Date().toISOString()}`;
    const signatureHash = crypto.createHash('sha256').update(signatureData).digest('hex');

    // Mettre à jour
    await pool.query(`
      UPDATE documents SET
        statut = 'accepte',
        signature_nom = ?,
        signature_date = NOW(),
        signature_ip = ?,
        signature_hash = ?
      WHERE id = ?
    `, [nom, req.ip, signatureHash, document.id]);

    await logHistorique(document.id, 'signature', {
      nom,
      ip: req.ip,
      hash: signatureHash,
    });

    res.json({ success: true, message: 'Devis accepté' });

  } catch (error) {
    console.error('Erreur acceptation devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Refuser un devis
app.post('/api/public/documents/:token/refuser', async (req, res) => {
  try {
    const { token } = req.params;
    const { commentaire } = req.body;

    const [rows] = await pool.query(`
      SELECT * FROM documents
      WHERE token_public = ? AND type = 'devis'
        AND statut IN ('envoye', 'vu')
    `, [token]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    await pool.query(`
      UPDATE documents SET statut = 'refuse' WHERE id = ?
    `, [rows[0].id]);

    await logHistorique(rows[0].id, 'refus', { commentaire, ip: req.ip });

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur refus devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

### 8.3 Page React publique

```jsx
// src/pages/DocumentPublic.jsx

import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export default function DocumentPublic() {
  const { token } = useParams();
  const [nom, setNom] = React.useState('');
  const [accepteConditions, setAccepteConditions] = React.useState(false);

  const { data: document, isLoading, error } = useQuery({
    queryKey: ['document-public', token],
    queryFn: () => fetch(`/api/public/documents/${token}`).then(r => r.json()),
  });

  const accepterMutation = useMutation({
    mutationFn: () => fetch(`/api/public/documents/${token}/accepter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom }),
    }).then(r => r.json()),
  });

  const refuserMutation = useMutation({
    mutationFn: () => fetch(`/api/public/documents/${token}/refuser`, {
      method: 'POST',
    }).then(r => r.json()),
  });

  if (isLoading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Document non trouvé</div>;

  const isDevis = document.type === 'devis';
  const canSign = isDevis && ['envoye', 'vu'].includes(document.statut);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">

        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Thomas Bonnardel</h1>
          <p className="text-gray-600">Design - Rénovation</p>
        </div>

        {/* Message */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-gray-700">
            Bonjour <strong>{document.client?.nom}</strong>,
          </p>
          <p className="mt-2">
            Voici votre {isDevis ? 'devis' : 'facture'} n° <strong>{document.numero}</strong>
            {' '}du {new Date(document.date_emission).toLocaleDateString('fr-FR')}
          </p>
          {isDevis && document.date_validite && (
            <p className="text-sm text-gray-500 mt-1">
              Valide jusqu'au {new Date(document.date_validite).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>

        {/* Prévisualisation PDF */}
        <div className="bg-white rounded-lg shadow mb-6">
          <iframe
            src={`/api/public/documents/${token}/pdf`}
            className="w-full h-[600px] rounded-lg"
            title="Aperçu document"
          />
        </div>

        {/* Montant */}
        <div className="text-center mb-6">
          <p className="text-gray-600">Net à payer</p>
          <p className="text-3xl font-bold text-primary">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
              .format(document.net_a_payer)}
          </p>
        </div>

        {/* Actions signature (devis uniquement) */}
        {canSign && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="font-semibold mb-4">Pour accepter ce devis</h3>

            <div className="space-y-4">
              <Input
                placeholder="Votre nom complet"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="conditions"
                  checked={accepteConditions}
                  onCheckedChange={setAccepteConditions}
                />
                <label htmlFor="conditions" className="text-sm">
                  J'accepte les conditions et le montant du devis
                </label>
              </div>

              <div className="flex gap-4">
                <Button
                  className="flex-1"
                  disabled={!nom || !accepteConditions || accepterMutation.isPending}
                  onClick={() => accepterMutation.mutate()}
                >
                  {accepterMutation.isPending ? 'Envoi...' : 'Accepter et signer'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => refuserMutation.mutate()}
                  disabled={refuserMutation.isPending}
                >
                  Refuser
                </Button>
              </div>
            </div>

            {accepterMutation.isSuccess && (
              <div className="mt-4 p-4 bg-green-50 text-green-700 rounded">
                Merci ! Votre devis a été accepté.
              </div>
            )}
          </div>
        )}

        {/* Statut si déjà traité */}
        {document.statut === 'accepte' && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center mb-6">
            ✓ Ce devis a été accepté le {new Date(document.signature_date).toLocaleDateString('fr-FR')}
          </div>
        )}

        {document.statut === 'refuse' && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center mb-6">
            Ce devis a été refusé
          </div>
        )}

        {/* Télécharger */}
        <div className="text-center">
          <Button variant="outline" asChild>
            <a href={`/api/public/documents/${token}/pdf`} download>
              📥 Télécharger le PDF
            </a>
          </Button>
        </div>

      </div>
    </div>
  );
}
```

---

## 9. Fonctions avancées

### 9.1 Duplication de document

```javascript
app.post('/api/documents/:id/dupliquer', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { type } = req.body; // Optionnel: changer le type

    // Récupérer document source
    const [docs] = await connection.query(
      'SELECT * FROM documents WHERE id = ?', [id]
    );
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const source = docs[0];
    const nouveauType = type || source.type;
    const numero = await genererNumero(nouveauType);
    const token = genererTokenPublic();

    // Créer le nouveau document
    const [result] = await connection.query(`
      INSERT INTO documents (
        type, numero, client_id, date_emission, date_validite,
        tva_applicable, mention_tva, conditions_paiement, modes_paiement,
        notes_client, objet, token_public, statut
      ) VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
        ?, ?, ?, ?, ?, ?, ?, 'brouillon')
    `, [
      nouveauType, numero, source.client_id,
      source.tva_applicable, source.mention_tva,
      source.conditions_paiement, source.modes_paiement,
      source.notes_client, source.objet, token
    ]);

    const nouveauId = result.insertId;

    // Dupliquer les lignes
    const [lignes] = await connection.query(
      'SELECT * FROM document_lignes WHERE document_id = ? ORDER BY ordre',
      [id]
    );

    const mapSections = {}; // old_id -> new_id

    for (const ligne of lignes) {
      const [ligneResult] = await connection.query(`
        INSERT INTO document_lignes (
          document_id, ordre, type, section_id, numero_affiche,
          designation, description, quantite, unite, prix_unitaire_ht,
          remise_type, remise_valeur, taux_tva, total_ht, total_tva, total_ttc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        nouveauId, ligne.ordre, ligne.type,
        ligne.section_id ? mapSections[ligne.section_id] : null,
        ligne.numero_affiche, ligne.designation, ligne.description,
        ligne.quantite, ligne.unite, ligne.prix_unitaire_ht,
        ligne.remise_type, ligne.remise_valeur, ligne.taux_tva,
        ligne.total_ht, ligne.total_tva, ligne.total_ttc
      ]);

      if (ligne.type === 'section') {
        mapSections[ligne.id] = ligneResult.insertId;
      }
    }

    // Recalculer les totaux
    await recalculerTotaux(connection, nouveauId);

    await logHistorique(nouveauId, 'creation', { source_id: id });

    await connection.commit();

    res.json({ id: nouveauId, numero });

  } catch (error) {
    await connection.rollback();
    console.error('Erreur duplication:', error);
    res.status(500).json({ error: 'Erreur duplication' });
  } finally {
    connection.release();
  }
});
```

### 9.2 Conversion devis → facture

```javascript
app.post('/api/documents/:id/convertir', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Vérifier que c'est un devis accepté
    const [docs] = await connection.query(`
      SELECT * FROM documents WHERE id = ? AND type = 'devis'
    `, [id]);

    if (docs.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    const devis = docs[0];

    if (devis.statut !== 'accepte') {
      return res.status(400).json({ error: 'Le devis doit être accepté pour être converti' });
    }

    // Créer la facture
    const numero = await genererNumero('facture');
    const token = genererTokenPublic();
    const echeance = new Date();
    echeance.setDate(echeance.getDate() + 30);

    const [result] = await connection.query(`
      INSERT INTO documents (
        type, numero, client_id, devis_origine_id, date_emission, date_echeance,
        tva_applicable, mention_tva, conditions_paiement, modes_paiement,
        notes_client, objet, token_public, statut,
        total_ht, total_tva, total_ttc, total_remise, net_a_payer
      ) VALUES (
        'facture', ?, ?, ?, CURDATE(), ?,
        ?, ?, ?, ?, ?, ?, ?, 'brouillon',
        ?, ?, ?, ?, ?
      )
    `, [
      numero, devis.client_id, id, echeance.toISOString().split('T')[0],
      devis.tva_applicable, devis.mention_tva,
      devis.conditions_paiement, devis.modes_paiement,
      devis.notes_client, devis.objet, token,
      devis.total_ht, devis.total_tva, devis.total_ttc,
      devis.total_remise, devis.net_a_payer
    ]);

    const factureId = result.insertId;

    // Copier les lignes
    await connection.query(`
      INSERT INTO document_lignes (
        document_id, ordre, type, numero_affiche,
        designation, description, quantite, unite, prix_unitaire_ht,
        remise_type, remise_valeur, taux_tva, total_ht, total_tva, total_ttc
      )
      SELECT
        ?, ordre, type, numero_affiche,
        designation, description, quantite, unite, prix_unitaire_ht,
        remise_type, remise_valeur, taux_tva, total_ht, total_tva, total_ttc
      FROM document_lignes WHERE document_id = ?
    `, [factureId, id]);

    await logHistorique(id, 'conversion_facture', { facture_id: factureId });
    await logHistorique(factureId, 'creation', { devis_origine_id: id });

    await connection.commit();

    res.json({ id: factureId, numero });

  } catch (error) {
    await connection.rollback();
    console.error('Erreur conversion:', error);
    res.status(500).json({ error: 'Erreur conversion' });
  } finally {
    connection.release();
  }
});
```

### 9.3 Envoi par email

```javascript
app.post('/api/documents/:id/envoyer', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, message } = req.body;

    // Récupérer le document
    const document = await getDocumentComplet(id);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const destinataire = email || document.client?.email;
    if (!destinataire) {
      return res.status(400).json({ error: 'Email destinataire requis' });
    }

    // Générer le PDF
    const pdfBuffer = await genererPDF(document);

    // Construire l'email
    const isDevis = document.type === 'devis';
    const typeLabel = isDevis ? 'Devis' : 'Facture';
    const lienPublic = `${process.env.PUBLIC_BASE_URL}/documents/${document.token_public}`;

    const sujet = `${typeLabel} n°${document.numero} - Thomas Bonnardel`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e5a8a;">${typeLabel} n°${document.numero}</h2>

        <p>Bonjour,</p>

        <p>Veuillez trouver ci-joint votre ${typeLabel.toLowerCase()} d'un montant de
        <strong>${formatMontant(document.net_a_payer)}</strong>.</p>

        ${message ? `<p>${message}</p>` : ''}

        <p>Vous pouvez également consulter ce document en ligne :</p>

        <p style="text-align: center;">
          <a href="${lienPublic}"
             style="display: inline-block; padding: 12px 24px; background: #1e5a8a;
                    color: white; text-decoration: none; border-radius: 4px;">
            Voir le ${typeLabel.toLowerCase()}
          </a>
        </p>

        ${isDevis ? `
          <p style="color: #666; font-size: 14px;">
            Ce devis est valable jusqu'au ${formatDate(document.date_validite)}.
          </p>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          Thomas Bonnardel - Design & Rénovation<br>
          944 Chemin de Tardinaou, 13190 Allauch<br>
          06 95 07 10 84
        </p>
      </div>
    `;

    // Envoyer
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: destinataire,
      subject: sujet,
      html,
      attachments: [{
        filename: `${document.type}-${document.numero}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    // Mettre à jour le statut
    if (document.statut === 'brouillon') {
      await pool.query(
        'UPDATE documents SET statut = ? WHERE id = ?',
        ['envoye', id]
      );
    }

    await logHistorique(id, 'envoi', { email: destinataire });

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ error: 'Erreur envoi email' });
  }
});
```

### 9.4 Relances automatiques

```javascript
// Cron job quotidien pour relances
// À exécuter via node-cron ou scheduler externe

async function verifierRelances() {
  // Devis expirés dans 7 jours
  const [devisARelancer] = await pool.query(`
    SELECT d.*, c.email, c.nom as client_nom
    FROM documents d
    JOIN clients c ON d.client_id = c.id
    WHERE d.type = 'devis'
      AND d.statut IN ('envoye', 'vu')
      AND d.date_validite BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      AND NOT EXISTS (
        SELECT 1 FROM document_historique h
        WHERE h.document_id = d.id
        AND h.evenement = 'relance'
        AND h.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      )
  `);

  for (const devis of devisARelancer) {
    await envoyerRelanceDevis(devis);
  }

  // Factures en retard
  const [facturesRetard] = await pool.query(`
    SELECT d.*, c.email, c.nom as client_nom,
           DATEDIFF(CURDATE(), d.date_echeance) as jours_retard
    FROM documents d
    JOIN clients c ON d.client_id = c.id
    WHERE d.type = 'facture'
      AND d.statut NOT IN ('paye', 'annule')
      AND d.date_echeance < CURDATE()
  `);

  for (const facture of facturesRetard) {
    // Relance à 7, 15, 30 jours
    if ([7, 15, 30].includes(facture.jours_retard)) {
      await envoyerRelanceFacture(facture);
    }
  }

  // Marquer devis expirés
  await pool.query(`
    UPDATE documents
    SET statut = 'expire'
    WHERE type = 'devis'
      AND statut IN ('envoye', 'vu')
      AND date_validite < CURDATE()
  `);
}

async function envoyerRelanceDevis(devis) {
  // ... envoi email relance
  await logHistorique(devis.id, 'relance', { type: 'expiration_proche' });
}

async function envoyerRelanceFacture(facture) {
  // ... envoi email relance
  await logHistorique(facture.id, 'relance', {
    type: 'retard_paiement',
    jours_retard: facture.jours_retard
  });
}
```

### 9.5 Modèles réutilisables

```javascript
// Créer un modèle depuis un document existant
app.post('/api/document-modeles/depuis/:documentId', requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { nom, description } = req.body;

    const document = await getDocumentComplet(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Extraire les lignes sans IDs
    const lignesTemplate = document.lignes.map(l => ({
      type: l.type,
      designation: l.designation,
      description: l.description,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
    }));

    const [result] = await pool.query(`
      INSERT INTO document_modeles (
        nom, description, type, lignes,
        conditions_paiement, modes_paiement, notes_client, tva_applicable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nom, description, document.type,
      JSON.stringify(lignesTemplate),
      document.conditions_paiement,
      document.modes_paiement,
      document.notes_client,
      document.tva_applicable
    ]);

    res.json({ id: result.insertId });

  } catch (error) {
    console.error('Erreur création modèle:', error);
    res.status(500).json({ error: 'Erreur création modèle' });
  }
});

// Créer un document depuis un modèle
app.post('/api/documents/depuis-modele/:modeleId', requireAdmin, async (req, res) => {
  try {
    const { modeleId } = req.params;
    const { client_id } = req.body;

    const [modeles] = await pool.query(
      'SELECT * FROM document_modeles WHERE id = ?',
      [modeleId]
    );

    if (modeles.length === 0) {
      return res.status(404).json({ error: 'Modèle non trouvé' });
    }

    const modele = modeles[0];
    const lignes = JSON.parse(modele.lignes);

    // Créer le document
    const numero = await genererNumero(modele.type);
    const token = genererTokenPublic();

    const [result] = await pool.query(`
      INSERT INTO documents (
        type, numero, client_id, date_emission, date_validite,
        tva_applicable, conditions_paiement, modes_paiement,
        notes_client, token_public, statut
      ) VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
        ?, ?, ?, ?, ?, 'brouillon')
    `, [
      modele.type, numero, client_id,
      modele.tva_applicable, modele.conditions_paiement,
      modele.modes_paiement, modele.notes_client, token
    ]);

    const documentId = result.insertId;

    // Ajouter les lignes
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      await pool.query(`
        INSERT INTO document_lignes (
          document_id, ordre, type, designation, description,
          quantite, unite, prix_unitaire_ht, taux_tva
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        documentId, i, ligne.type, ligne.designation, ligne.description,
        ligne.quantite, ligne.unite, ligne.prix_unitaire_ht, ligne.taux_tva
      ]);
    }

    // Numéroter et calculer
    await numeroterLignes(documentId);
    await recalculerTotaux(pool, documentId);

    res.json({ id: documentId, numero });

  } catch (error) {
    console.error('Erreur création depuis modèle:', error);
    res.status(500).json({ error: 'Erreur création depuis modèle' });
  }
});
```

### 9.6 Autosauvegarde

```javascript
// Frontend: Autosave avec debounce

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';

function useAutosave(documentId) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) =>
      fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries(['document', documentId]);
    },
  });

  const debouncedSave = useDebouncedCallback(
    (data) => mutation.mutate(data),
    1000 // Sauvegarde après 1s d'inactivité
  );

  return {
    save: debouncedSave,
    isSaving: mutation.isPending,
    lastSaved: mutation.isSuccess ? new Date() : null,
  };
}
```

### 9.7 Statistiques et export

```javascript
// Stats dashboard
app.get('/api/documents/stats', requireAdmin, async (req, res) => {
  try {
    const { periode = 'mois' } = req.query;

    let dateDebut;
    const now = new Date();

    switch (periode) {
      case 'semaine':
        dateDebut = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'mois':
        dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'trimestre':
        dateDebut = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'annee':
        dateDebut = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [stats] = await pool.query(`
      SELECT
        -- Devis
        COUNT(CASE WHEN type = 'devis' THEN 1 END) as nb_devis,
        SUM(CASE WHEN type = 'devis' THEN net_a_payer ELSE 0 END) as montant_devis,
        COUNT(CASE WHEN type = 'devis' AND statut = 'accepte' THEN 1 END) as nb_devis_acceptes,

        -- Factures
        COUNT(CASE WHEN type = 'facture' THEN 1 END) as nb_factures,
        SUM(CASE WHEN type = 'facture' THEN net_a_payer ELSE 0 END) as montant_factures,
        SUM(CASE WHEN type = 'facture' AND statut = 'paye' THEN net_a_payer ELSE 0 END) as montant_paye,

        -- Impayés
        COUNT(CASE WHEN type = 'facture' AND statut NOT IN ('paye', 'annule')
                   AND date_echeance < CURDATE() THEN 1 END) as nb_impayes,
        SUM(CASE WHEN type = 'facture' AND statut NOT IN ('paye', 'annule')
                 AND date_echeance < CURDATE() THEN net_a_payer ELSE 0 END) as montant_impayes

      FROM documents
      WHERE date_emission >= ?
    `, [dateDebut]);

    // Taux de conversion devis
    const tauxConversion = stats[0].nb_devis > 0
      ? (stats[0].nb_devis_acceptes / stats[0].nb_devis * 100).toFixed(1)
      : 0;

    res.json({
      ...stats[0],
      taux_conversion: tauxConversion,
      periode,
    });

  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur stats' });
  }
});

// Export CSV
app.get('/api/documents/export', requireAdmin, async (req, res) => {
  try {
    const { type, statut, date_debut, date_fin } = req.query;

    let query = `
      SELECT
        d.numero, d.type, d.statut, d.date_emission, d.date_validite, d.date_echeance,
        d.total_ht, d.total_tva, d.total_ttc, d.net_a_payer,
        c.nom as client_nom, c.email as client_email
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND d.type = ?';
      params.push(type);
    }
    if (statut) {
      query += ' AND d.statut = ?';
      params.push(statut);
    }
    if (date_debut) {
      query += ' AND d.date_emission >= ?';
      params.push(date_debut);
    }
    if (date_fin) {
      query += ' AND d.date_emission <= ?';
      params.push(date_fin);
    }

    query += ' ORDER BY d.date_emission DESC';

    const [rows] = await pool.query(query, params);

    // Générer CSV
    const headers = [
      'Numéro', 'Type', 'Statut', 'Date émission', 'Date validité', 'Échéance',
      'Total HT', 'TVA', 'Total TTC', 'Net à payer', 'Client', 'Email client'
    ];

    const csv = [
      headers.join(';'),
      ...rows.map(r => [
        r.numero, r.type, r.statut, r.date_emission, r.date_validite, r.date_echeance,
        r.total_ht, r.total_tva, r.total_ttc, r.net_a_payer,
        r.client_nom, r.client_email
      ].join(';'))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="documents.csv"');
    res.send('\ufeff' + csv); // BOM pour Excel

  } catch (error) {
    console.error('Erreur export:', error);
    res.status(500).json({ error: 'Erreur export' });
  }
});
```

---

## 10. Sécurité

### 10.1 Validation des entrées

```javascript
// Middleware de validation
import { z } from 'zod';

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors
      });
    }
  };
}

// Utilisation
app.post('/api/documents', requireAdmin, validate(DocumentSchema), async (req, res) => {
  // ...
});
```

### 10.2 Contrôle d'accès

```javascript
// Vérifier que l'utilisateur peut modifier un document
async function canModifyDocument(documentId, statut) {
  // Seuls les brouillons sont modifiables
  const statutsModifiables = ['brouillon'];

  if (!statutsModifiables.includes(statut)) {
    return {
      allowed: false,
      reason: 'Document non modifiable (déjà envoyé ou traité)'
    };
  }

  return { allowed: true };
}

// Vérifier les transitions de statut
const transitionsAutorisees = {
  brouillon: ['envoye'],
  envoye: ['vu', 'annule'],
  vu: ['accepte', 'refuse', 'expire', 'annule'],
  accepte: [], // Vers facture via conversion
  refuse: [],
  expire: [],
  paye: [],
  paye_partiel: ['paye'],
  annule: [],
};

function canTransition(currentStatut, newStatut) {
  return transitionsAutorisees[currentStatut]?.includes(newStatut) ?? false;
}
```

### 10.3 Protection des tokens publics

```javascript
// Rate limiting sur les endpoints publics
import rateLimit from 'express-rate-limit';

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: { error: 'Trop de requêtes, réessayez plus tard' }
});

app.use('/api/public', publicLimiter);

// Expiration des tokens
const TOKEN_VALIDITY_DAYS = 90;

async function cleanExpiredTokens() {
  await pool.query(`
    UPDATE documents
    SET token_public = NULL, token_expire_at = NULL
    WHERE token_expire_at < NOW()
  `);
}
```

### 10.4 Audit trail

```javascript
// Toutes les actions sont loggées dans document_historique
async function logHistorique(documentId, evenement, details = {}, req = null) {
  await pool.query(`
    INSERT INTO document_historique
    (document_id, evenement, details, ip_address, user_agent, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    documentId,
    evenement,
    JSON.stringify(details),
    req?.ip || null,
    req?.get('user-agent') || null,
    req?.user?.email || 'system'
  ]);
}
```

---

## 11. Annexes

### 11.1 Dépendances à ajouter

```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.4.0",
    "qrcode": "^1.5.3",
    "node-cron": "^3.0.3",
    "use-debounce": "^10.0.0"
  }
}
```

### 11.2 Structure des fichiers

```
src/
├── components/
│   ├── documents/
│   │   ├── DocumentForm.jsx          # Formulaire création/édition
│   │   ├── DocumentLignes.jsx        # Tableau des lignes éditable
│   │   ├── DocumentPreview.jsx       # Prévisualisation
│   │   ├── ClientSelector.jsx        # Sélection/création client
│   │   └── ModeleSelector.jsx        # Sélection modèle
│   └── pdf/
│       └── DevisFacturePDF.jsx       # Template PDF
├── pages/
│   ├── Gestion.jsx                   # Page principale (existante)
│   │   └── Onglet "Devis & Factures"
│   └── DocumentPublic.jsx            # Page publique client
└── api/
    └── documents.js                  # Client API

server.js                             # Ajout des routes backend
```

### 11.3 Migration SQL

```sql
-- Script de migration à exécuter
-- migrations/001_documents.sql

-- Créer les tables dans l'ordre
SOURCE create_clients.sql;
SOURCE create_documents.sql;
SOURCE create_document_lignes.sql;
SOURCE create_paiements.sql;
SOURCE create_document_modeles.sql;
SOURCE create_parametres_documents.sql;
SOURCE create_document_historique.sql;

-- Index de performance
CREATE INDEX idx_documents_client_date ON documents(client_id, date_emission);
CREATE INDEX idx_documents_statut_type ON documents(statut, type);
CREATE INDEX idx_lignes_section ON document_lignes(section_id);
```

### 11.4 Variables d'environnement

```env
# Ajouter au .env existant
PUBLIC_BASE_URL=https://atelier-des-espaces.fr
```

---

## Résumé

Cette spécification définit un module complet de gestion des devis et factures avec :

- **Modèle de données** robuste avec historique et audit
- **Calculs précis** avec gestion TVA, remises, acomptes
- **Numérotation** automatique conforme aux normes françaises
- **API REST** complète avec validation Zod
- **Parcours utilisateur** optimisé (2-5 min)
- **PDF professionnel** fidèle au modèle de référence
- **Lien public** avec signature électronique
- **Fonctions avancées** : duplication, modèles, relances, conversion
- **Sécurité** : validation, contrôle d'accès, audit trail

Prêt pour l'implémentation dans le stack existant (React + Express + MySQL).
