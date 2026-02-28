import { Test, TestingModule } from '@nestjs/testing';
import { EnhancedGitScmProvider } from './scm-git-enhanced.provider';
import simpleGit from 'simple-git';
import * as tmp from 'tmp-promise';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('simple-git');
jest.mock('tmp-promise');
jest.mock('fs');
jest.mock('path');

const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;
const mockTmp = tmp as jest.Mocked<typeof tmp>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('EnhancedGitScmProvider', () => {
  let provider: EnhancedGitScmProvider;
  let mockGit: any;
  let mockTmpDir: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnhancedGitScmProvider],
    }).compile();

    provider = module.get<EnhancedGitScmProvider>(EnhancedGitScmProvider);
    jest.clearAllMocks();

    // Mock simple-git
    mockGit = {
      clone: jest.fn(),
      version: jest.fn(),
      log: jest.fn(),
      branch: jest.fn(),
      revparse: jest.fn(),
      diffSummary: jest.fn(),
    };
    mockSimpleGit.mockReturnValue(mockGit);

    // Mock tmp-promise
    mockTmpDir = {
      path: '/tmp/test-repo',
      cleanup: jest.fn(),
    };
    mockTmp.dir.mockResolvedValue(mockTmpDir);

    // Mock fs
    (mockFs.existsSync as jest.Mock).mockReturnValue(true);
    (mockFs.readFileSync as jest.Mock).mockReturnValue('# Test Repository\n\nThis is a test repository.');

    // Mock path
    (mockPath.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider['config'].name).toBe('Enhanced Git Provider');
      expect(provider['config'].platform).toBe('generic');
      expect(provider['config'].supportsPrivateRepos).toBe(true);
      expect(provider['config'].supportsApi).toBe(false);
    });
  });

  describe('canHandle', () => {
    it('should handle HTTPS GitHub URLs', () => {
      expect(provider.canHandle('https://github.com/user/repo.git')).toBe(true);
      expect(provider.canHandle('https://github.com/user/repo')).toBe(true);
    });

    it('should handle HTTPS GitLab URLs', () => {
      expect(provider.canHandle('https://gitlab.com/user/repo.git')).toBe(true);
      expect(provider.canHandle('https://gitlab.example.com/user/repo')).toBe(true);
    });

    it('should handle SSH URLs', () => {
      expect(provider.canHandle('git@github.com:user/repo.git')).toBe(true);
      expect(provider.canHandle('ssh://git@gitlab.com/user/repo.git')).toBe(true);
    });

    it('should handle Bitbucket URLs', () => {
      expect(provider.canHandle('https://bitbucket.org/user/repo.git')).toBe(true);
      expect(provider.canHandle('git@bitbucket.org:user/repo.git')).toBe(true);
    });

    it('should handle Azure DevOps URLs', () => {
      expect(provider.canHandle('https://dev.azure.com/org/project/_git/repo')).toBe(true);
    });

    it('should handle Gitea URLs', () => {
      expect(provider.canHandle('https://gitea.example.com/user/repo.git')).toBe(true);
    });

    it('should handle Forgejo URLs', () => {
      expect(provider.canHandle('https://forgejo.example.com/user/repo.git')).toBe(true);
    });

    it('should handle Codeberg URLs', () => {
      expect(provider.canHandle('https://codeberg.org/user/repo.git')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(provider.canHandle('not-a-url')).toBe(false);
      expect(provider.canHandle('ftp://example.com/repo')).toBe(false);
      expect(provider.canHandle('')).toBe(false);
    });
  });

  describe('parseRepositoryUrl', () => {
    it('should parse HTTPS GitHub URLs', () => {
      const result = provider.parseRepositoryUrl('https://github.com/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'github',
        hostname: 'github.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'https://github.com/user/repo.git',
      });
    });

    it('should parse HTTPS URLs without .git extension', () => {
      const result = provider.parseRepositoryUrl('https://github.com/user/repo');
      
      expect(result).toMatchObject({
        platform: 'github',
        hostname: 'github.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'https://github.com/user/repo',
      });
    });

    it('should parse GitLab URLs', () => {
      const result = provider.parseRepositoryUrl('https://gitlab.com/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'gitlab',
        hostname: 'gitlab.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
      });
    });

    it('should parse SSH GitHub URLs', () => {
      const result = provider.parseRepositoryUrl('git@github.com:user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'github',
        hostname: 'github.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'git@github.com:user/repo.git',
      });
    });

    it('should parse SSH GitLab URLs', () => {
      const result = provider.parseRepositoryUrl('ssh://git@gitlab.com/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'gitlab',
        hostname: 'gitlab.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'ssh://git@gitlab.com/user/repo.git',
      });
    });

    it('should parse Bitbucket URLs', () => {
      const result = provider.parseRepositoryUrl('https://bitbucket.org/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'bitbucket',
        hostname: 'bitbucket.org',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
      });
    });

    it('should parse Azure DevOps URLs', () => {
      const result = provider.parseRepositoryUrl('https://dev.azure.com/org/project/_git/repo');
      
      expect(result).toMatchObject({
        platform: 'azure-devops',
        hostname: 'dev.azure.com',
        owner: 'org',
        repository: 'repo',
        fullName: 'org/repo',
      });
    });

    it('should parse Gitea URLs', () => {
      const result = provider.parseRepositoryUrl('https://gitea.example.com/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'gitea',
        hostname: 'gitea.example.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
      });
    });

    it('should parse Forgejo URLs', () => {
      const result = provider.parseRepositoryUrl('https://forgejo.example.com/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'forgejo',
        hostname: 'forgejo.example.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
      });
    });

    it('should parse Codeberg URLs', () => {
      const result = provider.parseRepositoryUrl('https://codeberg.org/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'codeberg',
        hostname: 'codeberg.org',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
      });
    });

    it('should return generic platform for unknown hostnames', () => {
      const result = provider.parseRepositoryUrl('https://custom-git.example.com/user/repo.git');
      
      expect(result).toMatchObject({
        platform: 'generic',
        hostname: 'custom-git.example.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
      });
    });

    it('should return null for invalid URLs', () => {
      expect(provider.parseRepositoryUrl('not-a-url')).toBeNull();
      expect(provider.parseRepositoryUrl('')).toBeNull();
    });

    it('should handle URLs with insufficient path parts', () => {
      expect(provider.parseRepositoryUrl('https://github.com/user')).toBeNull();
      expect(provider.parseRepositoryUrl('https://github.com/')).toBeNull();
    });
  });

  describe('determinePlatform', () => {
    it('should determine GitHub platform', () => {
      const result = (provider as any).determinePlatform('github.com');
      expect(result).toBe('github');
    });

    it('should determine GitLab platform', () => {
      const result = (provider as any).determinePlatform('gitlab.com');
      expect(result).toBe('gitlab');
    });

    it('should determine Bitbucket platform', () => {
      const result = (provider as any).determinePlatform('bitbucket.org');
      expect(result).toBe('bitbucket');
    });

    it('should determine Azure DevOps platform', () => {
      const result = (provider as any).determinePlatform('dev.azure.com');
      expect(result).toBe('azure-devops');
    });

    it('should determine Gitea platform', () => {
      const result = (provider as any).determinePlatform('gitea.example.com');
      expect(result).toBe('gitea');
    });

    it('should determine Forgejo platform', () => {
      const result = (provider as any).determinePlatform('forgejo.example.com');
      expect(result).toBe('forgejo');
    });

    it('should determine Codeberg platform', () => {
      const result = (provider as any).determinePlatform('codeberg.org');
      expect(result).toBe('codeberg');
    });

    it('should return generic for unknown platforms', () => {
      const result = (provider as any).determinePlatform('custom-git.example.com');
      expect(result).toBe('generic');
    });
  });

  describe('cloneRepository', () => {
    it('should clone repository successfully', async () => {
      mockGit.clone.mockResolvedValue(undefined);

      await provider.cloneRepository('https://github.com/user/repo.git', '/tmp/test');

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        '/tmp/test',
        []
      );
    });

    it('should apply token authentication for GitHub', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      mockGit.clone.mockResolvedValue(undefined);

      await provider.cloneRepository('https://github.com/user/repo.git', '/tmp/test');

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://test-token@github.com/user/repo.git',
        '/tmp/test',
        []
      );
    });

    it('should apply token authentication for GitLab', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      mockGit.clone.mockResolvedValue(undefined);

      await provider.cloneRepository('https://gitlab.com/user/repo.git', '/tmp/test');

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://oauth2:test-token@gitlab.com/user/repo.git',
        '/tmp/test',
        []
      );
    });

    it('should apply token authentication for Bitbucket', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      mockGit.clone.mockResolvedValue(undefined);

      await provider.cloneRepository('https://bitbucket.org/user/repo.git', '/tmp/test');

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://x-token-auth:test-token@bitbucket.org/user/repo.git',
        '/tmp/test',
        []
      );
    });

    it('should apply generic token authentication for unknown platforms', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      mockGit.clone.mockResolvedValue(undefined);

      await provider.cloneRepository('https://custom-git.example.com/user/repo.git', '/tmp/test');

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://test-token@custom-git.example.com/user/repo.git',
        '/tmp/test',
        []
      );
    });

    it('should build clone options correctly', async () => {
      mockGit.clone.mockResolvedValue(undefined);

      await provider.cloneRepository('https://github.com/user/repo.git', '/tmp/test', {
        depth: 1,
        branch: 'main',
        singleBranch: true,
        recursive: true,
      });

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        '/tmp/test',
        ['--depth', '1', '--branch', 'main', '--single-branch', '--recursive']
      );
    });

    it('should handle clone errors', async () => {
      const error = new Error('Clone failed');
      mockGit.clone.mockRejectedValue(error);

      await expect(
        provider.cloneRepository('https://github.com/user/repo.git', '/tmp/test')
      ).rejects.toThrow('Clone failed: Clone failed');
    });

    it('should handle non-Error clone failures', async () => {
      mockGit.clone.mockRejectedValue('String error');

      await expect(
        provider.cloneRepository('https://github.com/user/repo.git', '/tmp/test')
      ).rejects.toThrow('Clone failed: Unknown error');
    });
  });

  describe('applyTokenAuthentication', () => {
    it('should apply GitHub token authentication', () => {
      const result = (provider as any).applyTokenAuthentication(
        'https://github.com/user/repo.git',
        'test-token'
      );
      expect(result).toBe('https://test-token@github.com/user/repo.git');
    });

    it('should apply GitLab token authentication', () => {
      const result = (provider as any).applyTokenAuthentication(
        'https://gitlab.com/user/repo.git',
        'test-token'
      );
      expect(result).toBe('https://oauth2:test-token@gitlab.com/user/repo.git');
    });

    it('should apply Bitbucket token authentication', () => {
      const result = (provider as any).applyTokenAuthentication(
        'https://bitbucket.org/user/repo.git',
        'test-token'
      );
      expect(result).toBe('https://x-token-auth:test-token@bitbucket.org/user/repo.git');
    });

    it('should apply generic token authentication', () => {
      const result = (provider as any).applyTokenAuthentication(
        'https://custom-git.example.com/user/repo.git',
        'test-token'
      );
      expect(result).toBe('https://test-token@custom-git.example.com/user/repo.git');
    });

    it('should return original URL for SSH URLs', () => {
      const result = (provider as any).applyTokenAuthentication(
        'git@github.com:user/repo.git',
        'test-token'
      );
      expect(result).toBe('git@github.com:user/repo.git');
    });

    it('should handle URL parsing errors', () => {
      const result = (provider as any).applyTokenAuthentication(
        'invalid-url',
        'test-token'
      );
      expect(result).toBe('invalid-url');
    });
  });

  describe('buildCloneOptions', () => {
    it('should build empty options array when no options provided', () => {
      const result = (provider as any).buildCloneOptions({});
      expect(result).toEqual([]);
    });

    it('should build options with depth', () => {
      const result = (provider as any).buildCloneOptions({ depth: 1 });
      expect(result).toEqual(['--depth', '1']);
    });

    it('should build options with branch', () => {
      const result = (provider as any).buildCloneOptions({ branch: 'main' });
      expect(result).toEqual(['--branch', 'main']);
    });

    it('should build options with singleBranch', () => {
      const result = (provider as any).buildCloneOptions({ singleBranch: true });
      expect(result).toEqual(['--single-branch']);
    });

    it('should build options with recursive', () => {
      const result = (provider as any).buildCloneOptions({ recursive: true });
      expect(result).toEqual(['--recursive']);
    });

    it('should build options with all flags', () => {
      const result = (provider as any).buildCloneOptions({
        depth: 1,
        branch: 'main',
        singleBranch: true,
        recursive: true,
      });
      expect(result).toEqual(['--depth', '1', '--branch', 'main', '--single-branch', '--recursive']);
    });
  });

  describe('fetchRepoMetadata', () => {
    beforeEach(() => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.log.mockResolvedValue({
        latest: {
          hash: 'abc123',
          date: '2023-01-01T00:00:00Z',
          message: 'Test commit',
          author_name: 'Test Author',
        },
      });
      mockGit.revparse.mockResolvedValue('main');
      mockGit.branch.mockResolvedValue({
        all: ['origin/main', 'origin/develop'],
      });
    });

    it('should fetch metadata using Git commands', async () => {
      const result = await provider.fetchRepoMetadata('https://github.com/user/repo.git');

      expect(result).toMatchObject({
        name: 'repo',
        description: 'Test Repository',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'abc123',
          timestamp: '2023-01-01T00:00:00Z',
          message: 'Test commit',
          author: 'Test Author',
        },
        common: {
          webUrl: 'https://github.com/user/repo',
          cloneUrl: 'https://github.com/user/repo.git',
        },
      });
    });

    it('should handle missing README files', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await provider.fetchRepoMetadata('https://github.com/user/repo.git');

      expect(result.description).toBe('No description available');
    });

    it('should handle README parsing errors', async () => {
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = await provider.fetchRepoMetadata('https://github.com/user/repo.git');

      expect(result.description).toBe('No description available');
    });

    it('should handle missing default branch', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Branch error'));
      mockGit.branch.mockResolvedValue({
        all: ['origin/master'],
      });

      const result = await provider.fetchRepoMetadata('https://github.com/user/repo.git');

      expect(result.defaultBranch).toBe('master');
    });

    it('should handle missing commit information', async () => {
      mockGit.log.mockResolvedValue({
        latest: null,
      });

      const result = await provider.fetchRepoMetadata('https://github.com/user/repo.git');

      expect(result.lastCommit.hash).toBe('unknown');
    });

    it('should cleanup temporary directory', async () => {
      await provider.fetchRepoMetadata('https://github.com/user/repo.git');

      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle clone errors', async () => {
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));

      await expect(
        provider.fetchRepoMetadata('https://github.com/user/repo.git')
      ).rejects.toThrow('Clone failed: Clone failed');
    });
  });

  describe('extractRepoNameFromUrl', () => {
    it('should extract name from HTTPS URL', () => {
      const result = (provider as any).extractRepoNameFromUrl('https://github.com/user/repo.git');
      expect(result).toBe('repo');
    });

    it('should extract name from SSH URL', () => {
      const result = (provider as any).extractRepoNameFromUrl('git@github.com:user/repo.git');
      expect(result).toBe('repo');
    });

    it('should return unknown for invalid URLs', () => {
      const result = (provider as any).extractRepoNameFromUrl('invalid-url');
      expect(result).toBe('unknown');
    });
  });

  describe('convertToWebUrl', () => {
    it('should convert HTTPS URL', () => {
      const result = (provider as any).convertToWebUrl('https://github.com/user/repo.git');
      expect(result).toBe('https://github.com/user/repo');
    });

    it('should convert SSH to HTTPS', () => {
      const result = (provider as any).convertToWebUrl('git@github.com:user/repo.git');
      expect(result).toBe('https://github.com/user/repo');
    });

    it('should return original URL for non-matching patterns', () => {
      const result = (provider as any).convertToWebUrl('https://example.com/repo');
      expect(result).toBe('https://example.com/repo');
    });
  });

  describe('extractDescription', () => {
    it('should extract description from README.md', async () => {
      const result = await (provider as any).extractDescription('/tmp/repo');
      expect(result).toBe('Test Repository');
    });

    it('should handle empty README content', async () => {
      (mockFs.readFileSync as jest.Mock).mockReturnValue('');

      const result = await (provider as any).extractDescription('/tmp/repo');
      expect(result).toBeNull();
    });

    it('should handle README with only markdown formatting', async () => {
      (mockFs.readFileSync as jest.Mock).mockReturnValue('# # # # # # # # # #');

      const result = await (provider as any).extractDescription('/tmp/repo');
      expect(result).toBe('# # # # # # # # #');
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'A'.repeat(300);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(`# ${longDescription}`);

      const result = await (provider as any).extractDescription('/tmp/repo');
      expect(result).toBe(longDescription.substring(0, 200) + '...');
    });

    it('should handle file read errors', async () => {
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = await (provider as any).extractDescription('/tmp/repo');
      expect(result).toBeNull();
    });
  });

  describe('getLastCommitHash', () => {
    beforeEach(() => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.log.mockResolvedValue({
        latest: { hash: 'abc123' },
      });
    });

    it('should get last commit hash successfully', async () => {
      const result = await provider.getLastCommitHash('https://github.com/user/repo.git');

      expect(result).toBe('abc123');
      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        '/tmp/test-repo',
        ['--depth', '1']
      );
    });

    it('should return unknown when no commits found', async () => {
      mockGit.log.mockResolvedValue({
        latest: null,
      });

      const result = await provider.getLastCommitHash('https://github.com/user/repo.git');

      expect(result).toBe('unknown');
    });

    it('should handle clone errors', async () => {
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));

      const result = await provider.getLastCommitHash('https://github.com/user/repo.git');

      expect(result).toBe('unknown');
    });

    it('should cleanup temporary directory', async () => {
      await provider.getLastCommitHash('https://github.com/user/repo.git');

      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });
  });

  describe('hasChangesSince', () => {
    beforeEach(() => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.log.mockResolvedValue({
        latest: { hash: 'def456' },
        total: 5,
      });
      mockGit.diffSummary.mockResolvedValue({
        files: ['file1.js', 'file2.js'],
        insertions: 10,
        deletions: 5,
      });
    });

    it('should detect changes when commits differ', async () => {
      const result = await provider.hasChangesSince(
        'https://github.com/user/repo.git',
        'abc123'
      );

      expect(result).toMatchObject({
        hasChanges: true,
        lastCommitHash: 'def456',
        changeSummary: {
          filesChanged: 2,
          additions: 10,
          deletions: 5,
          commits: 5,
          commitRange: 'abc123..def456',
        },
      });
    });

    it('should detect no changes when commits are the same', async () => {
      mockGit.log.mockResolvedValue({
        latest: { hash: 'abc123' },
      });

      const result = await provider.hasChangesSince(
        'https://github.com/user/repo.git',
        'abc123'
      );

      expect(result).toMatchObject({
        hasChanges: false,
        lastCommitHash: 'abc123',
      });
    });

    it('should handle unknown commit hashes', async () => {
      mockGit.log.mockResolvedValue({
        latest: { hash: 'unknown' },
      });

      const result = await provider.hasChangesSince(
        'https://github.com/user/repo.git',
        'unknown'
      );

      expect(result).toMatchObject({
        hasChanges: true,
        lastCommitHash: 'unknown',
        error: 'Unable to determine commit hashes',
      });
    });

    it('should handle errors gracefully', async () => {
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));

      const result = await provider.hasChangesSince(
        'https://github.com/user/repo.git',
        'abc123'
      );

      expect(result).toMatchObject({
        hasChanges: true,
        error: 'Unable to determine commit hashes',
      });
    });

    it('should handle diff summary errors', async () => {
      mockGit.diffSummary.mockRejectedValue(new Error('Diff failed'));

      const result = await provider.hasChangesSince(
        'https://github.com/user/repo.git',
        'abc123'
      );

      expect(result).toMatchObject({
        hasChanges: true,
        lastCommitHash: 'def456',
        changeSummary: {
          filesChanged: 0,
          additions: 0,
          deletions: 0,
          commits: 5,
          commitRange: 'abc123..def456',
        },
      });
    });
  });

  describe('getChangeSummary', () => {
    beforeEach(() => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.log.mockResolvedValue({
        total: 5,
      });
      mockGit.diffSummary.mockResolvedValue({
        files: ['file1.js', 'file2.js'],
        insertions: 10,
        deletions: 5,
      });
    });

    it('should get change summary successfully', async () => {
      const result = await (provider as any).getChangeSummary(
        'https://github.com/user/repo.git',
        'abc123',
        'def456'
      );

      expect(result).toMatchObject({
        filesChanged: 2,
        additions: 10,
        deletions: 5,
        commits: 5,
        commitRange: 'abc123..def456',
      });
    });

    it('should handle log errors', async () => {
      mockGit.log.mockRejectedValue(new Error('Log failed'));

      const result = await (provider as any).getChangeSummary(
        'https://github.com/user/repo.git',
        'abc123',
        'def456'
      );

      expect(result.commits).toBe(0);
    });

    it('should handle diff summary errors', async () => {
      mockGit.diffSummary.mockRejectedValue(new Error('Diff failed'));

      const result = await (provider as any).getChangeSummary(
        'https://github.com/user/repo.git',
        'abc123',
        'def456'
      );

      expect(result).toMatchObject({
        filesChanged: 0,
        additions: 0,
        deletions: 0,
        commits: 5,
        commitRange: 'abc123..def456',
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when git is available', async () => {
      mockGit.version.mockResolvedValue('2.30.0');

      const result = await provider.healthCheck();

      expect(result).toMatchObject({
        isHealthy: true,
        lastChecked: expect.any(String),
        authenticationValid: true,
      });
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when git is not available', async () => {
      mockGit.version.mockRejectedValue(new Error('Git not found'));

      const result = await provider.healthCheck();

      expect(result).toMatchObject({
        isHealthy: false,
        lastChecked: expect.any(String),
        error: 'Git not found',
        authenticationValid: false,
      });
    });

    it('should handle non-Error git failures', async () => {
      mockGit.version.mockRejectedValue('String error');

      const result = await provider.healthCheck();

      expect(result).toMatchObject({
        isHealthy: false,
        error: 'Git command not available',
      });
    });
  });

  describe('validateAuthentication', () => {
    it('should return true when no authentication is configured', async () => {
      provider['authConfig'] = undefined;
      const result = await provider.validateAuthentication();
      expect(result).toBe(true);
    });

    it('should return true for generic provider', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      const result = await provider.validateAuthentication();
      expect(result).toBe(true);
    });
  });

  describe('fetchFromApi', () => {
    it('should return null for base implementation', async () => {
      const result = await (provider as any).fetchFromApi({
        platform: 'github',
        hostname: 'github.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'https://github.com/user/repo.git',
      });
      expect(result).toBeNull();
    });
  });
}); 