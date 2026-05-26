import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() { 
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token");

    if (!token) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    const decoded = verifyToken(token.value) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        profile: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, user: null }, { status: 404 });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      verificationType: user.verificationType,
      isPremium: user.isPremium,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile,
    };

    // 🌟 FIXED: Added success: true to match frontend validation layers perfectly
    return NextResponse.json({ 
      success: true, 
      user: safeUser 
    });

  } catch {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }
}
