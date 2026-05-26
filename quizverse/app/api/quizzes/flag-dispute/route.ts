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
      return NextResponse.json(
        { success: false, error: "Authentication status required to log platform disputes." },
        { status: 401 },
      );
    }

    let decodedUser: { userId: string };
    try {
      decodedUser = verifyToken(token) as { userId: string };
      if (!decodedUser?.userId) throw new Error("Missing user id");
    } catch {
      return NextResponse.json(
        { success: false, error: "Session validation failed. Please log in again." },
        { status: 401 },
      );
    }

    if (!quizId) {
      return NextResponse.json(
        { success: false, error: "Missing quiz id." },
        { status: 400 },
      );
    }

    const currentQuiz = await prisma.quizSet.findUnique({
      where: { id: quizId },
      select: { isPlagiarized: true },
    });

    if (!currentQuiz) {
      return NextResponse.json(
        { success: false, error: "Target quiz set not located in active indices." },
        { status: 404 },
      );
    }

    const updatedQuiz = await prisma.quizSet.update({
      where: { id: quizId },
      data: {
        isPlagiarized: !currentQuiz.isPlagiarized,
      },
      select: {
        id: true,
        isPlagiarized: true,
      },
    });

    return NextResponse.json({
      success: true,
      isPlagiarized: updatedQuiz.isPlagiarized,
      message: updatedQuiz.isPlagiarized
        ? "Asset successfully flagged for content plagiarism review."
        : "Content plagiarism dispute cleared.",
    });
  } catch (error) {
    console.error("DISPUTE_FLAG_API_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process dispute status change transaction." },
      { status: 500 },
    );
  }
}