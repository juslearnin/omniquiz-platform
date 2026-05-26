import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export async function POST(req: Request) {
  let requestedQuizId: string | null = null;

  try {
    const { action, quizId } = await req.json();
    requestedQuizId = quizId;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Clearance tracking requires session authentication." }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };

    if (action === "VERIFY_ACCESS") {
      const targetQuiz = await prisma.quizSet.findUnique({
        where: { id: quizId },
        select: { uploaderId: true, uniqueViews: true },
      });

      if (!targetQuiz) {
        return NextResponse.json({ success: false, error: "Quiz set not found." }, { status: 404 });
      }

      if (targetQuiz.uploaderId === decoded.userId) {
        return NextResponse.json({ success: true, uniqueViews: targetQuiz.uniqueViews });
      }

      const viewer = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { isPremium: true },
      });

      // 1. Locate the existing view entry to verify unique constraint boundaries
      const existingView = await prisma.quizViewLog.findUnique({
        where: {
          userId_quizId: {
            userId: decoded.userId,
            quizId: quizId,
          },
        },
      });

      // 🌟 RULE EXECUTION: If user has already visited this set asset, bypass incrementation loops completely
      if (existingView) {
        return NextResponse.json({ success: true, uniqueViews: targetQuiz.uniqueViews });
      }

      if (!viewer?.isPremium) {
        const rollingWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentUniqueViews = await prisma.quizViewLog.count({
          where: {
            userId: decoded.userId,
            viewedAt: {
              gte: rollingWindowStart,
            },
          },
        });

        if (recentUniqueViews >= 5) {
          return NextResponse.json(
            {
              success: false,
              error: "Premium Circuit Pass required after 5 rolling daily previews.",
              limitExceeded: true,
              paywall: true,
            },
            { status: 429 },
          );
        }
      }

      // 2. First-time encounter transaction commit layer across related metric structures
      const [, updatedQuiz] = await prisma.$transaction([
        prisma.quizViewLog.create({
          data: { userId: decoded.userId, quizId: quizId }
        }),
        prisma.quizSet.update({
          where: { id: quizId },
          data: { uniqueViews: { increment: 1 } }
        })
      ]);

      await broadcastRealtimeEvent({ type: "view", quizId, actorId: decoded.userId });

      return NextResponse.json({ success: true, uniqueViews: updatedQuiz.uniqueViews });
    }

    return NextResponse.json({ success: false, error: "Invalid execution signal parameters." }, { status: 400 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const currentQuizState = requestedQuizId
        ? await prisma.quizSet.findUnique({ where: { id: requestedQuizId }, select: { uniqueViews: true } })
        : null;
      return NextResponse.json({ success: true, uniqueViews: currentQuizState?.uniqueViews || 0 });
    }
    console.error("METRICS_GATE_CRITICAL_FAULT:", error);
    return NextResponse.json({ success: false, error: "Internal session tracking boundary exception." }, { status: 500 });
  }
}
