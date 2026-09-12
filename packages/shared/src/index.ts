export { z } from 'zod';
export type { ZodSchema, ZodTypeAny } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum ExpenseCategory {
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  HOUSING = 'HOUSING',
  UTILITIES = 'UTILITIES',
  HEALTH = 'HEALTH',
  EDUCATION = 'EDUCATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  CLOTHING = 'CLOTHING',
  OTHER = 'OTHER',
}

export enum BillCategory {
  SERVICES = 'SERVICES',
  TAXES = 'TAXES',
  DEBTS = 'DEBTS',
  INSURANCE = 'INSURANCE',
  OTHER = 'OTHER',
}

export enum BillStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum TodoStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ShoppingCategory {
  PANTRY = 'PANTRY',
  CLEANING = 'CLEANING',
  FRESH = 'FRESH',
  FROZEN = 'FROZEN',
  BEVERAGES = 'BEVERAGES',
  PERSONAL_CARE = 'PERSONAL_CARE',
  PET = 'PET',
  OTHER = 'OTHER',
}

export enum Recurrence {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

// ============================================
// ZOD SCHEMAS - VALIDATION
// ============================================

// Base schemas
export const idSchema = z.string().cuid();
export const emailSchema = z.string().email().toLowerCase().trim();
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().min(1).max(100).trim();
export const descriptionSchema = z.string().max(1000).trim().optional();
export const positiveDecimalSchema = z.number().positive().multipleOf(0.01);
export const nonNegativeIntSchema = z.number().int().nonnegative();
export const positiveIntSchema = z.number().int().positive();
export const dateTimeSchema = z.string().datetime({ offset: true });
export const dateSchema = z.string().date();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// Family
export const createFamilySchema = z.object({
  name: nameSchema,
});

export const updateFamilySchema = z.object({
  name: nameSchema.optional(),
});

// User
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  familyName: nameSchema.optional(), // For creating first family
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string(), // Don't validate length here, let backend handle
});

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  avatar: z.string().url().optional().nullable(),
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

