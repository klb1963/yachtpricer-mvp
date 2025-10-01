import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

type Constructor<T = object> = new (...args: unknown[]) => T;

export function AtLeastOne(
  keys: readonly string[],
  validationOptions?: ValidationOptions,
) {
  return function (target: object, propertyName: string) {
    const ctor = (target as { constructor: Constructor }).constructor;

    registerDecorator({
      name: 'AtLeastOne',
      target: ctor,
      propertyName,
      options: validationOptions,
      constraints: [keys],
      validator: {
        validate(_: unknown, args: ValidationArguments): boolean {
          const list = (args.constraints?.[0] as string[]) ?? [];
          const obj = args.object as Record<string, unknown>;

          return list.some((key) => {
            const v = obj[key];
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'string') return v.trim().length > 0;
            return v !== undefined && v !== null;
          });
        },
        defaultMessage(args: ValidationArguments): string {
          const list = ((args.constraints?.[0] as string[]) ?? []).join(' | ');
          return `At least one of [${list}] must be provided`;
        },
      },
    });
  };
}
