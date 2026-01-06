import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { useTheme } from "@/context/ThemeContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { CalendarDayColumn } from "./CalendarDayColumn";
import { NewRdvModal } from "./NewRdvModal";
import { api } from "@/api/apiClient";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h to 20h

export function CalendarTimeline() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'week';
    return window.innerWidth < 768 ? 'day' : 'week';
  });
  const [showNewRdv, setShowNewRdv] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'day' : 'week');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for external "open new rdv" events
  useEffect(() => {
    const handleOpenNewRdv = () => setShowNewRdv(true);
    window.addEventListener('open-new-rdv', handleOpenNewRdv);
    return () => window.removeEventListener('open-new-rdv', handleOpenNewRdv);
  }, []);

  const weekStart = startOfWeek(currentDate, { locale: fr, weekStartsOn: 1 });
  const daysToShow = viewMode === "week" ? 7 : 1;
  const days = Array.from({ length: daysToShow }, (_, i) =>
    addDays(viewMode === "week" ? weekStart : currentDate, i)
  );

  // Fetch events for visible range
  const { data: eventsData, isLoading, error } = useQuery({
    queryKey: ["calendar-events", weekStart.toISOString(), daysToShow],
    queryFn: async () => {
      const startDate = days[0];
      const endDate = addDays(days[days.length - 1], 1);
      return api.calendar.listEvents(startDate.toISOString(), endDate.toISOString());
    },
  });

  const events = useMemo(() => {
    if (!eventsData) return [];
    // Merge local and google events, prioritize local (they have more data)
    const localEvents = eventsData.localEvents || [];
    const googleEvents = (eventsData.googleEvents || []).filter(ge =>
      !localEvents.some(le => le.google_event_id === ge.id)
    );
    return [...localEvents, ...googleEvents];
  }, [eventsData]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped = {};
    days.forEach(day => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped[dayKey] = events.filter(e => {
        const eventDate = e.start ? parseISO(e.start) : null;
        return eventDate && isSameDay(eventDate, day);
      });
    });
    return grouped;
  }, [events, days]);

  const handleSlotClick = (date, hour) => {
    setSelectedSlot({ date, hour });
    setShowNewRdv(true);
  };

  const handleEventCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    setShowNewRdv(false);
    setSelectedSlot(null);
  };

  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(d => subWeeks(d, 1));
    } else {
      setCurrentDate(d => addDays(d, -1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(d => addWeeks(d, 1));
    } else {
      setCurrentDate(d => addDays(d, 1));
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-bg-surface)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: "var(--color-border-light)" }}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="ml-4 text-lg font-semibold capitalize" style={{ color: "var(--color-text-primary)" }}>
            {format(currentDate, "MMMM yyyy", { locale: fr })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle for larger screens */}
          <div className="hidden md:flex items-center gap-1 mr-2">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Jour
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Semaine
            </Button>
          </div>

          <Button
            onClick={() => setShowNewRdv(true)}
            style={{ backgroundColor: "var(--page-planning)", color: "white" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nouveau RDV</span>
            <span className="sm:hidden">RDV</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--page-planning)" }} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center" style={{ color: "var(--color-error-text)" }}>
            <p>Erreur lors du chargement du calendrier</p>
            <p className="text-sm opacity-75">{error.message}</p>
          </div>
        </div>
      )}

      {/* Timeline Grid */}
      {!isLoading && !error && (
        <ScrollArea className="flex-1">
          <div className="flex min-w-max">
            {/* Time column */}
            <div
              className="w-14 flex-shrink-0 border-r sticky left-0 z-10"
              style={{
                borderColor: "var(--color-border-light)",
                backgroundColor: "var(--color-bg-surface)"
              }}
            >
              <div className="h-14" /> {/* Header spacer */}
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="h-16 text-xs text-right pr-2 pt-1"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {hour}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(day => (
              <CalendarDayColumn
                key={day.toISOString()}
                date={day}
                events={eventsByDay[format(day, "yyyy-MM-dd")] || []}
                hours={HOURS}
                onSlotClick={handleSlotClick}
                isToday={isSameDay(day, new Date())}
                isDark={isDark}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* New RDV Modal */}
      <NewRdvModal
        open={showNewRdv}
        onOpenChange={setShowNewRdv}
        initialDate={selectedSlot?.date}
        initialHour={selectedSlot?.hour}
        onSuccess={handleEventCreated}
      />
    </div>
  );
}

export default CalendarTimeline;
