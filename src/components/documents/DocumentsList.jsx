import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminHero } from "@/components/admin/AdminHero";
import {
  Plus,
  Search,
  MoreVertical,
  FileText,
  Receipt,
  FileX,
  Eye,
  Edit2,
  Copy,
  Send,
  Trash2,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileDown,
} from "lucide-react";

const STATUTS = {
  brouillon: {
    label: "Brouillon",
    color: "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] border-[var(--color-border-light)]",
    icon: FileText,
  },
  envoye: {
    label: "Envoyé",
    color: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]",
    icon: Send,
  },
  vu: {
    label: "Vu",
    color: "bg-[var(--color-primary-100)] text-[var(--color-primary-600)] border-[var(--color-primary-300)]",
    icon: Eye,
  },
  accepte: {
    label: "Accepté",
    color: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]",
    icon: CheckCircle2,
  },
  refuse: {
    label: "Refusé",
    color: "bg-[var(--color-error-bg)] text-[var(--color-error-text)] border-[var(--color-error-border)]",
    icon: XCircle,
  },
  expire: {
    label: "Expiré",
    color: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]",
    icon: Clock,
  },
  paye: {
    label: "Payé",
    color: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]",
    icon: CheckCircle2,
  },
  paye_partiel: {
    label: "Partiel",
    color: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]",
    icon: AlertCircle,
  },
  annule: {
    label: "Annulé",
    color: "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)] border-[var(--color-border-light)]",
    icon: FileX,
  },
};

