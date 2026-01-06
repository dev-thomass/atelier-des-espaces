import express from "express";
import "dotenv/config";
import mysql from "mysql2/promise";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import multer from "multer";
import nodemailer from "nodemailer";
import PdfPrinter from "pdfmake";
import * as XLSX from "xlsx";
import { google } from "googleapis";
import bcrypt from "bcrypt";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

if (!GROQ_API_KEY) {
  console.warn("GROQ_API_KEY missing. Add it in .env");
}

const ADMIN_CODE = (process.env.ADMIN_CODE || "").trim();
const ADMIN_SECRET = (process.env.ADMIN_SECRET || process.env.ADMIN_CODE || "").trim();
const TOKEN_TTL_SECONDS = Number(process.env.ADMIN_TOKEN_TTL_SECONDS || 60 * 60 * 12);

if (!ADMIN_CODE) {
  console.warn("ADMIN_CODE missing. Admin login will fail.");
}
if (!process.env.ADMIN_SECRET && ADMIN_CODE) {
  console.warn("ADMIN_SECRET missing. Falling back to ADMIN_CODE for token signing.");
}

const historyStore = new Map();

let mysqlPool = null;
const getMySQLPool = () => {
  if (mysqlPool) return mysqlPool;
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    console.warn("MySQL not configured (missing .env variables)");
    return null;
  }
  mysqlPool = mysql.createPool({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    port: MYSQL_PORT ? Number(MYSQL_PORT) : 3306,
    connectionLimit: 5,
  });
  return mysqlPool;
};

const parseJsonField = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const ensureJsonString = (value, fallback) => {
  if (value === null || value === undefined) return JSON.stringify(fallback);
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(value);
};

const formatDateFr = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("fr-FR");
};

const formatMoney = (value) => {
  const formatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(Number(value) || 0);
  return formatted.replace(/[\u202F\u00A0]/g, " ");
};

const calculerLigneTotal = (ligne) => {
  if (!ligne || ligne.type !== "ligne") return 0;
  const base = (ligne.quantite || 0) * (ligne.prix_unitaire_ht || 0);
  let remise = 0;
  if (ligne.remise_valeur > 0) {
    remise = ligne.remise_type === "pourcentage" ? base * ligne.remise_valeur / 100 : ligne.remise_valeur;
  }
  return Math.round((base - remise) * 100) / 100;
};

const calculerSousTotalAvantIndex = (lignes, index) => {
  const target = lignes[index];
  if (!target) return 0;
  const sectionId = target.section_id || null;
  return lignes.slice(0, index).reduce((sum, ligne) => {
    if (ligne.type !== "ligne") return sum;
    if (sectionId) {
      return ligne.section_id === sectionId ? sum + calculerLigneTotal(ligne) : sum;
    }
    return !ligne.section_id ? sum + calculerLigneTotal(ligne) : sum;
  }, 0);
};

const numeroterLignesPdf = (lignes) => {
  let sectionIndex = 0;
  let ligneIndex = 0;
  let currentSectionId = null;

  return lignes.map((ligne) => {
    if (ligne.type === "section") {
      sectionIndex += 1;
      ligneIndex = 0;
      currentSectionId = ligne.id || `section_${sectionIndex}`;
      return { ...ligne, numero_affiche: `${sectionIndex}`, section_id: null };
    }

    const isLigne = ligne.type === "ligne";

    if (currentSectionId) {
      if (isLigne) {
        ligneIndex += 1;
        return { ...ligne, numero_affiche: `${sectionIndex}.${ligneIndex}`, section_id: currentSectionId };
      }
      return { ...ligne, numero_affiche: "", section_id: currentSectionId };
    }

    if (isLigne) {
      ligneIndex += 1;
      return { ...ligne, numero_affiche: `${ligneIndex}`, section_id: null };
    }

    return { ...ligne, numero_affiche: "", section_id: null };
  });
};

// PDF Printer configuration with fonts
const pdfFonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
  Times: {
    normal: "Times-Roman",
    bold: "Times-Bold",
    italics: "Times-Italic",
    bolditalics: "Times-BoldItalic",
  },
  Courier: {
    normal: "Courier",
    bold: "Courier-Bold",
    italics: "Courier-Oblique",
    bolditalics: "Courier-BoldOblique",
  },
};
const pdfPrinter = new PdfPrinter(pdfFonts);

// Default colors
const DEFAULT_PDF_BLUE = "#1a5490";
const DEFAULT_PDF_GRAY = "#5a6a7a";
const DEFAULT_PDF_TEXT = "#1e2a3a";

const BASE_PDF_APPEARANCE = {
  primaryColor: DEFAULT_PDF_BLUE,
  secondaryColor: "#d7e3ee",
  font: "Helvetica",
  baseFontSize: 9,
  lineHeight: 1.3,
  headerStyle: "ultra",
  clientPosition: "right",
  tableStyle: "minimal",
  borderWidth: 0.5,
  borderRadius: 8,
  cellPadding: 5,
  pageMargin: 42,
  sectionSpacing: 16,
  hide: {},
  columns: {
    showNumero: true,
    showQuantite: true,
    showUnite: true,
    showPrixUnitaire: true,
    showTva: false,
  },
  showSignatureBox: true,
  showPaymentMethods: true,
  showConditions: true,
  showFooter: true,
  showPageNumbers: true,
  showDraftWatermark: true,
  showDocumentBorder: true,
  compactMode: false,
  showSectionSubtotals: false,
  roundedRowBorders: true,
  layoutPreset: "premium-split",
};

const PDF_APPEARANCE_BY_TYPE = {
  devis: {
    primaryColor: "#1a5490",
    secondaryColor: "#d7e3ee",
    borderRadius: 8,
  },
  facture: {
    primaryColor: "#0e3a5c",
    secondaryColor: "#c7d7e6",
    borderRadius: 10,
    showSectionSubtotals: true,
  },
  avoir: {
    primaryColor: "#7d3b20",
    secondaryColor: "#efdcd1",
    borderRadius: 8,
  },
};

const getPdfAppearanceDefaults = (docType) => {
  const typeOverrides = PDF_APPEARANCE_BY_TYPE[docType] || {};
  const base = { ...BASE_PDF_APPEARANCE, ...typeOverrides };
  base.columns = { ...(BASE_PDF_APPEARANCE.columns || {}), ...(typeOverrides.columns || {}) };
  base.hide = { ...(BASE_PDF_APPEARANCE.hide || {}), ...(typeOverrides.hide || {}) };
  return base;
};

