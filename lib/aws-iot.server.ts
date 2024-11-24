import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
} from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import {
  AwsIotContext,
  AwsIotExtrasOptions,
  AwsIotOptions,
  AwsIotPayload,
} from './aws-iot.interface';
import { mqtt5, iot } from 'aws-crt';
import { v4 as uuidV4 } from 'uuid';

export class AwsIotServer extends Server implements CustomTransportStrategy {
  protected logger = new Logger(AwsIotServer.name);

  protected readonly connectionEndpoint: string;
  protected readonly certPath: string;
  protected readonly keyPath: string;

  protected client!: mqtt5.Mqtt5Client;

  constructor(protected readonly options: AwsIotOptions) {
    super();

    this.connectionEndpoint = options.hostname;
    this.certPath = options.certPath;
    this.keyPath = options.keyPath;

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  async listen(callback: () => void) {
    try {
      this.createMqttConnection();
      this.messageHandlers.forEach((handler, key) => {
        const extras = handler.extras as unknown as AwsIotExtrasOptions;
        if (!extras?.disabled) {
          this.client
            .subscribe({
              subscriptions: [{ topicFilter: key, qos: mqtt5.QoS.AtLeastOnce }],
            })
            .then(() =>
              this.logger.log(`Subscribed to topic "${key}" successfully`),
            )
            .catch((err) =>
              this.logger.error(`Failed to subscribe to topic "${key}"`, err),
            );
        } else {
          this.logger.log(`Disabled to topic "${key}"`);
        }
      });

      callback();
    } catch (err) {
      this.logger.error('Failed to connect to AWS IoT', err);
    }

    this.client.on('messageReceived', (event) => {
      const packet = event.message;
      const topic = packet.topicName;
      let payload: AwsIotPayload<any> | undefined = undefined;

      if (packet.payload) {
        try {
          const data = Buffer.from(packet.payload as ArrayBuffer).toString(
            'utf-8',
          );
          payload = JSON.parse(data);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {}
      }
      this.handleMessage(topic, {
        ...packet,
        payload,
      });
    });

    this.client.on('error', (error) => {
      this.logger.error('AWS IoT client error', error);
    });
  }

  close() {
    try {
      if (this.client) {
        this.client.stop();
      }
    } catch (e) {
      this.logger.error('Failed to close AWS IoT client', e);
    }
  }

  public createMqttConnection() {
    if (this.client) {
      return;
    }

    try {
      const builder =
        iot.AwsIotMqtt5ClientConfigBuilder.newDirectMqttBuilderWithMtlsFromPath(
          this.connectionEndpoint,
          this.certPath,
          this.keyPath,
        );

      builder.withConnectProperties({
        keepAliveIntervalSeconds: 60,
        clientId: uuidV4(),
      });
      builder.withSessionBehavior(mqtt5.ClientSessionBehavior.RejoinAlways);
      builder.withRetryJitterMode(mqtt5.RetryJitterType.Full);
      builder.withMinReconnectDelayMs(1000); // 1초
      builder.withMaxReconnectDelayMs(120000); // 2분
      builder.withMinConnectedTimeToResetReconnectDelayMs(30000); // 30초

      const client = new mqtt5.Mqtt5Client(builder.build());
      client.start();
      this.logger.log('AWS IoT client connect');
      this.client = client;

      this.client.on(
        'attemptingConnect',
        (eventData: mqtt5.AttemptingConnectEvent) => {
          console.log('[MQTT] 연결 시도 중...');
        },
      );

      this.client.on(
        'connectionSuccess',
        (eventData: mqtt5.ConnectionSuccessEvent) => {
          console.log('[MQTT] 연결 성공');
        },
      );

      this.client.on(
        'connectionFailure',
        (eventData: mqtt5.ConnectionFailureEvent) => {
          console.log(`[MQTT] 연결 실패: ${eventData.error.toString()}`);
          if (eventData.connack) {
            console.log(`[MQTT] 연결 실패: ${eventData.connack}`);
          }
        },
      );

      this.client.on('disconnection', (eventData: mqtt5.DisconnectionEvent) => {
        console.log(`[MQTT] 연결 끊김: ${eventData.error.toString()}`);
      });
    } catch (e) {
      this.logger.error('Failed to connect to AWS IoT', e);
    }
  }

  private handleMessage(topic: string, payload: AwsIotContext) {
    this.messageHandlers.forEach((handler, key) => {
      this.messageHandler(key, topic, payload, handler);
    });
  }

  matchMqttPattern(pattern: string, topic: string) {
    const patternSegments = pattern.split('/');
    const topicSegments = topic.split('/');
    const patternSegmentsLength = patternSegments.length;
    const topicSegmentsLength = topicSegments.length;
    const lastIndex = patternSegmentsLength - 1;
    for (let i = 0; i < patternSegmentsLength; i++) {
      const currentPattern = patternSegments[i];
      const patternChar = currentPattern[0];
      const currentTopic = topicSegments[i];
      if (!currentTopic && !currentPattern) {
        continue;
      }
      if (!currentTopic && currentPattern !== '#') {
        return false;
      }
      if (patternChar === '#') {
        return i === lastIndex;
      }
      if (patternChar !== '+' && currentPattern !== currentTopic) {
        return false;
      }
    }
    return patternSegmentsLength === topicSegmentsLength;
  }

  private async messageHandler(
    key: string,
    topic: string,
    payload: AwsIotContext,
    handler: MessageHandler,
  ) {
    if (this.matchMqttPattern(key, topic)) {
      await handler(payload.payload, payload);
    }
  }
}
