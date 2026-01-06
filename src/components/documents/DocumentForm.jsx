import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminHero } from "@/components/admin/AdminHero";
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  FileText,
  Receipt,
  User,
  Plus,
  Loader2,
  Calendar,
  Euro,
  Building2,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";
import ClientSelector from "./ClientSelector";
import ChantierSelector from "./ChantierSelector";
import DocumentLignes from "./DocumentLignes";
import DocumentAppearancePanel from "./DocumentAppearancePanel";

const MODES_PAIEMENT = [
  { id: "virement", label: "Virement bancaire" },
  { id: "cheque", label: "Chèque" },
  { id: "especes", label: "Espèces" },
  { id: "cb", label: "Carte bancaire" },
];

const CONDITIONS_PAIEMENT_OPTIONS = [
  { id: "none", label: "Aucune" },
  { id: "reception", label: "A reception" },
  { id: "30j", label: "30 jours" },
  { id: "30j_fdm", label: "30 jours fin de mois" },
  { id: "45j", label: "45 jours" },
  { id: "60j", label: "60 jours" },
  { id: "custom", label: "Personnalise" },
];

const CONDITIONS_PAIEMENT_LABELS = {
  reception: "A reception",
  "30j": "30 jours",
  "30j_fdm": "30 jours fin de mois",
  "45j": "45 jours",
  "60j": "60 jours",
};

const getConditionsPreset = (value) => {
  if (!value) return { preset: "none", custom: "" };
  const match = Object.entries(CONDITIONS_PAIEMENT_LABELS).find(([, label]) => label === value);
  if (match) return { preset: match[0], custom: "" };
  return { preset: "custom", custom: value };
};

const resolveConditionsPaiement = (preset, custom) => {
  if (!preset || preset === "none") return null;
  if (preset === "custom") {
    const trimmed = (custom || "").trim();
    return trimmed.length ? trimmed : null;
  }
  return CONDITIONS_PAIEMENT_LABELS[preset] || null;
};

const buildClientFromDocument = (doc) => {
  if (!doc) return null;
  const fallbackAddress = doc.client_adresse_ligne1 || doc.client_adresse || "";
  return {
    id: doc.client_id || doc.client?.id || null,
    nom: doc.client_nom || doc.client?.nom || "",
    prenom: doc.client_prenom || doc.client?.prenom || "",
    email: doc.client_email || doc.client?.email || "",
    telephone: doc.client_telephone || doc.client?.telephone || "",
    adresse_ligne1: fallbackAddress,
    adresse_ligne2: doc.client_adresse_ligne2 || doc.client?.adresse_ligne2 || "",
    code_postal: doc.client_code_postal || doc.client_cp || doc.client?.code_postal || "",
    ville: doc.client_ville || doc.client?.ville || "",
    pays: doc.client_pays || doc.client?.pays || "",
    siret: doc.client_siret || doc.client?.siret || "",
    type: doc.client_type || doc.client?.type || "particulier",
  };
};

const getResponseErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === "object") {
      const message = payload.message || payload.error || fallback;
      if (payload.solution) return `${message} ${payload.solution}`;
      return message;
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
};

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

