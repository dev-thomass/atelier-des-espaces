import express from "express";
import "dotenv/config";
import mysql from "mysql2/promise";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import multer from "multer";
import nodemailer from "nodemailer";
import PdfPrinter from "pdfmake";

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

const formatDateFr = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("fr-FR");
};

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value) || 0);

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

// Helper to lighten a color
const lightenColor = (hex, percent) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent));
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

const buildDocumentPdfDefinition = (doc) => {
  // Extract appearance options
  const appearance = doc.appearance || {};
  const PDF_BLUE = appearance.primaryColor || DEFAULT_PDF_BLUE;
  const PDF_BLUE_LIGHT = lightenColor(PDF_BLUE, 0.92);
  const PDF_BORDER = lightenColor(PDF_BLUE, 0.65);
  const PDF_GRAY = DEFAULT_PDF_GRAY;
  const PDF_TEXT = DEFAULT_PDF_TEXT;
  const pdfFont = appearance.font || "Helvetica";
  const fontSizeMultiplier = appearance.fontSize === "large" ? 1.1 : 1;
  const tableStyle = appearance.tableStyle || "striped";
  const hideOptions = appearance.hide || {};
  const showSectionSubtotals = appearance.showSectionSubtotals !== false;

  const typeLabel = doc.type === "devis" ? "Devis" : doc.type === "facture" ? "Facture" : "Avoir";
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
  const dateEmission = formatDateFr(doc.date_emission) || "-";
  const dateValidite = doc.date_validite ? formatDateFr(doc.date_validite) : "";
  const dateEcheance = doc.date_echeance ? formatDateFr(doc.date_echeance) : "";
  const modesPaiement = Array.isArray(doc.modes_paiement) ? doc.modes_paiement : [];
  const modesLabels = { virement: "Virement", cheque: "Chèque", especes: "Espèces", cb: "CB" };
  const modesPaiementText = modesPaiement.map((m) => modesLabels[m] || m).filter(Boolean).join(", ") || "Virement";

  // Build table body
  const tableBody = [[
    { text: "N°", style: "tHead", alignment: "center" },
    { text: "Désignation", style: "tHead" },
    { text: "Qté", style: "tHead", alignment: "center" },
    { text: "P.U. HT", style: "tHead", alignment: "right" },
    { text: "Total HT", style: "tHead", alignment: "right" },
  ]];

  const sectionTotals = [];
  let currentSection = null;
  let sectionSum = 0;

  numberedLignes.forEach((ligne, idx) => {
    const num = ligne.numero_affiche || "";

    if (ligne.type === "section") {
      if (currentSection && sectionSum > 0) {
        sectionTotals.push({ name: currentSection, total: sectionSum, afterRow: tableBody.length - 1 });
      }
      currentSection = ligne.designation || "Section";
      sectionSum = 0;
      tableBody.push([
        { text: num, style: "sectionCell", alignment: "center" },
        { text: currentSection, style: "sectionCell", colSpan: 4 },
        {}, {}, {},
      ]);
      return;
    }

    if (ligne.type === "entete") {
      tableBody.push([
        { text: "" },
        { text: (ligne.designation || "").toUpperCase(), fontSize: 7, bold: true, color: PDF_GRAY, colSpan: 4 },
        {}, {}, {},
      ]);
      return;
    }

    if (ligne.type === "texte") {
      tableBody.push([
        { text: "" },
        { text: ligne.designation || "", colSpan: 4, italics: true, color: PDF_GRAY, fontSize: 8 },
        {}, {}, {},
      ]);
      return;
    }

    if (ligne.type === "sous_total") {
      const st = calculerSousTotalAvantIndex(numberedLignes, idx);
      tableBody.push([
        { text: "" },
        { text: "" },
        { text: "" },
        { text: ligne.designation || "Sous-total", alignment: "right", fontSize: 8, bold: true },
        { text: formatMoney(st), alignment: "right", fontSize: 8, bold: true, fillColor: PDF_BLUE_LIGHT },
      ]);
      return;
    }

    // Regular line
    const qte = ligne.quantite || 0;
    const unite = ligne.unite || "";
    const pu = ligne.prix_unitaire_ht || 0;
    const tot = calculerLigneTotal(ligne);
    sectionSum += tot;

    const qteText = unite ? `${qte} ${unite}` : String(qte);
    const designation = ligne.description
      ? { stack: [{ text: ligne.designation || "" }, { text: ligne.description, fontSize: 7, color: PDF_GRAY, margin: [0, 1, 0, 0] }] }
      : { text: ligne.designation || "" };

    tableBody.push([
      { text: num, alignment: "center", color: PDF_GRAY, fontSize: 8 },
      designation,
      { text: qteText, alignment: "center", fontSize: 8 },
      { text: formatMoney(pu), alignment: "right", fontSize: 8 },
      { text: formatMoney(tot), alignment: "right", fontSize: 8 },
    ]);
  });

  // Last section total
  if (currentSection && sectionSum > 0) {
    sectionTotals.push({ name: currentSection, total: sectionSum, afterRow: tableBody.length - 1 });
  }

  // Insert section totals if enabled
  if (showSectionSubtotals) {
    sectionTotals.reverse().forEach((st) => {
      tableBody.splice(st.afterRow + 1, 0, [
        { text: "", border: [false, false, false, false] },
        { text: "", border: [false, false, false, false] },
        { text: "", border: [false, false, false, false] },
        { text: `${st.name} :`, alignment: "right", fontSize: 8, bold: true, border: [false, false, false, false] },
        { text: formatMoney(st.total), alignment: "right", fontSize: 8, bold: true, fillColor: PDF_BLUE_LIGHT, border: [false, false, false, false] },
      ]);
    });
  }

  // Build company info
  const companyInfo = [];
  if (!hideOptions.companyName) companyInfo.push({ text: "Thomas Bonnardel", fontSize: 14, bold: true, color: PDF_BLUE });
  if (!hideOptions.companyActivity) companyInfo.push({ text: "Design - Rénovation", fontSize: 8, color: PDF_GRAY });
  if (!hideOptions.companyAddress) companyInfo.push({ text: "944 Chemin de Tardinaou, 13190 Allauch", fontSize: 8, color: PDF_GRAY });
  const contactParts = [];
  if (!hideOptions.companyPhone) contactParts.push("06 95 07 10 84");
  if (!hideOptions.companyEmail) contactParts.push("thomasromeo.bonnardel@gmail.com");
  if (contactParts.length) companyInfo.push({ text: contactParts.join(" • "), fontSize: 8, color: PDF_TEXT, margin: [0, 3, 0, 0] });
  if (!hideOptions.companySiren) companyInfo.push({ text: "SIREN 992 454 694", fontSize: 7, color: PDF_GRAY });

  // Table layout
  const getTableLayout = () => {
    const base = {
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    };
    switch (tableStyle) {
      case "horizontal":
        return { ...base, hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length) ? 0.5 : 0.2, vLineWidth: () => 0, hLineColor: () => PDF_BORDER };
      case "vertical":
        return { ...base, hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0.5, hLineColor: () => PDF_BORDER, vLineColor: () => PDF_BORDER };
      case "rounded":
        return { ...base, hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length) ? 0.5 : 0.2, vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 0.5 : 0, hLineColor: () => PDF_BORDER, vLineColor: () => PDF_BORDER };
      default: // striped
        return { ...base, hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0, hLineColor: () => PDF_BORDER, fillColor: (i) => (i > 0 && i % 2 === 0) ? "#f8f9fa" : null };
    }
  };

  // Build totals rows
  const totalsRows = [];
  totalsRows.push([{ text: "Total HT", fontSize: 8 }, { text: formatMoney(totalHt), fontSize: 8, bold: true, alignment: "right" }]);
  if (totalRemise > 0) totalsRows.push([{ text: "Remise", fontSize: 8 }, { text: `- ${formatMoney(totalRemise)}`, fontSize: 8, alignment: "right" }]);
  if (doc.tva_applicable && totalTva > 0) totalsRows.push([{ text: "TVA", fontSize: 8 }, { text: formatMoney(totalTva), fontSize: 8, alignment: "right" }]);
  if (totalTtc !== totalHt) totalsRows.push([{ text: "Total TTC", fontSize: 8 }, { text: formatMoney(totalTtc), fontSize: 8, bold: true, alignment: "right" }]);
  if (retenue > 0) totalsRows.push([{ text: "Retenue garantie", fontSize: 8 }, { text: `- ${formatMoney(retenue)}`, fontSize: 8, alignment: "right" }]);

  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: pdfFont, fontSize: Math.round(9 * fontSizeMultiplier), color: PDF_TEXT, lineHeight: 1.2 },
    styles: {
      tHead: { bold: true, fontSize: Math.round(8 * fontSizeMultiplier), color: "white", fillColor: PDF_BLUE },
      sectionCell: { fillColor: PDF_BLUE_LIGHT, bold: true, fontSize: Math.round(9 * fontSizeMultiplier), color: PDF_BLUE },
    },
    content: [
      // Header
      {
        columns: [
          { width: "50%", stack: companyInfo },
          {
            width: "50%",
            stack: [
              { text: typeLabel.toUpperCase(), fontSize: 20, bold: true, color: PDF_BLUE, alignment: "right" },
              docNumero ? { text: `N° ${docNumero}`, fontSize: 9, alignment: "right", margin: [0, 2, 0, 0] } : {},
              { text: `Date : ${dateEmission}`, fontSize: 8, color: PDF_GRAY, alignment: "right", margin: [0, 8, 0, 0] },
              dateValidite ? { text: `Valide jusqu'au : ${dateValidite}`, fontSize: 8, color: PDF_GRAY, alignment: "right" } : {},
              dateEcheance ? { text: `Échéance : ${dateEcheance}`, fontSize: 8, color: PDF_GRAY, alignment: "right" } : {},
            ],
          },
        ],
      },

      // Client box
      {
        margin: [0, 20, 0, 15],
        columns: [
          { width: "*", text: "" },
          {
            width: 200,
            table: {
              widths: ["*"],
              body: [[{
                stack: [
                  { text: "DESTINATAIRE", fontSize: 7, color: PDF_BLUE, bold: true, margin: [0, 0, 0, 4] },
                  { text: clientName, fontSize: 10, bold: true },
                  clientAddress ? { text: clientAddress, fontSize: 8, color: PDF_GRAY, margin: [0, 2, 0, 0] } : {},
                ],
                margin: [8, 6, 8, 6],
              }]],
            },
            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => PDF_BORDER, vLineColor: () => PDF_BORDER },
          },
        ],
      },

      // Objet
      doc.objet ? { text: `Objet : ${doc.objet}`, fontSize: 9, bold: true, margin: [0, 0, 0, 10] } : {},

      // Table
      {
        table: {
          headerRows: 1,
          widths: [24, "*", 40, 50, 55],
          body: tableBody,
        },
        layout: getTableLayout(),
      },

      // Bottom section
      {
        margin: [0, 15, 0, 0],
        columns: [
          // Left side - conditions
          {
            width: "55%",
            stack: [
              modesPaiementText ? { text: `Paiement : ${modesPaiementText}`, fontSize: 8, color: PDF_GRAY } : {},
              mentionTva ? { text: mentionTva, fontSize: 7, italics: true, color: PDF_GRAY, margin: [0, 4, 0, 0] } : {},
              doc.type === "devis" ? {
                margin: [0, 15, 0, 0],
                table: {
                  widths: ["*"],
                  body: [[{
                    stack: [
                      { text: "Bon pour accord", fontSize: 8, bold: true, margin: [0, 0, 0, 3] },
                      { text: "Date et signature :", fontSize: 7, color: PDF_GRAY },
                      { text: "", margin: [0, 25, 0, 0] },
                    ],
                    margin: [8, 6, 8, 6],
                  }]],
                },
                layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => PDF_BORDER, vLineColor: () => PDF_BORDER },
              } : {},
            ],
          },
          { width: "5%", text: "" },
          // Right side - totals
          {
            width: "40%",
            stack: [
              {
                table: {
                  widths: ["*", "auto"],
                  body: totalsRows,
                },
                layout: "noBorders",
              },
              {
                margin: [0, 6, 0, 0],
                table: {
                  widths: ["*"],
                  body: [[{
                    columns: [
                      { text: "NET À PAYER", fontSize: 10, bold: true, color: "white" },
                      { text: formatMoney(netAPayer), fontSize: 12, bold: true, color: "white", alignment: "right" },
                    ],
                    margin: [10, 8, 10, 8],
                    fillColor: PDF_BLUE,
                  }]],
                },
                layout: { hLineWidth: () => 0, vLineWidth: () => 0 },
              },
            ],
          },
        ],
      },
    ],
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 0],
      columns: [
        { text: "Thomas Bonnardel EI • 944 Chemin de Tardinaou 13190 Allauch • SIREN 992 454 694", fontSize: 6, color: PDF_GRAY },
        { text: `${currentPage}/${pageCount}`, fontSize: 6, color: PDF_GRAY, alignment: "right" },
      ],
    }),
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
    appearance: payload.appearance || {},
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