// Helper to lighten a color
const lightenColor = (hex, percent) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent));
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildDocumentPdfDefinition = (doc) => {
  const docType = doc.type || "devis";
  const baseAppearance = getPdfAppearanceDefaults(docType);
  const rawAppearance = doc.appearance || {};
  const appearance = { ...baseAppearance, ...rawAppearance };
  appearance.columns = { ...(baseAppearance.columns || {}), ...(rawAppearance.columns || {}) };
  appearance.hide = { ...(baseAppearance.hide || {}), ...(rawAppearance.hide || {}) };

  const PDF_BLUE = appearance.primaryColor || DEFAULT_PDF_BLUE;
  const PDF_BLUE_LIGHT = lightenColor(PDF_BLUE, 0.92);
  const PDF_BLUE_SOFT = lightenColor(PDF_BLUE, 0.96);
  const PDF_ACCENT = lightenColor(PDF_BLUE, docType === "facture" ? 0.82 : 0.88);
  const PDF_CARD_LAYER = lightenColor(PDF_BLUE, docType === "facture" ? 0.94 : 0.97);
  const PDF_BORDER = appearance.secondaryColor || lightenColor(PDF_BLUE, 0.65);
  const PDF_GRAY = DEFAULT_PDF_GRAY;
  const PDF_TEXT = DEFAULT_PDF_TEXT;
  const PDF_MUTED = lightenColor(PDF_TEXT, 0.45);

  const resolveColumn = (primaryKey, legacyKey, defaultValue = true) => {
    if (appearance.columns && appearance.columns[primaryKey] !== undefined) {
      return appearance.columns[primaryKey] !== false;
    }
    if (appearance.columns && appearance.columns[legacyKey] !== undefined) {
      return appearance.columns[legacyKey] !== false;
    }
    return defaultValue;
  };

  // Typography options
  const pdfFont = appearance.font || "Helvetica";
  const baseFontSize = toNumber(appearance.baseFontSize ?? appearance.fontSize, 9);
  const lineHeight = toNumber(appearance.lineHeight, 1.2);
  const compactMode = appearance.compactMode || false;

  // Table options
  const tableStyle = appearance.tableStyle || "striped";
  const borderWidth = toNumber(appearance.borderWidth, 0.5);
  const borderRadius = toNumber(appearance.borderRadius, 0);
  const cellPadding = toNumber(appearance.cellPadding, 4);
  const showNumero = resolveColumn("showNumero", "numero", true);
  const showQuantite = resolveColumn("showQuantite", "quantite", true);
  const showUnite = resolveColumn("showUnite", "unite", true);
  const showPrixUnitaire = resolveColumn("showPrixUnitaire", "prixUnitaire", true);
  const showTva = appearance.columns && appearance.columns.showTva === true;

  // Layout options
  const headerStyle = appearance.headerStyle || "classic";
  const clientPosition = appearance.clientPosition || "right";
  const hideOptions = appearance.hide || {};
  const showSectionSubtotals = appearance.showSectionSubtotals !== false;

  // Logo options
  const logo = appearance.logo || null;
  const logoSize = appearance.logoSize || 50;
  const logoPosition = appearance.logoPosition || "left";

  // Footer options
  const showSignatureBox = appearance.showSignatureBox !== false;
  const showPaymentMethods = appearance.showPaymentMethods !== false;
  const showConditions = appearance.showConditions ?? appearance.showPaymentConditions ?? true;
  const showFooter = appearance.showFooter !== false;
  const showPageNumbers = appearance.showPageNumbers !== false;
  const layoutPreset = appearance.layoutPreset || "premium-split";

  // Page options
  const pageMargin = toNumber(appearance.pageMargin ?? appearance.pageMargins, 40);
  const sectionSpacing = toNumber(appearance.sectionSpacing, 15);
  const showDraftWatermark = appearance.showDraftWatermark ?? appearance.draftWatermark ?? false;
  const showDocumentBorder = appearance.showDocumentBorder ?? appearance.documentBorder ?? false;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - (pageMargin * 2);

  const typeLabel = docType === "devis" ? "Devis" : docType === "facture" ? "Facture" : "Avoir";
  const isFacture = docType === "facture";
  const cardRadius = borderRadius > 0 ? borderRadius : 8;
  const docNumero = doc.numero || "";
  const clientName = [doc.client_nom, doc.client_prenom].filter(Boolean).join(" ") || "Client";
  const clientAddress = [
    doc.client_adresse_ligne1,
    doc.client_adresse_ligne2,
    [doc.client_code_postal, doc.client_ville].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n");

  const lignes = Array.isArray(doc.lignes) ? doc.lignes : [];
  const numberedLignes = numeroterLignesPdf(lignes);

  const totalHt = Number(doc.total_ht) || 0;
  const totalTva = Number(doc.total_tva) || 0;
  const totalTtc = Number(doc.total_ttc) || totalHt + totalTva;
  const totalRemise = Number(doc.total_remise) || 0;
  const retenue = Number(doc.retenue_garantie_montant) || 0;
  const netAPayer = Number(doc.net_a_payer) || totalTtc - retenue;

  const mentionTva = doc.tva_applicable ? "" : (doc.mention_tva || "TVA non applicable, art. 293 B du CGI");
  const conditionsPaiement = doc.conditions_paiement || "";
  const notesClient = (doc.notes_client || "").trim();
  const dateEmission = formatDateFr(doc.date_emission) || "-";
  const dateValidite = doc.date_validite ? formatDateFr(doc.date_validite) : "";
  const dateEcheance = doc.date_echeance ? formatDateFr(doc.date_echeance) : "";
  const modesPaiement = Array.isArray(doc.modes_paiement) ? doc.modes_paiement : [];
  const modesLabels = { virement: "Virement", cheque: "Chèque", especes: "Espèces", cb: "CB" };
  const modesPaiementText = modesPaiement.map((m) => modesLabels[m] || m).filter(Boolean).join(", ") || "Virement";

  // Build dynamic table columns based on visibility settings
  const tableHeaders = [];
  const tableWidths = [];

  if (showNumero) {
    tableHeaders.push({ text: "N°", style: "tHead", alignment: "center" });
    tableWidths.push(24);
  }
  tableHeaders.push({ text: "Désignation", style: "tHead" });
  tableWidths.push("*");

  if (showQuantite) {
    tableHeaders.push({ text: "Qté", style: "tHead", alignment: "center" });
    tableWidths.push(40);
  }
  if (showPrixUnitaire) {
    tableHeaders.push({ text: "P.U. HT", style: "tHead", alignment: "right" });
    tableWidths.push(50);
  }
  if (showTva) {
    tableHeaders.push({ text: "TVA", style: "tHead", alignment: "center" });
    tableWidths.push(35);
  }
  tableHeaders.push({ text: "Total HT", style: "tHead", alignment: "right" });
  tableWidths.push(55);

  const numCols = tableHeaders.length;

  // Build table body
  const tableBody = [tableHeaders];
  const rowKinds = ["header"];
  const rowHeights = [null];

  const sectionTotals = [];
  let currentSection = null;
  let sectionSum = 0;

  // Helper to build a row with dynamic columns
  const buildRow = (cells) => {
    const row = [];
    if (showNumero) row.push(cells.num || { text: "" });
    row.push(cells.designation || { text: "" });
    if (showQuantite) row.push(cells.qte || { text: "" });
    if (showPrixUnitaire) row.push(cells.pu || { text: "" });
    if (showTva) row.push(cells.tva || { text: "" });
    row.push(cells.total || { text: "" });
    return row;
  };

  // Helper for colspan rows
  const buildColSpanRow = (firstCell, content) => {
    const row = [];
    if (showNumero) row.push(firstCell);
    row.push({ ...content, colSpan: numCols - (showNumero ? 1 : 0) });
    for (let i = 1; i < numCols - (showNumero ? 1 : 0); i++) row.push({});
    return row;
  };

  const fontSize = compactMode ? baseFontSize - 1 : baseFontSize;

  const estimateLineRowHeight = (ligne) => {
    const baseHeight = compactMode ? 22 : 26;
    const lineHeight = fontSize + 3;
    const designation = (ligne.designation || "").trim();
    const description = (ligne.description || "").trim();
    const designationLines = Math.max(1, Math.ceil(designation.length / 45));
    const descriptionLines = description ? Math.max(1, Math.ceil(description.length / 60)) : 0;
    const lineCount = designationLines + descriptionLines;
    return Math.max(baseHeight, (lineCount * lineHeight) + (compactMode ? 8 : 10));
  };

  numberedLignes.forEach((ligne, idx) => {
    const num = ligne.numero_affiche || "";

    if (ligne.type === "section") {
      if (currentSection && sectionSum > 0) {
        sectionTotals.push({ name: currentSection, total: sectionSum, afterRow: tableBody.length - 1 });
      }
      currentSection = ligne.designation || "Section";
      sectionSum = 0;
      const sectionRow = buildColSpanRow(
        { text: num, style: "sectionCell", alignment: "center" },
        { text: currentSection, style: "sectionCell" }
      );
      tableBody.push(sectionRow);
      rowKinds.push("section");
      rowHeights.push(null);
      return;
    }

    if (ligne.type === "entete") {
      const row = buildColSpanRow(
        { text: "" },
        { text: (ligne.designation || "").toUpperCase(), fontSize: fontSize - 2, bold: true, color: PDF_GRAY }
      );
      tableBody.push(row);
      rowKinds.push("entete");
      rowHeights.push(null);
      return;
    }

    if (ligne.type === "texte") {
      const row = buildColSpanRow(
        { text: "" },
        { text: ligne.designation || "", italics: true, color: PDF_GRAY, fontSize: fontSize - 1 }
      );
      tableBody.push(row);
      rowKinds.push("texte");
      rowHeights.push(null);
      return;
    }

    if (ligne.type === "sous_total") {
      const st = calculerSousTotalAvantIndex(numberedLignes, idx);
      tableBody.push(buildRow({
        num: { text: "", border: [false, false, false, false] },
        designation: { text: "", border: [false, false, false, false] },
        qte: { text: "", border: [false, false, false, false] },
        pu: { text: ligne.designation || "Sous-total", alignment: "right", fontSize: fontSize - 1, bold: true, border: [false, false, false, false] },
        tva: { text: "", border: [false, false, false, false] },
        total: { text: formatMoney(st), alignment: "right", fontSize: fontSize - 1, bold: true, fillColor: PDF_BLUE_LIGHT, border: [false, false, false, false] },
      }));
      rowKinds.push("sous_total");
      rowHeights.push(null);
      return;
    }

    // Regular line
    const qte = ligne.quantite || 0;
    const unite = ligne.unite || "";
    const pu = ligne.prix_unitaire_ht || 0;
    const tva = ligne.taux_tva || 0;
    const tot = calculerLigneTotal(ligne);
    sectionSum += tot;

    const qteText = showUnite && unite ? `${qte} ${unite}` : String(qte);
    const designation = ligne.description
      ? { stack: [{ text: ligne.designation || "" }, { text: ligne.description, fontSize: fontSize - 2, color: PDF_GRAY, margin: [0, 1, 0, 0] }] }
      : { text: ligne.designation || "" };

    tableBody.push(buildRow({
      num: { text: num, alignment: "center", color: PDF_GRAY, fontSize: fontSize - 1 },
      designation,
      qte: { text: qteText, alignment: "center", fontSize: fontSize - 1 },
      pu: { text: formatMoney(pu), alignment: "right", fontSize: fontSize - 1 },
      tva: { text: `${tva}%`, alignment: "center", fontSize: fontSize - 1, color: PDF_GRAY },
      total: { text: formatMoney(tot), alignment: "right", fontSize: fontSize - 1 },
    }));
    rowKinds.push("line");
    rowHeights.push(estimateLineRowHeight(ligne));
  });

  // Last section total
  if (currentSection && sectionSum > 0) {
    sectionTotals.push({ name: currentSection, total: sectionSum, afterRow: tableBody.length - 1 });
  }

  // Insert section totals if enabled
  if (showSectionSubtotals) {
    sectionTotals.reverse().forEach((st) => {
      const stRow = buildRow({
        num: { text: "", border: [false, false, false, false] },
        designation: { text: "", border: [false, false, false, false] },
        qte: { text: "", border: [false, false, false, false] },
        pu: { text: `${st.name} :`, alignment: "right", fontSize: fontSize - 1, bold: true, border: [false, false, false, false] },
        tva: { text: "", border: [false, false, false, false] },
        total: { text: formatMoney(st.total), alignment: "right", fontSize: fontSize - 1, bold: true, fillColor: PDF_BLUE_LIGHT, border: [false, false, false, false] },
      });
      tableBody.splice(st.afterRow + 1, 0, stRow);
      rowKinds.splice(st.afterRow + 1, 0, "section_total");
      rowHeights.splice(st.afterRow + 1, 0, null);
    });
  }

  // Build company info with logo support
  const buildCompanyInfo = () => {
    const textInfo = [];
    if (!hideOptions.companyName && logoPosition !== "replace") {
      textInfo.push({ text: "Thomas Bonnardel", fontSize: compactMode ? 12 : 14, bold: true, color: PDF_BLUE });
    }
    if (!hideOptions.companyActivity) textInfo.push({ text: "Design - Rénovation", fontSize: fontSize - 1, color: PDF_GRAY });
    if (!hideOptions.companyAddress) textInfo.push({ text: "944 Chemin de Tardinaou, 13190 Allauch", fontSize: fontSize - 1, color: PDF_GRAY });
    const contactParts = [];
    if (!hideOptions.companyPhone) contactParts.push("06 95 07 10 84");
    if (!hideOptions.companyEmail) contactParts.push("thomasromeo.bonnardel@gmail.com");
    if (contactParts.length) textInfo.push({ text: contactParts.join(" • "), fontSize: fontSize - 1, color: PDF_TEXT, margin: [0, 3, 0, 0] });
    if (!hideOptions.companySiren) textInfo.push({ text: "SIREN 992 454 694", fontSize: fontSize - 2, color: PDF_GRAY });

    if (!logo) return textInfo;

    const logoImg = { image: logo, width: logoSize, height: logoSize * 0.6 };

    if (logoPosition === "above") {
      return [logoImg, { text: "", margin: [0, 4, 0, 0] }, ...textInfo];
    }
    if (logoPosition === "replace") {
      return [{ ...logoImg, width: logoSize * 1.5, height: logoSize }];
    }
    // left position - logo next to text
    return [{
      columns: [
        { ...logoImg, width: logoSize, margin: [0, 0, 10, 0] },
        { stack: textInfo, width: "*" },
      ],
    }];
  };

  const companyInfo = buildCompanyInfo();

  // Table layout with dynamic settings
  const getTableLayout = () => {
    const pad = compactMode ? Math.max(2, cellPadding - 1) : cellPadding;
    const base = {
      paddingLeft: () => pad,
      paddingRight: () => pad,
      paddingTop: () => Math.max(2, pad - 1),
      paddingBottom: () => Math.max(2, pad - 1),
    };
    switch (tableStyle) {
      case "bordered":
        // Full borders on all cells
        return {
          ...base,
          hLineWidth: () => borderWidth,
          vLineWidth: () => borderWidth,
          hLineColor: () => PDF_BORDER,
          vLineColor: () => PDF_BORDER,
        };
      case "horizontal":
        // Only horizontal lines between rows
        return {
          ...base,
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? borderWidth : borderWidth * 0.5,
          vLineWidth: () => 0,
          hLineColor: () => PDF_BORDER,
        };
      case "minimal":
        // Only header bottom line and table bottom line
        return {
          ...base,
          hLineWidth: (i, node) => (i === 1 || i === node.table.body.length) ? borderWidth : 0,
          vLineWidth: () => 0,
          hLineColor: () => PDF_BORDER,
        };
      default: // striped
        // Alternating row colors, header and footer lines only
        return {
          ...base,
          hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length) ? borderWidth : 0,
          vLineWidth: () => 0,
          hLineColor: () => PDF_BORDER,
          fillColor: (i) => (i > 0 && i % 2 === 0)
            ? (headerStyle === "ultra" ? PDF_BLUE_SOFT : "#f8f9fa")
            : null,
        };
    }
  };

  // Build totals rows
  const totalsRows = [];
  const totFontSize = fontSize - 1;
  totalsRows.push([{ text: "Total HT", fontSize: totFontSize }, { text: formatMoney(totalHt), fontSize: totFontSize, bold: true, alignment: "right" }]);
  if (totalRemise > 0) totalsRows.push([{ text: "Remise", fontSize: totFontSize }, { text: `- ${formatMoney(totalRemise)}`, fontSize: totFontSize, alignment: "right" }]);
  if (doc.tva_applicable && totalTva > 0) totalsRows.push([{ text: "TVA", fontSize: totFontSize }, { text: formatMoney(totalTva), fontSize: totFontSize, alignment: "right" }]);
  if (totalTtc !== totalHt) totalsRows.push([{ text: "Total TTC", fontSize: totFontSize }, { text: formatMoney(totalTtc), fontSize: totFontSize, bold: true, alignment: "right" }]);
  if (retenue > 0) totalsRows.push([{ text: "Retenue garantie", fontSize: totFontSize }, { text: `- ${formatMoney(retenue)}`, fontSize: totFontSize, alignment: "right" }]);
  totalsRows.push([
    { text: "", margin: [0, 4, 0, 0] },
    { text: "", margin: [0, 4, 0, 0] },
  ]);
  const netRowFill = isFacture ? PDF_BLUE : null;
  const netRowColor = isFacture ? "white" : PDF_BLUE;
  const netRowMargin = isFacture ? [4, 2, 4, 2] : undefined;
  totalsRows.push([
    { text: "Net a payer", fontSize: fontSize, bold: true, color: netRowColor, fillColor: netRowFill, margin: netRowMargin },
    { text: formatMoney(netAPayer), fontSize: fontSize + 1, bold: true, color: netRowColor, alignment: "right", fillColor: netRowFill, margin: netRowMargin },
  ]);

  // Build header based on style
  const buildHeader = () => {
    const docAlign = clientPosition === "left" ? "left" : "right";

    const docInfo = {
      width: "50%",
      stack: [
        { text: typeLabel.toUpperCase(), fontSize: compactMode ? 16 : 20, bold: true, color: PDF_BLUE, alignment: docAlign },
        docNumero ? { text: `N° ${docNumero}`, fontSize: fontSize, alignment: docAlign, margin: [0, 2, 0, 0] } : {},
        { text: `Date : ${dateEmission}`, fontSize: fontSize - 1, color: PDF_GRAY, alignment: docAlign, margin: [0, 8, 0, 0] },
        dateValidite ? { text: `Valide jusqu'au : ${dateValidite}`, fontSize: fontSize - 1, color: PDF_GRAY, alignment: docAlign } : {},
        dateEcheance ? { text: `Échéance : ${dateEcheance}`, fontSize: fontSize - 1, color: PDF_GRAY, alignment: docAlign } : {},
      ],
    };

    // Ultra modern style - clean header with a rounded info card
    if (headerStyle === "ultra") {
      const cardWidth = compactMode ? 200 : 220;
      const cardPadding = compactMode ? 8 : 10;
      const metaLines = [
        { text: typeLabel.toUpperCase(), fontSize: compactMode ? 10 : 11, color: "white", bold: true },
        docNumero ? { text: `N° ${docNumero}`, fontSize: fontSize + 1, bold: true, color: "white", margin: [0, 3, 0, 0] } : null,
        { text: `Date : ${dateEmission}`, fontSize: fontSize - 1, color: "white", margin: [0, 4, 0, 0] },
        dateValidite ? { text: `Valide jusqu'au : ${dateValidite}`, fontSize: fontSize - 2, color: "white" } : null,
        dateEcheance ? { text: `Echeance : ${dateEcheance}`, fontSize: fontSize - 2, color: "white" } : null,
      ].filter(Boolean);

      const cardHeight = Math.max(compactMode ? 64 : 78, (metaLines.length * (fontSize + 3)) + (cardPadding * 2));
      const docCard = {
        width: cardWidth,
        stack: [
          {
            canvas: [{
              type: "rect",
              x: 0,
              y: 0,
              w: cardWidth,
              h: cardHeight,
              r: Math.max(0, borderRadius),
              color: PDF_BLUE,
            }],
          },
          {
            stack: metaLines,
            margin: [cardPadding, -cardHeight + cardPadding, cardPadding, cardPadding],
          },
        ],
      };

      return {
        stack: [
          {
            columns: [
              { width: "*", stack: companyInfo },
              docCard,
            ],
            columnGap: 16,
          },
          {
            canvas: [{
              type: "line",
              x1: 0,
              y1: 0,
              x2: contentWidth,
              y2: 0,
              lineWidth: 1.5,
              lineColor: PDF_BORDER,
            }],
            margin: [0, sectionSpacing - 6, 0, sectionSpacing],
          },
        ],
      };
    }

    // Modern style - colored banner with document type
    if (headerStyle === "modern") {
      const banner = {
        table: {
          widths: ["*"],
          body: [[{
            text: typeLabel.toUpperCase(),
            fontSize: compactMode ? 14 : 18,
            bold: true,
            color: "white",
            alignment: "center",
            margin: [0, 8, 0, 8],
          }]],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => PDF_BLUE,
        },
        margin: [0, 0, 0, sectionSpacing],
      };

      const modernDocInfo = {
        columns: [
          docNumero ? { text: `N° ${docNumero}`, fontSize: fontSize, bold: true } : {},
          { text: `Date : ${dateEmission}`, fontSize: fontSize - 1, color: PDF_MUTED, alignment: "right" },
        ],
        margin: [0, 0, 0, 4],
      };

      const headerContent = clientPosition === "left"
        ? { columns: [docInfo, { width: "50%", stack: companyInfo }] }
        : { columns: [{ width: "50%", stack: companyInfo }, { width: "50%", stack: [modernDocInfo] }] };

      return { stack: [banner, headerContent] };
    }

    // Minimal style - just text, no decorations
    if (headerStyle === "minimal") {
      const minimalInfo = [
        { text: `${typeLabel} ${docNumero}`, fontSize: fontSize + 2, bold: true, color: PDF_TEXT },
        { text: `${dateEmission}`, fontSize: fontSize - 1, color: PDF_GRAY, margin: [0, 2, 0, 0] },
      ];

      if (clientPosition === "left") {
        return { columns: [{ stack: minimalInfo, width: "50%" }, { width: "50%", stack: companyInfo }] };
      }
      return { columns: [{ width: "50%", stack: companyInfo }, { stack: minimalInfo, width: "50%", alignment: "right" }] };
    }

    // Classic style (default)
    if (clientPosition === "left") {
      return { columns: [docInfo, { width: "50%", stack: companyInfo }] };
    }
    return { columns: [{ width: "50%", stack: companyInfo }, docInfo] };
  };

  // Build client box with optional rounded corners
  const buildClientBox = () => {
    const boxWidth = compactMode ? 190 : 210;
    const innerMargin = compactMode ? 6 : 8;
    const innerPadding = compactMode ? 4 : 6;
    const clientContact = [doc.client_email, doc.client_telephone].filter(Boolean).join(" • ");
    const addressLines = clientAddress ? clientAddress.split("\n").length : 0;
    const contentLineCount = 2 + addressLines + (clientContact ? 1 : 0);
    const boxHeight = Math.max(compactMode ? 70 : 84, (contentLineCount * (fontSize + 2)) + (innerPadding * 2) + 6);

    // Content stack
    const contentStack = [
      { text: "DESTINATAIRE", fontSize: fontSize - 2, color: PDF_BLUE, bold: true, margin: [0, 0, 0, 4] },
      { text: clientName, fontSize: fontSize + 1, bold: true },
      clientAddress ? { text: clientAddress, fontSize: fontSize - 1, color: PDF_MUTED, margin: [0, 2, 0, 0] } : {},
      clientContact ? { text: clientContact, fontSize: fontSize - 2, color: PDF_MUTED, margin: [0, 2, 0, 0] } : {},
    ];

    let clientBox;
    if (borderRadius > 0) {
      // Use canvas for rounded corners
      clientBox = {
        width: boxWidth,
        stack: [
          {
            canvas: [{
              type: "rect",
              x: 0,
              y: 0,
              w: boxWidth,
              h: boxHeight,
              r: borderRadius,
              lineWidth: borderWidth,
              lineColor: PDF_BORDER,
              color: PDF_BLUE_SOFT,
            }],
          },
          {
            stack: contentStack,
            margin: [innerMargin, -boxHeight + innerPadding + 6, innerMargin, innerPadding],
          },
        ],
      };
    } else {
      // Standard table layout
      clientBox = {
        width: boxWidth,
        table: {
          widths: ["*"],
          body: [[{
            stack: contentStack,
            margin: [innerMargin, innerPadding, innerMargin, innerPadding],
          }]],
        },
        layout: { hLineWidth: () => borderWidth, vLineWidth: () => borderWidth, hLineColor: () => PDF_BORDER, vLineColor: () => PDF_BORDER },
      };
    }

    if (clientPosition === "left") {
      return { margin: [0, sectionSpacing, 0, sectionSpacing], columns: [clientBox, { width: "*", text: "" }] };
    }
    return { margin: [0, sectionSpacing, 0, sectionSpacing], columns: [{ width: "*", text: "" }, clientBox] };
  };

  // Build signature box (for devis) with optional rounded corners
  const buildCardTitle = (text, { fillColor = PDF_ACCENT, textColor = PDF_BLUE, titleFont = fontSize - 1 } = {}) => {
    const padX = 8;
    const padY = 3;
    const height = Math.max(16, Math.round(titleFont + (padY * 2)));
    const width = Math.min(contentWidth, Math.max(90, Math.round(text.length * (titleFont + 1) * 0.55 + (padX * 2))));

    return {
      stack: [
        { canvas: [{ type: "rect", x: 0, y: 0, w: width, h: height, r: Math.round(height / 2), color: fillColor }] },
        { text, fontSize: titleFont, bold: true, color: textColor, margin: [padX, -height + padY + 1, 0, 0] },
      ],
      margin: [0, 0, 0, 6],
    };
  };

  const buildLayeredCard = ({ width, height, padding, content, accentColor = PDF_CARD_LAYER, fillColor = "white", innerOffset = 4 }) => {
    const offset = Math.max(0, innerOffset);
    const innerWidth = Math.max(0, width - offset);
    const innerHeight = Math.max(0, height - offset);

    return {
      width,
      stack: [
        {
          canvas: [
            { type: "rect", x: 0, y: 0, w: width, h: height, r: cardRadius, color: accentColor },
            {
              type: "rect",
              x: offset,
              y: offset,
              w: innerWidth,
              h: innerHeight,
              r: Math.max(0, cardRadius - 2),
              color: fillColor,
              lineWidth: borderWidth,
              lineColor: PDF_BORDER,
            },
          ],
        },
        {
          ...content,
          margin: [padding + offset, -height + padding + offset, padding, padding],
        },
      ],
    };
  };

  const buildSignatureBox = (targetWidth) => {
    if (!showSignatureBox || doc.type !== "devis") return {};

    const innerPadding = compactMode ? 8 : 10;
    const boxHeight = compactMode ? 78 : 92;
    const cardWidth = targetWidth || Math.round(contentWidth * 0.55);

    const contentStack = [
      buildCardTitle("Signature", { fillColor: PDF_BLUE_LIGHT, textColor: PDF_BLUE }),
      { text: "Bon pour accord", fontSize: fontSize - 1, bold: true, margin: [0, 0, 0, 3] },
      { text: "Date et signature :", fontSize: fontSize - 2, color: PDF_GRAY },
      { text: "", margin: [0, compactMode ? 18 : 24, 0, 0] },
    ];

    return {
      margin: [0, sectionSpacing, 0, 0],
      ...buildLayeredCard({
        width: cardWidth,
        height: boxHeight,
        padding: innerPadding,
        accentColor: PDF_CARD_LAYER,
        fillColor: "white",
        content: { stack: contentStack },
      }),
    };
  };

  const buildClientNoteBlock = (targetWidth) => {
    if (!notesClient) return null;

    const notePadding = compactMode ? 10 : 12;
    const noteWidth = targetWidth || contentWidth;
    const widthRatio = Math.max(0.55, Math.min(1, noteWidth / contentWidth));
    const maxCharsPerLine = Math.max(50, Math.round((compactMode ? 90 : 100) * widthRatio));
    const estimatedLines = Math.max(1, Math.ceil(notesClient.length / maxCharsPerLine)) + 1;
    const noteHeight = Math.max(compactMode ? 72 : 86, (estimatedLines * (fontSize + 2)) + (notePadding * 2) + 10);
    const noteStack = [
      buildCardTitle("Note au client", { fillColor: PDF_BLUE_LIGHT, textColor: PDF_BLUE }),
      { text: notesClient, fontSize: fontSize - 1, color: PDF_TEXT, margin: [0, 2, 0, 0] },
    ];

    return {
      margin: [0, sectionSpacing, 0, 0],
      ...buildLayeredCard({
        width: noteWidth,
        height: noteHeight,
        padding: notePadding,
        accentColor: PDF_CARD_LAYER,
        fillColor: "white",
        content: { stack: noteStack },
      }),
    };
  };

  const buildTotalsCard = (targetWidth) => {
    const cardPadding = compactMode ? 10 : 12;
    const rowHeight = compactMode ? 14 : 16;
    const cardWidth = targetWidth || Math.round(contentWidth * 0.4);
    const cardHeight = Math.max(88, (totalsRows.length * rowHeight) + (cardPadding * 2) + 12);

    const totalsTable = {
      table: {
        widths: ["*", "auto"],
        body: totalsRows,
      },
      layout: "noBorders",
    };

    const title = isFacture ? "Total facture" : "Totaux";
    const totalsContent = {
      stack: [
        buildCardTitle(title, { fillColor: PDF_BLUE_LIGHT, textColor: PDF_BLUE }),
        totalsTable,
      ],
    };

    return buildLayeredCard({
      width: cardWidth,
      height: cardHeight,
      padding: cardPadding,
      accentColor: PDF_CARD_LAYER,
      fillColor: "white",
      content: totalsContent,
    });
  };

  const buildLineCard = (rowCells, rowHeight) => {
    const safeHeight = rowHeight || (compactMode ? 22 : 26);
    const marginBottom = compactMode ? 6 : 8;
    const columns = rowCells.map((cell, index) => ({
      ...cell,
      width: tableWidths[index],
      border: undefined,
    }));

    return {
      margin: [0, 0, 0, marginBottom],
      stack: [
        {
          canvas: [{
            type: "rect",
            x: 0,
            y: 0,
            w: contentWidth,
            h: safeHeight,
            r: borderRadius,
            lineWidth: borderWidth,
            lineColor: PDF_BORDER,
            color: "white",
          }],
        },
        {
          columns,
          columnGap: 0,
          margin: [cellPadding, -safeHeight + cellPadding + 2, cellPadding, cellPadding],
        },
      ],
    };
  };

  const buildPaymentCard = (targetWidth) => {
    const cardPadding = compactMode ? 10 : 12;
    const cardWidth = targetWidth || Math.round(contentWidth * 0.55);
    const lines = [];

    if (showPaymentMethods && modesPaiementText) {
      lines.push({ text: `Paiement : ${modesPaiementText}`, fontSize: fontSize - 1, color: PDF_TEXT });
    }
    if (showConditions && conditionsPaiement) {
      lines.push({ text: `Conditions : ${conditionsPaiement}`, fontSize: fontSize - 2, color: PDF_MUTED, margin: [0, 2, 0, 0] });
    }
    if (showConditions && mentionTva) {
      lines.push({ text: mentionTva, fontSize: fontSize - 2, italics: true, color: PDF_MUTED, margin: [0, 2, 0, 0] });
    }

    if (!lines.length) return null;

    const estimatedHeight = Math.max(
      compactMode ? 78 : 92,
      (lines.length * (fontSize + 4)) + (cardPadding * 2) + 18
    );

    return {
      ...buildLayeredCard({
        width: cardWidth,
        height: estimatedHeight,
        padding: cardPadding,
        accentColor: PDF_CARD_LAYER,
        fillColor: "white",
        content: {
          stack: [
            buildCardTitle("Paiement et conditions", { fillColor: PDF_BLUE_LIGHT, textColor: PDF_BLUE }),
            ...lines,
          ],
        },
      }),
    };
  };

  const isBlock = (block) => Boolean(block && (block.stack || block.table || block.columns || block.canvas));
  const applyMargin = (block, margin) => (isBlock(block) ? { ...block, margin } : null);
  const centerBlock = (block) => {
    if (!isBlock(block) || !block.width) return block;
    const margin = Array.isArray(block.margin) ? block.margin : [0, 0, 0, 0];
    const left = Math.max(0, Math.round((contentWidth - block.width) / 2));
    return { ...block, margin: [left, margin[1] || 0, margin[2] || 0, margin[3] || 0] };
  };

  const layoutConfigs = {
    "premium-split": {
      noteWidth: "full",
      paymentWidth: 0.55,
      totalsWidth: 0.4,
      signatureWidth: 0.55,
    },
    "premium-grid": {
      noteWidth: 0.55,
      paymentWidth: 0.55,
      totalsWidth: 0.4,
      signatureWidth: 0.4,
    },
    "centered-stack": {
      noteWidth: 0.82,
      paymentWidth: 0.72,
      totalsWidth: 0.72,
      signatureWidth: 0.72,
    },
  };

  const layoutConfig = layoutConfigs[layoutPreset] || layoutConfigs["premium-split"];
  const resolveWidth = (value, fallback) => {
    if (!value) return fallback;
    if (value === "full") return contentWidth;
    return Math.round(contentWidth * value);
  };

  const noteWidth = resolveWidth(layoutConfig.noteWidth, contentWidth);
  const paymentWidth = resolveWidth(layoutConfig.paymentWidth, Math.round(contentWidth * 0.55));
  const totalsWidth = resolveWidth(layoutConfig.totalsWidth, Math.round(contentWidth * 0.4));
  const signatureWidth = resolveWidth(layoutConfig.signatureWidth, Math.round(contentWidth * 0.55));
  const cardGap = compactMode ? 8 : 10;

  const signatureBox = buildSignatureBox(signatureWidth);
  const paymentCard = buildPaymentCard(paymentWidth);
  const totalsCard = buildTotalsCard(totalsWidth);
  const clientNoteBlock = buildClientNoteBlock(noteWidth);

  const stackCards = (cards, { center = false } = {}) => {
    const filtered = cards.filter(isBlock);
    return filtered.map((card, index) => {
      const margin = [0, 0, 0, index === filtered.length - 1 ? 0 : cardGap];
      const withSpacing = applyMargin(card, margin);
      return center ? centerBlock(withSpacing) : withSpacing;
    });
  };

  let noteBlockForContent = null;
  let bottomSection = null;

  if (layoutPreset === "premium-grid") {
    const leftStack = stackCards([clientNoteBlock, paymentCard]);
    const rightStack = stackCards([totalsCard, signatureBox]);
    bottomSection = {
      margin: [0, sectionSpacing, 0, 0],
      columns: [
        { width: "55%", stack: leftStack },
        { width: "5%", text: "" },
        { width: "40%", stack: rightStack },
      ],
    };
  } else if (layoutPreset === "centered-stack") {
    noteBlockForContent = clientNoteBlock ? centerBlock(applyMargin(clientNoteBlock, [0, sectionSpacing, 0, 0])) : null;
    bottomSection = {
      margin: [0, sectionSpacing, 0, 0],
      stack: stackCards([paymentCard, totalsCard, signatureBox], { center: true }),
    };
  } else {
    noteBlockForContent = clientNoteBlock ? applyMargin(clientNoteBlock, [0, sectionSpacing, 0, 0]) : null;
    const leftStack = stackCards([paymentCard, signatureBox]);
    const rightStack = stackCards([totalsCard]);
    bottomSection = {
      margin: [0, sectionSpacing, 0, 0],
      columns: [
        { width: "55%", stack: leftStack },
        { width: "5%", text: "" },
        { width: "40%", stack: rightStack },
      ],
    };
  }

  // Build watermark if enabled
  const watermark = showDraftWatermark ? {
    text: "BROUILLON",
    color: "#cccccc",
    opacity: 0.3,
    bold: true,
    italics: false,
  } : undefined;

  // Build background for document border
  const background = showDocumentBorder ? (currentPage, pageSize) => [{
    canvas: [{
      type: "rect",
      x: pageMargin - 5,
      y: pageMargin - 5,
      w: pageSize.width - (pageMargin * 2) + 10,
      h: pageSize.height - (pageMargin * 2) + 10,
      r: borderRadius,
      lineWidth: borderWidth,
      lineColor: PDF_BORDER,
    }],
  }] : undefined;

  const useRoundedRows = borderRadius > 0 && appearance.roundedRowBorders !== false;

  const tableContent = useRoundedRows
    ? [
        {
          table: {
            headerRows: 1,
            widths: tableWidths,
            body: [tableHeaders],
          },
          layout: getTableLayout(),
          margin: [0, 0, 0, compactMode ? 6 : 8],
        },
        ...tableBody.slice(1).map((row, index) => {
          const rowIndex = index + 1;
          const kind = rowKinds[rowIndex];
          if (kind === "line") {
            return buildLineCard(row, rowHeights[rowIndex]);
          }
          return {
            table: {
              widths: tableWidths,
              body: [row],
            },
            layout: "noBorders",
            margin: [0, 0, 0, compactMode ? 6 : 8],
          };
        }),
      ]
    : {
        table: {
          headerRows: 1,
          widths: tableWidths,
          body: tableBody,
        },
        layout: getTableLayout(),
      };

  return {
    pageSize: "A4",
    pageMargins: [pageMargin, pageMargin, pageMargin, pageMargin + 10],
    defaultStyle: { font: pdfFont, fontSize: fontSize, color: PDF_TEXT, lineHeight },
    styles: {
      tHead: {
        bold: true,
        fontSize: fontSize - 1,
        color: headerStyle === "ultra" ? PDF_BLUE : "white",
        fillColor: headerStyle === "ultra" ? PDF_BLUE_SOFT : PDF_BLUE,
      },
      sectionCell: { fillColor: PDF_BLUE_LIGHT, bold: true, fontSize: fontSize, color: PDF_BLUE },
    },
    watermark,
    background,
    content: [
      // Header
      buildHeader(),

      // Client box
      buildClientBox(),

      // Objet
      doc.objet ? { text: `Objet : ${doc.objet}`, fontSize: fontSize, bold: true, margin: [0, 0, 0, compactMode ? 8 : 10] } : {},

      // Table
      ...(Array.isArray(tableContent) ? tableContent : [tableContent]),
      ...(noteBlockForContent ? [noteBlockForContent] : []),

      // Bottom section
      ...(bottomSection ? [bottomSection] : []),
    ],
    footer: showFooter || showPageNumbers ? (currentPage, pageCount) => ({
      margin: [pageMargin, 0, pageMargin, 0],
      columns: [
        showFooter ? { text: "Thomas Bonnardel EI • 944 Chemin de Tardinaou 13190 Allauch • SIREN 992 454 694", fontSize: 6, color: PDF_MUTED } : { text: "" },
        showPageNumbers ? { text: `${currentPage}/${pageCount}`, fontSize: 6, color: PDF_MUTED, alignment: "right" } : { text: "" },
      ],
    }) : undefined,
  };
};

