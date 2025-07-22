import { GitScmProvider } from './scm-git.provider';
import simpleGit from 'simple-git';

// Mock simple-git
jest.mock('simple-git', () => {
  return jest.fn(() => ({
    clone: jest.fn(),
  }));
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

    it('should return mock metadata structure', async () => {
      const metadata = await provider.fetchRepoMetadata(testRepoUrl);

      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('defaultBranch');
      expect(metadata).toHaveProperty('lastCommit');
      expect(metadata.lastCommit).toHaveProperty('hash');
      expect(metadata.lastCommit).toHaveProperty('timestamp');
    });

    it('should return expected mock values', async () => {
      const metadata = await provider.fetchRepoMetadata(testRepoUrl);

      expect(metadata.name).toBe('mock-repo');
      expect(metadata.description).toBe('A mock repository');
      expect(metadata.defaultBranch).toBe('main');
      expect(metadata.lastCommit.hash).toBe('abc123');
      expect(metadata.lastCommit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return consistent timestamp format', async () => {
      const metadata1 = await provider.fetchRepoMetadata(testRepoUrl);
      const metadata2 = await provider.fetchRepoMetadata(testRepoUrl);

      // Both should be valid ISO date strings
      expect(new Date(metadata1.lastCommit.timestamp)).toBeInstanceOf(Date);
      expect(new Date(metadata2.lastCommit.timestamp)).toBeInstanceOf(Date);
      
      // Should have the same format (both should be valid ISO strings)
      expect(metadata1.lastCommit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(metadata2.lastCommit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle different repository URLs', async () => {
      const urls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
        'https://github.com/user/repo.git',
      ];

      for (const url of urls) {
        const metadata = await provider.fetchRepoMetadata(url);
        expect(metadata.name).toBe('mock-repo');
        expect(metadata.description).toBe('A mock repository');
      }
    });

    it('should handle empty repository URL', async () => {
      const metadata = await provider.fetchRepoMetadata('');
      expect(metadata.name).toBe('mock-repo');
    });

    it('should handle null repository URL', async () => {
      const metadata = await provider.fetchRepoMetadata(null as any);
      expect(metadata.name).toBe('mock-repo');
    });

    it('should return metadata with correct types', async () => {
      const metadata = await provider.fetchRepoMetadata(testRepoUrl);

      expect(typeof metadata.name).toBe('string');
      expect(typeof metadata.description).toBe('string');
      expect(typeof metadata.defaultBranch).toBe('string');
      expect(typeof metadata.lastCommit.hash).toBe('string');
      expect(typeof metadata.lastCommit.timestamp).toBe('string');
    });

    it('should return non-empty values', async () => {
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

      // Clone repository
      await provider.cloneRepository(testRepoUrl, testTargetPath);
      expect(mockGitInstance.clone).toHaveBeenCalledWith(testRepoUrl, testTargetPath);

      // Fetch metadata
      const metadata = await provider.fetchRepoMetadata(testRepoUrl);
      expect(metadata.name).toBe('mock-repo');
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