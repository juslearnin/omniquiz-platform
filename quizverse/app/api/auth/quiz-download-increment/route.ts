import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  let requestedQuizId: string | null = null;

  try {
    const { quizId } = await req.json();
    requestedQuizId = quizId;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Authentication required to pull packages." }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };

    if (!quizId) {
      return NextResponse.json({ success: false, error: "Target quiz id missing." }, { status: 400 });
    }

    const targetQuiz = await prisma.quizSet.findUnique({
      where: { id: quizId },
      select: { uploaderId: true, downloadCount: true },
    });

    if (!targetQuiz) {
      return NextResponse.json({ success: false, error: "Quiz set not found." }, { status: 404 });
    }

    if (targetQuiz.uploaderId === decoded.userId) {
      return NextResponse.json({ success: true, downloadCount: targetQuiz.downloadCount });
    }

    const existingDownload = await prisma.quizDownloadLog.findUnique({
      where: {
        userId_quizId: {
          userId: decoded.userId,
          quizId,
        },
      },
    });

    if (existingDownload) {
      return NextResponse.json({ success: true, downloadCount: targetQuiz.downloadCount });
    }

    const updatedQuiz = await prisma.$transaction(async (tx) => {
      await tx.quizDownloadLog.create({
        data: { userId: decoded.userId, quizId },
      });

      const quiz = await tx.quizSet.update({
        where: { id: quizId },
        data: { downloadCount: { increment: 1 } },
      });

      await tx.profile.update({
        where: { userId: quiz.uploaderId },
        data: { globalDownloads: { increment: 1 } },
      });

      return quiz;
    });

    return NextResponse.json({ success: true, downloadCount: updatedQuiz.downloadCount });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const currentQuizState = requestedQuizId
        ? await prisma.quizSet.findUnique({ where: { id: requestedQuizId }, select: { downloadCount: true } })
        : null;
      return NextResponse.json({ success: true, downloadCount: currentQuizState?.downloadCount || 0 });
    }
    console.error("DOWNLOAD_COUNT_ERROR:", error);
    return NextResponse.json({ success: false, error: "Database mapping breakdown." }, { status: 500 });
  }
}
