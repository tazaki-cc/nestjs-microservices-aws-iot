# @tazaki/nestjs-microservices-aws-iot

## Overview

This package provides a seamless wrapper for the `AWS IoT SDK` within Nest.js microservices, enabling easy integration with AWS IoT Core. With this, you can effortlessly publish and subscribe to MQTT topics using AWS IoT services in your Nest.js application.

## Features

> **Note:** This package is still under development. The initial release includes the following features:

- **Publish** messages to an MQTT topics
- **Subscribe** to an MQTT topics
- Simplified configuration through Nest.js dependency injection

## Installation

```bash
# for npm
npm install @tazaki/nestjs-microservices-aws-iot

# for yarn
yarn add @tazaki/nestjs-microservices-aws-iot

# for pnpm
pnpm add @tazaki/nestjs-microservices-aws-iot
```

## Usage

### Subscribing to an MQTT Topic

To subscribe to a topic, set up the microservice in your `main.ts` as follows:

```typescript
import { AwsIotServer } from '@tazaki/nestjs-microservices-aws-iot';
import type { AwsIotContext } from '@tazaki/nestjs-microservices-aws-iot';

const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AppModule,
  {
    strategy: new AwsIotServer({
      hostname: '[your-iot].iot.[region].amazonaws.com',
      certPath: './keys/cert.pem',
      keyPath: './keys/private.key',
    }),
  },
);
```

Then, in your controller, listen to incoming messages from the topic:

```typescript
...
  @MessagePattern('awesomeTopic')
  topic(@Payload() data: any, @Ctx() context: AwsIotContext) {
    console.log(data, context);
  }

  @MessagePattern('wildcardTopic/+/hello')
  wildcard(@Payload() data: any, @Ctx() context: AwsIotContext) {
    console.log(data, context);
  }
...
```

### Publishing a Message to an MQTT Topic

```typescript
import { AwsIotClient } from '@tazaki/nestjs-microservices-aws-iot';

export class AppService {
  private client: AwsIotClient;

  constructor() {
    // Initialize the client
    this.client = new AwsIotClient({
      hostname: '[your-iot].iot.[region].amazonaws.com',
      certPath: './keys/cert.pem',
      keyPath: './keys/private.key',
    });
  }

  public publishMessage() {
    // Publish a message to the topic
    this.client
      .send('topic', {
        message: 'Hello, World!',
      })
      .subscribe();
  }
}
```

## Usage Notice

This package was created to share internal code and may be used as-is. Please note that no guarantees are made regarding the functionality or suitability of the code in all environments.

## Additional Resources

For more details on using Nest.js, refer to the official documentation: [Nest.js Microservices Overview](https://docs.nestjs.com/microservices/basics).
