import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { quizId } = await req.json();
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Clearance verification failed. Unauthorized." }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };

    // Locate target quiz record
    const targetQuiz = await prisma.quizSet.findUnique({ where: { id: quizId } });
    if (!targetQuiz) {
      return NextResponse.json({ success: false, error: "Target set not located inside indices." }, { status: 404 });
    }

    // Security check boundary constraints enforcement
    if (targetQuiz.uploaderId !== decoded.userId) {
      return NextResponse.json({ success: false, error: "Operation denied. You do not own this asset packet." }, { status: 403 });
    }

    // Atomically delete quiz records and keep creator counters in a non-negative range.
    await prisma.$transaction(async (tx) => {
      await tx.quizSet.delete({ where: { id: quizId } });

      const remainingSets = await tx.quizSet.count({
        where: { uploaderId: decoded.userId },
      });
      let computedLevel = 1;
      if (remainingSets >= 10) computedLevel = 3;
      else if (remainingSets >= 3) computedLevel = 2;

      await tx.profile.update({
        where: { userId: decoded.userId },
        data: {
          contributions: remainingSets,
          creatorLevel: computedLevel,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Asset evicted successfully from core servers." });
  } catch (error) {
    console.error("DELETION_ROUTE_CRITICAL_FAULT:", error);
    return NextResponse.json({ success: false, error: "Internal processing deletion error." }, { status: 500 });
  }
}
