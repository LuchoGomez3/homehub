import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        familyId: session.user.familyId,
        avatar: session.user.avatar,
        language: session.user.language,
        theme: session.user.theme,
      },
      family: {
        id: session.user.familyId,
        name: 'Familia', // Would fetch from DB in production
      },
    },
  });
}