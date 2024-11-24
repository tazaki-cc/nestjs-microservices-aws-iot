import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { iot, mqtt5 } from 'aws-crt';
import { AwsIotOptions } from './aws-iot.interface';
import { Logger } from '@nestjs/common';
import { v4 as uuidV4 } from 'uuid';

export class AwsIotClient extends ClientProxy {
  protected logger = new Logger(AwsIotClient.name);

  protected readonly connectionEndpoint: string;
  protected readonly certPath: string;
  protected readonly keyPath: string;

  protected client!: mqtt5.Mqtt5Client;

  constructor(options: AwsIotOptions) {
    super();

    this.connectionEndpoint = options.hostname;
    this.certPath = options.certPath;
    this.keyPath = options.keyPath;

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  async connect(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    this.createMqttConnection();
  }
  async close() {
    if (this.client) {
      this.client.stop();
    }
  }

  async dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);
    const message = JSON.stringify(packet.data);

    return new Promise<void>(() =>
      this.client.publish({
        topicName: pattern,
        qos: mqtt5.QoS.AtLeastOnce,
        payload: Buffer.from(message, 'utf-8'),
      }),
    );
  }

  publish(
    packet: ReadPacket<any>,
    callback: (packet: WritePacket<any>) => void,
  ): any {
    const topic = this.normalizePattern(packet.pattern);
    const message = JSON.stringify(packet.data);

    if (!this.client) {
      this.logger.error('Client is not connected.');
      return callback({ err: 'Client is not connected.' });
    }

    try {
      this.client.publish({
        topicName: topic,
        qos: mqtt5.QoS.AtLeastOnce,
        payload: Buffer.from(message, 'utf-8'),
      });
      callback({ response: 'Message published successfully' });
    } catch (e) {
      this.logger.error('Failed to publish message', e);
      callback({ err: 'Failed to publish message' });
    }
  }

  private createMqttConnection() {
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
}
