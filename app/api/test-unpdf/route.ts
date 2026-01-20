import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    // Authentication check
    const authToken = process.env.UNPDF_TEST_ENDPOINT_TOKEN;
    if (authToken) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || authHeader !== `Bearer ${authToken}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 413 },
      );
    }

    // File type validation
    const isPdfMimeType = file.type === "application/pdf";
    const hasPdfExtension = file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdfMimeType && !hasPdfExtension) {
      return Response.json(
        { error: "Invalid file type. Only PDF files are accepted." },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();

    const start = performance.now();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const elapsed = performance.now() - start;

    // Null-safe text handling
    const safeText = text ?? "";

    return Response.json({
      success: true,
      totalPages,
      textLength: safeText.length,
      elapsedMs: Math.round(elapsed),
      preview: safeText.slice(0, 200),
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
