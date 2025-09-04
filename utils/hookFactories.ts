// Type-safe hook factories and utilities for better type inference

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Result,
  AsyncResult,
  State,
  SetState,
  Validator,
  AsyncValidator,
  Transform,
  AsyncTransform,
  Predicate,
  Option,
  Some,
  None
} from '../types/genericTypes';
import { 
  createSuccessResult, 
  createErrorResult,
  isSuccessResult
} from './typeGuards';

// State hook with validation
export function useValidatedState<T>(
  initialValue: T,
  validator?: Validator<T, boolean>
): [T, SetState<T>, { isValid: boolean; error: string | null }] {
  const [value, setValue] = useState<T>(initialValue);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validatedSetValue: SetState<T> = useCallback((newValue) => {
    const actualValue = typeof newValue === 'function'
      ? (newValue as (prev: T) => T)(value)
      : newValue;

    if (validator) {
      const valid = validator(actualValue);
      setIsValid(valid);
      setError(valid ? null : 'Validation failed');
    } else {
      setIsValid(true);
      setError(null);
    }

    setValue(newValue);
  }, [value, validator]);

  return [value, validatedSetValue, { isValid, error }];
}

// Async state hook with loading and error states
export function useAsyncState<T, E = Error>(
  initialValue: T
): {
  data: T;
  loading: boolean;
  error: E | null;
  setData: (value: T | ((prev: T) => T)) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: E | null) => void;
  reset: () => void;
} {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);

  const reset = useCallback(() => {
    setData(initialValue);
    setLoading(false);
    setError(null);
  }, [initialValue]);

  return {
    data,
    loading,
    error,
    setData,
    setLoading,
    setError,
    reset,
  };
}

// Result-based async operation hook
export function useAsyncOperation<T, E = Error>(): {
  execute: (operation: () => Promise<T>) => Promise<Result<T, E>>;
  data: T | null;
  loading: boolean;
  error: E | null;
  reset: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<Result<T, E>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await operation();
      setData(result);
      setLoading(false);
      return createSuccessResult(result);
    } catch (err) {
      const error = err as E;
      setError(error);
      setLoading(false);
      return createErrorResult(error);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return { execute, data, loading, error, reset };
}

// Debounced value hook with type safety
export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Previous value hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

// Stable callback hook with dependency array
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const ref = useRef<T>(callback);

  useEffect(() => {
    ref.current = callback;
  }, deps);

  return useCallback((...args: Parameters<T>) => {
    return ref.current(...args);
  }, []) as T;
}

