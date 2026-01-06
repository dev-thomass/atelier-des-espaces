import React, { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  GripVertical,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FileText,
  Type,
  Euro,
  Sparkles,
  Loader2,
  Wand2,
  Check,
  X,
  RefreshCw,
  Pencil,
  ArrowLeft,
} from "lucide-react";

const UNITES = ["u", "h", "j", "m²", "m³", "ml", "kg", "forfait", "lot"];
const TAUX_TVA = [0, 5.5, 10, 20];

function generateId() {
  return `ligne_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatMontant(value) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function calculerLigneTotal(ligne) {
  if (ligne.type !== "ligne") return 0;
  const base = (ligne.quantite || 0) * (ligne.prix_unitaire_ht || 0);
  let remise = 0;
  if (ligne.remise_valeur > 0) {
    if (ligne.remise_type === "pourcentage") {
      remise = base * ligne.remise_valeur / 100;
    } else {
      remise = ligne.remise_valeur;
    }
  }
  return Math.round((base - remise) * 100) / 100;
}

function numeroterLignes(lignes) {
  let sectionIndex = 0;
  let ligneIndex = 0;
  let currentSectionId = null;

  return lignes.map((ligne) => {
    if (ligne.type === "section") {
      sectionIndex++;
      ligneIndex = 0;
      currentSectionId = ligne.id;
      return { ...ligne, numero_affiche: `${sectionIndex}`, section_id: null };
    }

    const isLigne = ligne.type === "ligne";

    if (currentSectionId) {
      if (isLigne) {
        ligneIndex++;
        return { ...ligne, numero_affiche: `${sectionIndex}.${ligneIndex}`, section_id: currentSectionId };
      }
      return { ...ligne, numero_affiche: "", section_id: currentSectionId };
    }

    if (isLigne) {
      ligneIndex++;
      return { ...ligne, numero_affiche: `${ligneIndex}`, section_id: null };
    }

    return { ...ligne, numero_affiche: "", section_id: null };
  });
}

function calculerSousTotalSection(lignes, sectionId) {
  return lignes
    .filter((l) => l.section_id === sectionId && l.type === "ligne")
    .reduce((sum, l) => sum + calculerLigneTotal(l), 0);
}

function calculerSousTotalAvantIndex(lignes, index) {
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
}

export default function DocumentLignes({
  lignes = [],
  onChange,
  tvaApplicable = false,
  client = null,
  documentType = "devis",
  objet = ""
}) {
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiStep, setAiStep] = useState("prompt"); // "prompt" | "preview"
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiPreviewLignes, setAiPreviewLignes] = useState([]);
  const [editingLigneId, setEditingLigneId] = useState(null);

  const resetAIDialog = () => {
    setAiStep("prompt");
    setAiPrompt("");
    setAiError(null);
    setAiPreviewLignes([]);
    setEditingLigneId(null);
  };

  const closeAIDialog = () => {
    setShowAIDialog(false);
    resetAIDialog();
  };

  // Détecter si le texte ressemble à un devis existant à parser
  const detectExistingQuote = (text) => {
    const patterns = [
      /\d+[.,]\d+\s*€/,          // Prix avec €
      /\d+\s*h\s*$/m,             // Heures
      /\d+\s*m[²³]/,              // Mètres carrés/cubes
      /^\d+\.\d+/m,               // Numérotation 1.1, 1.2
      /Total\s*(HT|TTC)/i,        // Total
      /P\.?U\.?\s*(HT)?/i,        // Prix unitaire
    ];
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) matchCount++;
    }
    return matchCount >= 2;
  };

  // Compter le nombre approximatif de lignes de devis dans le texte
  const countQuoteLines = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    let count = 0;
    for (const line of lines) {
      // Lignes avec prix, quantités, ou numérotation
      if (/\d+[.,]\d+\s*€/.test(line) ||
          /^\d+\.\d+/.test(line.trim()) ||
          /^\d+\s*[-–).]/.test(line.trim()) ||
          /\d+\s*(h|m²|m³|ml|u|j|kg)\b/i.test(line) ||
          /MO\s+\d+/i.test(line) ||
          /^[A-ZÉÈÊÀÂÔÛÙ\s]{3,}$/.test(line.trim())) { // Titres en majuscules
        count++;
      }
    }
    return Math.max(count, Math.floor(lines.length * 0.6)); // Au moins 60% des lignes
  };

  // Découper le devis en sections pour traitement par lots
  const splitQuoteIntoChunks = (text) => {
    const lines = text.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentHeader = "";

    for (const line of lines) {
      const trimmed = line.trim();
      // Détecter un titre de section (majuscules, numérotation principale, ou mot-clé)
      const isHeader = (
        /^[A-ZÉÈÊÀÂÔÛÙ\s]{4,}$/.test(trimmed) ||
        /^\d+\s*[-–.)\s]+[A-ZÉÈÊÀÂ]/.test(trimmed) ||
        /^(TOTAL|SOUS-TOTAL|RÉCAPITULATIF)/i.test(trimmed)
      );

      if (isHeader && currentChunk.length > 0) {
        chunks.push({ header: currentHeader, content: currentChunk.join('\n') });
        currentChunk = [line];
        currentHeader = trimmed;
      } else {
        if (isHeader && currentChunk.length === 0) {
          currentHeader = trimmed;
        }
        currentChunk.push(line);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({ header: currentHeader, content: currentChunk.join('\n') });
    }

    // Si pas assez de chunks détectés, découper par nombre de lignes
    if (chunks.length <= 1 && lines.length > 30) {
      const chunkSize = 25;
      const lineChunks = [];
      for (let i = 0; i < lines.length; i += chunkSize) {
        lineChunks.push({
          header: `Partie ${Math.floor(i / chunkSize) + 1}`,
          content: lines.slice(i, i + chunkSize).join('\n')
        });
      }
      return lineChunks;
    }

    return chunks;
  };

  // État pour le traitement par lots
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0, status: "" });

  // Configuration retry et timeout pour l'IA
  const AI_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 60000, // 60 secondes
  };

  // Fonction utilitaire pour retry avec délai exponentiel
  const withRetry = async (fn, maxRetries = AI_CONFIG.maxRetries, baseDelay = AI_CONFIG.retryDelay) => {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  };

  // Fonction utilitaire pour timeout
  const withTimeout = (promise, ms = AI_CONFIG.timeout) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), ms)
      ),
    ]);
  };

  // Appel IA pour un seul chunk avec retry et timeout
  const parseChunkWithAI = async (chunkContent, chunkIndex, totalChunks) => {
    const chunkLines = countQuoteLines(chunkContent);

    const prompt = `MISSION: Parser cette SECTION de devis (${chunkIndex + 1}/${totalChunks}).

CONTENU À PARSER:
"""
${chunkContent}
"""

RÈGLES:
1. EXTRAIRE CHAQUE LIGNE avec prix/quantité = type "ligne"
2. Titres/sous-titres en MAJUSCULES = type "section"
3. Désignations EXACTES (ne pas reformuler)
4. Quantités et prix EXACTS
5. "MO" = main d'œuvre

FORMAT JSON:
{"lignes":[{"type":"section","designation":"TITRE"},{"type":"ligne","designation":"texte","quantite":1,"unite":"h","prix_unitaire_ht":44}]}

Unités: u, h, j, m², m³, ml, kg, forfait, lot`;

    const makeRequest = async () => {
      const response = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            lignes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["section", "ligne"] },
                  designation: { type: "string" },
                  quantite: { type: "number" },
                  unite: { type: "string" },
                  prix_unitaire_ht: { type: "number" }
                },
                required: ["type", "designation"]
              }
            }
          },
          required: ["lignes"]
        }
      });
      return response?.lignes || [];
    };

    // Appel avec retry et timeout
    return withRetry(() => withTimeout(makeRequest()));
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    setAiError(null);
    setAiProgress({ current: 0, total: 0, status: "" });

    const isExistingQuote = detectExistingQuote(aiPrompt);
    const estimatedLines = countQuoteLines(aiPrompt);

    try {
      let allLignes = [];

      if (isExistingQuote && estimatedLines > 20) {
        // MODE BATCH: Découper et traiter par sections
        const chunks = splitQuoteIntoChunks(aiPrompt);
        setAiProgress({ current: 0, total: chunks.length, status: "Découpage en sections..." });

        // Réinitialiser les lignes preview pour affichage progressif
        setAiPreviewLignes([]);

        for (let i = 0; i < chunks.length; i++) {
          setAiProgress({
            current: i + 1,
            total: chunks.length,
            status: `Traitement: ${chunks[i].header || `Section ${i + 1}`}`
          });

          try {
            const chunkLignes = await parseChunkWithAI(chunks[i].content, i, chunks.length);
            // Optimisation: push() au lieu de spread pour éviter O(n²)
            allLignes.push(...chunkLignes);

            // Mise à jour progressive des lignes pour feedback visuel
            const progressLignes = allLignes.map((ligne) => ({
              id: generateId(),
              type: ligne.type,
              designation: ligne.designation || "",
              description: "",
              quantite: ligne.type === "ligne" ? (ligne.quantite || 1) : null,
              unite: ligne.type === "ligne" ? (ligne.unite || "u") : null,
              prix_unitaire_ht: ligne.type === "ligne" ? (ligne.prix_unitaire_ht || 0) : null,
              remise_type: null,
              remise_valeur: 0,
              taux_tva: tvaApplicable ? 20 : 0,
              total_ht: 0,
              selected: true,
            }));
            setAiPreviewLignes(progressLignes);
          } catch (chunkError) {
            console.error(`Erreur chunk ${i + 1}:`, chunkError);
            // Continuer avec les autres chunks
          }
        }

        setAiProgress({ current: chunks.length, total: chunks.length, status: "Finalisation..." });

        // Aller directement à l'aperçu si on a des lignes
        if (allLignes.length > 0) {
          setAiStep("preview");
          const ratio = allLignes.length / estimatedLines;
          if (ratio < 0.5) {
            setAiError(`${allLignes.length} lignes extraites sur ~${estimatedLines} attendues. Vous pouvez régénérer.`);
          } else if (ratio < 0.8) {
            setAiError(`${allLignes.length} lignes extraites. Certaines lignes peuvent manquer.`);
          }
        } else {
          setAiError("Aucune ligne extraite. Vérifiez le format du devis.");
        }

        setAiLoading(false);
        setAiProgress({ current: 0, total: 0, status: "" });
        return; // Sortir ici, le mode batch gère tout

      } else {
        // MODE SIMPLE: Un seul appel
        setAiProgress({ current: 0, total: 1, status: "Génération en cours..." });

        // Construire le contexte
        let contextInfo = "";
        if (client) {
          contextInfo += `\nClient: ${client.nom}${client.prenom ? ` ${client.prenom}` : ""}`;
          if (client.ville) contextInfo += ` (${client.ville})`;
          if (client.type === "professionnel") contextInfo += " - Professionnel";
        }
        if (objet) {
          contextInfo += `\nObjet du ${documentType}: ${objet}`;
        }

        const prompt = isExistingQuote
          ? `Parser ce devis en JSON:
${contextInfo}

"""
${aiPrompt}
"""

RÈGLES: Extraire sections (titres MAJUSCULES) et lignes (avec quantité/prix). Désignations EXACTES.

FORMAT: {"lignes":[{"type":"section","designation":"TITRE"},{"type":"ligne","designation":"texte","quantite":1,"unite":"h","prix_unitaire_ht":44}]}
Unités: u, h, j, m², m³, ml, kg, forfait, lot`
          : `Expert en chiffrage travaux France.
${contextInfo}

Génère un devis COMPLET pour: "${aiPrompt}"

INSTRUCTIONS:
- Sections principales + sous-sections si pertinent
- Séparer MO et fournitures
- Prix réalistes 2024 (MO générale: 44€/h, plombier/électricien: 55€/h)
- Unités: h, m², ml, u, forfait

FORMAT JSON: {"lignes":[{"type":"section","designation":"TITRE"},{"type":"ligne","designation":"texte","quantite":1,"unite":"h","prix_unitaire_ht":44}]}`;

        const response = await api.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              lignes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["section", "ligne"] },
                    designation: { type: "string" },
                    quantite: { type: "number" },
                    unite: { type: "string" },
                    prix_unitaire_ht: { type: "number" }
                  },
                  required: ["type", "designation"]
                }
              }
            },
            required: ["lignes"]
          }
        });

        allLignes = response?.lignes || [];
      }

      // Convertir en format preview
      if (allLignes.length > 0) {
        const previewLignes = allLignes.map((ligne) => ({
          id: generateId(),
          type: ligne.type,
          designation: ligne.designation || "",
          description: "",
          quantite: ligne.type === "ligne" ? (ligne.quantite || 1) : null,
          unite: ligne.type === "ligne" ? (ligne.unite || "u") : null,
          prix_unitaire_ht: ligne.type === "ligne" ? (ligne.prix_unitaire_ht || 0) : null,
          remise_type: null,
          remise_valeur: 0,
          taux_tva: tvaApplicable ? 20 : 0,
          total_ht: 0,
          selected: true,
        }));

        setAiPreviewLignes(previewLignes);
        setAiStep("preview");

        // Info sur l'extraction
        if (isExistingQuote) {
          const ratio = previewLignes.length / estimatedLines;
          if (ratio < 0.5) {
            setAiError(`${previewLignes.length} lignes extraites sur ~${estimatedLines} attendues. Cliquez "Régénérer" pour réessayer.`);
          } else if (ratio < 0.8) {
            setAiError(`${previewLignes.length} lignes extraites. Certaines lignes peuvent manquer.`);
          }
        }
      } else {
        setAiError("Aucune ligne extraite. Vérifiez le format du devis.");
      }
    } catch (error) {
      console.error("Erreur génération IA:", error);

      // Messages d'erreur spécifiques selon le type d'erreur
      let errorMessage = "Erreur lors de la génération. Réessayez.";

      if (error.message === "TIMEOUT") {
        errorMessage = "La génération a pris trop de temps. Essayez avec moins de contenu ou réessayez.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Erreur de connexion réseau. Vérifiez votre connexion et réessayez.";
      } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
        errorMessage = "Format de réponse invalide. Réessayez avec un texte plus simple.";
      } else if (error.message?.includes("rate") || error.message?.includes("limit")) {
        errorMessage = "Limite de requêtes atteinte. Attendez quelques secondes et réessayez.";
      } else if (error.message?.includes("unauthorized") || error.message?.includes("401")) {
        errorMessage = "Session expirée. Veuillez vous reconnecter.";
      }

      setAiError(errorMessage);
    } finally {
      setAiLoading(false);
      setAiProgress({ current: 0, total: 0, status: "" });
    }
  };

  const togglePreviewLigne = (id) => {
    setAiPreviewLignes(prev =>
      prev.map(l => l.id === id ? { ...l, selected: !l.selected } : l)
    );
  };

  const removePreviewLigne = (id) => {
    setAiPreviewLignes(prev => prev.filter(l => l.id !== id));
  };

  const updatePreviewLigne = (id, field, value) => {
    setAiPreviewLignes(prev =>
      prev.map(l => l.id === id ? { ...l, [field]: value } : l)
    );
  };

  const confirmAIGeneration = () => {
    const selectedLignes = aiPreviewLignes
      .filter(l => l.selected)
      .map(({ selected, ...ligne }) => ligne);

    if (selectedLignes.length === 0) {
      setAiError("Sélectionnez au moins une ligne");
      return;
    }

    const numerotedLignes = numeroterLignes([...lignes, ...selectedLignes]);
    onChange(numerotedLignes);
    closeAIDialog();
  };

  const previewTotal = aiPreviewLignes
    .filter(l => l.selected && l.type === "ligne")
    .reduce((sum, l) => sum + ((l.quantite || 0) * (l.prix_unitaire_ht || 0)), 0);

  const addLigne = (type = "ligne", afterIndex = null) => {
    const defaultDesignation =
      type === "section"
        ? "Nouvelle section"
        : type === "texte"
        ? "Texte libre"
        : type === "entete"
        ? "En-tete"
        : type === "sous_total"
        ? "Sous-total"
        : "";
    const newLigne = {
      id: generateId(),
      type,
      designation: defaultDesignation,
      description: "",
      quantite: type === "ligne" ? 1 : null,
      unite: type === "ligne" ? "u" : null,
      prix_unitaire_ht: type === "ligne" ? 0 : null,
      remise_type: null,
      remise_valeur: 0,
      taux_tva: tvaApplicable ? 20 : 0,
      total_ht: 0,
    };

    const newLignes = [...lignes];
    if (afterIndex !== null && afterIndex >= 0) {
      newLignes.splice(afterIndex + 1, 0, newLigne);
    } else {
      newLignes.push(newLigne);
    }

    onChange(numeroterLignes(newLignes));

    if (type === "section") {
      setExpandedSections((prev) => new Set([...prev, newLigne.id]));
    }
  };

  const updateLigne = (id, field, value) => {
    const newLignes = lignes.map((l) => {
      if (l.id === id) {
        const updated = { ...l, [field]: value };
        if (field === "quantite" || field === "prix_unitaire_ht" || field === "remise_valeur" || field === "remise_type") {
          updated.total_ht = calculerLigneTotal(updated);
        }
        return updated;
      }
      return l;
    });
    onChange(numeroterLignes(newLignes));
  };

  const deleteLigne = (id) => {
    const ligne = lignes.find((l) => l.id === id);
    if (ligne?.type === "section") {
      // Supprimer la section et ses sous-lignes
      const newLignes = lignes.filter((l) => l.id !== id && l.section_id !== id);
      onChange(numeroterLignes(newLignes));
    } else {
      onChange(numeroterLignes(lignes.filter((l) => l.id !== id)));
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(lignes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange(numeroterLignes(items));
  };

  // Grouper les lignes par section pour l'affichage
  const groupedLignes = [];
  let currentSection = null;

  lignes.forEach((ligne, index) => {
    if (ligne.type === "section") {
      currentSection = { ...ligne, index, children: [] };
      groupedLignes.push(currentSection);
    } else if (currentSection && ligne.section_id === currentSection.id) {
      currentSection.children.push({ ...ligne, index });
    } else {
      groupedLignes.push({ ...ligne, index, children: null });
    }
  });

  const totalHT = lignes
    .filter((l) => l.type === "ligne")
    .reduce((sum, l) => sum + calculerLigneTotal(l), 0);

  return (
    <div className="space-y-3">
      {/* Toolbar compact */}
      <div
        className="flex items-center justify-between p-3 rounded-lg"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addLigne("section")}
            className="h-8"
          >
            <FolderPlus className="w-4 h-4 mr-1.5" />
            Section
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addLigne("ligne")}
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Ligne
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Type className="w-4 h-4 mr-1.5" />
                Autres
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => addLigne("texte")}>
                <Type className="w-4 h-4 mr-2" />
                Ligne texte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLigne("entete")}>
                <FileText className="w-4 h-4 mr-2" />
                En-tete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLigne("sous_total")}>
                <Euro className="w-4 h-4 mr-2" />
                Sous-total
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-6 mx-1" style={{ backgroundColor: "var(--color-border-light)" }} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAIDialog(true)}
            className="h-8 bg-gradient-to-r from-[var(--color-primary-100)] to-[var(--color-secondary-100)] border-[var(--color-primary-300)] hover:border-[var(--color-primary-400)] text-[var(--color-primary-700)]"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Générer avec IA
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">
            {lignes.filter((l) => l.type === "ligne").length} ligne(s)
          </span>
          <span className="font-semibold text-[var(--color-primary-600)]">
            {formatMontant(totalHT)} € HT
          </span>
        </div>
      </div>

      {/* Liste des lignes */}
      {lignes.length === 0 ? (
        <div
          className="border-2 border-dashed border-[var(--color-border-medium)] rounded-xl p-10 text-center"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--color-bg-surface-hover)]"
          >
            <FileText className="w-7 h-7 text-[var(--color-text-tertiary)]" />
          </div>
          <p className="font-medium mb-1 text-[var(--color-text-primary)]">
            Commencez votre document
          </p>
          <p className="text-sm mb-5 text-[var(--color-text-secondary)]">
            Ajoutez manuellement ou laissez l'IA vous aider
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => setShowAIDialog(true)}
              className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-secondary-500)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-secondary-600)] text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Générer avec IA
            </Button>
            <span className="text-sm text-[var(--color-text-tertiary)]">ou</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => addLigne("section")}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Section
              </Button>
              <Button variant="outline" onClick={() => addLigne("ligne")}>
                <Plus className="w-4 h-4 mr-2" />
                Ligne
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Type className="w-4 h-4 mr-2" />
                    Autres
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => addLigne("texte")}>
                    <Type className="w-4 h-4 mr-2" />
                    Ligne texte
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addLigne("entete")}>
                    <FileText className="w-4 h-4 mr-2" />
                    En-tete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addLigne("sous_total")}>
                    <Euro className="w-4 h-4 mr-2" />
                    Sous-total
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="lignes">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {/* En-tête tableau */}
                <div
                  className="hidden sm:grid gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg mb-2 bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)]"
                  style={{
                    gridTemplateColumns: "32px 50px 1fr 70px 60px 90px 90px 36px",
                  }}
                >
                  <div></div>
                  <div>N°</div>
                  <div>Désignation</div>
                  <div className="text-right">Qté</div>
                  <div className="text-center">Unité</div>
                  <div className="text-right">P.U. HT</div>
                  <div className="text-right">Total</div>
                  <div></div>
                </div>

                {lignes.map((ligne, index) => (
                  <Draggable key={ligne.id} draggableId={ligne.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-lg border transition-all ${
                          snapshot.isDragging ? "shadow-lg" : ""
                        } ${ligne.type === "section" ? "bg-[var(--color-primary-100)] border-[var(--color-primary-300)]" : ligne.type !== "ligne" ? "bg-[var(--color-bg-surface-hover)] border-[var(--color-border-light)]" : ""}`}
                        style={{
                          ...provided.draggableProps.style,
                          backgroundColor: ligne.type === "section"
                            ? "var(--color-primary-50)"
                            : ligne.type !== "ligne"
                            ? "var(--color-bg-elevated)"
                            : "var(--color-bg-surface)",
                          borderColor: ligne.type === "section"
                            ? "var(--color-primary-200)"
                            : "var(--color-border-light)",
                        }}
                      >
                        {ligne.type === "section" ? (
                          /* Section Row */
                          <div className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/50"
                                style={{ color: "var(--color-primary-400)" }}
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <button
                                onClick={() => toggleSection(ligne.id)}
                                className="p-1.5 hover:bg-white/50 rounded-md transition-colors"
                              >
                                {expandedSections.has(ligne.id) ? (
                                  <ChevronDown className="w-4 h-4" style={{ color: "var(--color-primary-600)" }} />
                                ) : (
                                  <ChevronRight className="w-4 h-4" style={{ color: "var(--color-primary-600)" }} />
                                )}
                              </button>

                              <span
                                className="font-bold min-w-[36px] text-center"
                                style={{ color: "var(--color-primary-600)" }}
                              >
                                {ligne.numero_affiche}
                              </span>

                              <Input
                                value={ligne.designation}
                                onChange={(e) => updateLigne(ligne.id, "designation", e.target.value)}
                                className="flex-1 font-semibold border-0 bg-transparent focus-visible:ring-1 h-8"
                                placeholder="Nom de la section"
                                style={{ color: "var(--color-primary-700)" }}
                              />

                              <div
                                className="px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap"
                                style={{
                                  backgroundColor: "var(--color-primary-100)",
                                  color: "var(--color-primary-700)",
                                }}
                              >
                                {formatMontant(calculerSousTotalSection(lignes, ligne.id))} €
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="w-4 h-4" style={{ color: "var(--color-primary-500)" }} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => addLigne("ligne", index)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Ajouter ligne après
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => addLigne("texte", index)}>
                                    <Type className="w-4 h-4 mr-2" />
                                    Ajouter texte apres
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => addLigne("entete", index)}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Ajouter en-tete apres
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => addLigne("sous_total", index)}>
                                    <Euro className="w-4 h-4 mr-2" />
                                    Ajouter sous-total
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-[var(--color-error-text)]"
                                    onClick={() => deleteLigne(ligne.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer section
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ) : ligne.type === "ligne" ? (
                          /* Ligne Row */
                          <div className="px-2 py-2">
                            {/* Mobile Layout */}
                            <div className="sm:hidden space-y-2">
                              <div className="flex items-center gap-2">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab p-1"
                                  style={{ color: "var(--color-text-tertiary)" }}
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <span
                                  className="text-sm font-medium min-w-[36px] text-center"
                                  style={{ color: "var(--color-primary-600)" }}
                                >
                                  {ligne.numero_affiche}
                                </span>
                                <Input
                                  value={ligne.designation}
                                  onChange={(e) => updateLigne(ligne.id, "designation", e.target.value)}
                                  className="flex-1 h-8"
                                  placeholder="Désignation"
                                  style={{ backgroundColor: "var(--color-bg-elevated)" }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-[var(--color-error-icon)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                                  onClick={() => deleteLigne(ligne.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-4 gap-2 pl-10">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={ligne.quantite || ""}
                                  onChange={(e) => updateLigne(ligne.id, "quantite", parseFloat(e.target.value) || 0)}
                                  placeholder="Qté"
                                  className="h-8 text-sm"
                                  style={{ backgroundColor: "var(--color-bg-elevated)" }}
                                />
                                <Select
                                  value={ligne.unite || "u"}
                                  onValueChange={(v) => updateLigne(ligne.id, "unite", v)}
                                >
                                  <SelectTrigger className="h-8 text-sm" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNITES.map((u) => (
                                      <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={ligne.prix_unitaire_ht || ""}
                                  onChange={(e) => updateLigne(ligne.id, "prix_unitaire_ht", parseFloat(e.target.value) || 0)}
                                  placeholder="Prix"
                                  className="h-8 text-sm"
                                  style={{ backgroundColor: "var(--color-bg-elevated)" }}
                                />
                                <div
                                  className="flex items-center justify-end text-sm font-semibold"
                                  style={{ color: "var(--color-text-primary)" }}
                                >
                                  {formatMontant(calculerLigneTotal(ligne))} €
                                </div>
                              </div>
                            </div>

                            {/* Desktop Layout */}
                            <div
                              className="hidden sm:grid gap-2 items-center"
                              style={{ gridTemplateColumns: "32px 50px 1fr 70px 60px 90px 90px 36px" }}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing flex justify-center p-1 rounded hover:bg-[var(--color-bg-surface-hover)]"
                                style={{ color: "var(--color-text-tertiary)" }}
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <span
                                className="text-sm font-medium text-center"
                                style={{ color: "var(--color-primary-600)" }}
                              >
                                {ligne.numero_affiche}
                              </span>

                              <Input
                                value={ligne.designation}
                                onChange={(e) => updateLigne(ligne.id, "designation", e.target.value)}
                                placeholder="Désignation de la ligne"
                                className="h-8"
                                style={{ backgroundColor: "var(--color-bg-elevated)" }}
                              />

                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={ligne.quantite || ""}
                                onChange={(e) => updateLigne(ligne.id, "quantite", parseFloat(e.target.value) || 0)}
                                className="text-right h-8"
                                style={{ backgroundColor: "var(--color-bg-elevated)" }}
                              />

                              <Select
                                value={ligne.unite || "u"}
                                onValueChange={(v) => updateLigne(ligne.id, "unite", v)}
                              >
                                <SelectTrigger className="h-8" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITES.map((u) => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={ligne.prix_unitaire_ht || ""}
                                onChange={(e) => updateLigne(ligne.id, "prix_unitaire_ht", parseFloat(e.target.value) || 0)}
                                className="text-right h-8"
                                style={{ backgroundColor: "var(--color-bg-elevated)" }}
                              />

                              <div
                                className="text-right text-sm font-semibold pr-1"
                                style={{ color: "var(--color-text-primary)" }}
                              >
                                {formatMontant(calculerLigneTotal(ligne))} €
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[var(--color-error-icon)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                                onClick={() => deleteLigne(ligne.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Special Row */
                          <div className="px-3 py-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[var(--color-bg-surface-hover)]"
                                style={{ color: "var(--color-text-tertiary)" }}
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <span
                                className="text-sm font-medium min-w-[36px] text-center"
                                style={{ color: "var(--color-primary-600)" }}
                              >
                                {ligne.numero_affiche}
                              </span>

                              {ligne.type === "texte" ? (
                                <Textarea
                                  value={ligne.designation}
                                  onChange={(e) => updateLigne(ligne.id, "designation", e.target.value)}
                                  rows={2}
                                  className="flex-1 text-sm"
                                  style={{ backgroundColor: "var(--color-bg-elevated)" }}
                                />
                              ) : (
                                <Input
                                  value={ligne.designation}
                                  onChange={(e) => updateLigne(ligne.id, "designation", e.target.value)}
                                  className={`flex-1 h-8 ${
                                    ligne.type === "entete" ? "font-semibold uppercase tracking-wide" : "font-medium"
                                  }`}
                                  style={{ backgroundColor: "var(--color-bg-elevated)" }}
                                />
                              )}

                              <div className="flex items-center gap-2 sm:ml-auto">
                                {ligne.type === "sous_total" && (
                                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    {formatMontant(calculerSousTotalAvantIndex(lignes, index))} ƒ'ª
                                  </span>
                                )}
                                <Badge className="bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] text-xs">
                                  {ligne.type === "texte" ? "Texte" : ligne.type === "entete" ? "En-tete" : "Sous-total"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-[var(--color-error-icon)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                                  onClick={() => deleteLigne(ligne.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Bouton ajouter en bas */}
      {lignes.length > 0 && (
        <div
          className="flex items-center justify-center gap-3 py-3 border-t border-[var(--color-border-light)]"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addLigne("section")}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <FolderPlus className="w-4 h-4 mr-1.5" />
            Ajouter section
          </Button>
          <div className="w-px h-4 bg-[var(--color-border-medium)]" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addLigne("ligne")}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Ajouter ligne
          </Button>
          <div className="w-px h-4 bg-[var(--color-border-medium)]" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <Type className="w-4 h-4 mr-1.5" />
                Ajouter autre
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => addLigne("texte")}>
                <Type className="w-4 h-4 mr-2" />
                Ligne texte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLigne("entete")}>
                <FileText className="w-4 h-4 mr-2" />
                En-tete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addLigne("sous_total")}>
                <Euro className="w-4 h-4 mr-2" />
                Sous-total
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Dialog IA - Étape 1: Prompt ou Étape 2: Aperçu */}
      <Dialog open={showAIDialog} onOpenChange={(open) => { if (!open) closeAIDialog(); else setShowAIDialog(true); }}>
        <DialogContent className={aiStep === "preview" ? "max-w-4xl max-h-[85vh] flex flex-col" : "max-w-2xl max-h-[85vh] flex flex-col"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-secondary-100)]">
                <Sparkles className="w-5 h-5 text-[var(--color-primary-600)]" />
              </div>
              <span className="font-semibold">{aiStep === "prompt" ? "Générer avec l'IA" : "Aperçu & Personnalisation"}</span>
              {aiStep === "preview" && (
                <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                  {aiPreviewLignes.filter(l => l.selected).length} / {aiPreviewLignes.length} sélectionnées
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Étape 1: Prompt */}
          {aiStep === "prompt" && (
            <>
              <div className="space-y-4 py-4">
                {client && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg text-sm bg-[var(--color-bg-surface-hover)] border border-[var(--color-border-light)]">
                    <span className="text-[var(--color-text-secondary)]">Client:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {client.nom}{client.prenom ? ` ${client.prenom}` : ""}
                    </span>
                    {client.ville && (
                      <span className="text-[var(--color-text-secondary)]">({client.ville})</span>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Décrivez le projet ou <span className="font-medium text-[var(--color-primary-600)]">collez un devis existant</span> à importer.
                    </p>
                    {aiPrompt.trim() && detectExistingQuote(aiPrompt) && (
                      <Badge className="bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)] text-xs">
                        Mode import détecté
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    placeholder={`Deux options :

1. DÉCRIRE UN PROJET :
   "Rénovation complète salle de bain 8m², douche italienne 120x90, carrelage sol et murs..."

2. COLLER UN DEVIS EXISTANT :
   Collez directement le contenu d'un devis (avec sections, lignes, quantités, prix) et l'IA le convertira automatiquement.`}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={8}
                    className="resize-none font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] bg-white border-[var(--color-border-medium)]"
                  />
                </div>

                {aiError && (
                  <div className="p-3 rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] text-sm">
                    {aiError}
                  </div>
                )}

                {!aiPrompt.trim() && (
                  <div className="p-3 rounded-lg border border-dashed border-[var(--color-border-medium)] bg-[var(--color-bg-surface-hover)]">
                    <p className="text-xs font-medium mb-2 text-[var(--color-text-secondary)]">
                      Exemples de projets :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Rénovation salle de bain 6m² avec douche italienne",
                        "Peinture appartement 3 pièces 65m²",
                        "Pose parquet chêne massif 30m² + plinthes",
                        "Aménagement terrasse avec cuisine extérieure",
                        "Création toit tôle ondulée + électricité",
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => setAiPrompt(example)}
                          className="px-2.5 py-1 text-xs rounded-full border border-[var(--color-border-medium)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-100)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-700)]"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiPrompt.trim() && detectExistingQuote(aiPrompt) && !aiLoading && (
                  <div className="p-3 rounded-lg bg-[var(--color-primary-100)] border border-[var(--color-primary-300)] text-[var(--color-primary-700)] text-sm flex items-start gap-2">
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Mode import activé — ~{countQuoteLines(aiPrompt)} lignes détectées</p>
                      <p className="text-xs text-[var(--color-primary-600)] mt-0.5">
                        {countQuoteLines(aiPrompt) > 20
                          ? "Traitement par lots activé : le devis sera découpé en sections pour une extraction complète."
                          : "L'IA va parser et structurer le devis que vous avez collé."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Barre de progression */}
                {aiLoading && aiProgress.total > 0 && (
                  <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--color-primary-100)] to-[var(--color-secondary-100)] border border-[var(--color-primary-300)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary-600)]" />
                        <span className="text-sm font-medium text-[var(--color-primary-700)]">{aiProgress.status}</span>
                      </div>
                      <span className="text-sm text-[var(--color-primary-600)]">
                        {aiProgress.current}/{aiProgress.total}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-primary-100)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-secondary-500)] transition-all duration-300"
                        style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }}
                      />
                    </div>
                    {aiProgress.current > 0 && (
                      <p className="text-xs text-[var(--color-primary-600)] mt-2">
                        {aiPreviewLignes.length > 0 ? `${aiPreviewLignes.length} lignes extraites...` : "Extraction en cours..."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeAIDialog} disabled={aiLoading}>
                  Annuler
                </Button>
                <Button
                  onClick={generateWithAI}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-secondary-500)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-secondary-600)] text-white"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {aiProgress.total > 1 ? `Section ${aiProgress.current}/${aiProgress.total}` : "Import en cours..."}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      {detectExistingQuote(aiPrompt) ? "Importer le devis" : "Générer"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Étape 2: Aperçu éditable */}
          {aiStep === "preview" && (
            <>
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {/* Barre d'info */}
                <div
                  className="flex items-center justify-between p-3 rounded-lg mb-3 bg-[var(--color-bg-surface-hover)]"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-[var(--color-text-secondary)]">
                      Cliquez sur une ligne pour la désélectionner. Modifiez les valeurs directement.
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setAiStep("prompt"); setAiPreviewLignes([]); }}
                    className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Régénérer
                  </Button>
                </div>

                {aiError && (
                  <div className="p-3 rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error-text)] text-sm mb-3">
                    {aiError}
                  </div>
                )}

                {/* Liste des lignes en aperçu */}
                <div className="flex-1 overflow-auto border border-[var(--color-border-light)] rounded-lg">
                  {/* En-tête */}
                  <div
                    className="grid gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10 bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)]"
                    style={{
                      gridTemplateColumns: "28px 1fr 70px 60px 90px 90px 32px",
                    }}
                  >
                    <div></div>
                    <div>Désignation</div>
                    <div className="text-right">Qté</div>
                    <div className="text-center">Unité</div>
                    <div className="text-right">P.U. HT</div>
                    <div className="text-right">Total</div>
                    <div></div>
                  </div>

                  {/* Lignes */}
                  <div className="divide-y divide-[var(--color-border-light)]">
                    {aiPreviewLignes.map((ligne) => (
                      <div
                        key={ligne.id}
                        className={`grid gap-2 px-3 py-2 items-center transition-all ${
                          !ligne.selected ? "opacity-40 bg-[var(--color-bg-surface-hover)]" : ""
                        } ${ligne.type === "section" ? "bg-[color:var(--color-primary-100)]/50" : ""}`}
                        style={{
                          gridTemplateColumns: ligne.type === "section"
                            ? "28px 1fr auto 32px"
                            : "28px 1fr 70px 60px 90px 90px 32px",
                        }}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => togglePreviewLigne(ligne.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            ligne.selected
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-[var(--color-border-medium)] hover:border-[var(--color-border-dark)]"
                          }`}
                        >
                          {ligne.selected && <Check className="w-3 h-3 text-white" />}
                        </button>

                        {/* Désignation */}
                        {ligne.type === "section" ? (
                          <>
                            <Input
                              value={ligne.designation}
                              onChange={(e) => updatePreviewLigne(ligne.id, "designation", e.target.value)}
                              className="font-semibold h-8 border-0 bg-transparent focus-visible:ring-1 text-[var(--color-primary-700)]"
                            />
                            <Badge className="bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)] text-xs">
                              Section
                            </Badge>
                          </>
                        ) : (
                          <>
                            <Input
                              value={ligne.designation}
                              onChange={(e) => updatePreviewLigne(ligne.id, "designation", e.target.value)}
                              className="h-8 text-sm text-[var(--color-text-primary)] bg-white border-[var(--color-border-light)]"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ligne.quantite || ""}
                              onChange={(e) => updatePreviewLigne(ligne.id, "quantite", parseFloat(e.target.value) || 0)}
                              className="text-right h-8 text-sm text-[var(--color-text-primary)] bg-white border-[var(--color-border-light)]"
                            />
                            <Select
                              value={ligne.unite || "u"}
                              onValueChange={(v) => updatePreviewLigne(ligne.id, "unite", v)}
                            >
                              <SelectTrigger className="h-8 text-sm text-[var(--color-text-primary)] bg-white border-[var(--color-border-light)]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITES.map((u) => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ligne.prix_unitaire_ht || ""}
                              onChange={(e) => updatePreviewLigne(ligne.id, "prix_unitaire_ht", parseFloat(e.target.value) || 0)}
                              className="text-right h-8 text-sm text-[var(--color-text-primary)] bg-white border-[var(--color-border-light)]"
                            />
                            <div className="text-right text-sm font-medium text-[var(--color-text-primary)]">
                              {formatMontant((ligne.quantite || 0) * (ligne.prix_unitaire_ht || 0))} €
                            </div>
                          </>
                        )}

                        {/* Supprimer */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[var(--color-text-muted)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                          onClick={() => removePreviewLigne(ligne.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total aperçu */}
                <div
                  className="flex items-center justify-between p-4 mt-3 rounded-lg bg-[var(--color-bg-surface-hover)]"
                >
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {aiPreviewLignes.filter(l => l.selected && l.type === "ligne").length} ligne(s) sélectionnée(s)
                  </div>
                  <div className="text-right">
                    <span className="text-sm mr-2 text-[var(--color-text-secondary)]">Total HT estimé:</span>
                    <span className="text-xl font-bold text-[var(--color-primary-600)]">
                      {formatMontant(previewTotal)} €
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setAiStep("prompt"); setAiPreviewLignes([]); }}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
                <Button variant="outline" onClick={closeAIDialog}>
                  Annuler
                </Button>
                <Button
                  onClick={confirmAIGeneration}
                  disabled={aiPreviewLignes.filter(l => l.selected).length === 0}
                  className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-secondary-500)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-secondary-600)] text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Ajouter {aiPreviewLignes.filter(l => l.selected).length} ligne(s)
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
