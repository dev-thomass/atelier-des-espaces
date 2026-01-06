import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { AdminHero, AdminPanel } from "@/components/admin/AdminHero";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2,
  Edit2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const DEFAULT_CLIENT = {
  type: "particulier",
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  adresse_ligne1: "",
  adresse_ligne2: "",
  code_postal: "",
  ville: "",
  pays: "",
  siret: "",
  tva_intracom: "",
  notes: "",
};

const buildPayload = (client) => ({
  type: client.type || "particulier",
  nom: (client.nom || "").trim(),
  prenom: (client.prenom || "").trim(),
  email: (client.email || "").trim(),
  telephone: (client.telephone || "").trim(),
  adresse_ligne1: (client.adresse_ligne1 || "").trim(),
  adresse_ligne2: (client.adresse_ligne2 || "").trim(),
  code_postal: (client.code_postal || "").trim(),
  ville: (client.ville || "").trim(),
  pays: (client.pays || "").trim(),
  siret: (client.siret || "").trim(),
  tva_intracom: (client.tva_intracom || "").trim(),
  notes: (client.notes || "").trim(),
});

export default function ClientsDirectory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_CLIENT);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const resetForm = () => setFormData({ ...DEFAULT_CLIENT });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => api.entities.Client.list("nom"),
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["admin-documents"],
    queryFn: () => api.entities.Document.list(),
  });

  const createClientMutation = useMutation({
    mutationFn: (payload) => api.entities.Client.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client cree", description: "Le client est disponible dans le repertoire." });
      setFormOpen(false);
      resetForm();
      setEditingClient(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Creation impossible",
        description: error?.message || "Erreur lors de la creation du client.",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: ({ id, payload }) => api.entities.Client.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client mis a jour", description: "Les informations ont ete enregistrees." });
      setFormOpen(false);
      resetForm();
      setEditingClient(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description: error?.message || "Erreur lors de la modification du client.",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: (id) => api.entities.Client.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client supprime", description: "Le client a ete supprime." });
      setDeleteOpen(false);
      setClientToDelete(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Suppression impossible",
        description: error?.message || "Erreur lors de la suppression du client.",
      });
    },
  });

  const openCreate = () => {
    setFormMode("create");
    setEditingClient(null);
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (client) => {
    setFormMode("edit");
    setEditingClient(client);
    setFormData({ ...DEFAULT_CLIENT, ...client, type: client.type || "particulier" });
    setFormOpen(true);
  };

  const openDelete = (client) => {
    setClientToDelete(client);
    setDeleteOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.nom.trim()) {
      toast({
        variant: "destructive",
        title: "Nom requis",
        description: "Merci de renseigner le nom du client.",
      });
      return;
    }

    const payload = buildPayload(formData);
    try {
      if (formMode === "create") {
        await createClientMutation.mutateAsync(payload);
        return;
      }
      if (!editingClient?.id) {
        toast({
          variant: "destructive",
          title: "Modification impossible",
          description: "Client introuvable.",
        });
        return;
      }
      await updateClientMutation.mutateAsync({ id: editingClient.id, payload });
    } catch (error) {
      // Errors are handled in mutation callbacks.
    }
  };

  const isSaving = createClientMutation.isPending || updateClientMutation.isPending;
  const isDeleting = deleteClientMutation.isPending;

  const documentsByClient = useMemo(() => {
    const stats = new Map();
    documents.forEach((doc) => {
      if (!doc.client_id) return;
      const entry = stats.get(doc.client_id) || {
        devis: 0,
        factures: 0,
        avoirs: 0,
        totalFacture: 0,
        lastDate: null,
      };

      if (doc.type === "devis") entry.devis += 1;
      if (doc.type === "facture") {
        entry.factures += 1;
        entry.totalFacture += Number(doc.total_ttc) || 0;
      }
      if (doc.type === "avoir") entry.avoirs += 1;

      const docDate = doc.date_emission || doc.date_validite || doc.date_echeance;
      if (docDate && (!entry.lastDate || new Date(docDate) > new Date(entry.lastDate))) {
        entry.lastDate = docDate;
      }
      stats.set(doc.client_id, entry);
    });
    return stats;
  }, [documents]);

  const stats = useMemo(() => {
    const clientsWithDocs = new Set();
    let devisCount = 0;
    let facturesCount = 0;
    let totalFacture = 0;

    documents.forEach((doc) => {
      if (doc.client_id) {
        clientsWithDocs.add(doc.client_id);
      }
      if (doc.type === "devis") devisCount += 1;
      if (doc.type === "facture") {
        facturesCount += 1;
        totalFacture += Number(doc.total_ttc) || 0;
      }
    });

    return {
      totalClients: clients.length,
      clientsWithDocs: clientsWithDocs.size,
      devisCount,
      facturesCount,
      totalFacture,
    };
  }, [clients, documents]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clients
      .filter((client) => {
        if (typeFilter !== "all" && client.type !== typeFilter) return false;
        if (!term) return true;
        return (
          client.nom?.toLowerCase().includes(term) ||
          client.prenom?.toLowerCase().includes(term) ||
          client.email?.toLowerCase().includes(term) ||
          client.telephone?.toLowerCase().includes(term) ||
          client.ville?.toLowerCase().includes(term) ||
          client.siret?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr-FR"));
  }, [clients, searchTerm, typeFilter]);

  const isLoading = clientsLoading || documentsLoading;

  const filterOptions = [
    { id: "all", label: "Tous" },
    { id: "particulier", label: "Particuliers" },
    { id: "professionnel", label: "Professionnels" },
  ];

  return (
    <div className="space-y-6">
      <AdminHero
        icon={Users}
        eyebrow="Administration"
        title="Repertoire clients"
        subtitle="Clients stockes dans les devis et factures"
        badges={[`${stats.totalClients} clients`, `${stats.facturesCount} factures`]}
        color="var(--page-clients)"
        rightContent={
          <Button
            onClick={openCreate}
            variant="outline"
            className="hero-action hero-action--solid"
          >
            <Plus className="w-4 h-4" />
            Nouveau client
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
              Total clients
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalClients}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
              Clients actifs
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.clientsWithDocs}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Devis</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.devisCount}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
              Total facture
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {formatMoney(stats.totalFacture)}
            </p>
          </CardContent>
        </Card>
      </div>

      <AdminPanel title="Recherche" icon={Search} accent="secondary">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <Input
              placeholder="Rechercher par nom, email, ville, SIRET..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {filterOptions.map((option) => {
              const isActive = typeFilter === option.id;
              return (
                <Button
                  key={option.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setTypeFilter(option.id)}
                  className={isActive ? "text-white" : ""}
                  style={{
                    borderColor: "var(--color-border-light)",
                    backgroundColor: isActive ? "var(--color-primary-600)" : "var(--color-bg-surface)",
                    color: isActive ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
          {filteredClients.length} client(s) affiches
        </p>
      </AdminPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-500)]" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="col-span-full border-2 border-dashed rounded-xl p-10 text-center bg-white">
            <Users className="w-10 h-10 mx-auto text-[var(--color-text-tertiary)]" />
            <p className="mt-3 font-semibold text-[var(--color-text-primary)]">Aucun client</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Creez un devis ou une facture pour enregistrer un client.
            </p>
            <Button onClick={openCreate} className="mt-4">
              <Plus className="w-4 h-4" />
              Nouveau client
            </Button>
          </div>
        ) : (
          filteredClients.map((client) => {
            const clientStats = documentsByClient.get(client.id) || {
              devis: 0,
              factures: 0,
              avoirs: 0,
              totalFacture: 0,
              lastDate: null,
            };
            const isPro = client.type === "professionnel";
            return (
              <Card key={client.id} className="border-none shadow-sm bg-white">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: isPro
                            ? "var(--color-secondary-100)"
                            : "var(--color-primary-100)",
                        }}
                      >
                        {isPro ? (
                          <Building2 className="w-5 h-5 text-[var(--color-secondary-600)]" />
                        ) : (
                          <User className="w-5 h-5 text-[var(--color-primary-600)]" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {client.nom || "Client sans nom"}
                          {client.prenom ? ` ${client.prenom}` : ""}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {isPro ? "Professionnel" : "Particulier"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className="border"
                      style={{
                        backgroundColor: isPro
                          ? "var(--color-secondary-100)"
                          : "var(--color-primary-100)",
                        color: isPro
                          ? "var(--color-secondary-700)"
                          : "var(--color-primary-700)",
                        borderColor: isPro
                          ? "var(--color-secondary-200)"
                          : "var(--color-primary-200)",
                      }}
                    >
                      {isPro ? "Pro" : "Particulier"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.telephone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                        <span>{client.telephone}</span>
                      </div>
                    )}
                    {(client.ville || client.code_postal) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                        <span>
                          {[client.code_postal, client.ville].filter(Boolean).join(" ")}
                        </span>
                      </div>
                    )}
                    {client.siret && (
                      <div className="text-[11px] text-[var(--color-text-tertiary)]">
                        SIRET: {client.siret}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]">
                      <FileText className="w-3 h-3 mr-1" />
                      Devis: {clientStats.devis}
                    </Badge>
                    <Badge className="bg-[var(--color-secondary-50)] text-[var(--color-secondary-700)] border border-[var(--color-secondary-200)]">
                      <Receipt className="w-3 h-3 mr-1" />
                      Factures: {clientStats.factures}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                    <span>Dernier doc: {formatDate(clientStats.lastDate)}</span>
                    <span>{formatMoney(clientStats.totalFacture)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(client)}
                    >
                      <Edit2 className="w-4 h-4" />
                      Modifier
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => openDelete(client)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingClient(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Nouveau client" : "Modifier client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-[var(--color-text-secondary)]">Type</Label>
                <div className="mt-2 flex gap-2">
                  {[
                    { value: "particulier", label: "Particulier" },
                    { value: "professionnel", label: "Professionnel" },
                  ].map((option) => {
                    const isActive = formData.type === option.value;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFormChange("type", option.value)}
                        className={isActive ? "text-white" : ""}
                        style={{
                          borderColor: "var(--color-border-light)",
                          backgroundColor: isActive ? "var(--color-primary-600)" : "var(--color-bg-surface)",
                          color: isActive ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                        }}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-[var(--color-text-secondary)]">
                  {formData.type === "professionnel" ? "Raison sociale" : "Nom"} *
                </Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => handleFormChange("nom", e.target.value)}
                  placeholder={formData.type === "professionnel" ? "Entreprise SARL" : "Dupont"}
                  className="h-10"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
              {formData.type === "particulier" && (
                <div>
                  <Label className="text-xs text-[var(--color-text-secondary)]">Prenom</Label>
                  <Input
                    value={formData.prenom}
                    onChange={(e) => handleFormChange("prenom", e.target.value)}
                    placeholder="Jean"
                    className="h-10"
                    style={{ backgroundColor: "var(--color-bg-surface)" }}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-[var(--color-text-secondary)]">Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  placeholder="contact@email.fr"
                  className="h-10"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--color-text-secondary)]">Telephone</Label>
                <Input
                  value={formData.telephone}
                  onChange={(e) => handleFormChange("telephone", e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="h-10"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <div>
                <Label className="text-xs text-[var(--color-text-secondary)]">Adresse</Label>
                <Input
                  value={formData.adresse_ligne1}
                  onChange={(e) => handleFormChange("adresse_ligne1", e.target.value)}
                  placeholder="123 rue de la Paix"
                  className="h-10"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
              <Input
                value={formData.adresse_ligne2}
                onChange={(e) => handleFormChange("adresse_ligne2", e.target.value)}
                placeholder="Complement d'adresse (optionnel)"
                className="h-10"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-[var(--color-text-secondary)]">Code postal</Label>
                  <Input
                    value={formData.code_postal}
                    onChange={(e) => handleFormChange("code_postal", e.target.value)}
                    placeholder="13000"
                    className="h-10"
                    style={{ backgroundColor: "var(--color-bg-surface)" }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-[var(--color-text-secondary)]">Ville</Label>
                  <Input
                    value={formData.ville}
                    onChange={(e) => handleFormChange("ville", e.target.value)}
                    placeholder="Marseille"
                    className="h-10"
                    style={{ backgroundColor: "var(--color-bg-surface)" }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-[var(--color-text-secondary)]">Pays</Label>
                  <Input
                    value={formData.pays}
                    onChange={(e) => handleFormChange("pays", e.target.value)}
                    placeholder="France"
                    className="h-10"
                    style={{ backgroundColor: "var(--color-bg-surface)" }}
                  />
                </div>
              </div>
            </div>

            {formData.type === "professionnel" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-[var(--color-text-secondary)]">SIRET</Label>
                  <Input
                    value={formData.siret}
                    onChange={(e) => handleFormChange("siret", e.target.value)}
                    placeholder="123 456 789 00012"
                    className="h-10"
                    style={{ backgroundColor: "var(--color-bg-surface)" }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-[var(--color-text-secondary)]">TVA intracom</Label>
                  <Input
                    value={formData.tva_intracom}
                    onChange={(e) => handleFormChange("tva_intracom", e.target.value)}
                    placeholder="FR12345678901"
                    className="h-10"
                    style={{ backgroundColor: "var(--color-bg-surface)" }}
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-[var(--color-text-secondary)]">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                rows={3}
                placeholder="Informations utiles..."
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : formMode === "create" ? "Creer" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setClientToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est definitive. Les documents restent mais le client sera supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDelete?.id && deleteClientMutation.mutate(clientToDelete.id)}
              disabled={isDeleting}
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
