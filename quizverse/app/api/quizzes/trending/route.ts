import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const trendingQuizzes = await prisma.quizSet.findMany({
      orderBy: {
        uniqueViews: "desc", // 🌟 Enforces descending popularity sorting sequence
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                institutionName: true,
                ratingAverage: true,
                contributions: true,
              },
            },
          },
        },
        ratings: {
          select: {
            id: true,
            score: true,
            reviewText: true,
            userId: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return NextResponse.json({ success: true, quizzes: trendingQuizzes });
  } catch (error) {
    console.error("TRENDING_FETCH_CRITICAL_FAULT:", error);
    return NextResponse.json({ success: false, error: "Failed to gather active grid index feeds." }, { status: 500 });
  }
}
