import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { z } from 'zod';
import { loginSchema, registerSchema } from '@homehub/shared';

const loginBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});

const registerBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  familyName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});

const tokenResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    user: Type.Object({
      id: Type.String(),
      email: Type.String(),
      name: Type.String(),
      role: Type.String(),
      familyId: Type.String(),
      avatar: Type.Union([Type.String(), Type.Null()]),
      language: Type.String(),
      theme: Type.String(),
    }),
    accessToken: Type.String(),
    refreshToken: Type.String(),
  }),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', {
    schema: {
      body: loginBody,
      response: { 200: tokenResponse },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await fastify.verifyPassword(password, user.passwordHash))) {
      throw fastify.httpErrors.unauthorized('Invalid credentials');
    }

    const accessToken = fastify.generateAccessToken(user);
    const refreshToken = fastify.generateRefreshToken(user);

    reply.setCookie('accessToken', accessToken.replace('Bearer ', ''), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    reply.setCookie('refreshToken', refreshToken.replace('Bearer ', ''), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          familyId: user.familyId,
          avatar: user.avatar,
          language: user.language,
          theme: user.theme,
        },
        accessToken,
        refreshToken,
      },
    };
  });

  // Register
  fastify.post('/register', {
    schema: {
      body: registerBody,
      response: { 201: tokenResponse },
    },
  }, async (request, reply) => {
    const { email, password, name, familyName } = request.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw fastify.httpErrors.conflict('Email already registered');
    }

    const passwordHash = await fastify.hashPassword(password);

    const family = await prisma.family.create({
      data: {
        name: familyName || `${name}'s Family`,
        members: {
          create: {
            email,
            passwordHash,
            name,
            role: 'ADMIN',
          },
        },
      },
      include: { members: true },
    });

    const user = family.members[0];
    const accessToken = fastify.generateAccessToken(user);
    const refreshToken = fastify.generateRefreshToken(user);

    reply.setCookie('accessToken', accessToken.replace('Bearer ', ''), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    reply.setCookie('refreshToken', refreshToken.replace('Bearer ', ''), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          familyId: user.familyId,
          avatar: user.avatar,
          language: user.language,
          theme: user.theme,
        },
        accessToken,
        refreshToken,
      },
    });
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      response: { 200: tokenResponse },
    },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken || request.headers.authorization?.replace('Bearer ', '');
    if (!refreshToken) {
      throw fastify.httpErrors.unauthorized('Refresh token required');
    }

    const parsed = fastify.parseToken(refreshToken);
    if (!parsed || parsed.type !== 'refresh') {
      throw fastify.httpErrors.unauthorized('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.sub },
      select: { id: true, email: true, name: true, role: true, familyId: true, avatar: true, language: true, theme: true },
    });

    if (!user || user.familyId !== parsed.familyId) {
      throw fastify.httpErrors.unauthorized('User not found');
    }

    const accessToken = fastify.generateAccessToken(user);
    const newRefreshToken = fastify.generateRefreshToken(user);

    reply.setCookie('accessToken', accessToken.replace('Bearer ', ''), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    reply.setCookie('refreshToken', newRefreshToken.replace('Bearer ', ''), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return {
      success: true,
      data: {
        user,
        accessToken,
        refreshToken: newRefreshToken,
      },
    };
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });
    return { success: true, data: { message: 'Logged out successfully' } };
  });

  // Me
  fastify.get('/me', {
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
              name: Type.String(),
              role: Type.String(),
              familyId: Type.String(),
              avatar: Type.Union([Type.String(), Type.Null()]),
              language: Type.String(),
              theme: Type.String(),
            }),
            family: Type.Object({
              id: Type.String(),
              name: Type.String(),
            }),
          }),
        }),
      },
    },
  }, async (request) => {
    return {
      success: true,
      data: {
        user: request.user!,
        family: request.family!,
      },
    };
  });
}