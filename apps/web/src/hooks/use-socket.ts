'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/auth';
import { api } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const {
    addExpense, updateExpense, removeExpense,
    addBill, updateBill, removeBill,
    addTodo, updateTodo, removeTodo,
    addShoppingItem, updateShoppingItem, removeShoppingItem,
    addEvent, updateEvent, removeEvent,
  } = useRealtimeStore();

  const handleExpenseCreated = useCallback((expense: any) => addExpense(expense), [addExpense]);
  const handleExpenseUpdated = useCallback((expense: any) => updateExpense(expense), [updateExpense]);
  const handleExpenseDeleted = useCallback((data: { id: string }) => removeExpense(data.id), [removeExpense]);

  const handleBillCreated = useCallback((bill: any) => addBill(bill), [addBill]);
  const handleBillUpdated = useCallback((bill: any) => updateBill(bill), [updateBill]);
  const handleBillDeleted = useCallback((data: { id: string }) => removeBill(data.id), [removeBill]);
  const handleBillPaid = useCallback((data: { id: string }) => {
    // Refresh bills from server when one is paid
  }, []);

  const handleTodoCreated = useCallback((todo: any) => addTodo(todo), [addTodo]);
  const handleTodoUpdated = useCallback((todo: any) => updateTodo(todo), [updateTodo]);
  const handleTodoDeleted = useCallback((data: { id: string }) => removeTodo(data.id), [removeTodo]);
  const handleTodoAssigned = useCallback((data: { todoId: string; assigneeId: string | null }) => {
    // Could update assignee in real-time
  }, []);

  const handleShoppingCreated = useCallback((item: any) => addShoppingItem(item), [addShoppingItem]);
  const handleShoppingUpdated = useCallback((item: any) => updateShoppingItem(item), [updateShoppingItem]);
  const handleShoppingDeleted = useCallback((data: { id: string }) => removeShoppingItem(data.id), [removeShoppingItem]);
  const handleShoppingToggle = useCallback((data: { id: string; isDone: boolean }) => {
    // The updateShoppingItem will handle this via the updated event
  }, []);

  const handleEventCreated = useCallback((event: any) => addEvent(event), [addEvent]);
  const handleEventUpdated = useCallback((event: any) => updateEvent(event), [updateEvent]);
  const handleEventDeleted = useCallback((data: { id: string }) => removeEvent(data.id), [removeEvent]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Expense events
    socket.on('expense:created', handleExpenseCreated);
    socket.on('expense:updated', handleExpenseUpdated);
    socket.on('expense:deleted', handleExpenseDeleted);

    // Bill events
    socket.on('bill:created', handleBillCreated);
    socket.on('bill:updated', handleBillUpdated);
    socket.on('bill:deleted', handleBillDeleted);
    socket.on('bill:paid', handleBillPaid);

    // Todo events
    socket.on('todo:created', handleTodoCreated);
    socket.on('todo:updated', handleTodoUpdated);
    socket.on('todo:deleted', handleTodoDeleted);
    socket.on('todo:assigned', handleTodoAssigned);

    // Shopping events
    socket.on('shopping:item:created', handleShoppingCreated);
    socket.on('shopping:item:updated', handleShoppingUpdated);
    socket.on('shopping:item:deleted', handleShoppingDeleted);
    socket.on('shopping:item:toggle', handleShoppingToggle);

    // Event events
    socket.on('event:created', handleEventCreated);
    socket.on('event:updated', handleEventUpdated);
    socket.on('event:deleted', handleEventDeleted);

    // Cleanup
    return () => {
      socket.off('expense:created', handleExpenseCreated);
      socket.off('expense:updated', handleExpenseUpdated);
      socket.off('expense:deleted', handleExpenseDeleted);
      socket.off('bill:created', handleBillCreated);
      socket.off('bill:updated', handleBillUpdated);
      socket.off('bill:deleted', handleBillDeleted);
      socket.off('bill:paid', handleBillPaid);
      socket.off('todo:created', handleTodoCreated);
      socket.off('todo:updated', handleTodoUpdated);
      socket.off('todo:deleted', handleTodoDeleted);
      socket.off('todo:assigned', handleTodoAssigned);
      socket.off('shopping:item:created', handleShoppingCreated);
      socket.off('shopping:item:updated', handleShoppingUpdated);
      socket.off('shopping:item:deleted', handleShoppingDeleted);
      socket.off('shopping:item:toggle', handleShoppingToggle);
      socket.off('event:created', handleEventCreated);
      socket.off('event:updated', handleEventUpdated);
      socket.off('event:deleted', handleEventDeleted);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    isAuthenticated,
    accessToken,
    addExpense, updateExpense, removeExpense,
    addBill, updateBill, removeBill,
    addTodo, updateTodo, removeTodo,
    addShoppingItem, updateShoppingItem, removeShoppingItem,
    addEvent, updateEvent, removeEvent,
  ]);

  return socketRef.current;
}