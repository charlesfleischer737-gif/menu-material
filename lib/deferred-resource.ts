// Share an in-flight module load, retain a successful result, and permit a
// deliberate retry after failure. Merely creating a resource never loads it.
export function deferredResource<T>(loader: () => Promise<T>) {
  let value: T | undefined;
  let pending: Promise<T> | undefined;
  return {
    peek: () => value,
    load() {
      return (pending ||= Promise.resolve()
        .then(loader)
        .then((result) => {
          value = result;
          return result;
        })
        .catch((error) => {
          pending = undefined;
          throw error;
        }));
    },
  };
}
