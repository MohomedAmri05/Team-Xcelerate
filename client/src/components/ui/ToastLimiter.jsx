import { useEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';

/*
| Keeps at most MAX pop-up messages on screen. Older ones are dismissed
| when new ones arrive, so a burst of actions never covers the page.
*/
const MAX = 3;

export default function ToastLimiter() {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((item) => item.visible)
      .slice(MAX)
      .forEach((item) => toast.dismiss(item.id));
  }, [toasts]);

  return null;
}
