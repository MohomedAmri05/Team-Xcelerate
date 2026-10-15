import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * GET helper with loading/error state.
 * `reload()` re-runs the request (used after create/update/delete).
 */
export function useApi(url, params) {
  const [state, setState] = useState({
    data: null,
    meta: null,
    loading: true,
    error: null
  });

  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    if (!url) {
      setState({ data: null, meta: null, loading: false, error: null });
      return undefined;
    }

    const controller = new AbortController();

    setState((current) => ({
      ...current,
      loading: true,
      error: null
    }));

    api
      .get(url, {
        params: JSON.parse(paramsKey),
        signal: controller.signal
      })
      .then((response) => {
        setState({
          data: response.data.data,
          meta: response.data.meta,
          loading: false,
          error: null
        });
      })
      .catch((error) => {
        if (error.code !== 'ERR_CANCELED') {
          setState({
            data: null,
            meta: null,
            loading: false,
            error: error.response?.data?.message || error.message
          });
        }
      });

    return () => controller.abort();
  }, [url, paramsKey, version]);

  return {
    ...state,
    reload
  };
}
