import { PublishPacket } from 'aws-crt/dist/common/mqtt5_packet';

export interface AwsIotOptions {
  hostname: string;
  certPath: string;
  keyPath: string;
}

export type AwsIotPayload<T = Record<string, unknown>> = T;

export type AwsIotContext<T = Record<string, unknown>> = {
  payload: AwsIotPayload<T>;
} & Omit<PublishPacket, 'payload'>;
