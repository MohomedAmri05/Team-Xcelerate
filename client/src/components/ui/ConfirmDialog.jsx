import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/*
| Accessible confirmation dialog used instead of window.confirm for
| destructive or important actions. Usage:
|
|   const confirm = useConfirm();
|   if (await confirm({ title, message, confirmLabel, tone: 'danger' })) { ... }
|
| Optional `input` asks for a short text (e.g. a reason) and resolves with
| the entered value instead of true.
*/

const ConfirmContext = createContext(null);

let globalConfirm = null;

/**
 * Promise-based replacement for window.confirm that can be called from any
 * event handler: `if (await confirmDialog('Delete this record?')) …`
 */
export function confirmDialog(options) {
  const request =
    typeof options === 'string'
      ? {
          title: 'Please confirm',
          message: options,
          confirmLabel: 'Confirm',
          tone: /delete|permanent|revoke|deactivat|archive|log out|remove/i.test(options) ? 'danger' : 'default'
        }
      : options;

  if (globalConfirm) {
    return globalConfirm(request);
  }

  return Promise.resolve(window.confirm(request.message || request.title));
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [text, setText] = useState('');
  const confirmButton = useRef(null);
  const inputRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setText(options.input?.defaultValue || '');
        setRequest({ ...options, resolve });
      }),
    []
  );

  useEffect(() => {
    globalConfirm = confirm;

    return () => {
      globalConfirm = null;
    };
  }, [confirm]);

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  useEffect(() => {
    if (!request) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === 'Escape') {
        close(false);
      }
    };

    window.addEventListener('keydown', onKey);
    setTimeout(() => (request.input ? inputRef.current : confirmButton.current)?.focus(), 30);

    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const minLength = request?.input?.minLength || 0;
  const inputInvalid = Boolean(request?.input) && text.trim().length < minLength;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {request && (
          <motion.div
            className="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                close(false);
              }
            }}
          >
            <motion.div
              className={`confirm-dialog confirm-dialog--${request.tone || 'default'}`}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-message"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              {request.tone === 'danger' && <TriangleAlert className="confirm-dialog__icon" aria-hidden="true" />}
              <h2 id="confirm-title">{request.title || 'Are you sure?'}</h2>
              {request.message && <p id="confirm-message">{request.message}</p>}

              {request.input && (
                <label className="confirm-dialog__input">
                  {request.input.label}
                  <textarea
                    ref={inputRef}
                    value={text}
                    maxLength={request.input.maxLength || 1000}
                    placeholder={request.input.placeholder || ''}
                    onChange={(event) => setText(event.target.value)}
                  />
                  {minLength > 0 && (
                    <small>
                      {text.trim().length}/{minLength} characters minimum
                    </small>
                  )}
                </label>
              )}

              <div className="confirm-dialog__actions">
                <button type="button" className="button ghost" onClick={() => close(false)}>
                  {request.cancelLabel || 'Cancel'}
                </button>
                <button
                  type="button"
                  ref={confirmButton}
                  className={`button ${request.tone === 'danger' ? 'button--danger' : ''}`}
                  disabled={inputInvalid}
                  onClick={() => close(request.input ? text.trim() : true)}
                >
                  {request.confirmLabel || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);

  // Fallback keeps components usable outside the provider (e.g. tests).
  return (
    confirm ||
    ((options) =>
      Promise.resolve(
        options.input ? window.prompt(options.message || options.title) : window.confirm(options.message || options.title)
      ))
  );
}
