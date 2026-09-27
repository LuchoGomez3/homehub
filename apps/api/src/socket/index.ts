import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { ACCESS_COOKIE } from '../lib/tokens.js';
import { verifyAccessSession } from '../lib/session.js';
import { sessionRoom, userRoom } from '../lib/rooms.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  familyId?: string;
}

/**
 * Mismo origen del token que el preHandler de HTTP: la cookie httpOnly, que
 * el navegador manda en el handshake, o un token explicito.
 */
function extractHandshakeToken(fastify: FastifyInstance, socket: Socket): string | null {
  const explicit = socket.handshake.auth?.token;
  if (typeof explicit === 'string' && explicit) return explicit.replace(/^Bearer /, '');

  const header = socket.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) return fastify.parseCookie(cookieHeader)[ACCESS_COOKIE] ?? null;

  return null;
}

export async function setupSocketIO(
  fastify: FastifyInstance,
  redisClient: ReturnType<typeof createClient>,
  redisSubClient: ReturnType<typeof createClient>,
) {
  const io = new SocketIOServer({
    cors: {
      origin: env.CORS_ORIGIN.split(','),
      credentials: true,
    },
    adapter: createAdapter(redisClient, redisSubClient),
  });

  // Mismo chequeo que HTTP (lib/session.ts): firma, tipo y sesion viva.
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = extractHandshakeToken(fastify, socket);
      if (!token) return next(new Error('Authentication required'));

      const session = await verifyAccessSession(fastify, token);
      if (!session) return next(new Error('Invalid or expired session'));

      socket.userId = session.user.id;
      socket.familyId = session.user.familyId;
      socket.join(sessionRoom(session.sid));
      next();
    } catch (err) {
      logger.error({ err }, 'Socket auth failed');
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const { userId, familyId } = socket;

    // Join family room
    socket.join(`family:${familyId}`);

    // Join user room for direct messages
    socket.join(userRoom(userId!));

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

  // Sin attach, Socket.IO no escucha en ningun puerto: los clientes no
  // tenian a donde conectarse. Comparte el servidor HTTP de Fastify.
  io.attach(fastify.server);
  fastify.addHook('onClose', async () => {
    await io.close();
  });

  // El decorador `io` lo registra server.ts con el valor que se devuelve aca.
  return io;
}