const TYPES = {
  devis: { label: "Devis", icon: FileText, color: "text-[var(--color-primary-600)]", bg: "bg-[var(--color-primary-100)]" },
  facture: { label: "Facture", icon: Receipt, color: "text-[var(--color-secondary-600)]", bg: "bg-[var(--color-secondary-100)]" },
  avoir: { label: "Avoir", icon: FileX, color: "text-[var(--color-error-text)]", bg: "bg-[var(--color-error-bg)]" },
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMontant(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function getJoursRetard(dateEcheance) {
  if (!dateEcheance) return 0;
  const diff = Math.floor((new Date() - new Date(dateEcheance)) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

// Onglets de statut pour le filtrage
const STATUS_TABS = [
  { value: "all", label: "Tous" },
  { value: "brouillon", label: "Brouillons" },
  { value: "envoye", label: "Envoyés" },
  { value: "accepte", label: "Acceptés" },
  { value: "a_facturer", label: "À facturer" },
  { value: "paye", label: "Payés" },
  { value: "refuse", label: "Refusés" },
];

export default function DocumentsList({ onCreateDocument, onEditDocument, onViewDocument }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewDocId = previewDoc?.id;
  const queryClient = useQueryClient();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", filterType],
    queryFn: async () => {
      const response = await fetch("/api/documents", {
        headers: { Authorization: `Bearer ${api.auth.getToken()}` },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${api.auth.getToken()}` },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/documents/${id}/dupliquer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${api.auth.getToken()}` },
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const envoyerMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/documents/${id}/envoyer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${api.auth.getToken()}` },
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  // Compteurs par statut
  const statusCounts = {
    all: documents.length,
    brouillon: documents.filter(d => d.statut === "brouillon").length,
    envoye: documents.filter(d => d.statut === "envoye").length,
    accepte: documents.filter(d => d.statut === "accepte").length,
    a_facturer: documents.filter(d => d.type === "devis" && d.statut === "accepte").length,
    paye: documents.filter(d => d.statut === "paye" || d.statut === "paye_partiel").length,
    refuse: documents.filter(d => d.statut === "refuse" || d.statut === "annule").length,
  };

  // Filtrage
  let filteredDocuments = documents;
  if (filterType !== "all") {
    filteredDocuments = filteredDocuments.filter((d) => d.type === filterType);
  }
  // Filtrage par onglet actif
  if (activeTab !== "all") {
    if (activeTab === "a_facturer") {
      filteredDocuments = filteredDocuments.filter((d) => d.type === "devis" && d.statut === "accepte");
    } else if (activeTab === "paye") {
      filteredDocuments = filteredDocuments.filter((d) => d.statut === "paye" || d.statut === "paye_partiel");
    } else if (activeTab === "refuse") {
      filteredDocuments = filteredDocuments.filter((d) => d.statut === "refuse" || d.statut === "annule");
    } else {
      filteredDocuments = filteredDocuments.filter((d) => d.statut === activeTab);
    }
  }
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredDocuments = filteredDocuments.filter((doc) =>
      doc.numero?.toLowerCase().includes(term) ||
      doc.client_nom?.toLowerCase().includes(term) ||
      doc.objet?.toLowerCase().includes(term)
    );
  }

  // Export CSV
  const exportCSV = () => {
    const headers = ["Numéro", "Type", "Client", "Objet", "Date émission", "Montant TTC", "Statut"];
    const rows = filteredDocuments.map(doc => [
      doc.numero,
      doc.type,
      doc.client_nom || "",
      doc.objet || "",
      formatDate(doc.date_emission),
      doc.net_a_payer || 0,
      STATUTS[doc.statut]?.label || doc.statut
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `documents_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!previewDocId) {
      setPreviewLoading(false);
      setPreviewError("");
      setPreviewPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      return;
    }

    let active = true;
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });

    const fetchPdf = async () => {
      try {
        const response = await fetch(`/api/documents/${previewDocId}/pdf?inline=1`, {
          headers: { Authorization: `Bearer ${api.auth.getToken()}` },
        });
        if (!response.ok) throw new Error("pdf_error");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewPdfUrl(url);
      } catch (error) {
        if (active) {
          console.error("PDF preview error:", error);
          setPreviewError("Impossible de charger le PDF.");
        }
      } finally {
        if (active) setPreviewLoading(false);
      }
    };

    fetchPdf();

    return () => {
      active = false;
    };
  }, [previewDocId]);

  const handleDownloadPreview = () => {
    if (previewPdfUrl) {
      const link = document.createElement("a");
      link.href = previewPdfUrl;
      link.download = `${previewDoc?.numero || "document"}.pdf`;
      link.click();
      return;
    }

    if (previewDocId) {
      window.open(`/api/documents/${previewDocId}/pdf`, "_blank");
    }
  };

  // Stats
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthDocs = documents.filter((d) => {
    const date = new Date(d.date_emission);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const stats = {
    devis: {
      count: thisMonthDocs.filter((d) => d.type === "devis").length,
      montant: thisMonthDocs.filter((d) => d.type === "devis").reduce((sum, d) => sum + (d.net_a_payer || 0), 0),
    },
    factures: {
      count: thisMonthDocs.filter((d) => d.type === "facture").length,
      montant: thisMonthDocs.filter((d) => d.type === "facture").reduce((sum, d) => sum + (d.net_a_payer || 0), 0),
    },
    impayes: {
      count: documents.filter((d) => d.type === "facture" && !["paye", "annule"].includes(d.statut) && getJoursRetard(d.date_echeance) > 0).length,
      montant: documents.filter((d) => d.type === "facture" && !["paye", "annule"].includes(d.statut) && getJoursRetard(d.date_echeance) > 0).reduce((sum, d) => sum + (d.net_a_payer || 0), 0),
    },
  };

  const handleDelete = (doc) => {
    if (doc.statut !== "brouillon") {
      alert("Seuls les brouillons peuvent être supprimés");
      return;
    }
    if (confirm(`Supprimer ${doc.type} ${doc.numero} ?`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <AdminHero
        icon={Receipt}
        eyebrow="Gestion commerciale"
        title="Devis & Factures"
        subtitle={`Synthèse ${monthLabel} — ${documents.length} document${documents.length > 1 ? "s" : ""}`}
        badges={[`${stats.devis.count} devis`, `${stats.factures.count} factures`]}
        gradient="linear-gradient(135deg, var(--color-secondary-500), var(--color-primary-500))"
        rightContent={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCreateDocument?.("devis")}>
                <FileText className="w-4 h-4 mr-2 text-[var(--color-primary-600)]" />
                Nouveau devis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateDocument?.("facture")}>
                <Receipt className="w-4 h-4 mr-2 text-[var(--color-secondary-600)]" />
                Nouvelle facture
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[var(--color-primary-100)]">
                <FileText className="w-6 h-6 text-[var(--color-primary-600)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Devis ce mois</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.devis.count}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[var(--color-primary-600)]">{formatMontant(stats.devis.montant)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[var(--color-secondary-100)]">
                <Receipt className="w-6 h-6 text-[var(--color-secondary-600)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Factures ce mois</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.factures.count}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[var(--color-secondary-600)]">{formatMontant(stats.factures.montant)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="admin-card"
          style={{ borderColor: stats.impayes.count > 0 ? "var(--color-error-border)" : "var(--color-border-light)" }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${
                  stats.impayes.count > 0 ? "bg-[var(--color-error-bg)]" : "bg-[var(--color-bg-surface-hover)]"
                }`}
              >
                <AlertCircle
                  className={`w-6 h-6 ${
                    stats.impayes.count > 0 ? "text-[var(--color-error-text)]" : "text-[var(--color-text-tertiary)]"
                  }`}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Impayés</p>
                <p
                  className={`text-2xl font-bold ${
                    stats.impayes.count > 0 ? "text-[var(--color-error-text)]" : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {stats.impayes.count}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-lg font-semibold ${
                    stats.impayes.count > 0 ? "text-[var(--color-error-text)]" : "text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {formatMontant(stats.impayes.montant)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets de filtrage par statut */}
      <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
        <CardContent className="p-4 space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full h-auto flex flex-wrap gap-1 p-1 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-surface-hover)]">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 min-w-[100px] px-3 py-2 text-sm text-[var(--color-text-secondary)] data-[state=active]:bg-[var(--color-bg-elevated)] data-[state=active]:text-[var(--color-text-primary)] data-[state=active]:shadow-sm rounded-md"
                >
                  {tab.label}
                  {statusCounts[tab.value] > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.value
                        ? "bg-[var(--color-primary-100)] text-[var(--color-primary-600)]"
                        : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                    }`}>
                      {statusCounts[tab.value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <Input
                placeholder="Rechercher par numéro, client, objet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                style={{ backgroundColor: "var(--color-bg-elevated)" }}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-36" style={{ backgroundColor: "var(--color-bg-elevated)" }}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="devis">Devis</SelectItem>
                <SelectItem value="facture">Factures</SelectItem>
                <SelectItem value="avoir">Avoirs</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
        <CardHeader className="p-4 border-b" style={{ borderColor: "var(--color-border-light)" }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Documents ({filteredDocuments.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-primary-500)" }} />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
              <p className="mb-4 text-[var(--color-text-secondary)]">
                {searchTerm || filterType !== "all" || activeTab !== "all"
                  ? "Aucun document trouvé"
                  : "Aucun document pour le moment"}
              </p>
              <Button onClick={() => onCreateDocument?.("devis")}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un devis
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-light)]">
              {filteredDocuments.map((doc) => {
                const typeInfo = TYPES[doc.type] || TYPES.devis;
                const statutInfo = STATUTS[doc.statut] || STATUTS.brouillon;
                const TypeIcon = typeInfo.icon;
                const StatutIcon = statutInfo.icon;
                const joursRetard = getJoursRetard(doc.date_echeance);
                const isRetard = doc.type === "facture" && !["paye", "annule"].includes(doc.statut) && joursRetard > 0;

                return (
                  <div
                    key={doc.id}
                    className="group flex items-center gap-4 p-4 hover:bg-[var(--color-bg-surface-hover)] cursor-pointer transition-colors"
                    style={{ backgroundColor: isRetard ? "var(--color-error-bg)" : undefined }}
                    onClick={() => onViewDocument?.(doc)}
                  >
                    {/* Type Icon */}
                    <div className={`p-2.5 rounded-xl ${typeInfo.bg} flex-shrink-0`}>
                      <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {doc.numero}
                        </span>
                        <Badge className={`text-xs border ${statutInfo.color}`}>
                          <StatutIcon className="w-3 h-3 mr-1" />
                          {statutInfo.label}
                        </Badge>
                        {isRetard && (
                          <Badge className="text-xs bg-[var(--color-error-bg)] text-[var(--color-error-text)] border-[var(--color-error-border)]">
                            {joursRetard}j retard
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                        {doc.client_nom || "Client non défini"}
                      </p>
                      {doc.objet && (
                        <p className="text-sm truncate text-[var(--color-text-tertiary)]">
                          {doc.objet}
                        </p>
                      )}
                    </div>

                    {/* Date */}
                    <div className="hidden sm:block text-sm text-right text-[var(--color-text-secondary)]">
                      <p>{formatDate(doc.date_emission)}</p>
                      {doc.type === "devis" && doc.date_validite && (
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          Exp: {formatDate(doc.date_validite)}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                        {formatMontant(doc.net_a_payer)}
                      </p>
                    </div>

                    {/* Quick Preview Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                    >
                      <Eye className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                    </Button>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => onViewDocument?.(doc)}>
                          <Eye className="w-4 h-4 mr-2" />Voir
                        </DropdownMenuItem>
                        {doc.statut === "brouillon" && (
                          <DropdownMenuItem onClick={() => onEditDocument?.(doc)}>
                            <Edit2 className="w-4 h-4 mr-2" />Modifier
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => window.open(`/api/documents/${doc.id}/pdf`, "_blank")}>
                          <Download className="w-4 h-4 mr-2" />PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {doc.statut === "brouillon" && (
                          <DropdownMenuItem onClick={() => envoyerMutation.mutate(doc.id)}>
                            <Send className="w-4 h-4 mr-2" />Envoyer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(doc.id)}>
                          <Copy className="w-4 h-4 mr-2" />Dupliquer
                        </DropdownMenuItem>
                        {doc.statut === "brouillon" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-[var(--color-error-text)]" onClick={() => handleDelete(doc)}>
                              <Trash2 className="w-4 h-4 mr-2" />Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet Aper?u rapide */}
      <Sheet open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-hidden flex flex-col">
          {previewDoc && (
            <>
              <SheetHeader className="border-b border-[var(--color-border-light)] pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${TYPES[previewDoc.type]?.bg || "bg-[var(--color-bg-surface-hover)]"}`}>
                      {React.createElement(TYPES[previewDoc.type]?.icon || FileText, {
                        className: `w-5 h-5 ${TYPES[previewDoc.type]?.color || "text-[var(--color-text-secondary)]"}`
                      })}
                    </div>
                    <div>
                      <SheetTitle className="text-left">{previewDoc.numero}</SheetTitle>
                      <Badge className={`text-xs border mt-1 ${STATUTS[previewDoc.statut]?.color || ""}`}>
                        {STATUTS[previewDoc.statut]?.label || previewDoc.statut}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 -mx-6 px-6 py-4 overflow-hidden flex flex-col gap-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Apercu du PDF final du document.
                </p>
                {previewLoading && (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement du PDF...
                  </div>
                )}
                {previewError && (
                  <div className="text-sm text-[var(--color-error-text)]">{previewError}</div>
                )}
                {!previewLoading && previewPdfUrl && (
                  <iframe
                    title={`Apercu PDF ${previewDoc.numero}`}
                    className="w-full flex-1 min-h-[60vh] rounded-lg border border-[var(--color-border-light)] bg-white"
                    src={previewPdfUrl}
                  />
                )}
                {!previewLoading && !previewPdfUrl && !previewError && (
                  <div className="text-sm text-[var(--color-text-secondary)]">Aucun apercu disponible.</div>
                )}
              </div>

              <div className="border-t border-[var(--color-border-light)] pt-4 flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1 min-w-[140px]" onClick={() => { setPreviewDoc(null); onEditDocument?.(previewDoc); }}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button variant="outline" onClick={handleDownloadPreview} disabled={!previewPdfUrl && !previewDocId}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => envoyerMutation.mutate(previewDocId)} disabled={!previewDocId}>
                  <Send className="w-4 h-4" />
                </Button>
                <Button className="flex-1 min-w-[140px]" onClick={() => { setPreviewDoc(null); onViewDocument?.(previewDoc); }}>
                  Voir details
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
