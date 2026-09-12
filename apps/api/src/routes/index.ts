import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { familyRoutes } from './family.js';
import { userRoutes } from './users.js';
import { expenseRoutes } from './expenses.js';
import { billRoutes } from './bills.js';
import { todoRoutes } from './todos.js';
import { shoppingRoutes } from './shopping.js';
import { eventRoutes } from './events.js';
import { invitationRoutes } from './invitations.js';
import { dashboardRoutes } from './dashboard.js';

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(familyRoutes, { prefix: '/api/family' });
  await fastify.register(userRoutes, { prefix: '/api/users' });
  await fastify.register(expenseRoutes, { prefix: '/api/expenses' });
  await fastify.register(billRoutes, { prefix: '/api/bills' });
  await fastify.register(todoRoutes, { prefix: '/api/todos' });
  await fastify.register(shoppingRoutes, { prefix: '/api/shopping' });
  await fastify.register(eventRoutes, { prefix: '/api/events' });
  await fastify.register(invitationRoutes, { prefix: '/api/invitations' });
  await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
}