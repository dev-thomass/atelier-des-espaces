import { describe, it, expect } from 'vitest';
import { calculerTotaux, validateDocumentLignes } from '../src/utils/calculs';

describe('calculerTotaux', () => {
  describe('calculs de base', () => {
    it('retourne des totaux à zéro pour un tableau vide', () => {
      const result = calculerTotaux([], { type: null, valeur: 0 }, false);
      expect(result).toEqual({
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        totalRemise: 0,
        netAPayer: 0,
      });
    });

    it('calcule correctement une ligne simple sans TVA', () => {
      const lignes = [
        { type: 'ligne', quantite: 2, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(200);
      expect(result.totalTVA).toBe(0);
      expect(result.totalTTC).toBe(200);
    });

    it('calcule correctement une ligne simple avec TVA', () => {
      const lignes = [
        { type: 'ligne', quantite: 2, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, true);
      expect(result.totalHT).toBe(200);
      expect(result.totalTVA).toBe(40);
      expect(result.totalTTC).toBe(240);
    });

    it('calcule correctement plusieurs lignes', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 },
        { type: 'ligne', quantite: 2, prix_unitaire_ht: 50, remise_valeur: 0, taux_tva: 20 },
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, true);
      expect(result.totalHT).toBe(200); // 100 + 100
      expect(result.totalTVA).toBe(40); // 200 * 20%
      expect(result.totalTTC).toBe(240);
    });
  });

  describe('remises par ligne', () => {
    it('applique une remise en pourcentage sur une ligne', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_type: 'pourcentage', remise_valeur: 10, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(90); // 100 - 10%
      expect(result.totalRemise).toBe(10);
    });

    it('applique une remise en montant sur une ligne', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_type: 'montant', remise_valeur: 15, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(85); // 100 - 15
      expect(result.totalRemise).toBe(15);
    });

    it('calcule la TVA après application de la remise ligne', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_type: 'pourcentage', remise_valeur: 10, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, true);
      expect(result.totalHT).toBe(90);
      expect(result.totalTVA).toBe(18); // 90 * 20%
      expect(result.totalTTC).toBe(108);
    });
  });

  describe('remise globale', () => {
    it('applique une remise globale en pourcentage', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: 'pourcentage', valeur: 10 }, false);
      expect(result.totalHT).toBe(90); // 100 - 10%
      expect(result.totalRemise).toBe(10);
    });

    it('applique une remise globale en montant', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: 'montant', valeur: 25 }, false);
      expect(result.totalHT).toBe(75); // 100 - 25
      expect(result.totalRemise).toBe(25);
    });

    it('cumule remise ligne et remise globale', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_type: 'pourcentage', remise_valeur: 10, taux_tva: 20 }
      ];
      // Ligne: 100 - 10% = 90
      // Global: 90 - 10% = 81
      const result = calculerTotaux(lignes, { type: 'pourcentage', valeur: 10 }, false);
      expect(result.totalHT).toBe(81);
      expect(result.totalRemise).toBe(19); // 10 (ligne) + 9 (global)
    });
  });

  describe('types de lignes non facturables', () => {
    it('ignore les lignes de type section', () => {
      const lignes = [
        { type: 'section', designation: 'Ma section' },
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 },
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(100);
    });

    it('ignore les lignes de type texte', () => {
      const lignes = [
        { type: 'texte', designation: 'Note importante' },
        { type: 'ligne', quantite: 2, prix_unitaire_ht: 50, remise_valeur: 0, taux_tva: 20 },
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(100);
    });

    it('ignore les sous-totaux', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 },
        { type: 'sous_total' },
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 50, remise_valeur: 0, taux_tva: 20 },
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(150);
    });
  });

  describe('cas limites', () => {
    it('gère les valeurs nulles ou undefined', () => {
      const lignes = [
        { type: 'ligne', quantite: null, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, false);
      expect(result.totalHT).toBe(0);
    });

    it('gère les taux TVA différents', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 20 },
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 10 },
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100, remise_valeur: 0, taux_tva: 5.5 },
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, true);
      expect(result.totalHT).toBe(300);
      expect(result.totalTVA).toBe(35.5); // 20 + 10 + 5.5
      expect(result.totalTTC).toBe(335.5);
    });

    it('arrondit correctement à 2 décimales', () => {
      const lignes = [
        { type: 'ligne', quantite: 3, prix_unitaire_ht: 33.33, remise_valeur: 0, taux_tva: 20 }
      ];
      const result = calculerTotaux(lignes, { type: null, valeur: 0 }, true);
      // 3 * 33.33 = 99.99
      expect(result.totalHT).toBe(99.99);
      expect(result.totalTVA).toBe(20); // 99.99 * 0.2 = 19.998 arrondi à 20
    });
  });
});

