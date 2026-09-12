import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { FastifyInstance } from 'fastify';
import { prisma } from '../server.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  familyId?: string;
}

export async function setupSocketIO(
  fastify: FastifyInstance,
  redisClient: ReturnType<typeof createClient>,
  redisSubClient: ReturnType<typeof createClient>
) {
  const io = new SocketIOServer({
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    adapter: createAdapter(redisClient, redisSubClient),
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));

      // Parse token (same logic as auth plugin)
      const parsed = parseToken(token);
      if (!parsed || parsed.type !== 'access') return next(new Error('Invalid token'));

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: parsed.sub },
        select: { id: true, familyId: true },
      });

      if (!user || user.familyId !== parsed.familyId) return next(new Error('User not found'));

      socket.userId = user.id;
      socket.familyId = user.familyId;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const { userId, familyId } = socket;

    // Join family room
    socket.join(`family:${familyId}`);

    // Join user room for direct messages
    socket.join(`user:${userId}`);

    // Track presence
    socket.to(`family:${familyId}`).emit('presence:join', { userId, name: '', familyId });

    logger.debug({ userId, familyId }, 'Socket connected');

    // Shopping module events
    socket.on('shopping:typing', () => {
      socket.to(`family:${familyId}`).emit('presence:typing', { userId, module: 'shopping', familyId });
    });

    // Todo module events
    socket.on('todos:typing', () => {
      socket.to(`family:${familyId}`).emit('presence:typing', { userId, module: 'todos', familyId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      socket.to(`family:${familyId}`).emit('presence:leave', { userId, familyId });
      logger.debug({ userId, familyId }, 'Socket disconnected');
    });
  });

  // Make io available on fastify
  fastify.decorate('io', io);

  return io;
}

function parseToken(token: string): { sub: string; familyId: string; role: string; type: string; exp: number } | null {
  try {
    const payload = token.replace('Bearer ', '');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}