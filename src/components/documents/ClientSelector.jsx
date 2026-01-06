import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Loader2,
  Users,
  UserPlus,
} from "lucide-react";

const getResponseErrorMessage = async (response, fallback) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === "object") {
      return payload.message || payload.error || fallback;
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
};

export default function ClientSelector({ onSelect, selectedId }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("select");
  const [isCreating, setIsCreating] = useState(false);

  // Form state for new client
  const [newClient, setNewClient] = useState({
    type: "particulier",
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    adresse_ligne1: "",
    adresse_ligne2: "",
    code_postal: "",
    ville: "",
    siret: "",
    tva_intracom: "",
  });

  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: {
          Authorization: `Bearer ${api.auth.getToken()}`,
        },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.auth.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Erreur creation client");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onSelect(data);
    },
  });

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();
    return (
      client.nom?.toLowerCase().includes(term) ||
      client.prenom?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.ville?.toLowerCase().includes(term) ||
      client.siret?.includes(term)
    );
  });

  const handleCreateClient = async () => {
    if (!newClient.nom) {
      toast({
        variant: "destructive",
        title: "Nom requis",
        description: "Le nom est obligatoire.",
      });
      return;
    }

    setIsCreating(true);
    try {
      await createClientMutation.mutateAsync(newClient);
    } catch (error) {
      console.error("Erreur:", error);
      const message = error?.message || "Erreur lors de la creation du client";
      toast({
        variant: "destructive",
        title: "Creation impossible",
        description: message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const updateNewClient = (field, value) => {
    setNewClient((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList
        className="grid w-full grid-cols-2 mb-4 p-1 h-auto"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <TabsTrigger
          value="select"
          className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
        >
          <Users className="w-4 h-4" />
          <span>Sélectionner</span>
          {clients.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            >
              {clients.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="create"
          className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Créer nouveau</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab: Sélectionner un client existant */}
      <TabsContent value="select" className="space-y-3 mt-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <Input
            placeholder="Rechercher par nom, email, ville..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
            style={{ backgroundColor: "var(--color-bg-elevated)" }}
          />
        </div>

        {/* Clients list */}
        <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--color-primary-500)" }} />
            </div>
          ) : filteredClients.length === 0 ? (
            <div
              className="text-center py-10 rounded-xl border-2 border-dashed"
              style={{ borderColor: "var(--color-border-light)" }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-[var(--color-bg-surface-hover)]">
                <User className="w-6 h-6 text-[var(--color-text-tertiary)]" />
              </div>
              <p className="font-medium mb-1 text-[var(--color-text-primary)]">
                {searchTerm ? "Aucun résultat" : "Aucun client"}
              </p>
              <p className="text-sm mb-4 text-[var(--color-text-secondary)]">
                {searchTerm ? "Essayez une autre recherche" : "Créez votre premier client"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("create")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer un client
              </Button>
            </div>
          ) : (
            filteredClients.map((client) => {
              const isSelected = selectedId === client.id;
              return (
                <button
                  key={client.id}
                  onClick={() => onSelect(client)}
                  className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm group ${
                    isSelected ? "ring-2" : "hover:border-[var(--color-border-medium)]"
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? "var(--color-primary-50)"
                      : "var(--color-bg-surface)",
                    borderColor: isSelected
                      ? "var(--color-primary-500)"
                      : "var(--color-border-light)",
                    ringColor: "var(--color-primary-500)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{
                        backgroundColor: client.type === "professionnel"
                          ? "var(--color-secondary-100)"
                          : "var(--color-primary-100)",
                      }}
                    >
                      {client.type === "professionnel" ? (
                        <Building2
                          className="w-4 h-4"
                          style={{ color: "var(--color-secondary-600)" }}
                        />
                      ) : (
                        <User
                          className="w-4 h-4"
                          style={{ color: "var(--color-primary-600)" }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className="font-medium truncate"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {client.nom}
                          {client.prenom && ` ${client.prenom}`}
                        </p>
                        {isSelected && (
                          <CheckCircle2
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--color-primary-500)" }}
                          />
                        )}
                      </div>

                      {(client.adresse_ligne1 || client.ville) && (
                        <p className="text-sm flex items-center gap-1 truncate mt-0.5 text-[var(--color-text-secondary)]">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {client.adresse_ligne1 && `${client.adresse_ligne1}, `}
                            {client.code_postal} {client.ville}
                          </span>
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap text-[var(--color-text-tertiary)]">
                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{client.email}</span>
                          </span>
                        )}
                        {client.telephone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {client.telephone}
                          </span>
                        )}
                        {client.siret && (
                          <span className="flex items-center gap-1">
                            SIRET: {client.siret}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </TabsContent>

      {/* Tab: Créer un nouveau client */}
      <TabsContent value="create" className="space-y-4 mt-0">
        {/* Type de client */}
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
            Type de client
          </Label>
          <RadioGroup
            value={newClient.type}
            onValueChange={(v) => updateNewClient("type", v)}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="particulier"
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                newClient.type === "particulier" ? "ring-2" : "hover:border-[var(--color-border-medium)]"
              }`}
              style={{
                backgroundColor: newClient.type === "particulier"
                  ? "var(--color-primary-50)"
                  : "var(--color-bg-surface)",
                borderColor: newClient.type === "particulier"
                  ? "var(--color-primary-500)"
                  : "var(--color-border-light)",
                ringColor: "var(--color-primary-500)",
              }}
            >
              <RadioGroupItem value="particulier" id="particulier" className="sr-only" />
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: "var(--color-primary-100)" }}
              >
                <User className="w-4 h-4" style={{ color: "var(--color-primary-600)" }} />
              </div>
              <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                Particulier
              </span>
            </Label>
            <Label
              htmlFor="professionnel"
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                newClient.type === "professionnel" ? "ring-2" : "hover:border-[var(--color-border-medium)]"
              }`}
              style={{
                backgroundColor: newClient.type === "professionnel"
                  ? "var(--color-secondary-50)"
                  : "var(--color-bg-surface)",
                borderColor: newClient.type === "professionnel"
                  ? "var(--color-secondary-500)"
                  : "var(--color-border-light)",
                ringColor: "var(--color-secondary-500)",
              }}
            >
              <RadioGroupItem value="professionnel" id="professionnel" className="sr-only" />
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: "var(--color-secondary-100)" }}
              >
                <Building2 className="w-4 h-4" style={{ color: "var(--color-secondary-600)" }} />
              </div>
              <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                Professionnel
              </span>
            </Label>
          </RadioGroup>
        </div>

        {/* Informations */}
        <div
          className="p-4 rounded-lg space-y-4"
          style={{ backgroundColor: "var(--color-bg-elevated)" }}
        >
          {/* Nom / Raison sociale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                {newClient.type === "professionnel" ? "Raison sociale" : "Nom"} *
              </Label>
              <Input
                value={newClient.nom}
                onChange={(e) => updateNewClient("nom", e.target.value)}
                placeholder={newClient.type === "professionnel" ? "ENTREPRISE SARL" : "Dupont"}
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
            {newClient.type === "particulier" && (
              <div>
                <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                  Prénom
                </Label>
                <Input
                  value={newClient.prenom}
                  onChange={(e) => updateNewClient("prenom", e.target.value)}
                  placeholder="Jean"
                  className="h-9"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Email
              </Label>
              <Input
                type="email"
                value={newClient.email}
                onChange={(e) => updateNewClient("email", e.target.value)}
                placeholder="contact@exemple.fr"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Téléphone
              </Label>
              <Input
                value={newClient.telephone}
                onChange={(e) => updateNewClient("telephone", e.target.value)}
                placeholder="06 12 34 56 78"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
              Adresse
            </Label>
            <Input
              value={newClient.adresse_ligne1}
              onChange={(e) => updateNewClient("adresse_ligne1", e.target.value)}
              placeholder="123 rue de la Paix"
              className="mb-2 h-9"
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            />
            <Input
              value={newClient.adresse_ligne2}
              onChange={(e) => updateNewClient("adresse_ligne2", e.target.value)}
              placeholder="Complément d'adresse (optionnel)"
              className="h-9"
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Code postal
              </Label>
              <Input
                value={newClient.code_postal}
                onChange={(e) => updateNewClient("code_postal", e.target.value)}
                placeholder="75001"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Ville
              </Label>
              <Input
                value={newClient.ville}
                onChange={(e) => updateNewClient("ville", e.target.value)}
                placeholder="Paris"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
          </div>

          {/* Informations légales (professionnel) */}
          {newClient.type === "professionnel" && (
            <div
              className="pt-3 mt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-3"
              style={{ borderColor: "var(--color-border-light)" }}
            >
              <div>
                <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                  SIRET
                </Label>
                <Input
                  value={newClient.siret}
                  onChange={(e) => updateNewClient("siret", e.target.value)}
                  placeholder="123 456 789 00012"
                  className="h-9"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                  N° TVA intracom.
                </Label>
                <Input
                  value={newClient.tva_intracom}
                  onChange={(e) => updateNewClient("tva_intracom", e.target.value)}
                  placeholder="FR12345678901"
                  className="h-9"
                  style={{ backgroundColor: "var(--color-bg-surface)" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleCreateClient}
            disabled={isCreating || !newClient.nom}
            className="gap-2"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Créer et sélectionner
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
