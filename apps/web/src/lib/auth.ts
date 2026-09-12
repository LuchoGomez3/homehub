import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { api } from './api';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        try {
          const response = await api.login({
            email: credentials.email,
            password: credentials.password,
          });

          const { user, accessToken, refreshToken } = response.data;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            familyId: user.familyId,
            avatar: user.avatar,
            language: user.language,
            theme: user.theme,
            accessToken,
            refreshToken,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.role = user.role;
        token.familyId = user.familyId;
        token.avatar = user.avatar;
        token.language = user.language;
        token.theme = user.theme;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user = {
        ...session.user,
        id: token.sub,
        role: token.role,
        familyId: token.familyId,
        avatar: token.avatar,
        language: token.language,
        theme: token.theme,
      };
      return session;
    },
  },
  pages: {
    signIn: '/es/login',
    error: '/es/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };