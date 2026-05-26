import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "omniquiz_guest_view_state";
const GUEST_DAILY_LIMIT = 2;

type GuestViewState = {
  date: string;
  viewedQuizIds: string[];
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseState(raw?: string): GuestViewState {
  if (!raw) return { date: todayKey(), viewedQuizIds: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<GuestViewState>;
    if (parsed.date !== todayKey()) return { date: todayKey(), viewedQuizIds: [] };
    return {
      date: todayKey(),
      viewedQuizIds: Array.isArray(parsed.viewedQuizIds) ? parsed.viewedQuizIds.filter(Boolean) : [],
    };
  } catch {
    return { date: todayKey(), viewedQuizIds: [] };
  }
}

export async function POST(req: Request) {
  try {
    const { quizId } = await req.json();
    if (!quizId) {
      return NextResponse.json({ success: false, error: "Quiz id missing." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const state = parseState(cookieStore.get(COOKIE_NAME)?.value);

    const targetQuiz = await prisma.quizSet.findUnique({
      where: { id: quizId },
      select: { uniqueViews: true },
    });

    if (!targetQuiz) {
      return NextResponse.json({ success: false, error: "Quiz set not found." }, { status: 404 });
    }

    if (state.viewedQuizIds.includes(quizId)) {
      return NextResponse.json({ success: true, uniqueViews: targetQuiz.uniqueViews });
    }

    if (state.viewedQuizIds.length >= GUEST_DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: "Identity verification required after 2 guest previews.",
          limitExceeded: true,
        },
        { status: 429 },
      );
    }

    const updatedQuiz = await prisma.quizSet.update({
      where: { id: quizId },
      data: { uniqueViews: { increment: 1 } },
      select: { uniqueViews: true },
    });

    const response = NextResponse.json({ success: true, uniqueViews: updatedQuiz.uniqueViews });
    response.cookies.set(
      COOKIE_NAME,
      JSON.stringify({ date: todayKey(), viewedQuizIds: [...state.viewedQuizIds, quizId] }),
      {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60,
        path: "/",
      },
    );
    return response;
  } catch (error) {
    console.error("GUEST_VIEW_GATE_ERROR:", error);
    return NextResponse.json({ success: false, error: "Guest view gate failed." }, { status: 500 });
  }
}
