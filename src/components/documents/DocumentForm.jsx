import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

export default function DocumentForm({ type = "devis", document = null, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const isEdit = !!document;
  const initialConditions = getConditionsPreset(document?.conditions_paiement);
  const initialRetenuePct = document?.retenue_garantie_pct > 0 ? document.retenue_garantie_pct : 5;
  const isFacture = type === "facture";

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
  const [appearanceOptions, setAppearanceOptions] = useState({
    primaryColor: "#1a5490",
    font: "Helvetica",
    fontSize: "normal",
    tableStyle: "rounded",
    hide: {},
    showSectionSubtotals: true,
    showQrCode: true,
  });
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

  const totaux = calculerTotaux(lignes, remiseGlobale, tvaApplicable);
  const retenuePctNumeric = Math.min(Math.max(Number(retenuePct) || 0, 0), 100);
  const retenueMontant = isFacture && retenueActive
    ? Math.round((totaux.totalTTC * retenuePctNumeric / 100) * 100) / 100
    : 0;
  const netAPayerFinal = Math.round((totaux.totalTTC - retenueMontant) * 100) / 100;
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
      if (!response.ok) throw new Error("Erreur création");
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
      if (!response.ok) throw new Error("Erreur mise à jour");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onSuccess?.();
    },
  });

  const handleSave = async (sendAfter = false) => {
    if (!client) { alert("Veuillez sélectionner un client"); return; }
    if (lignes.filter((l) => l.type === "ligne").length === 0) { alert("Veuillez ajouter au moins une ligne"); return; }

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
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de l'enregistrement");
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
        gradient={type === "devis"
          ? "linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))"
          : "linear-gradient(135deg, var(--color-secondary-500), var(--color-secondary-600))"
        }
        rightContent={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <Button variant="ghost" onClick={() => setShowPreview(true)} className="text-white/80 hover:text-white hover:bg-white/10">
              <Eye className="w-4 h-4 mr-2" />
              Apercu
            </Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
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
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Apercu du document</DialogTitle>
          </DialogHeader>
          <div className="flex-1 -mx-6 px-6 pb-4 overflow-hidden">
            <div className="h-full flex gap-4">
              {/* PDF Preview */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
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
              <div className="w-72 flex-shrink-0 border-l border-[var(--color-border-light)] pl-4 overflow-y-auto">
                <div className="sticky top-0 bg-[var(--color-bg-surface)] pb-3 mb-3 border-b border-[var(--color-border-light)]">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Apparence du document</h3>
                </div>
                <DocumentAppearancePanel
                  options={appearanceOptions}
                  onChange={setAppearanceOptions}
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
