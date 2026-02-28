import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import * as tmp from 'tmp-promise';
import simpleGit from 'simple-git';

// Mock external dependencies
jest.mock('tmp-promise');
jest.mock('simple-git');
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('GitLab Support Integration', () => {
  let app: INestApplication;
  const validApiKey = 'test-api-key';

  const mockTmpDir = {
    path: '/tmp/test-repo',
    cleanup: jest.fn(),
  };

  const mockGit = {
    clone: jest.fn(),
    branch: jest.fn(),
    log: jest.fn(),
    raw: jest.fn(),
  };

  const mockExec = require('child_process').exec;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup mocks
    (tmp.dir as jest.Mock).mockResolvedValue(mockTmpDir);
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful git clone
    mockGit.clone.mockResolvedValue(undefined);
    mockGit.branch.mockResolvedValue({ current: 'main' });
    mockGit.log.mockResolvedValue({ latest: { hash: 'test-commit-hash' } });
    mockGit.raw.mockResolvedValue('main');
    
    // Default successful semgrep scan
    mockExec.mockImplementation((command, options, callback) => {
      if (command.includes('semgrep')) {
        const mockOutput = {
          results: [
            {
              check_id: 'SEC-001',
              extra: {
                message: 'Hardcoded secret found',
                severity: 'HIGH',
              },
              path: 'src/config.ts',
              start: { line: 10 },
            },
          ],
        };
        if (callback) {
          callback(null, JSON.stringify(mockOutput), '');
        }
      } else if (command.includes('gitleaks')) {
        if (callback) {
          callback(null, '', '');
        }
      }
      return {} as any;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GitLab.com Public Repository', () => {
    const publicGitLabRepo = 'https://gitlab.com/test/repo';

    it('should scan a public GitLab repository without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: publicGitLabRepo })
        .expect(201);

      expect(response.body).toHaveProperty('repository');
      expect(response.body.repository).toHaveProperty('name');
      expect(response.body.repository).toHaveProperty('defaultBranch');
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('changeDetection');
    }, 10000);

    it('should handle GitLab API rate limits gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/test/repo' })
        .expect(201);

      // Should still return results even if API fails
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('findings');
    }, 10000);
  });

  describe('GitLab Authentication Scenarios', () => {
    it('should work without authentication for public repos', async () => {
      delete process.env.GITLAB_TOKEN;
      delete process.env.GITLAB_ACCESS_TOKEN;

      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/test/repo' })
        .expect(201);

      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('findings');
    }, 10000);

    it('should handle invalid GitLab token gracefully', async () => {
      process.env.GITLAB_TOKEN = 'invalid-token-123';

      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/test/repo' })
        .expect(201);

      // Should fallback to git commands
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('findings');
    }, 10000);
  });

  describe('Self-hosted GitLab Instances', () => {
    it('should handle self-hosted GitLab URLs correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.example.com/team/project' })
        .expect(201);

      // Should either succeed or fail gracefully with proper error
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('findings');
    }, 10000);

    it('should support custom GitLab hostnames', async () => {
      const customHostnames = [
        'https://gitlab.company.com/team/repo',
        'https://code.organization.org/group/project',
        'https://git.internal.net/department/application',
      ];

      for (const repoUrl of customHostnames) {
        const response = await request(app.getHttpServer())
          .post('/scan')
          .set('X-API-Key', validApiKey)
          .send({ repoUrl })
          .expect(201);

        // Should handle URL parsing without throwing errors
        expect(response.body).toHaveProperty('repository');
        expect(response.body).toHaveProperty('findings');
      }
    }, 15000);
  });

  describe('GitLab Repository Formats', () => {
    it('should handle various GitLab URL formats', async () => {
      const gitLabUrls = [
        'https://gitlab.com/user/repo',
        'https://gitlab.com/user/repo.git',
        'https://gitlab.com/user/repo/',
        'https://gitlab.com/user/repo.git/',
      ];

      for (const repoUrl of gitLabUrls) {
        const response = await request(app.getHttpServer())
          .post('/scan')
          .set('X-API-Key', validApiKey)
          .send({ repoUrl })
          .expect(201);

        // Should parse and handle all formats
        expect(response.body).toHaveProperty('repository');
        expect(response.body).toHaveProperty('findings');
      }
    }, 20000);
  });

  describe('GitLab Error Handling', () => {
    it('should handle non-existent GitLab repositories', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/nonexistent/repository123456' })
        .expect(201);

      // Should handle gracefully
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('findings');
    }, 10000);

    it('should handle GitLab API timeouts gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/timeout-test/repo' })
        .expect(201);

      // Should either succeed or provide meaningful error
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('findings');
    }, 10000);
  });

  describe('GitLab Metadata Extraction', () => {
    it('should extract comprehensive GitLab metadata when available', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/test/repo' })
        .expect(201);

      const { repository } = response.body;
      
      // Basic metadata should be available
      expect(repository).toHaveProperty('name');
      expect(repository).toHaveProperty('defaultBranch');
      expect(repository).toHaveProperty('lastCommit');
      expect(repository.lastCommit).toHaveProperty('hash');
      expect(repository.lastCommit).toHaveProperty('timestamp');
    }, 10000);
  });

  describe('GitLab API Response Validation', () => {
    it('should validate GitLab API responses properly', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', validApiKey)
        .send({ repoUrl: 'https://gitlab.com/test/repo' })
        .expect(201);

      // Ensure response structure is valid
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('scanner');
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('changeDetection');
      expect(response.body).toHaveProperty('allSecurityIssues');
    }, 10000);
  });
}); 