import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { env } from './config/env.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './lib/tokens.js';
import { authPlugin } from './plugins/auth.js';
import { familyPlugin } from './plugins/family.js';
import { registerRoutes } from './routes/index.js';
import { setupSocketIO } from './socket/index.js';
import { logger } from './utils/logger.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const redisClient = createClient({
  url: env.REDIS_URL,
});

const redisSubClient = redisClient.duplicate();

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true,
    ajv: {
      customOptions: { removeAdditional: 'all' },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Core plugins
  await server.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await server.register(cors, {
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await server.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  });

  await server.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (req) => req.ip,
  });

  // httpErrors, assert, etc. Las rutas y el plugin de auth dependen de esto.
  await server.register(sensible);

  // Dos instancias de JWT con secretos distintos: un access token robado no
  // sirve para fabricar refresh tokens, y viceversa. En runtime quedan como
  // fastify.jwt.access y fastify.jwt.refresh (ver lib/tokens.ts).
  await server.register(jwt, {
    namespace: 'access',
    secret: env.JWT_SECRET,
    sign: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  });
  await server.register(jwt, {
    namespace: 'refresh',
    secret: env.JWT_REFRESH_SECRET,
    sign: { expiresIn: REFRESH_TOKEN_TTL_SECONDS },
  });

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  // Swagger/OpenAPI
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'HomeHub API',
        description: 'Family management platform API',
        version: '1.0.0',
      },
      servers: [{ url: env.API_URL, description: 'Development server' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
        },
      },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
  });

  await server.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // Custom plugins
  await server.register(authPlugin);
  await server.register(familyPlugin);

  // Routes
  await registerRoutes(server);

  // Health check
  server.get('/health', {
    schema: {
      response: {
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.String(),
          uptime: Type.Number(),
        }),
      },
    },
  }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'Request error');

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.validation,
        },
      });
    }

    if (error.statusCode === 401) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (error.statusCode === 403) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }

    if (error.statusCode === 404) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  // Initialize Socket.IO
  const io = await setupSocketIO(server, redisClient, redisSubClient);
  server.decorate('io', io);

  // Connect Redis
  redisClient.on('error', (err) => logger.error({ err }, 'Redis client error'));
  redisSubClient.on('error', (err) => logger.error({ err }, 'Redis subscriber error'));

  await redisClient.connect();
  await redisSubClient.connect();

  return server;
}

async function start() {
  try {
    const server = await buildServer();
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`🚀 Server running at http://localhost:${env.PORT}`);
    logger.info(`📚 API docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };