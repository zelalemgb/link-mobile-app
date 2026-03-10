import React from "react";
import { getItem, setItem } from "../lib/storage";

export const useStoredState = (key, initialValue) => {
  const [value, setValue] = React.useState(initialValue);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    getItem(key, initialValue)
      .then((stored) => {
        if (active) setValue(stored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, initialValue]);

  const persist = async (nextValue) => {
    setValue(nextValue);
    await setItem(key, nextValue);
  };

  return { value, setValue: persist, loading };
};