// Memoized async computation hook
export function useAsyncMemo<T>(
  factory: () => Promise<T>,
  deps: React.DependencyList,
  initialValue?: T
): { value: T | undefined; loading: boolean; error: Error | null } {
  const [state, setState] = useState<{
    value: T | undefined;
    loading: boolean;
    error: Error | null;
  }>({
    value: initialValue,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState(prev => ({ ...prev, loading: true, error: null }));

    factory()
      .then((value) => {
        if (!cancelled) {
          setState({ value, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState(prev => ({ ...prev, loading: false, error }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}

// Type-safe local storage hook
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const serialize = serializer?.serialize ?? JSON.stringify;
  const deserialize = serializer?.deserialize ?? JSON.parse;

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setValue: (value: T | ((prev: T) => T)) => void = useCallback(
    (value) => {
      try {
        const valueToStore = typeof value === 'function'
          ? (value as (prev: T) => T)(storedValue)
          : value;

        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, serialize(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serialize, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  return [storedValue, setValue, removeValue];
}

// Array state manipulation hook
export function useArray<T>(
  initialArray: T[] = []
): {
  items: T[];
  add: (item: T) => void;
  remove: (index: number) => void;
  removeWhere: (predicate: Predicate<T>) => void;
  update: (index: number, item: T) => void;
  updateWhere: (predicate: Predicate<T>, updater: Transform<T, T>) => void;
  clear: () => void;
  reset: () => void;
  push: (item: T) => void;
  pop: () => T | undefined;
  shift: () => T | undefined;
  unshift: (item: T) => void;
} {
  const [items, setItems] = useState<T[]>(initialArray);

  const add = useCallback((item: T) => {
    setItems(prev => [...prev, item]);
  }, []);

  const remove = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeWhere = useCallback((predicate: Predicate<T>) => {
    setItems(prev => prev.filter(item => !predicate(item)));
  }, []);

  const update = useCallback((index: number, item: T) => {
    setItems(prev => prev.map((existingItem, i) => i === index ? item : existingItem));
  }, []);

  const updateWhere = useCallback((predicate: Predicate<T>, updater: Transform<T, T>) => {
    setItems(prev => prev.map(item => predicate(item) ? updater(item) : item));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const reset = useCallback(() => {
    setItems(initialArray);
  }, [initialArray]);

  const push = useCallback((item: T) => {
    setItems(prev => [...prev, item]);
  }, []);

  const pop = useCallback(() => {
    let poppedItem: T | undefined;
    setItems(prev => {
      if (prev.length > 0) {
        poppedItem = prev[prev.length - 1];
        return prev.slice(0, -1);
      }
      return prev;
    });
    return poppedItem;
  }, []);

  const shift = useCallback(() => {
    let shiftedItem: T | undefined;
    setItems(prev => {
      if (prev.length > 0) {
        shiftedItem = prev[0];
        return prev.slice(1);
      }
      return prev;
    });
    return shiftedItem;
  }, []);

  const unshift = useCallback((item: T) => {
    setItems(prev => [item, ...prev]);
  }, []);

  return {
    items,
    add,
    remove,
    removeWhere,
    update,
    updateWhere,
    clear,
    reset,
    push,
    pop,
    shift,
    unshift,
  };
}

// Toggle hook with multiple states
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue(prev => !prev);
  }, []);

  const setToggle = useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);

  return [value, toggle, setToggle];
}

// Counter hook with min/max bounds
export function useCounter(
  initialValue: number = 0,
  { min = -Infinity, max = Infinity }: { min?: number; max?: number } = {}
): {
  count: number;
  increment: () => void;
  decrement: () => void;
  set: (value: number) => void;
  reset: () => void;
} {
  const [count, setCount] = useState(() => 
    Math.max(min, Math.min(max, initialValue))
  );

  const increment = useCallback(() => {
    setCount(prev => Math.min(max, prev + 1));
  }, [max]);

  const decrement = useCallback(() => {
    setCount(prev => Math.max(min, prev - 1));
  }, [min]);

  const set = useCallback((value: number) => {
    setCount(Math.max(min, Math.min(max, value)));
  }, [min, max]);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return { count, increment, decrement, set, reset };
}

// Interval hook with automatic cleanup
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Timeout hook with automatic cleanup
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

// Option type hook for nullable values
export function useOption<T>(initialValue: T | null = null): {
  option: Option<T>;
  setValue: (value: T) => void;
  setNone: () => void;
  map: <U>(fn: (value: T) => U) => Option<U>;
  flatMap: <U>(fn: (value: T) => Option<U>) => Option<U>;
  filter: (predicate: Predicate<T>) => Option<T>;
  isSome: boolean;
  isNone: boolean;
} {
  const [option, setOption] = useState<Option<T>>(
    initialValue !== null 
      ? { _tag: 'Some', value: initialValue } as Some<T>
      : { _tag: 'None' } as None
  );

  const setValue = useCallback((value: T) => {
    setOption({ _tag: 'Some', value } as Some<T>);
  }, []);

  const setNone = useCallback(() => {
    setOption({ _tag: 'None' } as None);
  }, []);

  const map = useCallback(<U,>(fn: (value: T) => U): Option<U> => {
    return option._tag === 'Some' 
      ? { _tag: 'Some', value: fn(option.value) } as Some<U>
      : { _tag: 'None' } as None;
  }, [option]);

  const flatMap = useCallback(<U,>(fn: (value: T) => Option<U>): Option<U> => {
    return option._tag === 'Some' ? fn(option.value) : { _tag: 'None' } as None;
  }, [option]);

  const filter = useCallback((predicate: Predicate<T>): Option<T> => {
    return option._tag === 'Some' && predicate(option.value) 
      ? option 
      : { _tag: 'None' } as None;
  }, [option]);

  const isSome = useMemo(() => option._tag === 'Some', [option]);
  const isNone = useMemo(() => option._tag === 'None', [option]);

  return {
    option,
    setValue,
    setNone,
    map,
    flatMap,
    filter,
    isSome,
    isNone,
  };
}