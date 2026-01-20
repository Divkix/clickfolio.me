import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    const start = performance.now();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const elapsed = performance.now() - start;

    return Response.json({
      success: true,
      totalPages,
      textLength: text.length,
      elapsedMs: Math.round(elapsed),
      preview: text.slice(0, 200),
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
