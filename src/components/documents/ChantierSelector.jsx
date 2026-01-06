import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  MapPin,
  Calendar,
  CheckCircle2,
  Loader2,
  Building2,
} from "lucide-react";

const formatDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
};

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

export default function ChantierSelector({ onSelect, selectedId }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("select");
  const [isCreating, setIsCreating] = useState(false);
  const [newChantier, setNewChantier] = useState({
    titre: "",
    client: "",
    statut: "",
    date_debut: "",
    date_fin: "",
    budget_estime: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  const { data: chantiers = [], isLoading } = useQuery({
    queryKey: ["chantiers"],
    queryFn: async () => {
      const response = await fetch("/api/chantiers", {
        headers: { Authorization: `Bearer ${api.auth.getToken()}` },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const createChantierMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await fetch("/api/chantiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.auth.getToken()}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await getResponseErrorMessage(response, "Erreur creation chantier");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chantiers"] });
      onSelect?.(data);
    },
  });

  const filteredChantiers = chantiers.filter((chantier) => {
    const term = searchTerm.toLowerCase();
    return (
      chantier.titre?.toLowerCase().includes(term) ||
      chantier.client?.toLowerCase().includes(term) ||
      chantier.statut?.toLowerCase().includes(term)
    );
  });

  const updateNewChantier = (field, value) => {
    setNewChantier((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateChantier = async () => {
    if (!newChantier.titre) {
      toast({
        variant: "destructive",
        title: "Titre requis",
        description: "Le titre est obligatoire.",
      });
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        ...newChantier,
        date_debut: newChantier.date_debut || null,
        date_fin: newChantier.date_fin || null,
      };
      await createChantierMutation.mutateAsync(payload);
    } catch (error) {
      console.error("Erreur:", error);
      const message = error?.message || "Erreur lors de la creation du chantier";
      toast({
        variant: "destructive",
        title: "Creation impossible",
        description: message,
      });
    } finally {
      setIsCreating(false);
    }
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
          <MapPin className="w-4 h-4" />
          <span>Selectionner</span>
          {chantiers.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            >
              {chantiers.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="create"
          className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Creer nouveau</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="select" className="space-y-3 mt-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <Input
            placeholder="Rechercher par titre, client, statut..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
            style={{ backgroundColor: "var(--color-bg-elevated)" }}
          />
        </div>

        <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--color-primary-500)" }} />
            </div>
          ) : filteredChantiers.length === 0 ? (
            <div
              className="text-center py-10 rounded-xl border-2 border-dashed"
              style={{ borderColor: "var(--color-border-light)" }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-[var(--color-bg-surface-hover)]">
                <MapPin className="w-6 h-6 text-[var(--color-text-tertiary)]" />
              </div>
              <p className="font-medium mb-1 text-[var(--color-text-primary)]">
                {searchTerm ? "Aucun resultat" : "Aucun chantier"}
              </p>
              <p className="text-sm mb-4 text-[var(--color-text-secondary)]">
                {searchTerm ? "Essayez une autre recherche" : "Creez votre premier chantier"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("create")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Creer un chantier
              </Button>
            </div>
          ) : (
            filteredChantiers.map((chantier) => {
              const isSelected = selectedId === chantier.id;
              return (
                <button
                  key={chantier.id}
                  onClick={() => onSelect?.(chantier)}
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
                      style={{ backgroundColor: "var(--color-secondary-100)" }}
                    >
                      <MapPin className="w-4 h-4" style={{ color: "var(--color-secondary-600)" }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                          {chantier.titre || "Chantier sans titre"}
                        </p>
                        {isSelected && (
                          <CheckCircle2
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--color-primary-500)" }}
                          />
                        )}
                      </div>

                      {chantier.client && (
                        <p className="text-sm flex items-center gap-1 truncate mt-0.5 text-[var(--color-text-secondary)]">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{chantier.client}</span>
                        </p>
                      )}

                      {(chantier.date_debut || chantier.date_fin) && (
                        <p className="text-xs flex items-center gap-1 mt-1 text-[var(--color-text-tertiary)]">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {formatDateLabel(chantier.date_debut)}
                            {chantier.date_fin ? ` - ${formatDateLabel(chantier.date_fin)}` : ""}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </TabsContent>

      <TabsContent value="create" className="space-y-4 mt-0">
        <div
          className="p-4 rounded-lg space-y-4"
          style={{ backgroundColor: "var(--color-bg-elevated)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Titre *
              </Label>
              <Input
                value={newChantier.titre}
                onChange={(e) => updateNewChantier("titre", e.target.value)}
                placeholder="Renovation cuisine Dupont"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Client
              </Label>
              <Input
                value={newChantier.client}
                onChange={(e) => updateNewChantier("client", e.target.value)}
                placeholder="Famille Dupont"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Date debut
              </Label>
              <Input
                type="date"
                value={newChantier.date_debut}
                onChange={(e) => updateNewChantier("date_debut", e.target.value)}
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Date fin
              </Label>
              <Input
                type="date"
                value={newChantier.date_fin}
                onChange={(e) => updateNewChantier("date_fin", e.target.value)}
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Statut
              </Label>
              <Input
                value={newChantier.statut}
                onChange={(e) => updateNewChantier("statut", e.target.value)}
                placeholder="en cours"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
                Budget estime
              </Label>
              <Input
                value={newChantier.budget_estime}
                onChange={(e) => updateNewChantier("budget_estime", e.target.value)}
                placeholder="15000"
                className="h-9"
                style={{ backgroundColor: "var(--color-bg-surface)" }}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block text-[var(--color-text-secondary)]">
              Notes
            </Label>
            <Textarea
              value={newChantier.notes}
              onChange={(e) => updateNewChantier("notes", e.target.value)}
              placeholder="Notes chantier..."
              rows={3}
              style={{ backgroundColor: "var(--color-bg-surface)" }}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleCreateChantier}
            disabled={isCreating || !newChantier.titre}
            className="gap-2"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Creer et selectionner
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
