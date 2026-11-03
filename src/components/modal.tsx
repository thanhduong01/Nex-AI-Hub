'use client';
import { useRef } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  description,
  trigger,
  children,
  primary = false,
}: {
  title: string;
  description?: string;
  trigger: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className={`btn ${primary ? 'primary' : ''}`}
        onClick={() => ref.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog ref={ref} aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng"
            onClick={() => ref.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
    </>
  );
}
