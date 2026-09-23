import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api';

/**
 * A modal for an admin action. The body collects input; `onConfirm` runs the
 * action and the dialog stays open with the error if it fails.
 */
export function ActionDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  canConfirm = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  canConfirm?: boolean;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError('');
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialog-title">
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm && !busy) confirm();
        }}
      >
        <h2 id="dialog-title" style={{ margin: 0 }}>{title}</h2>
        {children}
        {error ? <div className="error-text" role="alert">{error}</div> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={`btn ${tone}`} disabled={!canConfirm || busy}>
            {busy ? <span className="spinner" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** The common case: an action that needs a written reason */
export function ReasonDialog(props: {
  open: boolean;
  title: string;
  intro?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  placeholder?: string;
  extra?: ReactNode;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (props.open) setReason('');
  }, [props.open]);
  return (
    <ActionDialog
      open={props.open}
      title={props.title}
      confirmLabel={props.confirmLabel}
      tone={props.tone}
      canConfirm={reason.trim().length >= 5}
      onConfirm={() => props.onConfirm(reason.trim())}
      onClose={props.onClose}
    >
      {props.intro ? <div className="muted">{props.intro}</div> : null}
      {props.extra}
      <label className="field">
        <span>Reason (recorded in the audit log)</span>
        <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={props.placeholder} required />
      </label>
    </ActionDialog>
  );
}
