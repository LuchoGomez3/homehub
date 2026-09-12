'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Family, Expense, Bill, Todo, ShoppingItem, Event } from '@homehub/shared';

interface AuthState {
  user: User | null;
  family: Family | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (data: { user: User; family: Family; accessToken: string; refreshToken: string }) => void;
  setUser: (user: User) => void;
  setFamily: (family: Family) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      family: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      setAuth: (data) => set({ ...data, isAuthenticated: true, isLoading: false }),
      setUser: (user) => set({ user }),
      setFamily: (family) => set({ family }),
      logout: () => set({ user: null, family: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        family: state.family,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Real-time sync store
interface RealtimeState {
  expenses: Expense[];
  bills: Bill[];
  todos: Todo[];
  shoppingItems: ShoppingItem[];
  events: Event[];
  users: User[];
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
  setBills: (bills: Bill[]) => void;
  addBill: (bill: Bill) => void;
  updateBill: (bill: Bill) => void;
  removeBill: (id: string) => void;
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (todo: Todo) => void;
  removeTodo: (id: string) => void;
  setShoppingItems: (items: ShoppingItem[]) => void;
  addShoppingItem: (item: ShoppingItem) => void;
  updateShoppingItem: (item: ShoppingItem) => void;
  removeShoppingItem: (id: string) => void;
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  removeEvent: (id: string) => void;
  setUsers: (users: User[]) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  expenses: [],
  bills: [],
  todos: [],
  shoppingItems: [],
  events: [],
  users: [],
  setExpenses: (expenses) => set({ expenses }),
  addExpense: (expense) => set((state) => ({ expenses: [expense, ...state.expenses] })),
  updateExpense: (expense) => set((state) => ({ expenses: state.expenses.map((e) => (e.id === expense.id ? expense : e)) })),
  removeExpense: (id) => set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),
  setBills: (bills) => set({ bills }),
  addBill: (bill) => set((state) => ({ bills: [bill, ...state.bills] })),
  updateBill: (bill) => set((state) => ({ bills: state.bills.map((b) => (b.id === bill.id ? bill : b)) })),
  removeBill: (id) => set((state) => ({ bills: state.bills.filter((b) => b.id !== id) })),
  setTodos: (todos) => set({ todos }),
  addTodo: (todo) => set((state) => ({ todos: [todo, ...state.todos] })),
  updateTodo: (todo) => set((state) => ({ todos: state.todos.map((t) => (t.id === todo.id ? todo : t)) })),
  removeTodo: (id) => set((state) => ({ todos: state.todos.filter((t) => t.id !== id) })),
  setShoppingItems: (items) => set({ shoppingItems: items }),
  addShoppingItem: (item) => set((state) => ({ shoppingItems: [item, ...state.shoppingItems] })),
  updateShoppingItem: (item) => set((state) => ({ shoppingItems: state.shoppingItems.map((i) => (i.id === item.id ? item : i)) })),
  removeShoppingItem: (id) => set((state) => ({ shoppingItems: state.shoppingItems.filter((i) => i.id !== id) })),
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [event, ...state.events] })),
  updateEvent: (event) => set((state) => ({ events: state.events.map((e) => (e.id === event.id ? event : e)) })),
  removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
  setUsers: (users) => set({ users }),
}));