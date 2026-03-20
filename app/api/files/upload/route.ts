import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import {
  handleUpload,
  FileValidationError,
  PdfExtractionError,
} from "@/lib/chat/file-handler";

/**
 * POST /api/files/upload
 * Validates file type/size, saves to temp dir, extracts PDF text.
 * Returns a FileRef object.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    const ref = await handleUpload(file);

    // Audit: file uploaded (non-blocking)
    writeAuditEvent({
      userId,
      eventType: "CHAT_FILE_UPLOADED",
      metadata: { fileType: ref.type, fileSize: ref.size },
    }).catch(() => {});

    return NextResponse.json({ data: ref }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PdfExtractionError) {
      const status = err.message.includes("timed out") ? 408 : 422;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json(
      { error: "File upload failed" },
      { status: 500 },
    );
  }
}
