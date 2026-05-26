import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/auth";
import { serialize } from "cookie";

interface UniversityRegistryEntry {
  name: string;
  domains: string[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      name, email, phone, password, role, token, 
      companyName, bio, baseRate, venueAddress 
    } = body;

    if (!email || !token || !password) {
      return NextResponse.json({ success: false, error: "Required tracking parameters missing." }, { status: 400 });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedPhone = phone?.trim();

    const validTokenRecord = await prisma.verificationToken.findUnique({
      where: { token: token.trim() }
    });

    if (!validTokenRecord || validTokenRecord.email !== sanitizedEmail) {
      return NextResponse.json({ success: false, error: "Invalid verification code supplied." }, { status: 400 });
    }

    if (new Date() > validTokenRecord.expires) {
      await prisma.verificationToken.delete({ where: { id: validTokenRecord.id } });
      return NextResponse.json({ success: false, error: "Verification token has expired." }, { status: 400 });
    }

    const emailDomain = sanitizedEmail.split("@")[1];
    let computedInstitution = null;

    if (role === "COLLEGE_STUDENT") {
      if (sanitizedEmail === "ojasr45@gmail.com") {
        computedInstitution = "OmniQuiz Beta Testing Campus";
      } else {
        try {
          const registryResponse = await fetch(`http://universities.hipolabs.com/search?name=&country=India`);
          const institutions = (await registryResponse.json()) as UniversityRegistryEntry[];
          const matchedCollege = institutions.find((inst) =>
            inst.domains.some((d: string) => d.toLowerCase() === emailDomain.toLowerCase())
          );
          computedInstitution = matchedCollege ? matchedCollege.name : `${emailDomain.split('.')[0].toUpperCase()} Campus Circuit`;
        } catch {
          computedInstitution = `${emailDomain.split('.')[0].toUpperCase()} Campus Circuit`;
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const systemUser = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: sanitizedEmail,
          phone: sanitizedPhone,
          password: hashedPassword,
          role,
          isVerified: true,
          verificationType: role === "COLLEGE_STUDENT" ? "EMAIL" : "PHONE",
        }
      });

      const newProfile = await tx.profile.create({
        data: {
          userId: newUser.id,
          institutionName: computedInstitution,
          companyName: role === "QUIZZER" ? companyName : null,
          bio: bio || null,
          baseRate: role === "QM" ? baseRate : null, // 💡 FIXED: Aligned with 'QM' model enum value
          venueAddress: role === "PUB_HOST" ? venueAddress : null
        }
      });

      await tx.verificationToken.delete({ where: { id: validTokenRecord.id } });
      return { user: newUser, profile: newProfile };
    });

    const sessionToken = generateToken(systemUser.user.id, systemUser.user.email);

    // 🌟 UNIFIED RESPONSE LAYER MATCHING MAIN PRISMA SCHEMAS EXPLICITLY
    const response = NextResponse.json({ 
      success: true, 
      message: "Profile finalized and authenticated.",
      user: {
        id: systemUser.user.id,
        name: systemUser.user.name,
        email: systemUser.user.email,
        role: systemUser.user.role,
        profile: {
          institutionName: systemUser.profile.institutionName,
          companyName: systemUser.profile.companyName,
          bio: systemUser.profile.bio,
          baseRate: systemUser.profile.baseRate,
          venueAddress: systemUser.profile.venueAddress
        }
      }
    });

    response.headers.set(
      "Set-Cookie",
      serialize("token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    );

    return response;

  } catch (error) {
    console.error("OTP_REGISTRATION_EXCEPTION:", error);
    return NextResponse.json({ success: false, error: "Database transaction failure." }, { status: 500 });
  }
}
