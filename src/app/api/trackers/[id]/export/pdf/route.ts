import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/api/guard";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { loadTrackerReportData } from "@/lib/trackers/report-data";
import { renderTrackerReportPdf } from "@/lib/trackers/pdf-report";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

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

    const buffer = await renderTrackerReportPdf(data);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(data.tracker.name)}-report.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