describe('validateDocumentLignes', () => {
  describe('validation de structure', () => {
    it('rejette si lignes n\'est pas un tableau', () => {
      expect(validateDocumentLignes(null)).toEqual({
        valid: false,
        error: 'Les lignes doivent être un tableau'
      });
      expect(validateDocumentLignes({})).toEqual({
        valid: false,
        error: 'Les lignes doivent être un tableau'
      });
      expect(validateDocumentLignes('string')).toEqual({
        valid: false,
        error: 'Les lignes doivent être un tableau'
      });
    });

    it('rejette un tableau vide (aucune ligne facturable)', () => {
      expect(validateDocumentLignes([])).toEqual({
        valid: false,
        error: 'Au moins une ligne facturable est requise'
      });
    });

    it('rejette si aucune ligne de type "ligne" (seulement sections)', () => {
      const lignes = [
        { type: 'section', designation: 'Section 1' },
        { type: 'texte', designation: 'Note' },
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Au moins une ligne facturable est requise'
      });
    });
  });

  describe('validation des types', () => {
    it('accepte tous les types valides', () => {
      const lignes = [
        { type: 'section', designation: 'Section' },
        { type: 'ligne', designation: 'Produit', quantite: 1, prix_unitaire_ht: 100 },
        { type: 'texte', designation: 'Note' },
        { type: 'entete', designation: 'Entête' },
        { type: 'sous_total' },
      ];
      expect(validateDocumentLignes(lignes)).toEqual({ valid: true });
    });

    it('rejette un type invalide', () => {
      const lignes = [
        { type: 'invalid_type', designation: 'Test' },
        { type: 'ligne', designation: 'Produit', quantite: 1, prix_unitaire_ht: 100 },
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: type invalide'
      });
    });

    it('rejette une ligne sans type', () => {
      const lignes = [
        { designation: 'Sans type' },
        { type: 'ligne', designation: 'Produit', quantite: 1, prix_unitaire_ht: 100 },
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: type invalide'
      });
    });
  });

  describe('validation des lignes facturables', () => {
    it('valide une ligne facturable correcte', () => {
      const lignes = [
        { type: 'ligne', designation: 'Produit A', quantite: 2, prix_unitaire_ht: 50 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({ valid: true });
    });

    it('rejette une ligne sans désignation', () => {
      const lignes = [
        { type: 'ligne', quantite: 1, prix_unitaire_ht: 100 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: désignation requise'
      });
    });

    it('rejette une ligne avec désignation vide', () => {
      const lignes = [
        { type: 'ligne', designation: '   ', quantite: 1, prix_unitaire_ht: 100 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: désignation requise'
      });
    });

    it('rejette une ligne avec quantité nulle', () => {
      const lignes = [
        { type: 'ligne', designation: 'Produit', quantite: 0, prix_unitaire_ht: 100 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: quantité doit être positive'
      });
    });

    it('rejette une ligne avec quantité négative', () => {
      const lignes = [
        { type: 'ligne', designation: 'Produit', quantite: -1, prix_unitaire_ht: 100 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: quantité doit être positive'
      });
    });

    it('rejette une ligne avec quantité non numérique', () => {
      const lignes = [
        { type: 'ligne', designation: 'Produit', quantite: '2', prix_unitaire_ht: 100 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: quantité doit être positive'
      });
    });

    it('rejette une ligne avec prix négatif', () => {
      const lignes = [
        { type: 'ligne', designation: 'Produit', quantite: 1, prix_unitaire_ht: -50 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 1: prix unitaire HT invalide'
      });
    });

    it('accepte un prix unitaire à zéro (prestation gratuite)', () => {
      const lignes = [
        { type: 'ligne', designation: 'Service offert', quantite: 1, prix_unitaire_ht: 0 }
      ];
      expect(validateDocumentLignes(lignes)).toEqual({ valid: true });
    });
  });

  describe('validation multi-lignes', () => {
    it('retourne l\'erreur de la première ligne invalide', () => {
      const lignes = [
        { type: 'ligne', designation: 'Valide', quantite: 1, prix_unitaire_ht: 100 },
        { type: 'ligne', designation: '', quantite: 1, prix_unitaire_ht: 100 },
        { type: 'ligne', designation: 'Autre', quantite: -1, prix_unitaire_ht: 100 },
      ];
      expect(validateDocumentLignes(lignes)).toEqual({
        valid: false,
        error: 'Ligne 2: désignation requise'
      });
    });

    it('valide un document complexe avec sections et lignes', () => {
      const lignes = [
        { type: 'section', designation: 'Travaux intérieurs' },
        { type: 'ligne', designation: 'Peinture', quantite: 50, prix_unitaire_ht: 25 },
        { type: 'ligne', designation: 'Main d\'oeuvre', quantite: 8, prix_unitaire_ht: 45 },
        { type: 'sous_total' },
        { type: 'section', designation: 'Travaux extérieurs' },
        { type: 'texte', designation: 'Selon devis annexe' },
        { type: 'ligne', designation: 'Ravalement façade', quantite: 1, prix_unitaire_ht: 3500 },
      ];
      expect(validateDocumentLignes(lignes)).toEqual({ valid: true });
    });
  });
});