const initDb = async () => {
  const pool = getMySQLPool();
  if (!pool) return;

  const statements = [
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
      INDEX idx_type_statut (type, statut),
      INDEX idx_client (client_id),
      INDEX idx_chantier (chantier_id),
      INDEX idx_date_emission (date_emission),
      INDEX idx_token (token_public)
    )`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
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
    columns: ["id", "title", "description", "start", "end", "color", "ordre"],
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

// Créer un document avec numérotation automatique
app.post("/api/documents", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const { type = "devis", client_id, lignes = [], ...rest } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: "client_id_required" });
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

    // Récupérer le document créé avec les infos client
    const [docs] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.email as client_email
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = ?`,
      [id]
    );

    const doc = docs[0];
    doc.lignes = parseJsonField(doc.lignes, []);
    doc.modes_paiement = parseJsonField(doc.modes_paiement, []);

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
      WHERE 1=1
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

// Détail d'un document
app.get("/api/documents/:id", requireAdmin, async (req, res) => {
  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT d.*, c.nom as client_nom, c.email as client_email, c.telephone as client_telephone,
              c.adresse_ligne1 as client_adresse, c.code_postal as client_cp, c.ville as client_ville,
              c.siret as client_siret, c.type as client_type
       FROM documents d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.id = ?`,
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

    // Retourner le document mis à jour
    const [rows] = await pool.query(
      `SELECT d.*, c.nom as client_nom FROM documents d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "document_not_found" });
    }

    const doc = rows[0];
    doc.lignes = parseJsonField(doc.lignes, []);
    doc.modes_paiement = parseJsonField(doc.modes_paiement, []);
    doc.pieces_jointes = parseJsonField(doc.pieces_jointes, []);

    res.json(doc);
  } catch (error) {
    console.error("Document update error:", error);
    res.status(500).json({ error: "document_error" });
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

// === FIN DOCUMENTS ===

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