const renderPdfBuffer = (doc) => {
  return new Promise((resolve, reject) => {
    try {
      const docDefinition = buildDocumentPdfDefinition(doc);
      const pdfDoc = pdfPrinter.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const buildPreviewDocument = (payload = {}) => {
  const client = payload.client || {};
  const lignes = Array.isArray(payload.lignes)
    ? payload.lignes
    : parseJsonField(payload.lignes, []);
  const modesPaiement = Array.isArray(payload.modes_paiement)
    ? payload.modes_paiement
    : parseJsonField(payload.modes_paiement, []);
  const defaultAppearance = getPdfAppearanceDefaults(payload.type || "devis");

  const doc = {
    type: payload.type || "devis",
    numero: payload.numero || "",
    date_emission: payload.date_emission || null,
    date_validite: payload.date_validite || null,
    date_echeance: payload.date_echeance || null,
    objet: payload.objet || "",
    lignes,
    tva_applicable: Boolean(payload.tva_applicable),
    mention_tva: payload.mention_tva || "TVA non applicable, art. 293 B du CGI",
    total_ht: Number(payload.total_ht) || 0,
    total_tva: Number(payload.total_tva) || 0,
    total_ttc: Number(payload.total_ttc) || 0,
    total_remise: Number(payload.total_remise) || 0,
    net_a_payer: Number(payload.net_a_payer) || 0,
    retenue_garantie_montant: Number(payload.retenue_garantie_montant) || 0,
    conditions_paiement: payload.conditions_paiement || null,
    modes_paiement: modesPaiement,
    notes_client: payload.notes_client || "",
    client_nom: payload.client_nom || client.nom || "",
    client_prenom: payload.client_prenom || client.prenom || "",
    client_email: payload.client_email || client.email || "",
    client_telephone: payload.client_telephone || client.telephone || "",
    client_adresse_ligne1: payload.client_adresse_ligne1 || client.adresse_ligne1 || "",
    client_adresse_ligne2: payload.client_adresse_ligne2 || client.adresse_ligne2 || "",
    client_code_postal: payload.client_code_postal || client.code_postal || "",
    client_ville: payload.client_ville || client.ville || "",
    client_pays: payload.client_pays || client.pays || "",
    siret: payload.siret || "",
    appearance: payload.appearance || defaultAppearance,
  };

  if (doc.total_ht === 0 && lignes.length) {
    let totalHT = 0;
    let totalTVA = 0;
    let totalRemise = 0;

    lignes.forEach((ligne) => {
      if (ligne.type !== "ligne") return;
      const base = (ligne.quantite || 0) * (ligne.prix_unitaire_ht || 0);
      let remise = 0;
      if (ligne.remise_valeur > 0) {
        remise = ligne.remise_type === "pourcentage" ? base * ligne.remise_valeur / 100 : ligne.remise_valeur;
      }
      const ligneHT = base - remise;
      totalHT += ligneHT;
      totalRemise += remise;
      if (doc.tva_applicable) {
        totalTVA += ligneHT * (ligne.taux_tva || 0) / 100;
      }
    });

    doc.total_ht = Math.round(totalHT * 100) / 100;
    doc.total_tva = Math.round(totalTVA * 100) / 100;
    doc.total_remise = doc.total_remise || Math.round(totalRemise * 100) / 100;
    doc.total_ttc = Math.round((doc.total_ht + doc.total_tva) * 100) / 100;
  }

  if (!doc.total_ttc) {
    doc.total_ttc = Math.round((doc.total_ht + doc.total_tva) * 100) / 100;
  }
  if (!doc.net_a_payer) {
    doc.net_a_payer = Math.round((doc.total_ttc - (doc.retenue_garantie_montant || 0)) * 100) / 100;
  }

  return doc;
};

const toIsoString = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return String(value);
};

const normalizeLeadPayload = (payload = {}) => {
  const source = (payload.source || payload.origin || "form").toString();
  const conversationId =
    (payload.conversation_id || payload.conversationId || "").toString().trim() || null;
  const summaryObj =
    typeof payload.summary === "string"
      ? parseJsonField(payload.summary, null)
      : payload.summary || null;
  const photosArray = Array.isArray(payload.photos)
    ? payload.photos
    : payload.photos
    ? [payload.photos]
    : [];

  return {
    id: (payload.id || conversationId || crypto.randomUUID()).toString(),
    source,
    name: payload.name || payload.nom || null,
    email: payload.email || null,
    phone: payload.phone || payload.telephone || null,
    address: payload.address || payload.adresse || null,
    project_type: payload.project_type || payload.typeProjet || payload.typeBien || null,
    description: payload.description || null,
    photos: photosArray,
    summary: summaryObj,
    conversation_id: conversationId,
    status: payload.status || "new",
  };
};

const parseLeadRow = (row) => ({
  id: row.id,
  source: row.source,
  name: row.name,
  email: row.email,
  phone: row.phone,
  address: row.address,
  project_type: row.project_type,
  description: row.description,
  photos: parseJsonField(row.photos, []),
  summary: parseJsonField(row.summary, null),
  conversation_id: row.conversation_id,
  status: row.status,
  created_at: toIsoString(row.created_at),
  updated_at: toIsoString(row.updated_at),
});

const loadChatRecord = async (cid) => {
  const pool = getMySQLPool();
  if (!pool) {
    return historyStore.get(cid) || null;
  }
  const [rows] = await pool.query(
    "SELECT id, agent, summary, messages, created_at, updated_at FROM chat_conversations WHERE id = ?",
    [cid]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    messages: parseJsonField(row.messages, []),
    summary: parseJsonField(row.summary, null),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    agent: row.agent || null,
  };
};

const listChatRecords = async () => {
  const pool = getMySQLPool();
  if (!pool) {
    return Array.from(historyStore.entries()).map(([id, record]) => ({
      id,
      conversationId: id,
      messages: record.messages || [],
      summary: record.summary || null,
      agent: record.agent || null,
      created_date: record.createdAt,
      updated_date: record.updatedAt,
    }));
  }
  const [rows] = await pool.query(
    "SELECT id, agent, summary, messages, created_at, updated_at FROM chat_conversations ORDER BY updated_at DESC"
  );
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.id,
    messages: parseJsonField(row.messages, []),
    summary: parseJsonField(row.summary, null),
    agent: row.agent || null,
    created_date: toIsoString(row.created_at),
    updated_date: toIsoString(row.updated_at),
  }));
};

