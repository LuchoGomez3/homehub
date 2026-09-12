'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  ({ className, open, onOpenChange, title, description, children, ...props }, ref) => {
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      };

      if (open) {
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <div
            ref={contentRef}
            className={cn(
              'relative w-full max-w-lg transform overflow-hidden rounded-lg bg-background p-6 text-left align-middle shadow-xl transition-all',
              className
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-describedby={description ? 'modal-description' : undefined}
          >
            {(title || description) && (
              <div className="mb-4">
                {title && (
                  <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="modal-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

export { Modal };