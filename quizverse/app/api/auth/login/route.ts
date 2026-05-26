import { prisma } from "@/lib/prisma";
import { comparePassword, generateToken } from "@/lib/auth";
import { serialize } from "cookie";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required login fields." }, { status: 400 });
    }

    // Standardize emails to lowercase to match our registration layer queries exactly
    const sanitizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
      include: {
        profile: true // 🌟 FIXED: Include full profile payload to prevent hydration mismatches
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.password);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Generate secure session tracking token strings
    const token = generateToken(user.id, user.email);

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

    const response = NextResponse.json({
      success: true,
      user: safeUser
    });

    // FIXING INCOGNITO COOKIE ATTRIBUTE SET
    response.headers.set(
      "Set-Cookie",
      serialize("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", 
        sameSite: "lax", 
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // Kept active for 1 week
      })
    );

    return response;

  } catch (error) {
    console.error("LOGIN_ROUTE_CRITICAL_EXCEPTION:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
