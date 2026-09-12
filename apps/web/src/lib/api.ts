import { z } from 'zod';
import type { 
  Expense, Bill, Todo, ShoppingItem, Event, User, Family,
  CreateExpenseInput, UpdateExpenseInput, ExpenseFilters,
  CreateBillInput, UpdateBillInput, BillFilters,
  CreateTodoInput, UpdateTodoInput, TodoFilters,
  CreateShoppingItemInput, UpdateShoppingItemInput, ShoppingFilters,
  CreateEventInput, UpdateEventInput, EventFilters,
  InviteUserInput, AcceptInvitationInput,
  LoginInput, RegisterInput, UpdateUserInput,
} from '@homehub/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new ApiError(response.status, error.error?.message || 'Request failed', error.error?.details);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  get<T>(endpoint: string) { return this.request<T>(endpoint, { method: 'GET' }); }
  post<T>(endpoint: string, data: unknown) { return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
  patch<T>(endpoint: string, data: unknown) { return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }); }
  delete<T>(endpoint: string) { return this.request<T>(endpoint, { method: 'DELETE' }); }

  // Auth
  login(data: LoginInput) { return this.post<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', data); }
  register(data: RegisterInput) { return this.post<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/register', data); }
  refresh() { return this.post<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/refresh', {}); }
  logout() { return this.post('/api/auth/logout', {}); }
  me() { return this.get<{ user: User; family: Family }>('/api/auth/me'); }

  // Family
  getFamily() { return this.get<Family>('/api/family'); }
  updateFamily(data: { name: string }) { return this.patch<Family>('/api/family', data); }
  getMembers() { return this.get<User[]>('/api/family/members'); }

  // Users
  getProfile() { return this.get<User>('/api/users/me'); }
  updateProfile(data: UpdateUserInput) { return this.patch<User>('/api/users/me', data); }
  changePassword(data: { currentPassword: string; newPassword: string }) { return this.post('/api/users/me/change-password', data); }

  // Expenses
  getExpenses(filters?: ExpenseFilters) { return this.get<{ data: Expense[]; meta: any }>('/api/expenses', { params: filters }); }
  getExpense(id: string) { return this.get<Expense>(`/api/expenses/${id}`); }
  createExpense(data: CreateExpenseInput) { return this.post<Expense>('/api/expenses', data); }
  updateExpense(id: string, data: UpdateExpenseInput) { return this.patch<Expense>(`/api/expenses/${id}`, data); }
  deleteExpense(id: string) { return this.delete(`/api/expenses/${id}`); }
  getExpenseStats(startDate?: string, endDate?: string) { return this.get(`/api/expenses/stats/summary`, { params: { startDate, endDate } }); }

  // Bills
  getBills(filters?: BillFilters) { return this.get<{ data: Bill[]; meta: any }>('/api/bills', { params: filters }); }
  getBill(id: string) { return this.get<Bill>(`/api/bills/${id}`); }
  createBill(data: CreateBillInput) { return this.post<Bill>('/api/bills', data); }
  updateBill(id: string, data: UpdateBillInput) { return this.patch<Bill>(`/api/bills/${id}`, data); }
  deleteBill(id: string) { return this.delete(`/api/bills/${id}`); }
  payBill(id: string) { return this.post<Bill>(`/api/bills/${id}/pay`, {}); }
  getUpcomingBills(days?: number) { return this.get<Bill[]>(`/api/bills/upcoming/next`, { params: { days } }); }

  // Todos
  getTodos(filters?: TodoFilters) { return this.get<{ data: Todo[]; meta: any }>('/api/todos', { params: filters }); }
  getTodo(id: string) { return this.get<Todo>(`/api/todos/${id}`); }
  createTodo(data: CreateTodoInput) { return this.post<Todo>('/api/todos', data); }
  updateTodo(id: string, data: UpdateTodoInput) { return this.patch<Todo>(`/api/todos/${id}`, data); }
  deleteTodo(id: string) { return this.delete(`/api/todos/${id}`); }
  getKanban() { return this.get<{ pending: Todo[]; inProgress: Todo[]; done: Todo[] }>('/api/todos/board/kanban'); }

  // Shopping
  getShoppingItems(filters?: ShoppingFilters) { return this.get<{ data: ShoppingItem[]; meta: any }>('/api/shopping', { params: filters }); }
  getShoppingItem(id: string) { return this.get<ShoppingItem>(`/api/shopping/${id}`); }
  createShoppingItem(data: CreateShoppingItemInput) { return this.post<ShoppingItem>('/api/shopping', data); }
  updateShoppingItem(id: string, data: UpdateShoppingItemInput) { return this.patch<ShoppingItem>(`/api/shopping/${id}`, data); }
  deleteShoppingItem(id: string) { return this.delete(`/api/shopping/${id}`); }
  toggleShoppingItem(id: string) { return this.post<ShoppingItem>(`/api/shopping/${id}/toggle`, {}); }
  clearCompletedShopping() { return this.delete('/api/shopping/completed/clear'); }
  getShoppingByCategory() { return this.get<Record<string, ShoppingItem[]>>('/api/shopping/grouped/by-category'); }

  // Events
  getEvents(filters?: EventFilters) { return this.get<{ data: Event[]; meta: any }>('/api/events', { params: filters }); }
  getEvent(id: string) { return this.get<Event>(`/api/events/${id}`); }
  createEvent(data: CreateEventInput) { return this.post<Event>('/api/events', data); }
  updateEvent(id: string, data: UpdateEventInput) { return this.patch<Event>(`/api/events/${id}`, data); }
  deleteEvent(id: string) { return this.delete(`/api/events/${id}`); }
  getCalendarEvents(start: string, end: string) { return this.get<Event[]>(`/api/events/calendar/month`, { params: { start, end } }); }
  getUpcomingEvents() { return this.get<Event[]>(`/api/events/upcoming/week`); }

  // Invitations
  inviteUser(data: InviteUserInput) { return this.post('/api/invitations', data); }
  getInvitations() { return this.get<{ data: any[] }>('/api/invitations'); }
  acceptInvitation(data: AcceptInvitationInput) { return this.post('/api/invitations/accept', data); }
  cancelInvitation(id: string) { return this.delete(`/api/invitations/${id}`); }

  // Dashboard
  getDashboard() { return this.get('/api/dashboard'); }
  getExpenseTrends() { return this.get('/api/dashboard/expense-trends'); }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient(API_URL, () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
});

// Helper for query params
function buildQuery(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString() ? `?${searchParams.toString()}` : '';
}

// Patch the request method to handle query params
const originalRequest = ApiClient.prototype.request;
ApiClient.prototype.request = async function<T>(endpoint: string, options: RequestInit = {}) {
  const url = new URL(`${this.baseUrl}${endpoint}`);
  if (options.method === 'GET' && options.body) {
    const params = options.body as Record<string, unknown>;
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return originalRequest.call(this, url.toString(), options);
};