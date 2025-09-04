// Advanced generic types and utilities for better type inference

// Utility types for advanced type manipulation
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type DeepNullable<T> = {
  [P in keyof T]: T[P] extends object ? DeepNullable<T[P]> : T[P] | null;
};

export type DeepNonNullable<T> = {
  [P in keyof T]: T[P] extends object ? DeepNonNullable<T[P]> : NonNullable<T[P]>;
};

// Key manipulation types
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

// Array and tuple utilities
export type Head<T extends readonly any[]> = T extends readonly [infer H, ...any[]] ? H : never;

export type Tail<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : never;

export type Last<T extends readonly any[]> = T extends readonly [...any[], infer L] ? L : never;

export type Length<T extends readonly any[]> = T['length'];

export type IsEmpty<T extends readonly any[]> = Length<T> extends 0 ? true : false;

export type Reverse<T extends readonly any[]> = T extends readonly [...infer Rest, infer Last]
  ? [Last, ...Reverse<Rest>]
  : [];

// String manipulation types
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

export type Join<T extends readonly string[], D extends string> = T extends readonly [
  infer First,
  ...infer Rest
]
  ? First extends string
    ? Rest extends readonly string[]
      ? Rest['length'] extends 0
        ? First
        : `${First}${D}${Join<Rest, D>}`
      : never
    : never
  : '';

export type Capitalize<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S;

export type Uncapitalize<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : S;

