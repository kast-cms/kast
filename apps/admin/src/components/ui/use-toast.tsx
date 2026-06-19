'use client';

import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastContextProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const remove = useCallback((id: number): void => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions): void => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, ...options }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map((entry) => (
          <Toast
            key={entry.id}
            variant={entry.variant ?? 'default'}
            duration={entry.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) remove(entry.id);
            }}
          >
            <ToastTitle>{entry.title}</ToastTitle>
            {entry.description !== undefined && entry.description !== '' && (
              <ToastDescription>{entry.description}</ToastDescription>
            )}
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastContextProvider>');
  return ctx;
}