// Expense
export const createExpenseSchema = z.object({
  amount: positiveDecimalSchema,
  category: z.nativeEnum(ExpenseCategory),
  description: descriptionSchema,
  date: dateTimeSchema,
  isRecurring: z.boolean().default(false),
  recurrence: z.nativeEnum(Recurrence).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseFiltersSchema = z.object({
  category: z.nativeEnum(ExpenseCategory).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  minAmount: z.number().multipleOf(0.01).optional(),
  maxAmount: z.number().multipleOf(0.01).optional(),
  isRecurring: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['date', 'amount', 'category', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Bill
export const createBillSchema = z.object({
  name: nameSchema,
  amount: positiveDecimalSchema,
  dueDate: dateTimeSchema,
  category: z.nativeEnum(BillCategory),
  status: z.nativeEnum(BillStatus).default(BillStatus.PENDING),
  recurrence: z.nativeEnum(Recurrence).default(Recurrence.MONTHLY),
  fileUrl: z.string().url().optional().nullable(),
});

export const updateBillSchema = createBillSchema.partial();

export const billFiltersSchema = z.object({
  category: z.nativeEnum(BillCategory).optional(),
  status: z.nativeEnum(BillStatus).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['dueDate', 'amount', 'name', 'status', 'createdAt']).default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Todo
export const createTodoSchema = z.object({
  title: nameSchema,
  description: descriptionSchema,
  status: z.nativeEnum(TodoStatus).default(TodoStatus.PENDING),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  dueDate: dateTimeSchema.optional().nullable(),
  assigneeId: idSchema.optional().nullable(),
});

export const updateTodoSchema = createTodoSchema.partial();

export const todoFiltersSchema = z.object({
  status: z.nativeEnum(TodoStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: idSchema.optional(),
  dueBefore: dateSchema.optional(),
  dueAfter: dateSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'title']).default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Shopping Item
export const createShoppingItemSchema = z.object({
  name: nameSchema,
  quantity: positiveIntSchema.default(1),
  unit: z.string().max(20).trim().optional().nullable(),
  category: z.nativeEnum(ShoppingCategory),
});

export const updateShoppingItemSchema = createShoppingItemSchema.partial().extend({
  isDone: z.boolean().optional(),
});

export const shoppingFiltersSchema = z.object({
  category: z.nativeEnum(ShoppingCategory).optional(),
  isDone: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
  sortBy: z.enum(['category', 'name', 'createdAt', 'isDone']).default('category'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Event
export const createEventSchema = z.object({
  title: nameSchema,
  description: descriptionSchema,
  startDate: dateTimeSchema,
  endDate: dateTimeSchema,
  allDay: z.boolean().default(false),
  recurrence: z.nativeEnum(Recurrence).optional().nullable(),
  color: hexColorSchema.optional().nullable(),
  attendeeIds: z.array(idSchema).default([]),
});

export const updateEventSchema = createEventSchema.partial();

export const eventFiltersSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  attendeeId: idSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

// Invitation
export const inviteUserSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(UserRole).default(UserRole.MEMBER),
});

export const acceptInvitationSchema = z.object({
  token: z.string(),
  password: passwordSchema,
  name: nameSchema,
});

// Pagination
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

// ============================================
// TYPE EXPORTS (inferred from schemas)
// ============================================

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type BillFilters = z.infer<typeof billFiltersSchema>;

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoFilters = z.infer<typeof todoFiltersSchema>;

export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemSchema>;
export type ShoppingFilters = z.infer<typeof shoppingFiltersSchema>;

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventFilters = z.infer<typeof eventFiltersSchema>;

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

export interface Family {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: UserRole;
  familyId: string;
  language: 'es' | 'en';
  theme: 'light' | 'dark' | 'system';
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  date: Date;
  isRecurring: boolean;
  recurrence: Recurrence | null;
  familyId: string;
  userId: string;
  user?: Pick<User, 'id' | 'name' | 'avatar'>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: BillCategory;
  status: BillStatus;
  recurrence: Recurrence;
  fileUrl: string | null;
  familyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: Priority;
  dueDate: Date | null;
  familyId: string;
  assigneeId: string | null;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: ShoppingCategory;
  isDone: boolean;
  addedById: string;
  addedBy?: Pick<User, 'id' | 'name' | 'avatar'>;
  familyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  recurrence: Recurrence | null;
  color: string | null;
  familyId: string;
  attendees: Pick<User, 'id' | 'name' | 'avatar'>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  familyId: string;
  invitedById: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export function createSuccessResponse<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || crypto.randomUUID(),
    },
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || crypto.randomUUID(),
    },
  };
}

// ============================================
// WEBSOCKET EVENTS
// ============================================

export interface WSEvents {
  // Shopping
  'shopping:item:created': ShoppingItem;
  'shopping:item:updated': ShoppingItem;
  'shopping:item:deleted': { id: string; familyId: string };
  'shopping:item:toggle': { id: string; isDone: boolean; familyId: string };

  // Todos
  'todo:created': Todo;
  'todo:updated': Todo;
  'todo:deleted': { id: string; familyId: string };
  'todo:assigned': { todoId: string; assigneeId: string | null; familyId: string };

  // Expenses
  'expense:created': Expense;
  'expense:updated': Expense;
  'expense:deleted': { id: string; familyId: string };

  // Bills
  'bill:created': Bill;
  'bill:updated': Bill;
  'bill:deleted': { id: string; familyId: string };
  'bill:paid': { id: string; familyId: string };

  // Events
  'event:created': Event;
  'event:updated': Event;
  'event:deleted': { id: string; familyId: string };

  // Notifications
  'notification:new': {
    id: string;
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
    link?: string;
  };

  // User presence
  'presence:join': { userId: string; name: string; familyId: string };
  'presence:leave': { userId: string; familyId: string };
  'presence:typing': { userId: string; module: 'shopping' | 'todos' | 'chat'; familyId: string };
}

export type WSEventName = keyof WSEvents;
export type WSEventData<K extends WSEventName> = WSEvents[K];

// ============================================
// I18N
// ============================================

export type SupportedLocale = 'es' | 'en';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['es', 'en'];
export const DEFAULT_LOCALE: SupportedLocale = 'es';

export const localeNames: Record<SupportedLocale, string> = {
  es: 'Español',
  en: 'English',
};

// Category labels for i18n
export const expenseCategoryLabels: Record<ExpenseCategory, Record<SupportedLocale, string>> = {
  [ExpenseCategory.FOOD]: { es: 'Alimentación', en: 'Food' },
  [ExpenseCategory.TRANSPORT]: { es: 'Transporte', en: 'Transport' },
  [ExpenseCategory.HOUSING]: { es: 'Vivienda', en: 'Housing' },
  [ExpenseCategory.UTILITIES]: { es: 'Servicios', en: 'Utilities' },
  [ExpenseCategory.HEALTH]: { es: 'Salud', en: 'Health' },
  [ExpenseCategory.EDUCATION]: { es: 'Educación', en: 'Education' },
  [ExpenseCategory.ENTERTAINMENT]: { es: 'Entretenimiento', en: 'Entertainment' },
  [ExpenseCategory.CLOTHING]: { es: 'Ropa', en: 'Clothing' },
  [ExpenseCategory.OTHER]: { es: 'Otros', en: 'Other' },
};

export const billCategoryLabels: Record<BillCategory, Record<SupportedLocale, string>> = {
  [BillCategory.SERVICES]: { es: 'Servicios', en: 'Services' },
  [BillCategory.TAXES]: { es: 'Impuestos', en: 'Taxes' },
  [BillCategory.DEBTS]: { es: 'Deudas', en: 'Debts' },
  [BillCategory.INSURANCE]: { es: 'Seguros', en: 'Insurance' },
  [BillCategory.OTHER]: { es: 'Otros', en: 'Other' },
};

export const shoppingCategoryLabels: Record<ShoppingCategory, Record<SupportedLocale, string>> = {
  [ShoppingCategory.PANTRY]: { es: 'Despensa', en: 'Pantry' },
  [ShoppingCategory.CLEANING]: { es: 'Limpieza', en: 'Cleaning' },
  [ShoppingCategory.FRESH]: { es: 'Frescos', en: 'Fresh' },
  [ShoppingCategory.FROZEN]: { es: 'Congelados', en: 'Frozen' },
  [ShoppingCategory.BEVERAGES]: { es: 'Bebidas', en: 'Beverages' },
  [ShoppingCategory.PERSONAL_CARE]: { es: 'Cuidado Personal', en: 'Personal Care' },
  [ShoppingCategory.PET]: { es: 'Mascotas', en: 'Pet' },
  [ShoppingCategory.OTHER]: { es: 'Otros', en: 'Other' },
};

export const todoStatusLabels: Record<TodoStatus, Record<SupportedLocale, string>> = {
  [TodoStatus.PENDING]: { es: 'Pendiente', en: 'Pending' },
  [TodoStatus.IN_PROGRESS]: { es: 'En progreso', en: 'In Progress' },
  [TodoStatus.DONE]: { es: 'Completado', en: 'Done' },
};

export const priorityLabels: Record<Priority, Record<SupportedLocale, string>> = {
  [Priority.LOW]: { es: 'Baja', en: 'Low' },
  [Priority.MEDIUM]: { es: 'Media', en: 'Medium' },
  [Priority.HIGH]: { es: 'Alta', en: 'High' },
  [Priority.URGENT]: { es: 'Urgente', en: 'Urgent' },
};

export const billStatusLabels: Record<BillStatus, Record<SupportedLocale, string>> = {
  [BillStatus.PENDING]: { es: 'Pendiente', en: 'Pending' },
  [BillStatus.PAID]: { es: 'Pagado', en: 'Paid' },
  [BillStatus.OVERDUE]: { es: 'Vencido', en: 'Overdue' },
  [BillStatus.CANCELLED]: { es: 'Cancelado', en: 'Cancelled' },
};

export const recurrenceLabels: Record<Recurrence, Record<SupportedLocale, string>> = {
  [Recurrence.DAILY]: { es: 'Diario', en: 'Daily' },
  [Recurrence.WEEKLY]: { es: 'Semanal', en: 'Weekly' },
  [Recurrence.MONTHLY]: { es: 'Mensual', en: 'Monthly' },
  [Recurrence.YEARLY]: { es: 'Anual', en: 'Yearly' },
};