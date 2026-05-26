import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, password, role } = body;

    if (!name || !email || !phone || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Name, Email, Phone, Password, and Role are mandatory fields." },
        { status: 400 }
      );
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedPhone = phone.trim();

    const validRoles = Object.values(UserRole) as string[];
    const normalizedRole = role.toUpperCase().replace(" ", "_");

    if (!validRoles.includes(normalizedRole)) {
      return NextResponse.json(
        { success: false, error: `Invalid role selected.` },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: sanitizedEmail },
          { phone: sanitizedPhone }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email address or phone number already exists." },
        { status: 400 }
      );
    }

    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryWindow = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.verificationToken.upsert({
      where: { email_token: { email: sanitizedEmail, token: generatedPin } },
      update: {
        token: generatedPin,
        expires: expiryWindow
      },
      create: {
        email: sanitizedEmail,
        token: generatedPin,
        expires: expiryWindow
      }
    });

    console.log(`\n============== OMNIQUIZ AUTH SIMULATION DISPATCH ==============`);
    console.log(`TARGET IDENTITY : ${sanitizedEmail}`);
    console.log(`SECURITY VERIFICATION PIN : ${generatedPin}`);
    console.log(`================================================================\n`);

    return NextResponse.json({
      success: true,
      message: "Verification entry generated successfully."
    });

  } catch (error) {
    console.error("SIGNUP_ROUTE_CRITICAL_EXCEPTION:", error);
    return NextResponse.json(
      { success: false, error: "Internal server processing failure." },
      { status: 500 }
    );
  }
}