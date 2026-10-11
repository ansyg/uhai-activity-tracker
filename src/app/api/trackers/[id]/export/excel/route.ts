import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUserId } from "@/lib/api/guard";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { loadTrackerReportData } from "@/lib/trackers/report-data";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "tracker";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);

    const data = await loadTrackerReportData(trackerId);
    if (!data) throw new NotFoundError("Tracker not found.");
    const { tracker, dashboard, phases, members } = data;

    const completionPercent = dashboard.totals.total
      ? Math.round((dashboard.totals.completed / dashboard.totals.total) * 100)
      : 0;

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Tracker", tracker.name],
      ["Description", tracker.description ?? ""],
      ["Owner", tracker.owner.name],
      ["Systems", tracker.systems.map((s) => s.system.name).join(", ")],
      ["Start date", formatDate(tracker.startDate)],
      ["End date", formatDate(tracker.endDate)],
      ["Generated", new Date().toISOString().slice(0, 10)],
      [],
      ["Overall completion", `${completionPercent}%`],
      ["Total activities", dashboard.totals.total],
      ["Completed", dashboard.totals.completed],
      ["In progress", dashboard.totals.inProgress],
      ["Not started", dashboard.totals.notStarted],
      ["Overdue", dashboard.overdue],
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const teamRows = members.map((m) => ({
      Name: m.user.name,
      Email: m.user.email,
      Role: m.role.name,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamRows), "Team");

    const phaseRows = dashboard.byPhase.map((phase) => ({
      Phase: phase.name,
      Completed: phase.completed,
      Total: phase.total,
      "% Complete": phase.avgPercent,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(phaseRows), "Phases");

    const activityRows = phases.flatMap((phase) =>
      phase.activities.map((activity) => ({
        Phase: phase.name,
        Activity: activity.title,
        Module: activity.module?.name ?? "",
        Assignees: activity.assignees.map((a) => a.user?.name ?? a.roleTag).join(", "),
        "Start Date": formatDate(activity.startDate),
        "End Date": formatDate(activity.endDate),
        "Status %": activity.statusPercent,
        Status: activity.status,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(activityRows), "Activities");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename(tracker.name)}-report.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
