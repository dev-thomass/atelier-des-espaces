import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/api/apiClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, User, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EVENT_TYPES = [
  { id: "rdv_client", label: "RDV Client", color: "var(--page-planning)" },
  { id: "interne", label: "Interne", color: "var(--color-secondary-500)" },
  { id: "autre", label: "Autre", color: "var(--color-text-tertiary)" },
];

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h to 20h
const MINUTES = [0, 15, 30, 45];

const DURATIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 heure" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 heures" },
  { value: 180, label: "3 heures" },
  { value: 240, label: "4 heures" },
];

export function NewRdvModal({ open, onOpenChange, initialDate, initialHour, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: "",
    type: "rdv_client",
    client_id: "",
    date: initialDate || new Date(),
    startHour: initialHour || 9,
    startMinute: 0,
    duration: 60,
    location: "",
    description: "",
  });

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        title: "",
        description: "",
        client_id: "",
        location: "",
        date: initialDate || new Date(),
        startHour: initialHour || 9,
        startMinute: 0,
        duration: 60,
        type: "rdv_client",
      }));
    }
  }, [open, initialDate, initialHour]);

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-rdv"],
    queryFn: () => api.entities.Client.list("nom"),
    enabled: open, // Only fetch when modal is open
  });

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const start = new Date(data.date);
      start.setHours(data.startHour, data.startMinute, 0, 0);

      const end = new Date(start.getTime() + data.duration * 60 * 1000);

      // Get client name for auto-title
      const client = clients.find(c => c.id === data.client_id);
      const autoTitle = data.type === "rdv_client" && client
        ? `RDV ${client.prenom || ''} ${client.nom}`.trim()
        : data.title;

      return api.calendar.createEvent({
        title: data.title || autoTitle || "Nouveau RDV",
        description: data.description,
        start: start.toISOString(),
        end: end.toISOString(),
        client_id: data.client_id || null,
        type: data.type,
        location: data.location,
        color: EVENT_TYPES.find(t => t.id === data.type)?.color,
      });
    },
    onSuccess: (result) => {
      toast({
        title: "RDV cree",
        description: result.synced
          ? "L'evenement a ete ajoute au calendrier et synchronise avec Google Calendar"
          : "L'evenement a ete ajoute au calendrier local",
      });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de creer l'evenement",
        variant: "destructive"
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const selectedClient = clients.find(c => c.id === formData.client_id);

  // Auto-fill location when client is selected
  useEffect(() => {
    if (selectedClient && !formData.location) {
      const addr = [
        selectedClient.adresse,
        selectedClient.code_postal,
        selectedClient.ville
      ].filter(Boolean).join(', ');
      if (addr) {
        setFormData(prev => ({ ...prev, location: addr }));
      }
    }
  }, [selectedClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" style={{ color: "var(--page-planning)" }} />
            Nouveau Rendez-vous
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Selection (only for rdv_client) */}
          {formData.type === "rdv_client" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Client
              </Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData(p => ({ ...p, client_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.prenom} {c.nom}</span>
                      {c.telephone && <span className="text-muted-foreground ml-2">- {c.telephone}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {selectedClient.email} {selectedClient.ville && `| ${selectedClient.ville}`}
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder={formData.type === "rdv_client" ? "RDV Client (auto si vide)" : "Titre de l'evenement"}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(formData.date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(d) => setFormData(p => ({ ...p, date: d || new Date() }))}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Heure
              </Label>
              <div className="flex gap-2">
                <Select
                  value={String(formData.startHour)}
                  onValueChange={(v) => setFormData(p => ({ ...p, startHour: Number(v) }))}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h} value={String(h)}>{h}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(formData.startMinute)}
                  onValueChange={(v) => setFormData(p => ({ ...p, startMinute: Number(v) }))}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTES.map(m => (
                      <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duree</Label>
            <Select
              value={String(formData.duration)}
              onValueChange={(v) => setFormData(p => ({ ...p, duration: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Lieu
            </Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
              placeholder="Adresse ou lieu du rendez-vous"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Notes supplementaires..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              style={{ backgroundColor: "var(--page-planning)" }}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Creer le RDV
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NewRdvModal;
