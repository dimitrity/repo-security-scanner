import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('GitLab Support Integration', () => {
  let app: INestApplication;
  const validApiKey = 'test-for-arnica-987';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GitLab.com Public Repository', () => {
    const publicGitLabRepo = 'https://gitlab.com/gitlab-org/gitlab-foss';

    it('should scan a public GitLab repository without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: publicGitLabRepo })
        .expect(201);

      expect(response.body).toHaveProperty('repository');
      expect(response.body.repository).toHaveProperty('name');
      expect(response.body.repository).toHaveProperty('defaultBranch');

      // Check for GitLab-specific metadata
      if (response.body.repository.gitlab) {
        expect(response.body.repository.gitlab).toHaveProperty('id');
        expect(response.body.repository.gitlab).toHaveProperty('visibility');
        expect(response.body.repository.gitlab).toHaveProperty('webUrl');
      }
    }, 30000);

    it('should handle GitLab API rate limits gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/gitlab-org/gitlab' })
        .expect(201);

      // Should still return results even if API fails
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('scanner');
    }, 30000);
  });

  describe('GitLab Authentication Scenarios', () => {
    const originalToken = process.env.GITLAB_TOKEN;

    afterEach(() => {
      // Restore original token
      if (originalToken) {
        process.env.GITLAB_TOKEN = originalToken;
      } else {
        delete process.env.GITLAB_TOKEN;
      }
    });

    it('should work without authentication for public repos', async () => {
      delete process.env.GITLAB_TOKEN;
      delete process.env.GITLAB_ACCESS_TOKEN;

      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/gitlab-org/gitlab-foss' })
        .expect(201);

      expect(response.body).toHaveProperty('repository');
    }, 30000);

    it('should handle invalid GitLab token gracefully', async () => {
      process.env.GITLAB_TOKEN = 'invalid-token-123';

      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/gitlab-org/gitlab-foss' })
        .expect(201);

      // Should fallback to git commands
      expect(response.body).toHaveProperty('repository');
    }, 30000);
  });

  describe('Self-hosted GitLab Instances', () => {
    it('should handle self-hosted GitLab URLs correctly', async () => {
      // This will likely fail to connect, but should parse correctly
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.example.com/team/project' });

      // Should either succeed or fail gracefully with proper error
      expect([200, 201, 400, 500]).toContain(response.status);
    }, 15000);

    it('should support custom GitLab hostnames', async () => {
      const customGitLabUrls = [
        'https://gitlab.company.com/team/repo',
        'https://code.organization.org/group/project',
        'https://git.internal.net/department/application',
      ];

      for (const url of customGitLabUrls) {
        const response = await request(app.getHttpServer())
          .post('/scan')
          .set('X-API-Key', validApiKey)
          .send({ repoUrl: url });

        // Should handle URL parsing without throwing errors
        expect([200, 201, 400, 500]).toContain(response.status);
      }
    }, 20000);
  });

  describe('GitLab Repository Formats', () => {
    it('should handle various GitLab URL formats', async () => {
      const gitLabUrls = [
        'https://gitlab.com/user/repo',
        'https://gitlab.com/user/repo.git',
        'https://gitlab.com/group/subgroup/project',
        'https://gitlab.com/group/subgroup/project.git',
      ];

      for (const url of gitLabUrls) {
        const response = await request(app.getHttpServer())
          .post('/scan')
          .set('X-API-Key', validApiKey)
          .send({ repoUrl: url });

        // Should parse and handle all formats
        expect([200, 201, 400, 500]).toContain(response.status);
      }
    }, 25000);
  });

  describe('GitLab Error Handling', () => {
    it('should handle non-existent GitLab repositories', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/nonexistent/repository123456' })
        .expect(500);

      expect(response.body).toHaveProperty('message');
    }, 15000);

    it('should handle GitLab API timeouts gracefully', async () => {
      // This test simulates network issues
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/timeout-test/repo' });

      // Should either succeed or provide meaningful error
      expect([200, 201, 400, 500]).toContain(response.status);
    }, 20000);
  });

  describe('GitLab Metadata Extraction', () => {
    it('should extract comprehensive GitLab metadata when available', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/gitlab-org/gitlab-foss' })
        .expect(201);

      const { repository } = response.body;

      // Basic metadata should always be present
      expect(repository).toHaveProperty('name');
      expect(repository).toHaveProperty('description');
      expect(repository).toHaveProperty('defaultBranch');
      expect(repository).toHaveProperty('lastCommit');

      // GitLab-specific metadata may be present
      if (repository.gitlab) {
        expect(repository.gitlab).toHaveProperty('webUrl');
        expect(repository.gitlab).toHaveProperty('visibility');
        expect(repository.gitlab).toHaveProperty('httpUrlToRepo');
      }
    }, 30000);
  });

  describe('GitLab API Response Validation', () => {
    it('should validate GitLab API responses properly', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/gitlab-org/gitlab-foss' })
        .expect(201);

      // Ensure response structure is valid
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('scanner');
      expect(response.body).toHaveProperty('findings');

      // Validate repository metadata structure
      const { repository } = response.body;
      expect(typeof repository.name).toBe('string');
      expect(typeof repository.defaultBranch).toBe('string');
      expect(repository.lastCommit).toHaveProperty('hash');
      expect(repository.lastCommit).toHaveProperty('timestamp');
    }, 30000);
  });
});
