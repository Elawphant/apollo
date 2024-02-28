import { reject, resolve } from "rsvp";




class AbortablePromise<T> extends Promise<T> {
  declare private abortController: AbortController;

  constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void, signal: AbortSignal) => void) {
    const abortController = new AbortController();
    super((resolve, reject) => {
      executor(resolve, reject, abortController.signal);
    });
    this.abortController = abortController;
  };

  public getSignal = (): AbortSignal => {
    return this.abortController.signal;
  };

  abort = (): void => {
    this.abortController.abort();
  };
};

export { AbortablePromise };