const saveChatRecord = async (cid, record) => {
  const pool = getMySQLPool();
  if (!pool) {
    historyStore.set(cid, record);
    return;
  }
  const summaryValue = record.summary ? JSON.stringify(record.summary) : null;
  const messagesValue = JSON.stringify(record.messages || []);
  const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
  const updatedAt = record.updatedAt ? new Date(record.updatedAt) : new Date();
  await pool.query(
    `INSERT INTO chat_conversations (id, agent, summary, messages, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       agent = VALUES(agent),
       summary = VALUES(summary),
       messages = VALUES(messages),
       updated_at = VALUES(updated_at)`,
    [cid, record.agent || null, summaryValue, messagesValue, createdAt, updatedAt]
  );
};

// ============================================
// GOOGLE CALENDAR SERVICE
// ============================================
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const getGoogleAuth = () => {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    return null;
  }
  return new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/calendar']
  );
};

const googleCalendarService = {
  async listEvents(timeMin, timeMax) {
    const auth = getGoogleAuth();
    if (!auth || !GOOGLE_CALENDAR_ID) {
      console.warn("Google Calendar not configured");
      return [];
    }
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });
      return response.data.items || [];
    } catch (error) {
      console.error("Google Calendar listEvents error:", error.message);
      return [];
    }
  },

  async createEvent({ title, description, start, end, location }) {
    const auth = getGoogleAuth();
    if (!auth || !GOOGLE_CALENDAR_ID) {
      console.warn("Google Calendar not configured");
      return null;
    }
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      const event = {
        summary: title,
        description: description || '',
        location: location || '',
        start: { dateTime: new Date(start).toISOString(), timeZone: 'Europe/Paris' },
        end: { dateTime: new Date(end).toISOString(), timeZone: 'Europe/Paris' },
      };
      const response = await calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        resource: event,
      });
      return response.data;
    } catch (error) {
      console.error("Google Calendar createEvent error:", error.message);
      throw error;
    }
  },

  async updateEvent(googleEventId, { title, description, start, end, location }) {
    const auth = getGoogleAuth();
    if (!auth || !GOOGLE_CALENDAR_ID) {
      console.warn("Google Calendar not configured");
      return null;
    }
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      const event = {
        summary: title,
        description: description || '',
        location: location || '',
        start: { dateTime: new Date(start).toISOString(), timeZone: 'Europe/Paris' },
        end: { dateTime: new Date(end).toISOString(), timeZone: 'Europe/Paris' },
      };
      const response = await calendar.events.update({
        calendarId: GOOGLE_CALENDAR_ID,
        eventId: googleEventId,
        resource: event,
      });
      return response.data;
    } catch (error) {
      console.error("Google Calendar updateEvent error:", error.message);
      throw error;
    }
  },

  async deleteEvent(googleEventId) {
    const auth = getGoogleAuth();
    if (!auth || !GOOGLE_CALENDAR_ID) {
      console.warn("Google Calendar not configured");
      return;
    }
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({
        calendarId: GOOGLE_CALENDAR_ID,
        eventId: googleEventId,
      });
    } catch (error) {
      console.error("Google Calendar deleteEvent error:", error.message);
      throw error;
    }
  },
};

const DEFAULT_PRESTATIONS = [
  {
    titre: "Renovation interieure",
    description: "Renovation complete, tous corps d'etat, pour transformer votre interieur.",
  },
  {
    titre: "Amenagement interieur",
    description: "Optimisation des volumes, circulation et rangements sur mesure.",
  },
  {
    titre: "Conception 3D",
    description: "Plans et visuels 3D pour valider les choix avant travaux.",
  },
  {
    titre: "Platrerie",
    description: "Cloisons, doublages, faux plafonds et finitions lisses.",
  },
  {
    titre: "Peinture",
    description: "Preparation des supports et mise en peinture durable.",
  },
  {
    titre: "Carrelage",
    description: "Pose murale et sol, joints precis et finitions soignees.",
  },
  {
    titre: "Parquet",
    description: "Pose et renovation de parquets pour une ambiance chaleureuse.",
  },
];

