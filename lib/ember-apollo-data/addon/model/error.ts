import { tracked } from 'tracked-built-ins';
import type { AttrField, RelationshipField } from './field-mappings';

type ErrorHandlerType = {
  add: (attr: string, message: string) => void;
  clear: () => void;
  errorsFor: (attr: string) => string[] | undefined;
  has: (attr: string) => boolean;
  remove: (attr: string) => void;
  areErrors: boolean;
};

class ErrorHandler implements ErrorHandlerType {
  private ERRORS: Map<string, string[]> = tracked(Map);

  private initAttr = (attr: string) => {
    if (!this.ERRORS.has(attr)) {
      this.ERRORS.set(attr, tracked([]));
    }
  };

  public get errors() {
    return Object.fromEntries(this.ERRORS);
  }

  public get areErrors() {
    return Array.from(this.ERRORS.values()).some(
      (val) => val && val.length > 0,
    );
  }

  public add = (attr: string, message: string) => {
    this.initAttr(attr);
    this.ERRORS.get(attr)!.push(message);
  };

  public clear = () => {
    this.ERRORS.clear();
  };

  public errorsFor = (attr: string) => {
    return this.ERRORS.get(attr);
  };

  public has = (attr: string) => {
    return (
      (this.ERRORS.get(attr) && this.ERRORS.get(attr)!.length > 0) || false
    );
  };

  public remove = (attr: string) => {
    if (this.errorsFor(attr)) {
      this.errorsFor(attr)!.length = 0;
    }
  };

  constructor(fields?: { [key: string]: AttrField | RelationshipField }) {
    if (fields) {
      Object.values(fields).forEach((field) => {
        this.initAttr(field.propertyName as string);
      });
      this.initAttr('messages');
    }
  }
}

export function configureErrorHandler(meta: {
  [key: string]: AttrField | RelationshipField;
}): ErrorHandlerType & { errors: Record<string, string[]> } {
  const ErrorHanlerInstance = new ErrorHandler(meta);
  const proxy = new Proxy(ErrorHanlerInstance.errors, {
    get(target, prop, receiver) {
      if (
        ['add', 'remove', 'clear', 'errorsFor', 'has', 'areErrors'].includes(
          prop as string,
        )
      ) {
        return ErrorHanlerInstance[prop as keyof ErrorHandler];
      }
    },
  });
  return proxy as unknown as ErrorHandlerType & {
    errors: Record<string, string[]>;
  };
}
