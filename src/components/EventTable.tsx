import { StatusPill } from "./goal-ui";
import { goalStatus } from "@/lib/performance";
import { TERRITORY_COLOR } from "@/lib/territory";
import type { EventRow } from "@/lib/goals-data";

export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Events against their attendance goals. Past events show active
 * practitioners who attended; upcoming ones show active practitioners
 * registered so far, so a CM can see which events need people.
 */
export function EventTable({ events, showYear = false }: { events: EventRow[]; showYear?: boolean }) {
  if (!events.length) return <p className="m-0 text-[12px] text-[#6a7da0]">No in-person events in this view.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Event</th>
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 font-medium">Members in city</th>
            <th className="py-2 font-medium">Attended · registered</th>
            <th className="py-2 font-medium">Goal · stretch</th>
            <th className="py-2 font-medium">Capacity</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const actual = e.past ? e.practitioners : e.registered;
            const status = goalStatus(actual, e.goal);
            return (
              <tr key={e.id} className="border-t border-[#141c2b]">
                <td className="py-2 whitespace-nowrap tabular-nums text-[#9bb0d4]">{dateShort(e.startsAt)}{showYear ? ` ${e.startsAt.slice(0, 4)}` : ""}</td>
                <td className="py-2 text-[#cfdaee]">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: TERRITORY_COLOR[e.region] }} />
                  {e.city || e.name}
                </td>
                <td className="py-2 text-[#9bb0d4]">{e.typeName ?? ""}</td>
                <td className="py-2 tabular-nums text-[#9bb0d4]">{e.membersInCity || ""}</td>
                <td className="py-2 tabular-nums text-white">
                  {actual}
                  {!e.past && <span className="ml-1 text-[11px] text-[#6a7da0]">registered</span>}
                  {e.past && e.attended > e.practitioners && (
                    <span className="ml-1 text-[11px] text-[#6a7da0]" title="Sponsors, vendors and Confide staff aren't counted">
                      (+{e.attended - e.practitioners} others)
                    </span>
                  )}
                </td>
                <td className="py-2 tabular-nums text-[#9bb0d4]">{e.goal ? `${e.goal.goal} · ${e.goal.stretch}` : ""}</td>
                <td className="py-2 tabular-nums text-[#6a7da0]">
                  {e.capacity ?? ""}
                  {e.waitlisted > 0 && <span className="ml-1 text-[11px] text-[#facc15]">{e.waitlisted} waitlisted</span>}
                </td>
                <td className="py-2 text-right">
                  {e.goal ? (
                    e.past ? (
                      <StatusPill status={status} />
                    ) : (
                      <StatusPill status={status} label={status === "below" ? "Needs people" : status === "met" ? "On track" : "Stretch on track"} />
                    )
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