export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<CamelCase<`${P2}${P3}`>>}`
  : S;

export type KebabCase<S extends string> = S extends `${infer C}${infer T}`
  ? C extends Uppercase<C>
    ? `-${Lowercase<C>}${KebabCase<T>}`
    : `${C}${KebabCase<T>}`
  : S;

// Function type utilities
export type Parameters<T> = T extends (...args: infer P) => any ? P : never;
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
export type ConstructorParameters<T> = T extends abstract new (...args: infer P) => any ? P : never;
export type InstanceType<T> = T extends abstract new (...args: any) => infer R ? R : any;

// Promise utilities
export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

export type PromiseType<T> = T extends Promise<infer U> ? U : T;

export type AllSettled<T extends readonly any[]> = {
  [K in keyof T]: T[K] extends Promise<infer U>
    ? { status: 'fulfilled'; value: U } | { status: 'rejected'; reason: any }
    : { status: 'fulfilled'; value: T[K] };
};

// Conditional types for better type inference
export type If<C extends boolean, T, F> = C extends true ? T : F;

export type Not<C extends boolean> = C extends true ? false : true;

export type And<A extends boolean, B extends boolean> = A extends true
  ? B extends true
    ? true
    : false
  : false;

export type Or<A extends boolean, B extends boolean> = A extends true
  ? true
  : B extends true
  ? true
  : false;

// Object manipulation utilities
export type Merge<A, B> = Prettify<Omit<A, keyof B> & B>;

export type MergeDeep<A, B> = Prettify<{
  [K in keyof A | keyof B]: K extends keyof B
    ? K extends keyof A
      ? A[K] extends object
        ? B[K] extends object
          ? MergeDeep<A[K], B[K]>
          : B[K]
        : B[K]
      : B[K]
    : K extends keyof A
    ? A[K]
    : never;
}>;

export type Override<T, U> = Prettify<Omit<T, keyof U> & U>;

export type PartialBy<T, K extends keyof T> = Prettify<Omit<T, K> & Partial<Pick<T, K>>>;

export type RequiredBy<T, K extends keyof T> = Prettify<T & Required<Pick<T, K>>>;

// Branded types for better type safety
export type Brand<T, B> = T & { readonly __brand: B };

export type Nominal<T, N extends string> = T & { readonly __nominal: N };

export type Opaque<T, N extends string> = T & { readonly [K in N]: never };

// Event and handler utilities
export type EventOf<T> = T extends React.ChangeEvent<infer U>
  ? React.ChangeEvent<U>
  : T extends React.MouseEvent<infer U>
  ? React.MouseEvent<U>
  : T extends React.KeyboardEvent<infer U>
  ? React.KeyboardEvent<U>
  : T extends React.FocusEvent<infer U>
  ? React.FocusEvent<U>
  : never;

export type HandlerFor<T> = T extends React.ChangeEvent<any>
  ? React.ChangeEventHandler
  : T extends React.MouseEvent<any>
  ? React.MouseEventHandler
  : T extends React.KeyboardEvent<any>
  ? React.KeyboardEventHandler
  : T extends React.FocusEvent<any>
  ? React.FocusEventHandler
  : never;

// Component type utilities
export type ComponentProps<T> = T extends React.ComponentType<infer P>
  ? P
  : T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : never;

export type ElementType<T extends React.ElementType> = React.ComponentProps<T>;

export type PropsOf<T extends keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>> = 
  JSX.LibraryManagedAttributes<T, React.ComponentPropsWithoutRef<T>>;

// Validation and transformation generics
export type Validator<T, R = boolean> = (value: T) => R;

export type AsyncValidator<T, R = boolean> = (value: T) => Promise<R>;

export type Transform<T, U> = (value: T) => U;

export type AsyncTransform<T, U> = (value: T) => Promise<U>;

export type Predicate<T> = (value: T) => boolean;

export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

// Result and Either types for functional programming
export type Success<T> = { readonly success: true; readonly data: T };
export type Failure<E> = { readonly success: false; readonly error: E };
export type Result<T, E = Error> = Success<T> | Failure<E>;

export type Left<L> = { readonly _tag: 'Left'; readonly left: L };
export type Right<R> = { readonly _tag: 'Right'; readonly right: R };
export type Either<L, R> = Left<L> | Right<R>;

export type Option<T> = Some<T> | None;
export type Some<T> = { readonly _tag: 'Some'; readonly value: T };
export type None = { readonly _tag: 'None' };

// Collection utilities
export type NonEmptyArray<T> = [T, ...T[]];

export type ReadonlyNonEmptyArray<T> = readonly [T, ...T[]];

export type Dictionary<T> = Record<string, T>;

export type ReadonlyDictionary<T> = Readonly<Record<string, T>>;

export type SafeDictionary<T> = Record<string, T | undefined>;

export type Entries<T> = Array<{
  [K in keyof T]: [K, T[K]];
}[keyof T]>;

export type FromEntries<T extends ReadonlyArray<readonly [PropertyKey, any]>> = {
  [K in T[number] as K[0]]: K[1];
};

// State management utilities
export type State<T> = T;
export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
export type StateUpdater<T> = (prevState: T) => T;

export type Reducer<S, A> = (state: S, action: A) => S;

export type ReducerAction<R> = R extends Reducer<any, infer A> ? A : never;

export type ReducerState<R> = R extends Reducer<infer S, any> ? S : never;

// API and networking types
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type HTTPStatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 422 | 500 | 502 | 503;

export type APIResponse<T> = {
  readonly data: T;
  readonly status: HTTPStatusCode;
  readonly message?: string;
};

export type APIError = {
  readonly error: string;
  readonly status: HTTPStatusCode;
  readonly details?: unknown;
};

// Utility functions with strong typing
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> => 
  result.success === true;

export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> => 
  result.success === false;

export const isLeft = <L, R>(either: Either<L, R>): either is Left<L> => 
  either._tag === 'Left';

export const isRight = <L, R>(either: Either<L, R>): either is Right<R> => 
  either._tag === 'Right';

export const isSome = <T>(option: Option<T>): option is Some<T> => 
  option._tag === 'Some';

export const isNone = <T>(option: Option<T>): option is None => 
  option._tag === 'None';

// Type-safe object operations
export const keys = <T extends Record<string, any>>(obj: T): Array<keyof T> => 
  Object.keys(obj) as Array<keyof T>;

export const values = <T extends Record<string, any>>(obj: T): Array<T[keyof T]> => 
  Object.values(obj);

export const entries = <T extends Record<string, any>>(obj: T): Entries<T> => 
  Object.entries(obj) as Entries<T>;

// Array utilities with type safety
export const head = <T>(array: readonly T[]): T | undefined => array[0];

export const tail = <T>(array: readonly T[]): T[] => array.slice(1);

export const last = <T>(array: readonly T[]): T | undefined => 
  array[array.length - 1];

export const init = <T>(array: readonly T[]): T[] => 
  array.slice(0, -1);

export const isEmpty = <T>(array: readonly T[]): boolean => array.length === 0;

export const isNonEmpty = <T>(array: readonly T[]): array is NonEmptyArray<T> => 
  array.length > 0;

// Functional programming utilities
export const identity = <T>(value: T): T => value;

export const constant = <T>(value: T): () => T => () => value;

export const noop = (): void => {};

export const pipe = <T, U>(value: T, fn: (value: T) => U): U => fn(value);

export const compose = <T, U, V>(
  fn1: (value: U) => V,
  fn2: (value: T) => U
): ((value: T) => V) => (value) => fn1(fn2(value));

// Type assertion utilities
export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${value}`);
};

export const exhaustiveCheck = (_value: never): never => {
  throw new Error('Exhaustive check failed');
};

// Generic factory functions
export const createFactory = <T>() => ({
  create: (props: T): T => props,
  partial: (props: Partial<T>): Partial<T> => props,
  required: (props: Required<T>): Required<T> => props,
});

export const createValidator = <T>(
  predicate: Predicate<T>,
  errorMessage: string = 'Validation failed'
): Validator<T, Result<T, Error>> => {
  return (value: T) => 
    predicate(value) 
      ? { success: true as const, data: value }
      : { success: false as const, error: new Error(errorMessage) };
};

export const createAsyncValidator = <T>(
  predicate: AsyncPredicate<T>,
  errorMessage: string = 'Validation failed'
): AsyncValidator<T, Result<T, Error>> => {
  return async (value: T) => 
    (await predicate(value))
      ? { success: true as const, data: value }
      : { success: false as const, error: new Error(errorMessage) };
};