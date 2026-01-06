import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
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
import { Calendar as CalendarIcon, Clock, User, MapPin, FileText, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS = {
  rdv_client: "RDV Client",
  interne: "Interne",
  autre: "Autre",
};

export function EventDetailModal({ event, open, onOpenChange }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!event) return null;

  const start = typeof event.start === 'string' ? parseISO(event.start) : new Date(event.start);
  const end = event.end
    ? (typeof event.end === 'string' ? parseISO(event.end) : new Date(event.end))
    : null;

  const isGoogleOnly = event.isGoogleOnly;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (isGoogleOnly) {
        throw new Error("Les evenements Google uniquement ne peuvent pas etre supprimes depuis cette interface");
      }
      return api.calendar.deleteEvent(event.id);
    },
    onSuccess: () => {
      toast({
        title: "Evenement supprime",
        description: "L'evenement a ete supprime du calendrier",
      });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de supprimer l'evenement",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm("Voulez-vous vraiment supprimer cet evenement ?")) {
      deleteMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" style={{ color: event.color || "var(--page-planning)" }} />
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <div
              className="px-3 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: event.color || "var(--page-planning)" }}
            >
              {TYPE_LABELS[event.type] || "Evenement"}
            </div>
            {isGoogleOnly && (
              <div
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-warning-bg)",
                  color: "var(--color-warning-text)"
                }}
              >
                Google Calendar
              </div>
            )}
            {event.google_event_id && !isGoogleOnly && (
              <div
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-success-bg)",
                  color: "var(--color-success-text)"
                }}
              >
                Synchronise
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 mt-0.5" style={{ color: "var(--color-text-tertiary)" }} />
            <div>
              <p className="font-medium capitalize" style={{ color: "var(--color-text-primary)" }}>
                {format(start, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>
                {format(start, "HH:mm")}
                {end && ` - ${format(end, "HH:mm")}`}
              </p>
            </div>
          </div>

          {/* Client info */}
          {(event.client_nom || event.client_prenom) && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 mt-0.5" style={{ color: "var(--color-text-tertiary)" }} />
              <div>
                <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {event.client_prenom} {event.client_nom}
                </p>
                {event.client_telephone && (
                  <p style={{ color: "var(--color-text-secondary)" }}>
                    {event.client_telephone}
                  </p>
                )}
                {event.client_email && (
                  <p style={{ color: "var(--color-text-secondary)" }}>
                    {event.client_email}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 mt-0.5" style={{ color: "var(--color-text-tertiary)" }} />
              <div>
                <p style={{ color: "var(--color-text-primary)" }}>
                  {event.location}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1 hover:underline"
                  style={{ color: "var(--page-planning)" }}
                >
                  Voir sur Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 mt-0.5" style={{ color: "var(--color-text-tertiary)" }} />
              <div>
                <p
                  className="whitespace-pre-wrap text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {event.description}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isGoogleOnly && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Supprimer
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EventDetailModal;
