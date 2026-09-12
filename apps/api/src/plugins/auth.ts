import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

const TOKEN_PREFIX = 'Bearer ';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user: { id: string; familyId: string; role: string }): string {
  return `Bearer ${Buffer.from(JSON.stringify({
    sub: user.id,
    familyId: user.familyId,
    role: user.role,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  })).toString('base64url')}`;
}

function generateRefreshToken(user: { id: string; familyId: string }): string {
  return `Bearer ${Buffer.from(JSON.stringify({
    sub: user.id,
    familyId: user.familyId,
    type: 'refresh',
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  })).toString('base64url')}`;
}

function parseToken(token: string): { sub: string; familyId: string; role: string; type: string; exp: number } | null {
  try {
    const payload = token.replace(TOKEN_PREFIX, '');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('hashPassword', hashPassword);
  fastify.decorate('verifyPassword', verifyPassword);
  fastify.decorate('generateAccessToken', generateAccessToken);
  fastify.decorate('generateRefreshToken', generateRefreshToken);
  fastify.decorate('parseToken', parseToken);

  // Authenticate decorator
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for public routes
    const publicPaths = ['/health', '/docs', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/invitations/accept'];
    if (publicPaths.some(path => request.url.startsWith(path))) return;

    const authHeader = request.headers.authorization;
    const cookieToken = request.cookies?.accessToken;

    const token = authHeader?.startsWith(TOKEN_PREFIX) ? authHeader : cookieToken ? TOKEN_PREFIX + cookieToken : null;

    if (!token) {
      throw fastify.httpErrors.unauthorized('Authentication required');
    }

    const parsed = parseToken(token);
    if (!parsed || parsed.type !== 'access') {
      throw fastify.httpErrors.unauthorized('Invalid or expired token');
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: parsed.sub },
      select: { id: true, email: true, name: true, role: true, familyId: true, avatar: true, language: true, theme: true },
    });

    if (!user || user.familyId !== parsed.familyId) {
      throw fastify.httpErrors.unauthorized('User not found or family mismatch');
    }

    request.user = user;
  });

  // Require admin role
  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== 'ADMIN') {
      throw fastify.httpErrors.forbidden('Admin access required');
    }
  });
}