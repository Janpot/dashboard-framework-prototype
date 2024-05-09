import * as React from "react";

const keys = new WeakMap();
let nextKey = 1;

export function getObjectKey(obj: Function | Object) {
  let key = keys.get(obj);
  if (!key) {
    key = nextKey++;
    keys.set(obj, key);
  }
  return key;
}

/**
 * Consume a context but throw when used outside of a provider.
 */
export function useNonNullableContext<T>(
  context: React.Context<T>,
  name?: string,
): NonNullable<T> {
  const maybeContext = React.useContext(context);
  if (maybeContext === null || maybeContext === undefined) {
    throw new Error(`context "${name}" was used without a Provider`);
  }
  return maybeContext;
}
