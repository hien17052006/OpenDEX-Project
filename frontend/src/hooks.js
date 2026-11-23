import { useEffect, useState } from 'react';

export function usePolling(load, deps, interval = 3000) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    const run = () =>
      load()
        .then((result) => active && setData(result))
        .catch(() => {});
    run();
    const id = setInterval(run, interval);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, deps);

  return data;
}