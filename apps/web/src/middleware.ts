import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Public paths that don't require auth
    const publicPaths = ['/login', '/register', '/api/auth'];
    const isPublicPath = publicPaths.some(p => path.startsWith(p));

    if (isPublicPath) {
      return NextResponse.next();
    }

    // If no token and not public, redirect to login
    if (!token) {
      const loginUrl = new URL('/es/login', req.url);
      loginUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
};