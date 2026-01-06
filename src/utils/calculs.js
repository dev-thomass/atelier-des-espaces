/**
 * Calcule les totaux d'un document (devis/facture)
 * @param {Array} lignes - Les lignes du document
 * @param {Object} remiseGlobale - La remise globale { type: 'pourcentage'|'montant', valeur: number }
 * @param {boolean} tvaApplicable - Si la TVA est applicable
 * @returns {Object} Les totaux calculés
 */
export function calculerTotaux(lignes, remiseGlobale = { type: null, valeur: 0 }, tvaApplicable = false) {
  let totalHT = 0;
  let totalTVA = 0;
  let totalRemiseLignes = 0;

  lignes.forEach((ligne) => {
    if (ligne.type === "ligne") {
      const baseHT = (ligne.quantite || 0) * (ligne.prix_unitaire_ht || 0);
      let remiseLigne = 0;
      if (ligne.remise_valeur > 0) {
        remiseLigne = ligne.remise_type === "pourcentage" ? baseHT * ligne.remise_valeur / 100 : ligne.remise_valeur;
      }
      const ligneHT = baseHT - remiseLigne;
      const ligneTVA = tvaApplicable ? ligneHT * (ligne.taux_tva || 0) / 100 : 0;
      totalHT += ligneHT;
      totalTVA += ligneTVA;
      totalRemiseLignes += remiseLigne;
    }
  });

  let remiseGlobaleAmount = 0;
  if (remiseGlobale.valeur > 0) {
    remiseGlobaleAmount = remiseGlobale.type === "pourcentage" ? totalHT * remiseGlobale.valeur / 100 : remiseGlobale.valeur;
  }

  const totalHTApresRemise = totalHT - remiseGlobaleAmount;
  const totalTTC = totalHTApresRemise + totalTVA;

  return {
    totalHT: Math.round(totalHTApresRemise * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
    totalRemise: Math.round((totalRemiseLignes + remiseGlobaleAmount) * 100) / 100,
    netAPayer: Math.round(totalTTC * 100) / 100,
  };
}

/**
 * Valide les lignes d'un document
 * @param {Array} lignes - Les lignes à valider
 * @returns {Object} Résultat de la validation { valid: boolean, error?: string }
 */
export function validateDocumentLignes(lignes) {
  if (!Array.isArray(lignes)) {
    return { valid: false, error: "Les lignes doivent être un tableau" };
  }

  const lignesFacturables = lignes.filter(l => l.type === "ligne");
  if (lignesFacturables.length === 0) {
    return { valid: false, error: "Au moins une ligne facturable est requise" };
  }

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    if (!ligne.type || !["ligne", "section", "texte", "entete", "sous_total"].includes(ligne.type)) {
      return { valid: false, error: `Ligne ${i + 1}: type invalide` };
    }

    if (ligne.type === "ligne") {
      if (!ligne.designation || typeof ligne.designation !== "string" || ligne.designation.trim() === "") {
        return { valid: false, error: `Ligne ${i + 1}: désignation requise` };
      }

      if (typeof ligne.quantite !== "number" || ligne.quantite <= 0) {
        return { valid: false, error: `Ligne ${i + 1}: quantité doit être positive` };
      }

      if (typeof ligne.prix_unitaire_ht !== "number" || ligne.prix_unitaire_ht < 0) {
        return { valid: false, error: `Ligne ${i + 1}: prix unitaire HT invalide` };
      }
    }
  }

  return { valid: true };
}