const normalizePrestationTitle = (value) => {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const seedBasePrestations = async (pool) => {
  if (!DEFAULT_PRESTATIONS.length) return;
  const [rows] = await pool.query("SELECT titre, ordre FROM prestations");
  const existing = new Set(rows.map((row) => normalizePrestationTitle(row.titre)));
  const maxOrdre = rows.reduce((max, row) => {
    const value = Number(row.ordre);
    if (Number.isFinite(value) && value > max) return value;
    return max;
  }, -1);
  let nextOrdre = maxOrdre + 1;

  const values = [];
  const placeholders = [];

  for (const prestation of DEFAULT_PRESTATIONS) {
    const normalized = normalizePrestationTitle(prestation.titre);
    if (existing.has(normalized)) continue;
    values.push(
      crypto.randomUUID(),
      prestation.titre,
      prestation.description,
      1,
      nextOrdre
    );
    placeholders.push("(?, ?, ?, ?, ?)");
    nextOrdre += 1;
  }

  if (!placeholders.length) return;
  await pool.query(
    "INSERT INTO prestations (id, titre, description, visible, ordre) VALUES " + placeholders.join(","),
    values
  );
};

const initDb = async () => {
  const pool = getMySQLPool();
  if (!pool) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role ENUM('admin', 'user') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    )`,
    `CREATE TABLE IF NOT EXISTS projets (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      description TEXT,
      categorie VARCHAR(64),
      image_url TEXT,
      image_label VARCHAR(32),
      images_supplementaires JSON,
      images_labels JSON,
      client VARCHAR(255),
      annee VARCHAR(8),
      surface VARCHAR(64),
      duree VARCHAR(64),
      visible TINYINT(1) DEFAULT 1,
      mis_en_avant TINYINT(1) DEFAULT 0,
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prestations (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      description TEXT,
      prix_indicatif VARCHAR(64),
      duree_estimee VARCHAR(64),
      visible TINYINT(1) DEFAULT 1,
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start DATETIME NOT NULL,
      end DATETIME,
      color VARCHAR(32),
      ordre INT DEFAULT 0,
      client_id VARCHAR(64),
      type ENUM('rdv_client', 'interne', 'autre') DEFAULT 'autre',
      location VARCHAR(255),
      google_event_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_client (client_id),
      INDEX idx_google_event (google_event_id)
    )`,
    `CREATE TABLE IF NOT EXISTS liste_courses (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      categorie VARCHAR(64),
      urgence VARCHAR(32),
      fait TINYINT(1) DEFAULT 0,
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notes (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255),
      content TEXT,
      color VARCHAR(32),
      pinned TINYINT(1) DEFAULT 0,
      archived TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS chantiers (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      client VARCHAR(255),
      statut VARCHAR(64),
      date_debut DATE,
      date_fin DATE,
      budget_estime VARCHAR(64),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS taches (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      priorite VARCHAR(32),
      statut VARCHAR(64),
      date_limite DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS compta_urssaf (
      id VARCHAR(64) PRIMARY KEY,
      periode VARCHAR(32),
      ca_encaisse DECIMAL(12,2),
      charges DECIMAL(12,2),
      date_declaration DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS chat_conversations (
      id VARCHAR(64) PRIMARY KEY,
      agent VARCHAR(128),
      summary JSON,
      messages JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(64) PRIMARY KEY,
      source VARCHAR(32) NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(64),
      address TEXT,
      project_type VARCHAR(255),
      description TEXT,
      photos JSON,
      summary JSON,
      conversation_id VARCHAR(64),
      status VARCHAR(32) DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_conversation (conversation_id)
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(64) PRIMARY KEY,
      type ENUM('particulier', 'professionnel') NOT NULL DEFAULT 'particulier',
      nom VARCHAR(255) NOT NULL,
      prenom VARCHAR(100),
      email VARCHAR(255),
      telephone VARCHAR(20),
      adresse_ligne1 VARCHAR(255),
      adresse_ligne2 VARCHAR(255),
      code_postal VARCHAR(10),
      ville VARCHAR(100),
      pays VARCHAR(100) DEFAULT 'France',
      siret VARCHAR(20),
      tva_intracom VARCHAR(20),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_nom (nom),
      INDEX idx_email (email)
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(64) PRIMARY KEY,
      type ENUM('devis', 'facture', 'avoir') NOT NULL,
      numero VARCHAR(20) NOT NULL UNIQUE,
      reference_externe VARCHAR(100),
      client_id VARCHAR(64) NOT NULL,
      chantier_id VARCHAR(64),
      date_emission DATE NOT NULL,
      date_validite DATE,
      date_echeance DATE,
      date_visite DATE,
      date_debut_travaux DATE,
      duree_estimee INT,
      duree_unite VARCHAR(20),
      statut ENUM('brouillon', 'envoye', 'vu', 'accepte', 'refuse', 'expire', 'paye', 'paye_partiel', 'annule') NOT NULL DEFAULT 'brouillon',
      total_ht DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_tva DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_ttc DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_remise DECIMAL(12,2) NOT NULL DEFAULT 0,
      acompte_demande DECIMAL(12,2) DEFAULT 0,
      net_a_payer DECIMAL(12,2) NOT NULL DEFAULT 0,
      tva_applicable TINYINT(1) NOT NULL DEFAULT 0,
      mention_tva VARCHAR(255) DEFAULT 'TVA non applicable, art. 293 B du CGI',
      remise_type ENUM('pourcentage', 'montant'),
      remise_valeur DECIMAL(12,2) DEFAULT 0,
      retenue_garantie_pct DECIMAL(5,2) DEFAULT 0,
      retenue_garantie_montant DECIMAL(12,2) DEFAULT 0,
      conditions_paiement TEXT,
      modes_paiement JSON,
      iban VARCHAR(34),
      bic VARCHAR(11),
      notes_internes TEXT,
      notes_client TEXT,
      objet VARCHAR(500),
      lignes JSON,
      pieces_jointes JSON,
      signature_nom VARCHAR(255),
      signature_date DATETIME,
      signature_ip VARCHAR(45),
      signature_hash VARCHAR(64),
      token_public VARCHAR(64) UNIQUE,
      token_expire_at DATETIME,
      pdf_path VARCHAR(500),
      pdf_generated_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL,
      INDEX idx_type_statut (type, statut),
      INDEX idx_client (client_id),
      INDEX idx_chantier (chantier_id),
      INDEX idx_date_emission (date_emission),
      INDEX idx_token (token_public),
      INDEX idx_deleted (deleted_at)
    )`,
    // Table des paiements
    `CREATE TABLE IF NOT EXISTS paiements (
      id VARCHAR(64) PRIMARY KEY,
      document_id VARCHAR(64) NOT NULL,
      montant DECIMAL(12,2) NOT NULL,
      date_paiement DATE NOT NULL,
      mode VARCHAR(50),
      reference VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_document (document_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )`,
    // Table des configurations d'apparence PDF
    `CREATE TABLE IF NOT EXISTS appearance_configs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      document_id VARCHAR(64),
      config JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_doc (user_id, document_id),
      INDEX idx_user (user_id),
      INDEX idx_document (document_id)
    )`,
    // Table d'audit
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(64),
      old_data JSON,
      new_data JSON,
      metadata JSON,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_entity (entity_type, entity_id),
      INDEX idx_created (created_at),
      INDEX idx_action (action)
    )`,
    // Table des templates de documents
    `CREATE TABLE IF NOT EXISTS document_templates (
      id VARCHAR(64) PRIMARY KEY,
      nom VARCHAR(100) NOT NULL,
      type ENUM('devis', 'facture', 'avoir') NOT NULL,
      lignes JSON,
      conditions_paiement TEXT,
      notes_defaut TEXT,
      appearance_config JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }

  // Ajouter colonne deleted_at si elle n'existe pas (migration)
  try {
    await pool.query(`ALTER TABLE documents ADD COLUMN deleted_at DATETIME DEFAULT NULL`);
    await pool.query(`ALTER TABLE documents ADD INDEX idx_deleted (deleted_at)`);
  } catch (e) {
    // Colonne existe déjà, ignorer
  }

  // Ajouter colonne devis_source_id pour lien devis->facture
  try {
    await pool.query(`ALTER TABLE documents ADD COLUMN devis_source_id VARCHAR(64)`);
  } catch (e) {
    // Colonne existe déjà, ignorer
  }

  try {
    await seedBasePrestations(pool);
  } catch (error) {
    console.error("Seed prestations error:", error.message);
  }
};

const encodeBase64Url = (value) => Buffer.from(value).toString("base64url");
const decodeBase64Url = (value) => Buffer.from(value, "base64url").toString("utf-8");

const signToken = (payload) => {
  if (!ADMIN_SECRET) return null;
  const data = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_SECONDS * 1000,
  };
  const encoded = encodeBase64Url(JSON.stringify(data));
  const signature = crypto.createHmac("sha256", ADMIN_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

const verifyToken = (token) => {
  if (!token || !ADMIN_SECRET) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(decodeBase64Url(encoded));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
};

const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    req.admin = payload;
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.admin = payload;
  next();
};

const ENTITY_CONFIG = {
  projets: {
    table: "projets",
    public: true,
    defaultSort: "ordre",
    jsonFields: ["images_supplementaires", "images_labels"],
    booleanFields: ["visible", "mis_en_avant"],
    columns: [
      "id",
      "titre",
      "description",
      "categorie",
      "image_url",
      "image_label",
      "images_supplementaires",
      "images_labels",
      "client",
      "annee",
      "surface",
      "duree",
      "visible",
      "mis_en_avant",
      "ordre",
    ],
  },
  prestations: {
    table: "prestations",
    public: true,
    defaultSort: "ordre",
    jsonFields: [],
    booleanFields: ["visible"],
    columns: [
      "id",
      "titre",
      "description",
      "prix_indicatif",
      "duree_estimee",
      "visible",
      "ordre",
    ],
  },
  events: {
    table: "events",
    public: false,
    defaultSort: "start",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "title", "description", "start", "end", "color", "ordre", "client_id", "type", "location", "google_event_id"],
  },
  "liste-courses": {
    table: "liste_courses",
    public: false,
    defaultSort: "ordre",
    jsonFields: [],
    booleanFields: ["fait"],
    columns: ["id", "titre", "categorie", "urgence", "fait", "ordre"],
  },
  notes: {
    table: "notes",
    public: false,
    defaultSort: "updated_at",
    jsonFields: [],
    booleanFields: ["pinned", "archived"],
    columns: ["id", "title", "content", "color", "pinned", "archived"],
  },
  chantiers: {
    table: "chantiers",
    public: false,
    defaultSort: "date_debut",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "titre", "client", "statut", "date_debut", "date_fin", "budget_estime", "notes"],
  },
  taches: {
    table: "taches",
    public: false,
    defaultSort: "date_limite",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "titre", "priorite", "statut", "date_limite", "notes"],
  },
  "compta-urssaf": {
    table: "compta_urssaf",
    public: false,
    defaultSort: "periode",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "periode", "ca_encaisse", "charges", "date_declaration", "notes"],
  },
  clients: {
    table: "clients",
    public: false,
    defaultSort: "nom",
    jsonFields: [],
    booleanFields: [],
    columns: [
      "id", "type", "nom", "prenom", "email", "telephone",
      "adresse_ligne1", "adresse_ligne2", "code_postal", "ville", "pays",
      "siret", "tva_intracom", "notes"
    ],
  },
  documents: {
    table: "documents",
    public: false,
    defaultSort: "date_emission",
    jsonFields: ["modes_paiement", "lignes", "pieces_jointes"],
    booleanFields: ["tva_applicable"],
    columns: [
      "id", "type", "numero", "reference_externe", "client_id", "chantier_id",
      "date_emission", "date_validite", "date_echeance",
      "date_visite", "date_debut_travaux", "duree_estimee", "duree_unite",
      "statut",
      "total_ht", "total_tva", "total_ttc", "total_remise", "acompte_demande", "net_a_payer",
      "tva_applicable", "mention_tva", "remise_type", "remise_valeur",
      "retenue_garantie_pct", "retenue_garantie_montant",
      "conditions_paiement", "modes_paiement", "iban", "bic",
      "notes_internes", "notes_client", "objet", "lignes", "pieces_jointes",
      "signature_nom", "signature_date", "signature_ip", "signature_hash",
      "token_public", "token_expire_at", "pdf_path", "pdf_generated_at"
    ],
  },
};

const sanitizePayload = (payload, config) => {
  const clean = {};
  for (const key of config.columns) {
    if (payload[key] !== undefined) {
      clean[key] = payload[key];
    }
  }
  return clean;
};

const normalizeValue = (value, config, key) => {
  if (config.booleanFields.includes(key)) {
    return value ? 1 : 0;
  }
  if (config.jsonFields.includes(key)) {
    return JSON.stringify(Array.isArray(value) ? value : value || []);
  }
  return value;
};

const parseRow = (row, config) => {
  const parsed = { ...row };
  config.booleanFields.forEach((key) => {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      parsed[key] = Boolean(parsed[key]);
    }
  });
  config.jsonFields.forEach((key) => {
    if (parsed[key] === null || parsed[key] === undefined) {
      parsed[key] = [];
    } else if (typeof parsed[key] === "string") {
      try {
        parsed[key] = JSON.parse(parsed[key]);
      } catch {
        parsed[key] = [];
      }
    }
  });
  return parsed;
};

const buildFilters = (query, config, isAdmin) => {
  const filters = [];
  const values = [];

  config.columns.forEach((column) => {
    if (query[column] === undefined) return;
    let value = query[column];
    if (config.booleanFields.includes(column)) {
      value = value === "true" || value === "1" || value === true ? 1 : 0;
    }
    filters.push(`${column} = ?`);
    values.push(value);
  });

  if (config.public && !isAdmin && query.visible === undefined && config.columns.includes("visible")) {
    filters.push("visible = 1");
  }

  return { filters, values };
};

const ensureUploadsDir = async () => {
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const name = `${Date.now()}-${safeName}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 8 * 1024 * 1024) },
});

const ensureDocumentUploadsDir = async (documentId) => {
  const dir = path.join(process.cwd(), "public", "uploads", "documents", documentId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const documentStorage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const dir = await ensureDocumentUploadsDir(req.params.id);
      cb(null, dir);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const name = `${Date.now()}-${safeName}`;
    cb(null, name);
  },
});

const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 8 * 1024 * 1024) },
});

app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.get("/api/db/health", async (_req, res) => {
  try {
    const pool = getMySQLPool();
    if (!pool) {
      return res.status(503).json({ status: "mysql_not_configured" });
    }
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", result: rows[0] });
  } catch (error) {
    console.error("MySQL health error:", error);
    res.status(500).json({ status: "error", error: error.message });
  }
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

const BCRYPT_ROUNDS = 12;

// Register new user
app.post("/api/auth/register", async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const { email, password, name } = req.body || {};

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: "validation_error", message: "Email et mot de passe requis" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "validation_error", message: "Email invalide" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "validation_error", message: "Mot de passe trop court (min 6 caracteres)" });
  }

  try {
    // Check if email already exists
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "email_exists", message: "Cet email est deja utilise" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const userId = crypto.randomUUID();
    const role = "admin"; // For now, all users are admins

    await pool.query(
      "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
      [userId, email.toLowerCase().trim(), passwordHash, name?.trim() || null, role]
    );

    // Generate token
    const user = {
      id: userId,
      email: email.toLowerCase().trim(),
      full_name: name?.trim() || email.split("@")[0],
      role,
    };
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "server_error", message: "Erreur lors de l'inscription" });
  }
});

// Login with email/password
app.post("/api/auth/login", async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "validation_error", message: "Email et mot de passe requis" });
  }

  try {
    // Find user by email
    const [users] = await pool.query(
      "SELECT id, email, password_hash, name, role FROM users WHERE email = ?",
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "invalid_credentials", message: "Email ou mot de passe incorrect" });
    }

    const dbUser = users[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, dbUser.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "invalid_credentials", message: "Email ou mot de passe incorrect" });
    }

    // Generate token
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      full_name: dbUser.name || dbUser.email.split("@")[0],
      role: dbUser.role,
    };
    const token = signToken(user);

    res.json({ token, user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "server_error", message: "Erreur lors de la connexion" });
  }
});

// Legacy admin login (keep for backward compatibility)
app.post("/api/admin/login", (req, res) => {
  const { code, email, name } = req.body || {};
  if (!code || code.trim() !== ADMIN_CODE) {
    return res.status(401).json({ error: "invalid_code" });
  }
  const user = {
    email: (email || "admin@site.local").trim(),
    full_name: (name || "Administrateur").trim(),
    role: "admin",
  };
  const token = signToken(user);
  if (!token) {
    return res.status(500).json({ error: "token_error" });
  }
  res.json({ token, user });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ user: req.admin });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (String(process.env.UPLOAD_REQUIRE_AUTH || "false") === "true") {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!verifyToken(token)) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }
  if (!req.file) {
    return res.status(400).json({ error: "file_missing" });
  }
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ file_url: fileUrl });
});

const getMailer = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
};

