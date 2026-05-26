import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { quizId, score, reviewText } = await req.json();
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Authentication required to post reviews." }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };

    if (!quizId || !score) {
      return NextResponse.json({ success: false, error: "Missing required tracking parameters." }, { status: 400 });
    }

    // Locate target quiz item to verify ownership constraints
    const targetQuiz = await prisma.quizSet.findUnique({ where: { id: quizId } });
    if (!targetQuiz) {
      return NextResponse.json({ success: false, error: "Quiz set not located inside records." }, { status: 404 });
    }

    // 🔒 EXPLICIT SECURITY CHECK: Restrict self-reviews to protect system rating metrics
    if (targetQuiz.uploaderId === decoded.userId) {
      return NextResponse.json({ success: false, error: "Operation denied. You cannot critique your own published asset." }, { status: 403 });
    }

    // Write or update user review within database rows using upsert logic
    const loggedReview = await prisma.quizRating.upsert({
      where: {
        userId_quizId: {
          userId: decoded.userId,
          quizId: quizId
        }
      },
      update: {
        score: Number(score),
        reviewText: reviewText?.trim() || ""
      },
      create: {
        userId: decoded.userId,
        quizId: quizId,
        score: Number(score),
        reviewText: reviewText?.trim() || ""
      }
    });

    // Re-calculate user ranking star averages dynamically inside profiles model frame
    const allQuizRatings = await prisma.quizRating.findMany({
      where: { quiz: { uploaderId: targetQuiz.uploaderId } },
      select: { score: true }
    });

    const averageRatingCalculated = allQuizRatings.reduce((acc, curr) => acc + curr.score, 0) / allQuizRatings.length;

    await prisma.profile.update({
      where: { userId: targetQuiz.uploaderId },
      data: { ratingAverage: parseFloat(averageRatingCalculated.toFixed(2)) }
    });

    return NextResponse.json({ success: true, review: loggedReview });
  } catch (error) {
    console.error("CRITIQUE_SUBMISSION_FAULT:", error);
    return NextResponse.json({ success: false, error: "Internal review processor processing crash." }, { status: 500 });
  }
}