import { AwsIotExtrasOptions } from './aws-iot.interface';

export function Sub(
  topic: string,
  extras: AwsIotExtrasOptions,
): MethodDecorator {
  return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>) => {
    Reflect.defineMetadata(
      PATTERN_METADATA,
      ([] as Array<string>).concat(topic),
      descriptor.value,
    );
    Reflect.defineMetadata(PATTERN_HANDLER_METADATA, 1, descriptor.value);
    Reflect.defineMetadata(
      PATTERN_EXTRAS_METADATA,
      {
        ...Reflect.getMetadata(PATTERN_EXTRAS_METADATA, descriptor.value),
        ...extras,
      },
      descriptor.value,
    );
  };
}

export const PATTERN_EXTRAS_METADATA = 'microservices:pattern_extras';
export const PATTERN_METADATA = 'microservices:pattern';
export const PATTERN_HANDLER_METADATA = 'microservices:handler_type';