app.post("/api/email", async (req, res) => {
  const { to, subject, body, replyTo } = req.body || {};
  if (!subject || !body) {
    return res.status(400).json({ error: "missing_subject_or_body" });
  }
  const transporter = getMailer();
  if (!transporter) {
    return res.status(503).json({ error: "smtp_not_configured" });
  }
  const mailFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailTo = process.env.MAIL_TO || to;
  if (!mailTo) {
    return res.status(400).json({ error: "missing_recipient" });
  }
  try {
    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      subject,
      html: body,
      replyTo: replyTo || undefined,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("SMTP error:", error);
    res.status(500).json({ error: "smtp_error" });
  }
});

app.post("/api/llm", async (req, res) => {
  const { prompt, response_json_schema } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "missing_prompt" });
  }
  try {
    const schemaHint = response_json_schema
      ? `Return a JSON object matching this schema: ${JSON.stringify(response_json_schema)}`
      : "Return a JSON object.";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: schemaHint },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
      return res.status(500).json({ error: "llm_error" });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }
    res.json(parsed || { raw });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "llm_error" });
  }
});

app.get("/api/chat", async (_req, res) => {
  try {
    const list = await listChatRecords();
    list.sort((a, b) => new Date(b.updated_date).getTime() - new Date(a.updated_date).getTime());
    res.json(list);
  } catch (error) {
    console.error("Chat list error:", error);
    res.status(500).json({ error: "chat_error" });
  }
});

app.get("/api/chat/:conversationId", async (req, res) => {
  const cid = req.params.conversationId;
  try {
    const record = await loadChatRecord(cid);
    if (!record) {
      return res.status(404).json({ error: "conversation_not_found" });
    }
    res.json({
      conversationId: cid,
      history: record.messages || [],
      summary: record.summary || null,
    });
  } catch (error) {
    console.error("Chat get error:", error);
    res.status(500).json({ error: "chat_error" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, conversationId, context = {}, systemPrompt } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "missing_message" });
  }

  const cid = conversationId || crypto.randomUUID();
  const pastRecord = (await loadChatRecord(cid)) || { messages: [], summary: null, createdAt: new Date().toISOString() };
  const past = pastRecord.messages || [];
  const limitedPast = past.slice(-6);

  const agentName =
    typeof context === "string"
      ? context
      : context?.agent_name || context?.agent || context?.page || null;

  const basePrompt = `
You are an assistant that helps scope a renovation project.
Return ONLY valid JSON with keys:
{
  "message": "reply",
  "summary": {
    "typeProjet": "",
    "typeBien": "",
    "surface": "",
    "budget": "",
    "delai": "",
    "adresse": "",
    "description": "",
    "coordonnees": { "nom": "", "email": "", "telephone": "" },
    "pointsOuverts": []
  }
}
If unknown, keep empty strings or add to pointsOuverts.
Context: ${JSON.stringify(context)}
ConversationId: ${cid}
`;
  const finalSystemPrompt = systemPrompt && systemPrompt.trim() ? systemPrompt : basePrompt;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...limitedPast,
          { role: "user", content: message },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
      return res.status(500).json({ error: "groq_error" });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";

    const tryParse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    let parsed = tryParse(raw);
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = tryParse(match[0]);
      }
    }

    if (!parsed) {
      parsed = { message: raw || "Reply unavailable", summary: null };
    }

    const replyText = (parsed.message || raw || "").toString().trim();
    const updatedMessages = [...limitedPast, { role: "user", content: message }, { role: "assistant", content: replyText }];
    const updatedAt = new Date().toISOString();

    await saveChatRecord(cid, {
      messages: updatedMessages.slice(-6),
      summary: parsed.summary || pastRecord.summary || null,
      createdAt: pastRecord.createdAt || updatedAt,
      updatedAt,
      agent: agentName || pastRecord.agent || null,
    });

    res.json({
      reply: replyText || "Reply unavailable",
      raw,
      summary: parsed.summary || null,
      conversationId: cid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "chat_error" });
  }
});

app.post("/api/leads", async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const lead = normalizeLeadPayload(req.body || {});

  try {
    await pool.query(
      `INSERT INTO leads (id, source, name, email, phone, address, project_type, description, photos, summary, conversation_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         source = VALUES(source),
         name = VALUES(name),
         email = VALUES(email),
         phone = VALUES(phone),
         address = VALUES(address),
         project_type = VALUES(project_type),
         description = VALUES(description),
         photos = VALUES(photos),
         summary = VALUES(summary),
         status = VALUES(status),
         updated_at = CURRENT_TIMESTAMP`,
      [
        lead.id,
        lead.source,
        lead.name,
        lead.email,
        lead.phone,
        lead.address,
        lead.project_type,
        lead.description,
        JSON.stringify(lead.photos || []),
        lead.summary ? JSON.stringify(lead.summary) : null,
        lead.conversation_id,
        lead.status,
      ]
    );

    res.json({ success: true, id: lead.id });
  } catch (error) {
    console.error("Lead insert error:", error);
    res.status(500).json({ error: "lead_error" });
  }
});

app.get("/api/leads", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const limit = Math.min(Number(req.query.limit || 200), 500);

  try {
    const [rows] = await pool.query(
      "SELECT id, source, name, email, phone, address, project_type, description, photos, summary, conversation_id, status, created_at, updated_at FROM leads ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    res.json(rows.map(parseLeadRow));
  } catch (error) {
    console.error("Lead list error:", error);
    res.status(500).json({ error: "lead_error" });
  }
});

// === DOCUMENTS: Routes spécifiques ===

// Générer le prochain numéro de document
const genererNumeroDocument = async (pool, type) => {
  const prefixes = { devis: "D", facture: "F", avoir: "A" };
  const prefixe = prefixes[type] || "D";
  const annee = new Date().getFullYear();

  const [rows] = await pool.query(
    `SELECT numero FROM documents WHERE type = ? AND numero LIKE ? ORDER BY numero DESC LIMIT 1`,
    [type, `${prefixe}${annee}%`]
  );

  let compteur = 1;
  if (rows.length > 0) {
    const dernierNumero = rows[0].numero;
    compteur = parseInt(dernierNumero.slice(-5)) + 1;
  }

  return `${prefixe}${annee}${compteur.toString().padStart(5, "0")}`;
};

// Générer un token public sécurisé
const genererTokenPublic = () => crypto.randomBytes(32).toString("base64url");

// Fonction de validation des lignes de document
const validateDocumentLignes = (lignes) => {
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

      const quantite = Number(ligne.quantite);
      if (isNaN(quantite) || quantite < 0) {
        return { valid: false, error: `Ligne ${i + 1}: quantité invalide (doit être >= 0)` };
      }

      const prix = Number(ligne.prix_unitaire_ht);
      if (isNaN(prix) || prix < 0) {
        return { valid: false, error: `Ligne ${i + 1}: prix unitaire invalide (doit être >= 0)` };
      }

      if (ligne.taux_tva !== undefined && ligne.taux_tva !== null) {
        const tva = Number(ligne.taux_tva);
        if (isNaN(tva) || tva < 0 || tva > 100) {
          return { valid: false, error: `Ligne ${i + 1}: taux TVA invalide (0-100)` };
        }
      }
    }
  }

  return { valid: true };
};

// Créer un document avec numérotation automatique
app.post("/api/documents", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { type = "devis", client_id, lignes = [], ...rest } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: "client_id_required", message: "Un client est requis" });
    }

    // Validation des lignes
    const validation = validateDocumentLignes(lignes);
    if (!validation.valid) {
      return res.status(400).json({ error: "validation_error", message: validation.error });
    }

    const id = crypto.randomUUID();
    const numero = await genererNumeroDocument(pool, type);
    const token_public = genererTokenPublic();

    const payload = {
      id,
      type,
      numero,
      client_id,
      chantier_id: rest.chantier_id || null,
      token_public,
      statut: "brouillon",
      lignes: JSON.stringify(lignes),
      pieces_jointes: JSON.stringify(rest.pieces_jointes || []),
      modes_paiement: JSON.stringify(rest.modes_paiement || ["virement", "cheque"]),
      date_emission: rest.date_emission || new Date().toISOString().split("T")[0],
      date_validite: rest.date_validite || null,
      date_echeance: rest.date_echeance || null,
      date_visite: rest.date_visite || null,
      date_debut_travaux: rest.date_debut_travaux || null,
      duree_estimee: rest.duree_estimee ?? null,
      duree_unite: rest.duree_unite || null,
      total_ht: rest.total_ht || 0,
      total_tva: rest.total_tva || 0,
      total_ttc: rest.total_ttc || 0,
      total_remise: rest.total_remise || 0,
      net_a_payer: rest.net_a_payer || rest.total_ttc || 0,
      tva_applicable: rest.tva_applicable ? 1 : 0,
      mention_tva: rest.mention_tva || "TVA non applicable, art. 293 B du CGI",
      remise_type: rest.remise_type || null,
      remise_valeur: rest.remise_valeur || 0,
      retenue_garantie_pct: rest.retenue_garantie_pct || 0,
      retenue_garantie_montant: rest.retenue_garantie_montant || 0,
      acompte_demande: rest.acompte_demande || 0,
      objet: rest.objet || null,
      notes_client: rest.notes_client || null,
      notes_internes: rest.notes_internes || null,
      conditions_paiement: rest.conditions_paiement || null,
    };

    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map(() => "?").join(",");

    await pool.query(
      `INSERT INTO documents (${columns.join(",")}) VALUES (${placeholders})`,
      values
    );

    // Récupérer le document créé avec les infos client complètes
    const [docs] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.prenom as client_prenom, c.email as client_email,
              c.telephone as client_telephone, c.adresse_ligne1 as client_adresse_ligne1,
              c.adresse_ligne2 as client_adresse_ligne2, c.code_postal as client_code_postal,
              c.ville as client_ville, c.pays as client_pays,
              c.siret as client_siret, c.type as client_type
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = ?`,
      [id]
    );

    const doc = docs[0];
    doc.lignes = parseJsonField(doc.lignes, []);
    doc.modes_paiement = parseJsonField(doc.modes_paiement, []);
    doc.client = {
      id: doc.client_id,
      nom: doc.client_nom,
      prenom: doc.client_prenom,
      email: doc.client_email,
      telephone: doc.client_telephone,
      adresse_ligne1: doc.client_adresse_ligne1,
      adresse_ligne2: doc.client_adresse_ligne2,
      code_postal: doc.client_code_postal,
      ville: doc.client_ville,
      pays: doc.client_pays,
      siret: doc.client_siret,
      type: doc.client_type,
    };

    res.json(doc);
  } catch (error) {
    console.error("Document create error:", error);
    res.status(500).json({ error: "document_error" });
  }
});

// Liste des documents avec infos client
app.get("/api/documents", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { type, statut, limit = 100 } = req.query;

    let sql = `
      SELECT d.*, c.nom as client_nom, c.email as client_email
      FROM documents d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.deleted_at IS NULL
    `;
    const params = [];

    if (type) {
      sql += " AND d.type = ?";
      params.push(type);
    }
    if (statut) {
      sql += " AND d.statut = ?";
      params.push(statut);
    }

    sql += " ORDER BY d.date_emission DESC, d.created_at DESC LIMIT ?";
    params.push(Math.min(Number(limit), 500));

    const [rows] = await pool.query(sql, params);

    const docs = rows.map((row) => ({
      ...row,
      lignes: parseJsonField(row.lignes, []),
      modes_paiement: parseJsonField(row.modes_paiement, []),
      pieces_jointes: parseJsonField(row.pieces_jointes, []),
    }));

    res.json(docs);
  } catch (error) {
    console.error("Document list error:", error);
    res.status(500).json({ error: "document_error" });
  }
});

// Export Excel des documents
app.get("/api/documents/export/excel", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { type, statut, dateDebut, dateFin } = req.query;

    let sql = `
      SELECT d.*, c.nom as client_nom, c.prenom as client_prenom, c.email as client_email
      FROM documents d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.deleted_at IS NULL
    `;
    const params = [];

    if (type && type !== "all") {
      sql += " AND d.type = ?";
      params.push(type);
    }
    if (statut && statut !== "all") {
      sql += " AND d.statut = ?";
      params.push(statut);
    }
    if (dateDebut) {
      sql += " AND d.date_emission >= ?";
      params.push(dateDebut);
    }
    if (dateFin) {
      sql += " AND d.date_emission <= ?";
      params.push(dateFin);
    }

    sql += " ORDER BY d.date_emission DESC, d.created_at DESC";

    const [rows] = await pool.query(sql, params);

    // Préparer les données pour Excel
    const excelData = rows.map((row) => {
      const lignes = parseJsonField(row.lignes, []);
      const lignesFacturables = lignes.filter(l => l.type === "ligne");
      const totalHT = lignesFacturables.reduce((sum, l) => {
        const base = (l.quantite || 0) * (l.prix_unitaire_ht || 0);
        const remise = l.remise_valeur > 0
          ? (l.remise_type === "pourcentage" ? base * l.remise_valeur / 100 : l.remise_valeur)
          : 0;
        return sum + (base - remise);
      }, 0);

      return {
        "Numéro": row.numero || "",
        "Type": row.type === "devis" ? "Devis" : row.type === "facture" ? "Facture" : "Avoir",
        "Statut": row.statut || "",
        "Date émission": row.date_emission ? formatDateFr(row.date_emission) : "",
        "Date échéance": row.date_echeance ? formatDateFr(row.date_echeance) : "",
        "Client": [row.client_nom, row.client_prenom].filter(Boolean).join(" "),
        "Email client": row.client_email || "",
        "Objet": row.objet || "",
        "Total HT": Math.round(totalHT * 100) / 100,
        "Total TTC": row.total_ttc || 0,
        "Nb lignes": lignesFacturables.length,
        "Conditions paiement": row.conditions_paiement || "",
        "Créé le": row.created_at ? formatDateFr(row.created_at) : "",
      };
    });

    // Créer le classeur Excel
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documents");

    // Ajuster la largeur des colonnes
    const colWidths = [
      { wch: 18 }, // Numéro
      { wch: 10 }, // Type
      { wch: 12 }, // Statut
      { wch: 12 }, // Date émission
      { wch: 12 }, // Date échéance
      { wch: 25 }, // Client
      { wch: 25 }, // Email
      { wch: 30 }, // Objet
      { wch: 12 }, // Total HT
      { wch: 12 }, // Total TTC
      { wch: 10 }, // Nb lignes
      { wch: 18 }, // Conditions
      { wch: 12 }, // Créé le
    ];
    ws["!cols"] = colWidths;

    // Générer le fichier en buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `documents_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Excel export error:", error);
    res.status(500).json({ error: "export_error", message: "Erreur lors de l'export Excel" });
  }
});

