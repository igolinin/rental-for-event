import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDo } from "@/lib/permissions";
import { inferItemDetails, type LLMProvider } from "@/lib/ai";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canDo(session, "INVENTORY", "CREATE"))) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  // Load AI config
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "singleton" },
    select: { aiProvider: true, aiApiKey: true, aiModel: true },
  });

  if (!settings?.aiProvider || !settings.aiApiKey) {
    return NextResponse.json(
      { error: "AI is not configured. Set a provider and API key in Settings." },
      { status: 400 }
    );
  }

  let imageBase64: string | undefined;
  let mimeType = "image/jpeg";
  let hint: string | undefined;

  try {
    const fd = await req.formData();
    const file = fd.get("image") as File | null;
    hint = (fd.get("hint") as string | null)?.trim() || undefined;

    if (file) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Image too large — max 5 MB" }, { status: 400 });
      }
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json({ error: "Only JPEG, PNG, or WebP images allowed" }, { status: 400 });
      }
      mimeType = file.type;
      imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }

    if (!imageBase64 && !hint) {
      return NextResponse.json({ error: "Provide an image or a text description." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    const suggestion = await inferItemDetails(
      imageBase64,
      mimeType,
      hint,
      settings.aiProvider as LLMProvider,
      settings.aiApiKey,
      settings.aiModel
    );
    return NextResponse.json({ suggestion });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI inference failed" },
      { status: 502 }
    );
  }
}
