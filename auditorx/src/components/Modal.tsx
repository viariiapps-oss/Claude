"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black leading-tight tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-paper"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
