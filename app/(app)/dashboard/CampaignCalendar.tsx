"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@ui/components";
import type { CalendarCampaign } from "@services/index";

interface CampaignCalendarProps {
  readonly campaigns: readonly CalendarCampaign[];
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Midnight (local) for a date, for day-range comparisons. */
function startOfDay(value: Date): number {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

/** True when `day` falls within a campaign's inclusive run (start..end). */
function isWithin(day: Date, campaign: CalendarCampaign): boolean {
  const d = startOfDay(day);
  return (
    d >= startOfDay(new Date(campaign.startsAt)) &&
    d <= startOfDay(new Date(campaign.endsAt))
  );
}

/** Build the 6x7 day grid (Mon-first) covering a given month. */
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // JS getDay(): 0=Sun..6=Sat; shift so Monday is column 0.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Monthly campaign calendar (ClickUp/Google-style). Shows which campaigns run
 * on each day, with month navigation and a hoverable day → campaign list.
 */
export function CampaignCalendar({ campaigns }: CampaignCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const grid = useMemo(
    () => buildGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const campaignsForDay = useMemo(() => {
    const map = new Map<string, CalendarCampaign[]>();
    for (const day of grid) {
      const key = day.toDateString();
      map.set(
        key,
        campaigns.filter((campaign) => isWithin(day, campaign)),
      );
    }
    return map;
  }, [grid, campaigns]);

  const goMonth = (delta: number) => {
    setSelectedDay(null);
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectedCampaigns = selectedDay
    ? (campaignsForDay.get(selectedDay) ?? [])
    : [];
  const todayKey = today.toDateString();

  return (
    <div className="pms-calendar">
      <div className="pms-calendar__header">
        <h2 className="pms-calendar__title">
          {MONTHS[cursor.month]} {cursor.year}
        </h2>
        <div className="pms-calendar__nav">
          <button
            type="button"
            className="pms-calendar__nav-btn"
            aria-label="Bulan sebelumnya"
            onClick={() => goMonth(-1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pms-calendar__today"
            onClick={() =>
              setCursor({
                year: today.getFullYear(),
                month: today.getMonth(),
              })
            }
          >
            Hari ini
          </button>
          <button
            type="button"
            className="pms-calendar__nav-btn"
            aria-label="Bulan berikutnya"
            onClick={() => goMonth(1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="pms-calendar__weekdays">
        {WEEKDAYS.map((label) => (
          <span key={label} className="pms-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="pms-calendar__grid">
        {grid.map((day) => {
          const key = day.toDateString();
          const dayCampaigns = campaignsForDay.get(key) ?? [];
          const inMonth = day.getMonth() === cursor.month;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          return (
            <button
              type="button"
              key={key}
              className={[
                "pms-calendar__cell",
                inMonth ? "" : "pms-calendar__cell--muted",
                isToday ? "pms-calendar__cell--today" : "",
                isSelected ? "pms-calendar__cell--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelectedDay(isSelected ? null : key)}
            >
              <span className="pms-calendar__date">{day.getDate()}</span>
              <span className="pms-calendar__events">
                {dayCampaigns.slice(0, 3).map((campaign) => (
                  <span
                    key={campaign.id}
                    className="pms-calendar__event"
                    title={campaign.name}
                  >
                    {campaign.name}
                  </span>
                ))}
                {dayCampaigns.length > 3 && (
                  <span className="pms-calendar__more">
                    +{dayCampaigns.length - 3} lagi
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="pms-calendar__detail">
          <strong className="pms-calendar__detail-title">
            {new Date(selectedDay).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
          {selectedCampaigns.length === 0 ? (
            <p className="pms-calendar__detail-empty">
              Tidak ada campaign berjalan pada tanggal ini.
            </p>
          ) : (
            <ul className="pms-calendar__detail-list">
              {selectedCampaigns.map((campaign) => (
                <li key={campaign.id} className="pms-calendar__detail-item">
                  <span>
                    <strong>{campaign.name}</strong>
                    <span className="pms-calendar__detail-brand">
                      {campaign.brandName}
                    </span>
                  </span>
                  <StatusBadge status={campaign.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