// Détail d'un document
app.get("/api/documents/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.prenom as client_prenom, c.email as client_email,
              c.telephone as client_telephone, c.adresse_ligne1 as client_adresse_ligne1,
              c.adresse_ligne2 as client_adresse_ligne2, c.code_postal as client_code_postal,
              c.ville as client_ville, c.pays as client_pays,
              c.siret as client_siret, c.type as client_type
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = rows[0];
    doc.lignes = parseJsonField(doc.lignes, []);
    doc.modes_paiement = parseJsonField(doc.modes_paiement, []);
    doc.pieces_jointes = parseJsonField(doc.pieces_jointes, []);
    doc.client = {
      id: doc.client_id,
      nom: doc.client_nom,
      prenom: doc.client_prenom,
      email: doc.client_email,
      telephone: doc.client_telephone,
      adresse_ligne1: doc.client_adresse_ligne1,
      adresse_ligne2: doc.client_adresse_ligne2,
      code_postal: doc.client_code_postal,
      ville: doc.client_ville,
      pays: doc.client_pays,
      siret: doc.client_siret,
      type: doc.client_type,
    };

    res.json(doc);
  } catch (error) {
    console.error("Document get error:", error);
    res.status(500).json({ error: "document_error" });
  }
});

// Mettre à jour un document

// Preview PDF (sans sauvegarde)
app.post("/api/documents/preview", requireAdmin, async (req, res) => {
  try {
    const doc = buildPreviewDocument(req.body || {});
    const pdfBuffer = await renderPdfBuffer(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=preview.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Document preview PDF error:", error);
    res.status(500).json({ error: "pdf_preview_error" });
  }
});

// PDF d'un document
app.get("/api/documents/:id/pdf", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.prenom as client_prenom, c.email as client_email,
              c.telephone as client_telephone, c.adresse_ligne1 as client_adresse_ligne1,
              c.adresse_ligne2 as client_adresse_ligne2, c.code_postal as client_code_postal,
              c.ville as client_ville, c.pays as client_pays
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = rows[0];
    doc.lignes = parseJsonField(doc.lignes, []);
    doc.modes_paiement = parseJsonField(doc.modes_paiement, []);

    const pdfBuffer = await renderPdfBuffer(doc);

    const disposition = req.query.inline === "1" ? "inline" : "attachment";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename=${doc.numero || "document"}.pdf`
    );
    res.send(pdfBuffer);

    await pool.query("UPDATE documents SET pdf_generated_at = NOW() WHERE id = ?", [doc.id]);
  } catch (error) {
    console.error("Document PDF error:", error);
    res.status(500).json({ error: "pdf_error" });
  }
});

// Pieces jointes
app.post("/api/documents/:id/pieces-jointes", requireAdmin, documentUpload.array("files", 10), async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
  if (!files.length) {
    return res.status(400).json({ error: "file_missing" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT pieces_jointes FROM documents WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const existing = parseJsonField(rows[0].pieces_jointes, []);
    const uploaded = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.originalname,
      url: `${baseUrl}/uploads/documents/${req.params.id}/${file.filename}`,
      size: file.size,
      type: file.mimetype,
      storage_name: file.filename,
      uploaded_at: new Date().toISOString(),
    }));

    const updated = [...existing, ...uploaded];
    await pool.query(
      "UPDATE documents SET pieces_jointes = ? WHERE id = ?",
      [JSON.stringify(updated), req.params.id]
    );

    res.json({ pieces_jointes: updated });
  } catch (error) {
    console.error("Document attachment error:", error);
    res.status(500).json({ error: "upload_error" });
  }
});

app.put("/api/documents/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    // Vérifier que le document existe et son statut
    const [existing] = await pool.query(
      "SELECT id, statut, numero FROM documents WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const currentDoc = existing[0];

    const { lignes, modes_paiement, ...rest } = req.body;

    const updates = { ...rest };
    if (lignes) updates.lignes = JSON.stringify(lignes);
    if (modes_paiement) updates.modes_paiement = JSON.stringify(modes_paiement);
    if (updates.pieces_jointes !== undefined) {
      updates.pieces_jointes = JSON.stringify(updates.pieces_jointes);
    }
    if (updates.tva_applicable !== undefined) updates.tva_applicable = updates.tva_applicable ? 1 : 0;

    const columns = Object.keys(updates);
    if (columns.length === 0) {
      return res.status(400).json({ error: "no_updates" });
    }

    const values = Object.values(updates);
    const sets = columns.map((col) => `${col} = ?`).join(", ");

    await pool.query(`UPDATE documents SET ${sets} WHERE id = ?`, [...values, req.params.id]);

    // Log audit si changement de statut
    if (req.body.statut && req.body.statut !== currentDoc.statut) {
      await pool.query(
        `INSERT INTO audit_logs (id, action, entity_type, entity_id, metadata, created_at)
         VALUES (?, 'STATUS_CHANGE', 'document', ?, ?, NOW())`,
        [
          crypto.randomUUID(),
          req.params.id,
          JSON.stringify({
            old_status: currentDoc.statut,
            new_status: req.body.statut,
            numero: currentDoc.numero
          })
        ]
      );
    }

    // Retourner le document mis à jour avec infos client complètes
    const [rows] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.email as client_email, c.telephone as client_telephone,
              c.adresse_ligne1 as client_adresse, c.code_postal as client_cp, c.ville as client_ville,
              c.siret as client_siret, c.type as client_type
       FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = rows[0];
    doc.lignes = parseJsonField(doc.lignes, []);
    doc.modes_paiement = parseJsonField(doc.modes_paiement, []);
    doc.pieces_jointes = parseJsonField(doc.pieces_jointes, []);
    doc.client = {
      id: doc.client_id,
      nom: doc.client_nom,
      email: doc.client_email,
      telephone: doc.client_telephone,
      adresse_ligne1: doc.client_adresse,
      code_postal: doc.client_cp,
      ville: doc.client_ville,
      siret: doc.client_siret,
      type: doc.client_type,
    };

    res.json(doc);
  } catch (error) {
    console.error("Document update error:", error);
    res.status(500).json({ error: "document_error" });
  }
});

// Supprimer un document (soft delete)
app.delete("/api/documents/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    // Récupérer le document
    const [docs] = await pool.query(
      "SELECT id, statut, numero, type FROM documents WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );

    if (docs.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = docs[0];

    // Seuls les brouillons peuvent être supprimés
    if (doc.statut !== "brouillon") {
      return res.status(403).json({
        error: "document_not_deletable",
        message: `Seuls les brouillons peuvent être supprimés. Ce document a le statut "${doc.statut}".`,
        statut_actuel: doc.statut,
        solution: "Pour supprimer ce document, changez d'abord son statut en brouillon ou archivez-le."
      });
    }

    // Soft delete
    await pool.query(
      "UPDATE documents SET deleted_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, 'DELETE', 'document', ?, ?, NOW())`,
      [
        crypto.randomUUID(),
        req.params.id,
        JSON.stringify({
          numero: doc.numero,
          type: doc.type,
          statut: doc.statut
        })
      ]
    );

    res.json({ success: true, message: "Document supprimé" });
  } catch (error) {
    console.error("Document delete error:", error);
    res.status(500).json({ error: "document_error" });
  }
});

// Convertir un devis en facture
app.post("/api/documents/:id/convertir", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [docs] = await pool.query(
      "SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );

    if (docs.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const source = docs[0];

    // Vérifier que c'est un devis accepté
    if (source.type !== "devis") {
      return res.status(400).json({
        error: "invalid_document_type",
        message: "Seuls les devis peuvent être convertis en facture."
      });
    }

    // Créer la facture
    const newId = crypto.randomUUID();
    const numero = await genererNumeroDocument(pool, "facture");
    const token_public = genererTokenPublic();

    const lignesValue = ensureJsonString(source.lignes, []);
    const modesPaiementValue = ensureJsonString(source.modes_paiement, []);
    const [devisSourceRows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documents'
         AND COLUMN_NAME = 'devis_source_id'`
    );
    const hasDevisSource = devisSourceRows.length > 0;

    const devisSourceColumn = hasDevisSource ? ", devis_source_id" : "";
    const devisSourcePlaceholder = hasDevisSource ? ", ?" : "";

    const values = [
      newId,
      numero,
      source.client_id,
      source.chantier_id,
      source.date_visite,
      source.date_debut_travaux,
      source.duree_estimee,
      source.duree_unite,
      source.tva_applicable,
      source.mention_tva,
      source.conditions_paiement,
      modesPaiementValue,
      lignesValue,
      source.notes_client,
      `Facture issue du devis ${source.numero}`,
      source.objet,
      source.total_ht,
      source.total_tva,
      source.total_ttc,
      source.total_remise,
      source.remise_type,
      source.remise_valeur,
      source.retenue_garantie_pct,
      source.retenue_garantie_montant,
      source.net_a_payer,
      token_public,
    ];

    if (hasDevisSource) {
      values.push(req.params.id);
    }

    await pool.query(
      `INSERT INTO documents (id, type, numero, client_id, chantier_id, date_emission, date_echeance,
        date_visite, date_debut_travaux, duree_estimee, duree_unite,
        tva_applicable, mention_tva, conditions_paiement, modes_paiement, lignes, pieces_jointes,
        notes_client, notes_internes, objet, total_ht, total_tva, total_ttc, total_remise,
        remise_type, remise_valeur, retenue_garantie_pct, retenue_garantie_montant, net_a_payer,
        token_public, statut${devisSourceColumn})
       VALUES (?, 'facture', ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, JSON_ARRAY(),
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, 'brouillon'${devisSourcePlaceholder})`,
      values
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, 'CONVERT_TO_INVOICE', 'document', ?, ?, NOW())`,
      [
        crypto.randomUUID(),
        newId,
        JSON.stringify({
          devis_id: req.params.id,
          devis_numero: source.numero,
          facture_numero: numero
        })
      ]
    );

    // Récupérer la facture créée
    const [newDocs] = await pool.query(
      `SELECT d.*, c.nom as client_nom
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = ?`,
      [newId]
    );

    const facture = newDocs[0];
    facture.lignes = parseJsonField(facture.lignes, []);
    facture.modes_paiement = parseJsonField(facture.modes_paiement, []);
    facture.pieces_jointes = parseJsonField(facture.pieces_jointes, []);

    res.json({
      success: true,
      message: `Facture ${numero} créée à partir du devis ${source.numero}`,
      facture
    });
  } catch (error) {
    console.error("Document conversion error:", error);
    res.status(500).json({
      error: "document_error",
      message: error?.message || "Erreur lors de la conversion",
    });
  }
});

// Dupliquer un document
app.post("/api/documents/:id/dupliquer", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [docs] = await pool.query("SELECT * FROM documents WHERE id = ?", [req.params.id]);
    if (docs.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const source = docs[0];
    const newType = req.body.type || source.type;
    const newId = crypto.randomUUID();
    const numero = await genererNumeroDocument(pool, newType);
    const token_public = genererTokenPublic();

    await pool.query(
      `INSERT INTO documents (id, type, numero, client_id, chantier_id, date_emission, date_validite,
        date_visite, date_debut_travaux, duree_estimee, duree_unite,
        tva_applicable, mention_tva, conditions_paiement, modes_paiement, lignes, pieces_jointes,
        notes_client, objet, total_ht, total_tva, total_ttc, total_remise,
        retenue_garantie_pct, retenue_garantie_montant, net_a_payer,
        token_public, statut)
       SELECT ?, ?, ?, client_id, chantier_id, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
        date_visite, date_debut_travaux, duree_estimee, duree_unite,
        tva_applicable, mention_tva, conditions_paiement, modes_paiement, lignes, JSON_ARRAY(),
        notes_client, objet, total_ht, total_tva, total_ttc, total_remise,
        retenue_garantie_pct, retenue_garantie_montant, net_a_payer,
        ?, 'brouillon'
       FROM documents WHERE id = ?`,
      [newId, newType, numero, token_public, req.params.id]
    );

    res.json({ id: newId, numero });
  } catch (error) {
    console.error("Document duplicate error:", error);
    res.status(500).json({ error: "document_error" });
  }
});

// Envoyer un document par email
app.post("/api/documents/:id/envoyer", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [docs] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.email as client_email
       FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = ?`,
      [req.params.id]
    );

    if (docs.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = docs[0];
    const destinataire = req.body.email || doc.client_email;

    if (!destinataire) {
      return res.status(400).json({ error: "email_required" });
    }

    const typeLabel = doc.type === "devis" ? "Devis" : doc.type === "facture" ? "Facture" : "Avoir";
    const lienPublic = `${process.env.PUBLIC_BASE_URL || "http://localhost:5173"}/documents/${doc.token_public}`;

    // Construire l'email
    const sujet = `${typeLabel} n°${doc.numero} - Thomas Bonnardel`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e5a8a;">${typeLabel} n°${doc.numero}</h2>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-joint votre ${typeLabel.toLowerCase()} d'un montant de <strong>${doc.net_a_payer} €</strong>.</p>
        <p>Vous pouvez consulter ce document en ligne :</p>
        <p style="text-align: center;">
          <a href="${lienPublic}" style="display: inline-block; padding: 12px 24px; background: #1e5a8a; color: white; text-decoration: none; border-radius: 4px;">
            Voir le ${typeLabel.toLowerCase()}
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          Thomas Bonnardel - Design & Rénovation<br>
          944 Chemin de Tardinaou, 13190 Allauch<br>
          06 95 07 10 84
        </p>
      </div>
    `;

    // Envoyer l'email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: sujet,
      html,
    });

    // Mettre à jour le statut si brouillon
    if (doc.statut === "brouillon") {
      await pool.query("UPDATE documents SET statut = 'envoye' WHERE id = ?", [req.params.id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Document send error:", error);
    res.status(500).json({ error: "send_error" });
  }
});

// === APPEARANCE CONFIG ===

const DEFAULT_APPEARANCE = {
  primaryColor: "#1a5490",
  secondaryColor: "#e5e7eb",
  font: "Helvetica",
  baseFontSize: 9,
  lineHeight: 1.3,
  headerStyle: "ultra",
  clientPosition: "right",
  tableStyle: "minimal",
  borderWidth: 0.5,
  borderRadius: 8,
  cellPadding: 5,
  pageMargin: 42,
  sectionSpacing: 16,
  hide: {},
  columns: {
    showNumero: true,
    showQuantite: true,
    showUnite: true,
    showPrixUnitaire: true,
    showTva: false,
  },
  showSignatureBox: true,
  showPaymentMethods: true,
  showConditions: true,
  showFooter: true,
  showPageNumbers: true,
  showDraftWatermark: true,
  showDocumentBorder: true,
  compactMode: false,
  showSectionSubtotals: false,
};

