import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { User, MapPin, Clock } from "lucide-react";
import { EventDetailModal } from "./EventDetailModal";

const TYPE_COLORS = {
  rdv_client: "var(--page-planning)",
  interne: "var(--color-secondary-500)",
  autre: "var(--color-text-tertiary)",
};

export function CalendarEventCard({ event, style }) {
  const [showDetail, setShowDetail] = useState(false);

  const start = typeof event.start === 'string' ? parseISO(event.start) : new Date(event.start);
  const eventColor = event.color || TYPE_COLORS[event.type] || TYPE_COLORS.autre;
  const isClientRdv = event.type === "rdv_client";
  const isGoogleOnly = event.isGoogleOnly;

  // Calculate if we have enough height for multiple lines
  const heightNum = parseInt(style?.height) || 60;
  const showDetails = heightNum >= 48;
  const showLocation = heightNum >= 72;

  return (
    <>
      <div
        className="absolute left-1 right-1 rounded-md px-2 py-1 cursor-pointer overflow-hidden
                   transition-all hover:shadow-lg hover:z-20 hover:scale-[1.02]"
        style={{
          ...style,
          backgroundColor: eventColor,
          opacity: isGoogleOnly ? 0.75 : 0.95,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}
        onClick={() => setShowDetail(true)}
      >
        {/* Time and title */}
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-white/80 flex-shrink-0" />
          <p className="text-xs font-semibold text-white truncate">
            {format(start, "HH:mm")} - {event.title}
          </p>
        </div>

        {/* Client info */}
        {showDetails && isClientRdv && (event.client_nom || event.client_prenom) && (
          <p className="text-xs text-white/80 truncate flex items-center gap-1 mt-0.5">
            <User className="w-3 h-3 flex-shrink-0" />
            {event.client_prenom} {event.client_nom}
          </p>
        )}

        {/* Location */}
        {showLocation && event.location && (
          <p className="text-xs text-white/70 truncate flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {event.location}
          </p>
        )}

        {/* Google-only badge */}
        {isGoogleOnly && (
          <div className="absolute top-1 right-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
              title="Evenement Google Calendar uniquement"
            />
          </div>
        )}
      </div>

      <EventDetailModal
        event={event}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
}

export default CalendarEventCard;
