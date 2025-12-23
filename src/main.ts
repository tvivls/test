import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { AppModule } from './app.module';

let app: NestFastifyApplication;

async function bootstrap(): Promise<NestFastifyApplication> {
  if (!app) {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      {
        logger: ['error', 'warn'],
      },
    );

    const config = new DocumentBuilder()
      .setTitle('Tao Bot API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/json',
    });

    app.enableCors({
      origin: true,
      credentials: true,
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }
  return app;
}

// For Vercel serverless
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await bootstrap();
    const fastifyInstance = app.getHttpAdapter().getInstance();

    let payload: string | Buffer | undefined;
    if (req.body) {
      payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fastifyInstance.inject({
      method: req.method as any,
      url: req.url || '/',
      headers: req.headers as Record<string, string>,
      payload,
    });

    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        res.setHeader(key, value as string);
      }
    }

    res.status(response.statusCode).send(response.payload);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// For local development - only runs when executed directly (not imported by Vercel)
if (require.main === module) {
  void (async () => {
    const app = await bootstrap();
    // const configService = app.get(CustomConfigService);
    const port = 3000;
    await app.listen(port);
    console.log(`Server running on port ${port}`);
  })();
}