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
        keepAliveIntervalSeconds: 1200,
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
    } catch (e) {
      this.logger.error('Failed to connect to AWS IoT', e);
    }
  }
}
