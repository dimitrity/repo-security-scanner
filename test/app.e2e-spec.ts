import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('SecurityScanController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  it('/scan (POST) - success', async () => {
    const res = await request(app.getHttpServer())
      .post('/scan')
      .set('x-api-key', 'test-for-arnika-987')
      .send({ repoUrl: 'https://github.com/example/repo' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('repository');
    expect(res.body).toHaveProperty('scanner');
    expect(res.body).toHaveProperty('findings');
  });

  it('/scan (POST) - missing API key', async () => {
    const res = await request(app.getHttpServer())
      .post('/scan')
      .send({ repoUrl: 'https://github.com/example/repo' });
    expect(res.status).toBe(401);
  });

  it('/scan (POST) - invalid repoUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/scan')
      .set('x-api-key', 'test-for-arnika-987')
      .send({ repoUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
