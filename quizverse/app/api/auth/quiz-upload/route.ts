import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

const MAX_PACKET_BYTES = 45 * 1024 * 1024;
const ACCEPTED_PACKET_PREFIXES = [
  "data:application/pdf;base64,",
  "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,",
  "data:application/octet-stream;base64,",
];

function estimateDataUrlBytes(payload: string) {
  const base64 = payload.split(",").pop() || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      genre,
      price,
      questionCount,
      fileName,
      fileUrl,
      fileType,
      signedAffidavit,
    } = body;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Session identity unverified. Please log back in." },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token) as { userId: string };

    if (!title || !fileName || !fileUrl) {
      return NextResponse.json(
        { success: false, error: "Required title, file name, or PDF payload is missing." },
        { status: 400 },
      );
    }

    if (!signedAffidavit) {
      return NextResponse.json(
        { success: false, error: "Originality affidavit is required." },
        { status: 400 },
      );
    }

    const packetPayload = String(fileUrl);
    const isAcceptedPacket = ACCEPTED_PACKET_PREFIXES.some((prefix) =>
      packetPayload.startsWith(prefix),
    );

    if (!isAcceptedPacket) {
      return NextResponse.json(
        { success: false, error: "Only browser-buffered PDF or PPTX payloads are accepted." },
        { status: 400 },
      );
    }

    if (estimateDataUrlBytes(packetPayload) > MAX_PACKET_BYTES) {
      return NextResponse.json(
        { success: false, error: "Document packet exceeds the 45MB creator upload limit." },
        { status: 413 },
      );
    }

    const duplicateMatch = await prisma.quizSet.findFirst({
      where: { fileUrl },
      select: { id: true },
    });

    if (duplicateMatch) {
      return NextResponse.json(
        {
          success: false,
          error: "Plagiarism Block. This exact document payload already exists.",
        },
        { status: 409 },
      );
    }

    const newQuiz = await prisma.$transaction(async (tx) => {
      const currentProfile = await tx.profile.upsert({
        where: { userId: decoded.userId },
        update: {},
        create: { userId: decoded.userId },
      });

      const activeContributionCount = await tx.quizSet.count({
        where: { uploaderId: decoded.userId },
      });
      const serverPrice = activeContributionCount > 3 ? Math.max(0, Number(price || 0)) : 0;

      const quiz = await tx.quizSet.create({
        data: {
          title,
          description: description || `Uploaded PDF: ${fileName}`,
          genre: String(genre || "GENERAL").toUpperCase(),
          price: serverPrice,
          questionCount: Number(questionCount || 20),
          fileUrl,
          fileType: fileType || "PDF",
          signedAffidavit: Boolean(signedAffidavit),
          uploaderId: decoded.userId,
        },
      });

      const currentContributions = (currentProfile?.contributions || 0) + 1;

      let computedLevel = 1;
      if (currentContributions >= 10) computedLevel = 3;
      else if (currentContributions >= 3) computedLevel = 2;

      await tx.profile.update({
        where: { userId: decoded.userId },
        data: {
          contributions: currentContributions,
          creatorLevel: computedLevel,
        },
      });

      return quiz;
    });

    return NextResponse.json({ success: true, quizId: newQuiz.id });
  } catch (error) {
    console.error("WRITE_INGESTION_CRITICAL_FAULT:", error);
    return NextResponse.json(
      { success: false, error: "Failed to securely serialize data packet." },
      { status: 500 },
    );
  }
}
