import React from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarEventCard } from "./CalendarEventCard";

export function CalendarDayColumn({ date, events, hours, onSlotClick, isToday, isDark }) {
  const calculateEventPosition = (event) => {
    const start = typeof event.start === 'string' ? parseISO(event.start) : new Date(event.start);
    const end = event.end
      ? (typeof event.end === 'string' ? parseISO(event.end) : new Date(event.end))
      : new Date(start.getTime() + 60 * 60 * 1000);

    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const duration = differenceInMinutes(end, start);

    // Position relative to first hour (7h) - 64px per hour
    const firstHour = hours[0] || 7;
    const topOffset = (startHour - firstHour) * 64 + (startMinute / 60) * 64;
    const height = (duration / 60) * 64;

    return {
      top: Math.max(0, topOffset),
      height: Math.max(height, 28) // Min height for visibility
    };
  };

  return (
    <div
      className="flex-1 min-w-[120px] md:min-w-[140px] border-r relative"
      style={{ borderColor: "var(--color-border-light)" }}
    >
      {/* Day header */}
      <div
        className={`h-14 flex flex-col items-center justify-center border-b sticky top-0 z-10
                    ${isToday ? "font-bold" : ""}`}
        style={{
          backgroundColor: isToday ? "var(--page-planning-light)" : "var(--color-bg-surface)",
          borderColor: "var(--color-border-light)",
          color: isToday ? "var(--page-planning)" : "var(--color-text-primary)",
        }}
      >
        <span className="text-xs uppercase tracking-wide">
          {format(date, "EEE", { locale: fr })}
        </span>
        <span
          className={`text-lg leading-none ${
            isToday
              ? "bg-[var(--page-planning)] text-white rounded-full w-8 h-8 flex items-center justify-center"
              : ""
          }`}
        >
          {format(date, "d")}
        </span>
      </div>

      {/* Hour slots */}
      <div className="relative">
        {hours.map((hour, idx) => (
          <div
            key={hour}
            className="h-16 border-b cursor-pointer transition-colors hover:bg-opacity-50"
            style={{
              borderColor: "var(--color-border-light)",
              backgroundColor: idx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)")
            }}
            onClick={() => onSlotClick(date, hour)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)");
            }}
          >
            {/* Half hour line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed"
              style={{
                top: "50%",
                borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
              }}
            />
          </div>
        ))}

        {/* Events overlay */}
        {events.map((event, idx) => {
          const { top, height } = calculateEventPosition(event);
          // Skip events that start before our first hour
          if (top < 0 && top + height <= 0) return null;

          return (
            <CalendarEventCard
              key={event.id || idx}
              event={event}
              style={{
                top: `${Math.max(0, top)}px`,
                height: `${height}px`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default CalendarDayColumn;
