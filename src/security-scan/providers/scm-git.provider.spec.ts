import { GitScmProvider } from './scm-git.provider';
import simpleGit from 'simple-git';

// Mock simple-git
jest.mock('simple-git', () => {
  const mockGit = jest.fn(() => ({
    clone: jest.fn(),
    getRemotes: jest.fn(),
    revparse: jest.fn(),
    log: jest.fn(),
  }));
  return mockGit;
});

describe('GitScmProvider', () => {
  let provider: GitScmProvider;
  const mockGit = simpleGit as jest.MockedFunction<typeof simpleGit>;

  beforeEach(() => {
    provider = new GitScmProvider();
    jest.clearAllMocks();
  });

  describe('cloneRepository', () => {
    const testRepoUrl = 'https://github.com/test/repo';
    const testTargetPath = '/tmp/test-repo';

    it('should successfully clone a repository', async () => {
      const mockGitInstance = {
        clone: jest.fn().mockResolvedValue(undefined),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      await provider.cloneRepository(testRepoUrl, testTargetPath);

      expect(mockGit).toHaveBeenCalled();
      expect(mockGitInstance.clone).toHaveBeenCalledWith(testRepoUrl, testTargetPath);
    });

    it('should handle cloning errors', async () => {
      const mockGitInstance = {
        clone: jest.fn().mockRejectedValue(new Error('Clone failed')),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      await expect(provider.cloneRepository(testRepoUrl, testTargetPath)).rejects.toThrow('Clone failed');
    });

    it('should handle different repository URL formats', async () => {
      const mockGitInstance = {
        clone: jest.fn().mockResolvedValue(undefined),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      const urls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
        'https://github.com/user/repo.git',
        'git@github.com:user/repo.git',
      ];

      for (const url of urls) {
        await provider.cloneRepository(url, testTargetPath);
        expect(mockGitInstance.clone).toHaveBeenCalledWith(url, testTargetPath);
      }
    });

    it('should handle empty repository URL', async () => {
      const mockGitInstance = {
        clone: jest.fn().mockRejectedValue(new Error('Invalid URL')),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      await expect(provider.cloneRepository('', testTargetPath)).rejects.toThrow('Invalid URL');
    });

    it('should handle empty target path', async () => {
      const mockGitInstance = {
        clone: jest.fn().mockRejectedValue(new Error('Invalid path')),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      await expect(provider.cloneRepository(testRepoUrl, '')).rejects.toThrow('Invalid path');
    });
  });

  describe('fetchRepoMetadata', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    beforeEach(() => {
      // Mock fetch for API calls
      global.fetch = jest.fn();
    });

    it('should return metadata structure', async () => {
      // Mock GitHub API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-repo',
          description: 'Test repository',
          default_branch: 'main',
          updated_at: '2024-01-01T00:00:00Z'
        })
      });

      const metadata = await provider.fetchRepoMetadata(testRepoUrl);

      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('defaultBranch');
      expect(metadata).toHaveProperty('lastCommit');
      expect(metadata.lastCommit).toHaveProperty('hash');
      expect(metadata.lastCommit).toHaveProperty('timestamp');
    });

    it('should fetch from GitHub API for GitHub URLs', async () => {
      const mockResponse = {
        name: 'test-repo',
        description: 'Test repository',
        default_branch: 'main',
        updated_at: '2024-01-01T00:00:00Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const metadata = await provider.fetchRepoMetadata(testRepoUrl);
      
      expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/repos/test/repo');
      expect(metadata.name).toBe('test-repo');
      expect(metadata.description).toBe('Test repository');
      expect(metadata.defaultBranch).toBe('main');
    });

    it('should fetch from GitLab API for GitLab URLs', async () => {
      const mockResponse = {
        name: 'test-repo',
        description: 'Test repository',
        default_branch: 'main',
        last_activity_at: '2024-01-01T00:00:00Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const metadata = await provider.fetchRepoMetadata('https://gitlab.com/test/repo');
      
      expect(global.fetch).toHaveBeenCalledWith('https://gitlab.com/api/v4/projects/test%2Frepo');
      expect(metadata.name).toBe('test-repo');
      expect(metadata.description).toBe('Test repository');
    });

    it('should fetch from Bitbucket API for Bitbucket URLs', async () => {
      const mockResponse = {
        name: 'test-repo',
        description: 'Test repository',
        mainbranch: { name: 'main' },
        updated_on: '2024-01-01T00:00:00Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const metadata = await provider.fetchRepoMetadata('https://bitbucket.org/test/repo');
      
      expect(global.fetch).toHaveBeenCalledWith('https://api.bitbucket.org/2.0/repositories/test/repo');
      expect(metadata.name).toBe('test-repo');
      expect(metadata.description).toBe('Test repository');
    });

    it('should handle API failures gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const metadata = await provider.fetchRepoMetadata(testRepoUrl);
      
      expect(metadata.name).toBe('repo');
      expect(metadata.description).toBe('Repository information unavailable');
      expect(metadata.lastCommit.hash).toBe('unknown');
    });

    it('should handle malformed URLs', async () => {
      const metadata = await provider.fetchRepoMetadata('invalid-url');
      
      expect(metadata.name).toBe('invalid-url');
      expect(metadata.description).toBe('Repository information unavailable');
    });

    it('should return metadata with correct types', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-repo',
          description: 'Test repository',
          default_branch: 'main',
          updated_at: '2024-01-01T00:00:00Z'
        })
      });

      const metadata = await provider.fetchRepoMetadata(testRepoUrl);

      expect(typeof metadata.name).toBe('string');
      expect(typeof metadata.description).toBe('string');
      expect(typeof metadata.defaultBranch).toBe('string');
      expect(typeof metadata.lastCommit.hash).toBe('string');
      expect(typeof metadata.lastCommit.timestamp).toBe('string');
    });

    it('should return non-empty values', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-repo',
          description: 'Test repository',
          default_branch: 'main',
          updated_at: '2024-01-01T00:00:00Z'
        })
      });

      const metadata = await provider.fetchRepoMetadata(testRepoUrl);

      expect(metadata.name.length).toBeGreaterThan(0);
      expect(metadata.description.length).toBeGreaterThan(0);
      expect(metadata.defaultBranch.length).toBeGreaterThan(0);
      expect(metadata.lastCommit.hash.length).toBeGreaterThan(0);
      expect(metadata.lastCommit.timestamp.length).toBeGreaterThan(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle clone then metadata fetch workflow', async () => {
      const testRepoUrl = 'https://github.com/test/repo';
      const testTargetPath = '/tmp/test-repo';

      const mockGitInstance = {
        clone: jest.fn().mockResolvedValue(undefined),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      // Mock GitHub API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-repo',
          description: 'Test repository',
          default_branch: 'main',
          updated_at: '2024-01-01T00:00:00Z'
        })
      });

      // Clone repository
      await provider.cloneRepository(testRepoUrl, testTargetPath);
      expect(mockGitInstance.clone).toHaveBeenCalledWith(testRepoUrl, testTargetPath);

      // Fetch metadata
      const metadata = await provider.fetchRepoMetadata(testRepoUrl);
      expect(metadata.name).toBe('test-repo');
    });

    it('should handle multiple operations in sequence', async () => {
      const mockGitInstance = {
        clone: jest.fn().mockResolvedValue(undefined),
      };
      mockGit.mockReturnValue(mockGitInstance as any);

      const operations = [
        () => provider.cloneRepository('https://github.com/repo1', '/tmp/repo1'),
        () => provider.fetchRepoMetadata('https://github.com/repo1'),
        () => provider.cloneRepository('https://github.com/repo2', '/tmp/repo2'),
        () => provider.fetchRepoMetadata('https://github.com/repo2'),
      ];

      for (const operation of operations) {
        await expect(operation()).resolves.not.toThrow();
      }
    });
  });
}); 