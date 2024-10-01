export interface AwsIotOptions {
  hostname: string;
  certPath: string;
  keyPath: string;
}

export type AwsIotPayload = any;

export interface AwsIotContext {
  type: string;
  topicName: string;
  payload: AwsIotPayload;
  qos: number;
  retain: boolean;
  userProperties: any;
}