function formatMontant(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function calculerTotaux(lignes, remiseGlobale = { type: null, valeur: 0 }, tvaApplicable = false) {
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

const DEFAULT_APPEARANCE = {
  primaryColor: "#1a5490",
  secondaryColor: "#d7e3ee",
  font: "Helvetica",
  baseFontSize: 9,
  lineHeight: 1.3,
  headerStyle: "ultra",
  clientPosition: "right",
  layoutPreset: "premium-split",
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
};

const DEFAULT_APPEARANCE_BY_TYPE = {
  devis: DEFAULT_APPEARANCE,
  facture: {
    ...DEFAULT_APPEARANCE,
    primaryColor: "#0e3a5c",
    secondaryColor: "#c7d7e6",
    borderRadius: 10,
    showSectionSubtotals: true,
  },
  avoir: {
    ...DEFAULT_APPEARANCE,
    primaryColor: "#7d3b20",
    secondaryColor: "#efdcd1",
    borderRadius: 8,
  },
};

const getDefaultAppearance = (docType) => {
  const base = DEFAULT_APPEARANCE_BY_TYPE[docType] || DEFAULT_APPEARANCE;
  return {
    ...base,
    columns: { ...(base.columns || {}) },
    hide: { ...(base.hide || {}) },
  };
};

export default function DocumentForm({ type = "devis", document = null, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!document;
  const initialConditions = getConditionsPreset(document?.conditions_paiement);
  const initialRetenuePct = document?.retenue_garantie_pct > 0 ? document.retenue_garantie_pct : 5;
  const isFacture = type === "facture";
  const appearanceLoadedRef = useRef(false);
  const saveAppearanceTimeoutRef = useRef(null);

  // Form state
  const [client, setClient] = useState(document?.client || null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [chantier, setChantier] = useState(() => {
    if (!document?.chantier_id) return null;
    return {
      id: document.chantier_id,
      titre: document.chantier_titre,
      client: document.chantier_client,
      date_debut: document.chantier_date_debut,
      date_fin: document.chantier_date_fin,
    };
  });
  const [showChantierSelector, setShowChantierSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [appearanceOptions, setAppearanceOptions] = useState(() => getDefaultAppearance(type));

  // Charger la config d'apparence sauvegardée
  const { data: savedAppearance } = useQuery({
    queryKey: ["appearance-config", document?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (document?.id) params.append("document_id", document.id);
      const response = await fetch(`/api/appearance-config?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (!response.ok) return getDefaultAppearance(type);
      return response.json();
    },
  });

  // Appliquer la config chargée
  useEffect(() => {
    if (savedAppearance && !appearanceLoadedRef.current) {
      setAppearanceOptions({ ...getDefaultAppearance(type), ...savedAppearance });
      appearanceLoadedRef.current = true;
    }
  }, [savedAppearance]);

  // Mutation pour sauvegarder la config
  const saveAppearanceMutation = useMutation({
    mutationFn: async (config) => {
      const response = await fetch("/api/appearance-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({ document_id: document?.id || null, config }),
      });
      if (!response.ok) throw new Error("Failed to save appearance");
      return response.json();
    },
  });

  // Auto-save debounced de l'apparence avec feedback
  const handleAppearanceChange = useCallback((newOptions) => {
    setAppearanceOptions(newOptions);

    // Debounce la sauvegarde
    if (saveAppearanceTimeoutRef.current) {
      clearTimeout(saveAppearanceTimeoutRef.current);
    }
    saveAppearanceTimeoutRef.current = setTimeout(() => {
      saveAppearanceMutation.mutate(newOptions, {
        onSuccess: () => {
          toast({
            title: "Apparence sauvegardée",
            description: "Les modifications ont été enregistrées.",
            duration: 2000,
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erreur de sauvegarde",
            description: "Impossible de sauvegarder l'apparence. Réessayez.",
          });
        },
      });
    }, 1000);
  }, [saveAppearanceMutation, toast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveAppearanceTimeoutRef.current) {
        clearTimeout(saveAppearanceTimeoutRef.current);
      }
    };
  }, []);
  const [dateEmission, setDateEmission] = useState(formatDate(document?.date_emission || new Date()));
  const [dateValidite, setDateValidite] = useState(formatDate(document?.date_validite || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [dateEcheance, setDateEcheance] = useState(formatDate(document?.date_echeance || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [dateVisite, setDateVisite] = useState(formatDate(document?.date_visite || null));
  const [dateDebutTravaux, setDateDebutTravaux] = useState(formatDate(document?.date_debut_travaux || null));
  const [dureeEstimee, setDureeEstimee] = useState(document?.duree_estimee ?? "");
  const [dureeUnite, setDureeUnite] = useState(document?.duree_unite || "jours");
  const [objet, setObjet] = useState(document?.objet || "");
  const [lignes, setLignes] = useState(document?.lignes || []);
  const [tvaApplicable, setTvaApplicable] = useState(document?.tva_applicable || false);
  const [mentionTva, setMentionTva] = useState(document?.mention_tva || "TVA non applicable, art. 293 B du CGI");
  const [modesPaiement, setModesPaiement] = useState(document?.modes_paiement || ["virement", "cheque"]);
  const [conditionsPaiementPreset, setConditionsPaiementPreset] = useState(initialConditions.preset);
  const [conditionsPaiementCustom, setConditionsPaiementCustom] = useState(initialConditions.custom);
  const [remiseGlobale, setRemiseGlobale] = useState({ type: document?.remise_type || null, valeur: document?.remise_valeur || 0 });
  const [retenueActive, setRetenueActive] = useState(isFacture && (document?.retenue_garantie_pct || 0) > 0);
  const [retenuePct, setRetenuePct] = useState(initialRetenuePct);
  const [acompte, setAcompte] = useState(document?.acompte_demande || 0);
  const [notesClient, setNotesClient] = useState(document?.notes_client || "");
  const [notesInternes, setNotesInternes] = useState(document?.notes_internes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef(null);
  const autoSaveIntervalRef = useRef(null);

  useEffect(() => {
    if (!document) return;
    const docClientId = document.client?.id || document.client_id || null;
    if (!docClientId && client?.id) return;
    if (docClientId && client?.id === docClientId) return;
    if (document.client && document.client.id) {
      setClient(document.client);
      return;
    }
    const nextClient = buildClientFromDocument(document);
    if (nextClient?.id || nextClient?.nom || nextClient?.email) {
      setClient(nextClient);
    }
  }, [document, client?.id]);

  // Resynchroniser les conditions de paiement quand le document change
  useEffect(() => {
    if (!document?.conditions_paiement) return;
    const newConditions = getConditionsPreset(document.conditions_paiement);
    setConditionsPaiementPreset(newConditions.preset);
    setConditionsPaiementCustom(newConditions.custom);
  }, [document?.conditions_paiement]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: chantierLookup = [] } = useQuery({
    queryKey: ["chantiers", document?.chantier_id],
    queryFn: async () => {
      if (!document?.chantier_id) return [];
      return api.entities.Chantier.filter({ id: document.chantier_id });
    },
    enabled: !!document?.chantier_id && (!chantier || !chantier.titre),
  });

  useEffect(() => {
    if (chantierLookup.length > 0) {
      setChantier((current) => (current?.titre ? current : chantierLookup[0]));
    }
  }, [chantierLookup]);

  // Memoization des calculs de totaux pour éviter recalculs inutiles
  const totaux = useMemo(
    () => calculerTotaux(lignes, remiseGlobale, tvaApplicable),
    [lignes, remiseGlobale, tvaApplicable]
  );

  const retenuePctNumeric = Math.min(Math.max(Number(retenuePct) || 0, 0), 100);
  const retenueMontant = useMemo(
    () => isFacture && retenueActive
      ? Math.round((totaux.totalTTC * retenuePctNumeric / 100) * 100) / 100
      : 0,
    [isFacture, retenueActive, totaux.totalTTC, retenuePctNumeric]
  );
  const netAPayerFinal = useMemo(
    () => Math.round((totaux.totalTTC - retenueMontant) * 100) / 100,
    [totaux.totalTTC, retenueMontant]
  );
  const conditionsPaiementPreview = resolveConditionsPaiement(conditionsPaiementPreset, conditionsPaiementCustom);
  const pdfAvailable = Boolean(document?.id);

  const buildPreviewPayload = useCallback(() => {
    const clientPayload = client ? {
      client_nom: client.nom || "",
      client_prenom: client.prenom || "",
      client_email: client.email || "",
      client_telephone: client.telephone || "",
      client_adresse_ligne1: client.adresse_ligne1 || "",
      client_adresse_ligne2: client.adresse_ligne2 || "",
      client_code_postal: client.code_postal || "",
      client_ville: client.ville || "",
      client_pays: client.pays || "",
      siret: client.siret || "",
    } : {};

    const numero = document?.numero || (type === "devis" ? "DEVIS-BROUILLON" : "FACTURE-BROUILLON");

    return {
      type,
      numero,
      date_emission: dateEmission,
      date_validite: type === "devis" ? dateValidite : null,
      date_echeance: type === "facture" ? dateEcheance : null,
      duree_estimee: dureeEstimee ? Number(dureeEstimee) : null,
      duree_unite: dureeEstimee ? dureeUnite : null,
      objet,
      lignes,
      tva_applicable: tvaApplicable,
      mention_tva: mentionTva,
      total_ht: totaux.totalHT,
      total_tva: totaux.totalTVA,
      total_ttc: totaux.totalTTC,
      total_remise: totaux.totalRemise,
      net_a_payer: netAPayerFinal,
      retenue_garantie_montant: retenueMontant,
      conditions_paiement: conditionsPaiementPreview,
      modes_paiement: modesPaiement,
      notes_client: notesClient,
      appearance: appearanceOptions,
      ...clientPayload,
    };
  }, [
    client,
    type,
    document,
    dateEmission,
    dateValidite,
    dateEcheance,
    dureeEstimee,
    dureeUnite,
    objet,
    lignes,
    tvaApplicable,
    mentionTva,
    totaux,
    netAPayerFinal,
    retenueMontant,
    conditionsPaiementPreview,
    modesPaiement,
    notesClient,
    appearanceOptions,
  ]);

  const fetchPreviewPdf = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });

    try {
      const response = await fetch("/api/documents/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.auth.getToken()}` },
        body: JSON.stringify(buildPreviewPayload()),
      });
      if (!response.ok) throw new Error("preview_error");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (error) {
      console.error("Preview PDF error:", error);
      setPreviewError("Impossible de generer le PDF.");
    } finally {
      setPreviewLoading(false);
    }
  }, [buildPreviewPayload]);

  const handleDownloadPreview = () => {
    if (previewPdfUrl) {
      const link = window.document.createElement("a");
      link.href = previewPdfUrl;
      link.download = `${document?.numero || (type === "devis" ? "devis" : "facture")}.pdf`;
      link.click();
      return;
    }

    if (pdfAvailable) {
      window.open(`/api/documents/${document.id}/pdf`, "_blank");
    }
  };

  useEffect(() => {
    if (showPreview) {
      fetchPreviewPdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  useEffect(() => {
    if (!showPreview) {
      setPreviewPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    }
  }, [showPreview]);

  // Auto-save brouillon toutes les 30 secondes si des modifications ont été faites
  const buildAutoSavePayload = useCallback(() => {
    if (!client?.id) return null;
    if (lignes.filter((l) => l.type === "ligne").length === 0) return null;

    const conditionsPaiementValue = resolveConditionsPaiement(conditionsPaiementPreset, conditionsPaiementCustom);
    const dureeEstimeeValue = dureeEstimee === "" ? null : Number(dureeEstimee);
    const dureeEstimeeFinal = Number.isNaN(dureeEstimeeValue) ? null : dureeEstimeeValue;
    const dureeUniteFinal = dureeEstimeeFinal ? dureeUnite : null;
    const retenuePctValue = isFacture && retenueActive ? Math.min(Math.max(Number(retenuePct) || 0, 0), 100) : 0;

    return {
      type, client_id: client.id, date_emission: dateEmission,
      date_validite: type === "devis" ? dateValidite : null,
      date_echeance: type === "facture" ? dateEcheance : null,
      chantier_id: chantier?.id || null,
      date_visite: dateVisite || null,
      date_debut_travaux: dateDebutTravaux || null,
      duree_estimee: dureeEstimeeFinal,
      duree_unite: dureeUniteFinal,
      objet, lignes, tva_applicable: tvaApplicable, mention_tva: mentionTva,
      modes_paiement: modesPaiement,
      conditions_paiement: conditionsPaiementValue,
      remise_type: remiseGlobale.type,
      remise_valeur: remiseGlobale.valeur, acompte_demande: acompte,
      retenue_garantie_pct: retenuePctValue,
      retenue_garantie_montant: retenuePctValue > 0 ? Math.round((totaux.totalTTC * retenuePctValue / 100) * 100) / 100 : 0,
      total_ht: totaux.totalHT,
      total_tva: totaux.totalTVA,
      total_ttc: totaux.totalTTC,
      total_remise: totaux.totalRemise,
      net_a_payer: netAPayerFinal,
      notes_client: notesClient, notes_internes: notesInternes,
    };
  }, [
    client, type, dateEmission, dateValidite, dateEcheance, chantier, dateVisite,
    dateDebutTravaux, dureeEstimee, dureeUnite, objet, lignes, tvaApplicable,
    mentionTva, modesPaiement, conditionsPaiementPreset, conditionsPaiementCustom,
    remiseGlobale, acompte, retenueActive, retenuePct, totaux, netAPayerFinal,
    notesClient, notesInternes, isFacture
  ]);

  const performAutoSave = useCallback(async () => {
    if (isSaving || isAutoSaving) return;

    const payload = buildAutoSavePayload();
    if (!payload) return;

    setIsAutoSaving(true);
    try {
      const endpoint = isEdit ? `/api/documents/${document.id}` : "/api/documents";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.auth.getToken()}` },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setLastAutoSave(new Date());
        // Si c'est une création, on recharge pour avoir l'ID du document
        if (!isEdit) {
          queryClient.invalidateQueries({ queryKey: ["documents"] });
        }
      }
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [buildAutoSavePayload, isSaving, isAutoSaving, isEdit, document?.id, queryClient]);

  // Déclencher l'auto-save après 30 secondes d'inactivité
  useEffect(() => {
    // Ne pas auto-save si document déjà sauvegardé et pas en mode édition
    if (!isEdit && !client?.id) return;

    // Clear previous timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for 30 seconds after last change
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 30000); // 30 secondes

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [buildAutoSavePayload, performAutoSave, isEdit, client?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, []);

  // Auto-refresh preview when form data changes (debounced)
  const autoRefreshTimeoutRef = useRef(null);
  const prevPayloadRef = useRef(null);

  useEffect(() => {
    if (!showPreview) return;

    const currentPayload = JSON.stringify(buildPreviewPayload());
    // Skip if payload hasn't changed
    if (prevPayloadRef.current === currentPayload) return;
    prevPayloadRef.current = currentPayload;

    // Clear existing timeout
    if (autoRefreshTimeoutRef.current) {
      clearTimeout(autoRefreshTimeoutRef.current);
    }

    // Debounce: wait 800ms after last change before refreshing
    autoRefreshTimeoutRef.current = setTimeout(() => {
      fetchPreviewPdf();
    }, 800);

    return () => {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
    };
  }, [showPreview, buildPreviewPayload, fetchPreviewPdf]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.auth.getToken()}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Erreur creation");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onSuccess?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.auth.getToken()}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Erreur mise a jour");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onSuccess?.();
    },
  });

  const handleSave = async (sendAfter = false) => {
    const showError = (title, message) => {
      setFormError(message);
      toast({ variant: "destructive", title, description: message });
    };

    setFormError("");
    if (!client?.id) {
      showError("Client requis", "Veuillez selectionner un client.");
      return;
    }
    if (lignes.filter((l) => l.type === "ligne").length === 0) {
      showError("Lignes requises", "Veuillez ajouter au moins une ligne.");
      return;
    }

    setIsSaving(true);
    const conditionsPaiementValue = resolveConditionsPaiement(conditionsPaiementPreset, conditionsPaiementCustom);
    const dureeEstimeeValue = dureeEstimee === "" ? null : Number(dureeEstimee);
    const dureeEstimeeFinal = Number.isNaN(dureeEstimeeValue) ? null : dureeEstimeeValue;
    const dureeUniteFinal = dureeEstimeeFinal ? dureeUnite : null;
    const retenuePctValue = isFacture && retenueActive ? retenuePctNumeric : 0;
    const data = {
      type, client_id: client.id, date_emission: dateEmission,
      date_validite: type === "devis" ? dateValidite : null,
      date_echeance: type === "facture" ? dateEcheance : null,
      chantier_id: chantier?.id || null,
      date_visite: dateVisite || null,
      date_debut_travaux: dateDebutTravaux || null,
      duree_estimee: dureeEstimeeFinal,
      duree_unite: dureeUniteFinal,
      objet, lignes, tva_applicable: tvaApplicable, mention_tva: mentionTva,
      modes_paiement: modesPaiement,
      conditions_paiement: conditionsPaiementValue,
      remise_type: remiseGlobale.type,
      remise_valeur: remiseGlobale.valeur, acompte_demande: acompte,
      retenue_garantie_pct: retenuePctValue,
      retenue_garantie_montant: retenuePctValue > 0 ? retenueMontant : 0,
      total_ht: totaux.totalHT,
      total_tva: totaux.totalTVA,
      total_ttc: totaux.totalTTC,
      total_remise: totaux.totalRemise,
      net_a_payer: netAPayerFinal,
      notes_client: notesClient, notes_internes: notesInternes,
    };

    try {
      if (isEdit) await updateMutation.mutateAsync(data);
      else await createMutation.mutateAsync(data);
      setFormError("");
    } catch (error) {
      console.error("Erreur:", error);
      const message = error?.message || "Erreur lors de l'enregistrement";
      showError("Enregistrement impossible", message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModesPaiementChange = (modeId, checked) => {
    if (checked) setModesPaiement([...modesPaiement, modeId]);
    else setModesPaiement(modesPaiement.filter((m) => m !== modeId));
  };

  const TypeIcon = type === "devis" ? FileText : Receipt;
  const typeLabel = type === "devis" ? "Devis" : "Facture";

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <AdminHero
        icon={TypeIcon}
        eyebrow={isEdit ? "Modification" : "Création"}
        title={`${isEdit ? "Modifier" : "Nouveau"} ${typeLabel}`}
        subtitle={isEdit ? `${document.numero}` : `Création rapide en quelques étapes`}
        badges={client ? [client.nom] : []}
        color={type === "devis" ? "var(--color-primary-500)" : "var(--color-secondary-500)"}
        rightContent={
          <div className="flex items-center gap-2">
            {/* Indicateur auto-save */}
            {(isAutoSaving || lastAutoSave) && (
              <div className="text-xs text-white/60 flex items-center gap-1">
                {isAutoSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sauvegarde...</span>
                  </>
                ) : lastAutoSave ? (
                  <span>Sauvegardé à {lastAutoSave.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                ) : null}
              </div>
            )}
            <Button variant="outline" onClick={onClose} className="hero-action hero-action--ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(true)} className="hero-action hero-action--ghost">
              <Eye className="w-4 h-4 mr-2" />
              Apercu
            </Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving || isAutoSaving} className="hero-action hero-action--solid">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        }
      />

      {formError && (
        <Alert className="bg-[var(--color-error-bg)] border-[var(--color-error-border)]">
          <div className="flex items-start justify-between gap-3">
            <AlertDescription className="text-[var(--color-error-text)] text-sm">
              {formError}
            </AlertDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setFormError("")}
              className="h-7 w-7 -mr-2 text-[var(--color-error-text)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Step 1: Client */}
          <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
            <CardHeader className="p-4 border-b" style={{ borderColor: "var(--color-border-light)" }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${type === "devis" ? "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]" : "bg-[var(--color-secondary-100)] text-[var(--color-secondary-600)]"}`}>1</div>
                <CardTitle className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Client</CardTitle>
                {client && <Badge className="bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]"><CheckCircle2 className="w-3 h-3 mr-1" />Sélectionné</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {client ? (
                <div className="flex items-start justify-between p-4 rounded-xl border" style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border-light)" }}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${type === "devis" ? "bg-[var(--color-primary-100)]" : "bg-[var(--color-secondary-100)]"}`}>
                      {client.type === "professionnel" ? <Building2 className={`w-5 h-5 ${type === "devis" ? "text-[var(--color-primary-600)]" : "text-[var(--color-secondary-600)]"}`} /> : <User className={`w-5 h-5 ${type === "devis" ? "text-[var(--color-primary-600)]" : "text-[var(--color-secondary-600)]"}`} />}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{client.nom}</p>
                      {client.adresse_ligne1 && <p className="text-sm text-[var(--color-text-secondary)]">{client.adresse_ligne1}, {client.code_postal} {client.ville}</p>}
                      <div className="flex items-center gap-4 mt-1 text-sm text-[var(--color-text-tertiary)]">
                        {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
                        {client.telephone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.telephone}</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowClientSelector(true)}>Changer</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-20 border-dashed border-2" onClick={() => setShowClientSelector(true)}>
                  <Plus className="w-5 h-5 mr-2" />Sélectionner un client
                </Button>
              )}
            </CardContent>
          </Card>

            {/* Step 2: Chantier */}
          <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
            <CardHeader className="p-4 border-b" style={{ borderColor: "var(--color-border-light)" }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${type === "devis" ? "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]" : "bg-[var(--color-secondary-100)] text-[var(--color-secondary-600)]"}`}>2</div>
                <CardTitle className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Chantier</CardTitle>
                {chantier && <Badge className="bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]">Lie</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {chantier ? (
                <div className="flex items-start justify-between p-4 rounded-xl border" style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border-light)" }}>
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[var(--color-bg-surface-hover)]">
                      <MapPin className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{chantier.titre || "Chantier sans titre"}</p>
                      {chantier.client && <p className="text-sm text-[var(--color-text-secondary)]">{chantier.client}</p>}
                      {(chantier.date_debut || chantier.date_fin) && (
                        <div className="flex items-center gap-4 mt-1 text-sm text-[var(--color-text-tertiary)]">
                          {chantier.date_debut && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Debut: {formatDate(chantier.date_debut)}</span>}
                          {chantier.date_fin && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Fin: {formatDate(chantier.date_fin)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowChantierSelector(true)}>Changer</Button>
                    <Button variant="ghost" size="sm" onClick={() => setChantier(null)}>Retirer</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-20 border-dashed border-2" onClick={() => setShowChantierSelector(true)}>
                  <Plus className="w-5 h-5 mr-2" />Lier un chantier
                </Button>
              )}
            </CardContent>
          </Card>

          </div>
          {/* Step 3: Lignes */}
          <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
            <CardHeader className="p-4 border-b" style={{ borderColor: "var(--color-border-light)" }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${type === "devis" ? "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]" : "bg-[var(--color-secondary-100)] text-[var(--color-secondary-600)]"}`}>3</div>
                <CardTitle className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Lignes du {typeLabel.toLowerCase()}</CardTitle>
                {lignes.filter(l => l.type === "ligne").length > 0 && (
                  <Badge className="bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]">
                    {lignes.filter(l => l.type === "ligne").length} ligne(s)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <DocumentLignes
                lignes={lignes}
                onChange={setLignes}
                tvaApplicable={tvaApplicable}
                client={client}
                documentType={type}
                objet={objet}
              />
            </CardContent>
          </Card>

          {/* Step 4: Options */}
          <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
            <CardHeader className="p-4 border-b" style={{ borderColor: "var(--color-border-light)" }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${type === "devis" ? "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]" : "bg-[var(--color-secondary-100)] text-[var(--color-secondary-600)]"}`}>4</div>
                <CardTitle className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Options</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {/* Dates & Objet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Date d'émission</Label>
                  <Input type="date" value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} className="mt-1" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                </div>
                {type === "devis" && (
                  <div>
                    <Label className="text-sm font-medium">Valide jusqu'au</Label>
                    <Input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} className="mt-1" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                  </div>
                )}
                {type === "facture" && (
                  <div>
                    <Label className="text-sm font-medium">Échéance paiement</Label>
                    <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className="mt-1" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                  </div>
                )}
                <div className={type === "devis" ? "" : "sm:col-span-2 lg:col-span-1"}>
                  <Label className="text-sm font-medium">Objet</Label>
                  <Input placeholder="Ex: Rénovation salle de bain" value={objet} onChange={(e) => setObjet(e.target.value)} className="mt-1" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                </div>
              </div>

              {/* Dates avancees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Visite prealable</Label>
                  <Input type="date" value={dateVisite} onChange={(e) => setDateVisite(e.target.value)} className="mt-1" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Debut des travaux</Label>
                  <Input type="date" value={dateDebutTravaux} onChange={(e) => setDateDebutTravaux(e.target.value)} className="mt-1" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Duree estimee</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min="0"
                      value={dureeEstimee}
                      onChange={(e) => setDureeEstimee(e.target.value)}
                      className="w-24"
                      style={{ backgroundColor: "var(--color-bg-elevated)" }}
                    />
                    <Select value={dureeUnite} onValueChange={setDureeUnite}>
                      <SelectTrigger className="w-36" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jours">Jours</SelectItem>
                        <SelectItem value="semaines">Semaines</SelectItem>
                        <SelectItem value="mois">Mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* TVA */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                <div className="flex items-center gap-2">
                  <Checkbox id="tva" checked={tvaApplicable} onCheckedChange={setTvaApplicable} />
                  <Label htmlFor="tva" className="cursor-pointer font-medium">TVA applicable</Label>
                </div>
                {!tvaApplicable && (
                  <Input placeholder="Mention TVA" value={mentionTva} onChange={(e) => setMentionTva(e.target.value)} className="mt-3 max-w-md" style={{ backgroundColor: "var(--color-bg-surface)" }} />
                )}
              </div>

              {/* Modes de paiement */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Modes de paiement acceptés</Label>
                <div className="flex flex-wrap gap-3">
                  {MODES_PAIEMENT.map((mode) => (
                    <div key={mode.id} className="flex items-center gap-2">
                      <Checkbox id={`mode-${mode.id}`} checked={modesPaiement.includes(mode.id)} onCheckedChange={(checked) => handleModesPaiementChange(mode.id, checked)} />
                      <Label htmlFor={`mode-${mode.id}`} className="cursor-pointer text-sm">{mode.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions de paiement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Conditions de paiement</Label>
                  <Select
                    value={conditionsPaiementPreset}
                    onValueChange={(value) => {
                      setConditionsPaiementPreset(value);
                      if (value !== "custom") setConditionsPaiementCustom("");
                    }}
                  >
                    <SelectTrigger className="w-full" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                      <SelectValue placeholder="Selectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS_PAIEMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {conditionsPaiementPreset === "custom" && (
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium mb-2 block">Conditions personnalisees</Label>
                    <Textarea
                      placeholder="Ex: 40% a la commande, solde a la livraison"
                      value={conditionsPaiementCustom}
                      onChange={(e) => setConditionsPaiementCustom(e.target.value)}
                      rows={3}
                      style={{ backgroundColor: "var(--color-bg-elevated)" }}
                    />
                  </div>
                )}
              </div>

              {/* Retenue de garantie */}
              {isFacture && (
                <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="retenue"
                        checked={retenueActive}
                        onCheckedChange={(checked) => {
                          const nextValue = Boolean(checked);
                          setRetenueActive(nextValue);
                          if (nextValue && (!retenuePct || Number(retenuePct) === 0)) {
                            setRetenuePct(5);
                          }
                        }}
                      />
                      <Label htmlFor="retenue" className="cursor-pointer font-medium">
                        Retenue de garantie
                      </Label>
                    </div>
                    {retenueActive && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={retenuePct}
                          onChange={(e) => setRetenuePct(e.target.value)}
                          className="w-20"
                          style={{ backgroundColor: "var(--color-bg-surface)" }}
                        />
                        <span className="text-sm text-[var(--color-text-secondary)]">%</span>
                      </div>
                    )}
                  </div>
                  {retenueActive && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                      Montant retenu: {formatMontant(retenueMontant)}
                    </p>
                  )}
                </div>
              )}

              {/* Remise & Acompte */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Remise globale</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" placeholder="0" value={remiseGlobale.valeur || ""} onChange={(e) => setRemiseGlobale({ ...remiseGlobale, valeur: parseFloat(e.target.value) || 0 })} className="w-24" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                    <Select value={remiseGlobale.type || "none"} onValueChange={(v) => setRemiseGlobale({ ...remiseGlobale, type: v === "none" ? null : v })}>
                      <SelectTrigger className="w-28" style={{ backgroundColor: "var(--color-bg-elevated)" }}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        <SelectItem value="pourcentage">%</SelectItem>
                        <SelectItem value="montant">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {type === "devis" && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Acompte demandé</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" placeholder="0" value={acompte || ""} onChange={(e) => setAcompte(parseFloat(e.target.value) || 0)} className="w-32" style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                      <span className="text-[var(--color-text-secondary)]">EUR</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Notes pour le client</Label>
                  <Textarea placeholder="Conditions particulières..." value={notesClient} onChange={(e) => setNotesClient(e.target.value)} rows={3} style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Notes internes</Label>
                  <Textarea placeholder="Notes privées..." value={notesInternes} onChange={(e) => setNotesInternes(e.target.value)} rows={3} style={{ backgroundColor: "var(--color-bg-elevated)" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Récapitulatif */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
              <CardHeader className="p-4 border-b" style={{ borderColor: "var(--color-border-light)" }}>
                <CardTitle className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Total HT</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{formatMontant(totaux.totalHT)}</span>
                  </div>
                  {tvaApplicable && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">TVA</span>
                      <span className="font-medium text-[var(--color-text-primary)]">{formatMontant(totaux.totalTVA)}</span>
                    </div>
                  )}
                  {totaux.totalRemise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">Remise</span>
                      <span className="font-medium text-[var(--color-warning-text)]">-{formatMontant(totaux.totalRemise)}</span>
                    </div>
                  )}
                  {retenueMontant > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">Retenue garantie</span>
                      <span className="font-medium text-[var(--color-warning-text)]">-{formatMontant(retenueMontant)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[var(--color-border-light)]">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[var(--color-text-primary)]">Net a payer</span>
                    <span className="text-2xl font-bold text-[var(--color-primary-600)]">{formatMontant(netAPayerFinal)}</span>
                  </div>
                  {!tvaApplicable && (
                    <p className="text-xs mt-2 italic text-[var(--color-text-tertiary)]">{mentionTva}</p>
                  )}
                </div>

                <div className="pt-4 space-y-2">
                  <Button className="w-full" onClick={() => handleSave(false)} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Enregistrer
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleSave(true)} disabled={isSaving}>
                    <Send className="w-4 h-4 mr-2" />
                    Enregistrer et envoyer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3 text-[var(--color-text-primary)]">Checklist</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${client ? "bg-[var(--color-success-bg)]" : "bg-[var(--color-bg-surface-hover)]"}`}>
                      {client ? <CheckCircle2 className="w-3 h-3 text-[var(--color-success-text)]" /> : <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />}
                    </div>
                    <span className={client ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>Client sélectionné</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${lignes.filter(l => l.type === "ligne").length > 0 ? "bg-[var(--color-success-bg)]" : "bg-[var(--color-bg-surface-hover)]"}`}>
                      {lignes.filter(l => l.type === "ligne").length > 0 ? <CheckCircle2 className="w-3 h-3 text-[var(--color-success-text)]" /> : <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />}
                    </div>
                    <span className={lignes.filter(l => l.type === "ligne").length > 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>Lignes ajoutées</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${objet ? "bg-[var(--color-success-bg)]" : "bg-[var(--color-bg-surface-hover)]"}`}>
                      {objet ? <CheckCircle2 className="w-3 h-3 text-[var(--color-success-text)]" /> : <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />}
                    </div>
                    <span className={objet ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>Objet renseigné</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col min-h-0">
          <DialogHeader>
            <DialogTitle>Apercu du document</DialogTitle>
          </DialogHeader>
          <div className="flex-1 -mx-6 px-6 pb-4 overflow-hidden min-h-0">
            <div className="h-full flex gap-4 min-h-0">
              {/* PDF Preview */}
              <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Apercu genere a partir du rendu PDF final. Se met a jour automatiquement.
                </p>
                {previewLoading && (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generation du PDF en cours...
                  </div>
                )}
                {previewError && (
                  <div className="text-sm text-[var(--color-error-text)]">{previewError}</div>
                )}
                {!previewLoading && previewPdfUrl && (
                  <iframe
                    title="Apercu PDF"
                    className="w-full flex-1 min-h-[60vh] rounded-lg border border-[var(--color-border-light)] bg-white"
                    src={previewPdfUrl}
                  />
                )}
                {!previewLoading && !previewPdfUrl && !previewError && (
                  <div className="text-sm text-[var(--color-text-secondary)]">Aucun apercu disponible.</div>
                )}
              </div>

              {/* Appearance Panel */}
              <div className="w-72 flex-shrink-0 border-l border-[var(--color-border-light)] pl-4 pr-2 overflow-y-auto h-full min-h-0">
                <div className="sticky top-0 bg-[var(--color-bg-surface)] pb-3 mb-3 border-b border-[var(--color-border-light)]">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Apparence du document</h3>
                </div>
                <DocumentAppearancePanel
                  options={appearanceOptions}
                  onChange={handleAppearanceChange}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border-light)] pt-4 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Fermer
            </Button>
            <Button variant="outline" onClick={fetchPreviewPdf} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Rafraichir
            </Button>
            <Button onClick={handleDownloadPreview} disabled={!previewPdfUrl && !pdfAvailable}>
              Telecharger PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chantier Selector Dialog */}
      <Dialog open={showChantierSelector} onOpenChange={setShowChantierSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Selectionner un chantier</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <ChantierSelector onSelect={(c) => { setChantier(c); setShowChantierSelector(false); }} selectedId={chantier?.id} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Selector Dialog */}
      <Dialog open={showClientSelector} onOpenChange={setShowClientSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Sélectionner un client</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <ClientSelector onSelect={(c) => { setClient(c); setShowClientSelector(false); }} selectedId={client?.id} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