// Récupérer la config d'apparence
app.get("/api/appearance-config", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { document_id } = req.query;
    const user_id = "default"; // À remplacer par req.admin.id quand auth complète

    // Chercher config spécifique au document
    if (document_id) {
      const [rows] = await pool.query(
        "SELECT config FROM appearance_configs WHERE user_id = ? AND document_id = ?",
        [user_id, document_id]
      );
      if (rows.length > 0) {
        return res.json(parseJsonField(rows[0].config, DEFAULT_APPEARANCE));
      }
    }

    // Sinon config par défaut de l'utilisateur
    const [defaultRows] = await pool.query(
      "SELECT config FROM appearance_configs WHERE user_id = ? AND document_id IS NULL",
      [user_id]
    );

    if (defaultRows.length > 0) {
      return res.json(parseJsonField(defaultRows[0].config, DEFAULT_APPEARANCE));
    }

    res.json(DEFAULT_APPEARANCE);
  } catch (error) {
    console.error("Appearance config get error:", error);
    res.status(500).json({ error: "config_error" });
  }
});

// Sauvegarder la config d'apparence
app.put("/api/appearance-config", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { document_id, config } = req.body;
    const user_id = "default"; // À remplacer par req.admin.id quand auth complète

    if (!config) {
      return res.status(400).json({ error: "config_required" });
    }

    const id = crypto.randomUUID();
    const configJson = JSON.stringify(config);

    // Upsert
    await pool.query(
      `INSERT INTO appearance_configs (id, user_id, document_id, config, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = NOW()`,
      [id, user_id, document_id || null, configJson]
    );

    res.json({ success: true, config });
  } catch (error) {
    console.error("Appearance config save error:", error);
    res.status(500).json({ error: "config_error" });
  }
});

// === PAIEMENTS ===

// Liste des paiements (tous ou par document)
app.get("/api/paiements", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { document_id, limit = 100 } = req.query;

    let sql = `
      SELECT p.*, d.numero as document_numero, d.type as document_type, c.nom as client_nom
      FROM paiements p
      LEFT JOIN documents d ON p.document_id = d.id
      LEFT JOIN clients c ON d.client_id = c.id
    `;
    const params = [];

    if (document_id) {
      sql += " WHERE p.document_id = ?";
      params.push(document_id);
    }

    sql += " ORDER BY p.date_paiement DESC, p.created_at DESC LIMIT ?";
    params.push(Math.min(Number(limit), 500));

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Paiements list error:", error);
    res.status(500).json({ error: "paiements_error" });
  }
});

// Créer un paiement
app.post("/api/paiements", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { document_id, montant, date_paiement, mode, reference, notes } = req.body;

    if (!document_id || !montant || !date_paiement) {
      return res.status(400).json({ error: "missing_fields", required: ["document_id", "montant", "date_paiement"] });
    }

    // Vérifier que le document existe et est une facture
    const [docs] = await pool.query(
      "SELECT id, type, statut, net_a_payer, numero FROM documents WHERE id = ? AND deleted_at IS NULL",
      [document_id]
    );

    if (docs.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = docs[0];
    if (doc.type !== "facture") {
      return res.status(400).json({ error: "invalid_document_type", message: "Les paiements ne peuvent être enregistrés que sur des factures." });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO paiements (id, document_id, montant, date_paiement, mode, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, document_id, montant, date_paiement, mode || null, reference || null, notes || null]
    );

    // Calculer le total des paiements et mettre à jour le statut
    const [paiements] = await pool.query(
      "SELECT SUM(montant) as total FROM paiements WHERE document_id = ?",
      [document_id]
    );

    const totalPaye = Number(paiements[0].total) || 0;
    const resteAPayer = Number(doc.net_a_payer) - totalPaye;
    let nouveauStatut = doc.statut;

    if (resteAPayer <= 0) {
      nouveauStatut = "paye";
    } else if (totalPaye > 0) {
      nouveauStatut = "paye_partiel";
    }

    if (nouveauStatut !== doc.statut) {
      await pool.query("UPDATE documents SET statut = ? WHERE id = ?", [nouveauStatut, document_id]);
    }

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, 'CREATE_PAYMENT', 'paiement', ?, ?, NOW())`,
      [
        crypto.randomUUID(),
        id,
        JSON.stringify({
          document_id,
          document_numero: doc.numero,
          montant,
          total_paye: totalPaye,
          reste_a_payer: resteAPayer,
          nouveau_statut: nouveauStatut
        })
      ]
    );

    const [newPaiement] = await pool.query("SELECT * FROM paiements WHERE id = ?", [id]);
    res.json({
      ...newPaiement[0],
      total_paye: totalPaye,
      reste_a_payer: Math.max(0, resteAPayer),
      statut_document: nouveauStatut
    });
  } catch (error) {
    console.error("Paiement create error:", error);
    res.status(500).json({ error: "paiements_error" });
  }
});

// Supprimer un paiement
app.delete("/api/paiements/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [paiements] = await pool.query("SELECT * FROM paiements WHERE id = ?", [req.params.id]);

    if (paiements.length === 0) {
      return res.status(404).json({ error: "paiement_not_found" });
    }

    const paiement = paiements[0];
    const document_id = paiement.document_id;

    // Supprimer le paiement
    await pool.query("DELETE FROM paiements WHERE id = ?", [req.params.id]);

    // Recalculer le statut du document
    const [docs] = await pool.query("SELECT net_a_payer, numero FROM documents WHERE id = ?", [document_id]);
    const [restePaiements] = await pool.query("SELECT SUM(montant) as total FROM paiements WHERE document_id = ?", [document_id]);

    const totalPaye = Number(restePaiements[0].total) || 0;
    const resteAPayer = Number(docs[0].net_a_payer) - totalPaye;
    let nouveauStatut = "envoye";

    if (resteAPayer <= 0 && totalPaye > 0) {
      nouveauStatut = "paye";
    } else if (totalPaye > 0) {
      nouveauStatut = "paye_partiel";
    }

    await pool.query("UPDATE documents SET statut = ? WHERE id = ?", [nouveauStatut, document_id]);

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, 'DELETE_PAYMENT', 'paiement', ?, ?, NOW())`,
      [
        crypto.randomUUID(),
        req.params.id,
        JSON.stringify({
          document_id,
          document_numero: docs[0].numero,
          montant_supprime: paiement.montant,
          nouveau_total_paye: totalPaye,
          nouveau_statut: nouveauStatut
        })
      ]
    );

    res.json({ success: true, statut_document: nouveauStatut, total_paye: totalPaye, reste_a_payer: Math.max(0, resteAPayer) });
  } catch (error) {
    console.error("Paiement delete error:", error);
    res.status(500).json({ error: "paiements_error" });
  }
});

// Résumé paiements d'un document
app.get("/api/documents/:id/paiements", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [docs] = await pool.query(
      "SELECT net_a_payer, total_ttc FROM documents WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );

    if (docs.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const [paiements] = await pool.query(
      "SELECT * FROM paiements WHERE document_id = ? ORDER BY date_paiement ASC",
      [req.params.id]
    );

    const totalPaye = paiements.reduce((sum, p) => sum + Number(p.montant), 0);
    const resteAPayer = Number(docs[0].net_a_payer) - totalPaye;

    res.json({
      paiements,
      total_paye: totalPaye,
      reste_a_payer: Math.max(0, resteAPayer),
      net_a_payer: Number(docs[0].net_a_payer),
      est_solde: resteAPayer <= 0
    });
  } catch (error) {
    console.error("Document paiements error:", error);
    res.status(500).json({ error: "paiements_error" });
  }
});

// === FIN DOCUMENTS ===

// ============================================
// CALENDAR API ENDPOINTS
// ============================================

// GET /api/calendar/events - Liste les événements avec données clients
app.get("/api/calendar/events", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { start, end } = req.query;
    const timeMin = start ? new Date(start) : new Date();
    const timeMax = end ? new Date(end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Fetch from local DB with client info
    const [localEvents] = await pool.query(`
      SELECT e.*,
             c.nom as client_nom,
             c.prenom as client_prenom,
             c.telephone as client_telephone,
             c.email as client_email
      FROM events e
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.start >= ? AND e.start <= ?
      ORDER BY e.start
    `, [timeMin.toISOString().slice(0, 19).replace('T', ' '),
        timeMax.toISOString().slice(0, 19).replace('T', ' ')]);

    // Also fetch from Google Calendar
    const googleEvents = await googleCalendarService.listEvents(timeMin, timeMax);

    res.json({
      localEvents,
      googleEvents: googleEvents.map(ge => ({
        id: ge.id,
        title: ge.summary,
        description: ge.description,
        start: ge.start?.dateTime || ge.start?.date,
        end: ge.end?.dateTime || ge.end?.date,
        location: ge.location,
        isGoogleOnly: true
      }))
    });
  } catch (error) {
    console.error("Calendar events error:", error);
    res.status(500).json({ error: "calendar_error", message: error.message });
  }
});

// POST /api/calendar/events - Créer un événement (sync Google)
app.post("/api/calendar/events", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { title, description, start, end, color, client_id, type, location } = req.body;

    if (!title || !start) {
      return res.status(400).json({ error: "validation_error", message: "title et start requis" });
    }

    // Build description with client info if linked
    let fullDescription = description || '';
    let eventLocation = location || '';

    if (client_id) {
      const [clients] = await pool.query('SELECT * FROM clients WHERE id = ?', [client_id]);
      if (clients[0]) {
        const clientInfo = clients[0];
        fullDescription = `Client: ${clientInfo.prenom || ''} ${clientInfo.nom}\n` +
          `Tel: ${clientInfo.telephone || 'N/A'}\n` +
          `Email: ${clientInfo.email || 'N/A'}\n\n${description || ''}`;

        if (!eventLocation && clientInfo.adresse) {
          eventLocation = `${clientInfo.adresse}, ${clientInfo.code_postal || ''} ${clientInfo.ville || ''}`.trim();
        }
      }
    }

    const eventEnd = end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();

    // Create on Google Calendar
    let googleEventId = null;
    try {
      const googleEvent = await googleCalendarService.createEvent({
        title,
        description: fullDescription,
        start,
        end: eventEnd,
        location: eventLocation,
      });
      googleEventId = googleEvent?.id || null;
    } catch (gcError) {
      console.warn("Google Calendar sync failed:", gcError.message);
      // Continue without Google sync
    }

    // Save to local DB
    const id = crypto.randomUUID();
    await pool.query(`
      INSERT INTO events (id, title, description, start, end, color, client_id, type, location, google_event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, title, description || null, start, eventEnd, color || null, client_id || null, type || 'autre', eventLocation || null, googleEventId]);

    res.json({ id, google_event_id: googleEventId, synced: !!googleEventId });
  } catch (error) {
    console.error("Create calendar event error:", error);
    res.status(500).json({ error: "calendar_error", message: error.message });
  }
});

// PUT /api/calendar/events/:id - Modifier un événement (sync Google)
app.put("/api/calendar/events/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { id } = req.params;
    const { title, description, start, end, color, client_id, type, location } = req.body;

    // Get existing event
    const [events] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
    if (!events[0]) {
      return res.status(404).json({ error: "event_not_found" });
    }

    const existingEvent = events[0];

    // Build update fields
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (start !== undefined) updates.start = start;
    if (end !== undefined) updates.end = end;
    if (color !== undefined) updates.color = color;
    if (client_id !== undefined) updates.client_id = client_id;
    if (type !== undefined) updates.type = type;
    if (location !== undefined) updates.location = location;

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true, message: "No changes" });
    }

    // Update local DB
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    await pool.query(`UPDATE events SET ${setClauses} WHERE id = ?`, [...values, id]);

    // Sync to Google Calendar if linked
    if (existingEvent.google_event_id) {
      try {
        await googleCalendarService.updateEvent(existingEvent.google_event_id, {
          title: title || existingEvent.title,
          description: description || existingEvent.description,
          start: start || existingEvent.start,
          end: end || existingEvent.end,
          location: location || existingEvent.location,
        });
      } catch (gcError) {
        console.warn("Google Calendar update sync failed:", gcError.message);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update calendar event error:", error);
    res.status(500).json({ error: "calendar_error", message: error.message });
  }
});

// DELETE /api/calendar/events/:id - Supprimer un événement (sync Google)
app.delete("/api/calendar/events/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { id } = req.params;

    // Get event to find Google ID
    const [events] = await pool.query('SELECT google_event_id FROM events WHERE id = ?', [id]);
    if (!events[0]) {
      return res.status(404).json({ error: "event_not_found" });
    }

    // Delete from Google Calendar
    if (events[0].google_event_id) {
      try {
        await googleCalendarService.deleteEvent(events[0].google_event_id);
      } catch (gcError) {
        console.warn("Google Calendar delete sync failed:", gcError.message);
      }
    }

    // Delete from local DB
    await pool.query('DELETE FROM events WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete calendar event error:", error);
    res.status(500).json({ error: "calendar_error", message: error.message });
  }
});

// === FIN CALENDAR ===

app.use(optionalAuth);

app.get("/api/:entity", async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const isAdmin = Boolean(req.admin);
  if (!config.public && !isAdmin) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const { filters, values } = buildFilters(req.query, config, isAdmin);
  const sortKey = config.columns.includes(req.query.sort) ? req.query.sort : config.defaultSort;
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : null;

  let sql = `SELECT * FROM ${config.table}`;
  if (filters.length) {
    sql += ` WHERE ${filters.join(" AND ")}`;
  }
  if (sortKey) {
    sql += ` ORDER BY ${sortKey} ASC`;
  }
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  try {
    const [rows] = await pool.query(sql, values);
    const data = rows.map((row) => parseRow(row, config));
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/:entity", requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const payload = sanitizePayload(req.body || {}, config);
  const id = payload.id || crypto.randomUUID();
  payload.id = id;

  const columns = Object.keys(payload);
  const values = columns.map((key) => normalizeValue(payload[key], config, key));
  const placeholders = columns.map(() => "?").join(",");

  try {
    await pool.query(`INSERT INTO ${config.table} (${columns.join(",")}) VALUES (${placeholders})`, values);
    const created = await pool.query(`SELECT * FROM ${config.table} WHERE id = ?`, [id]);
    const row = created[0][0];
    res.json(parseRow(row, config));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

app.put("/api/:entity/:id", requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const payload = sanitizePayload(req.body || {}, config);
  const columns = Object.keys(payload);
  if (!columns.length) {
    return res.status(400).json({ error: "no_updates" });
  }

  const values = columns.map((key) => normalizeValue(payload[key], config, key));
  const sets = columns.map((key) => `${key} = ?`).join(", ");

  try {
    await pool.query(`UPDATE ${config.table} SET ${sets} WHERE id = ?`, [...values, req.params.id]);
    const updated = await pool.query(`SELECT * FROM ${config.table} WHERE id = ?`, [req.params.id]);
    const row = updated[0][0];
    res.json(parseRow(row, config));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/api/:entity/:id", requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    await pool.query(`DELETE FROM ${config.table} WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initDb();
  console.log(`API server running on http://localhost:${PORT}`);
});
