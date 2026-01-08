import { Octokit } from '@octokit/rest';
import { Repository, FileContent } from '../types';
import chalk from 'chalk';
import ora from 'ora';

export class GitHubService {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getAuthenticatedUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return data;
    } catch (error) {
      throw new Error('Failed to authenticate with GitHub. Please check your token.');
    }
  }

  async listRepositories(username?: string): Promise<Repository[]> {
    const spinner = ora('Fetching repositories...').start();

    try {
      let repos: Repository[] = [];

      if (username) {
        // Get repos for specific user
        const { data } = await this.octokit.repos.listForUser({
          username,
          per_page: 100,
          sort: 'updated',
        });
        repos = data as Repository[];
      } else {
        // Get repos for authenticated user
        const { data } = await this.octokit.repos.listForAuthenticatedUser({
          per_page: 100,
          sort: 'updated',
          affiliation: 'owner',
        });
        repos = data as Repository[];
      }

      spinner.succeed(`Found ${chalk.cyan(repos.length)} repositories`);
      return repos;
    } catch (error: any) {
      spinner.fail('Failed to fetch repositories');
      throw new Error(`GitHub API Error: ${error.message}`);
    }
  }

  async getRepositoriesWithoutDescription(username?: string): Promise<Repository[]> {
    const repos = await this.listRepositories(username);
    const reposWithoutDesc = repos.filter(repo => !repo.description || repo.description.trim() === '');

    console.log(chalk.yellow(`Found ${reposWithoutDesc.length} repositories without descriptions`));

    return reposWithoutDesc;
  }

  async getRepositoriesWithDescription(username?: string): Promise<Repository[]> {
    const repos = await this.listRepositories(username);
    const reposWithDesc = repos.filter(repo => repo.description && repo.description.trim() !== '');

    console.log(chalk.green(`Found ${reposWithDesc.length} repositories with descriptions`));

    return reposWithDesc;
  }

  async getRepositoryFiles(owner: string, repo: string, path: string = ''): Promise<FileContent[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      const files: FileContent[] = [];

      if (Array.isArray(data)) {
        // Prepare promises for parallel fetching
        const fetchPromises = data.map(async (item) => {
          if (item.type === 'file' && this.shouldIncludeFile(item.name)) {
            try {
              return await this.getFileContent(owner, repo, item.path);
            } catch (error) {
              return null;
            }
          } else if (item.type === 'dir' && !this.shouldSkipDirectory(item.name)) {
            // Recursively get files from subdirectories (limited depth)
            if (path.split('/').length < 2) { // Reduced depth for speed
              return await this.getRepositoryFiles(owner, repo, item.path);
            }
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);

        for (const res of results) {
          if (Array.isArray(res)) {
            files.push(...res);
          } else if (res) {
            files.push(res);
          }
        }
      }

      return files;
    } catch (error) {
      console.log(chalk.gray(`  Could not access path: ${path}`));
      return [];
    }
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if ('content' in data && data.type === 'file') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        // Skip very large files
        if (content.length > 100000) {
          return null;
        }

        return {
          path: data.path,
          content,
          size: data.size,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async updateRepositoryDescription(owner: string, repo: string, description: string): Promise<void> {
    const spinner = ora(`Updating ${repo}...`).start();

    try {
      await this.octokit.repos.update({
        owner,
        repo,
        description,
      });

      spinner.succeed(`Updated ${chalk.green(repo)}`);
    } catch (error: any) {
      spinner.fail(`Failed to update ${repo}`);
      if (error.message.includes('Resource not accessible')) {
        throw new Error(
          `Permission Denied: Your Fine-grained token lacks 'Metadata' write access.\n` +
          `Please go to GitHub settings, edit your token, and under "Repository permissions", set "Metadata" to "Read and write".`
        );
      }
      throw new Error(`Failed to update repository: ${error.message}`);
    }
  }

  private shouldIncludeFile(filename: string): boolean {
    const extensions = [
      '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
      '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.swift', '.kt', '.scala',
      '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.scss',
      '.sh', '.bash', '.sql', '.r', '.m', '.lua', '.pl', '.vim'
    ];

    const importantFiles = [
      'README', 'LICENSE', 'Cargo.toml', 'package.json', 'requirements.txt',
      'Gemfile', 'pom.xml', 'build.gradle', 'CMakeLists.txt', 'Makefile',
      'Dockerfile', 'docker-compose.yml', '.gitignore', 'setup.py', 'pyproject.toml'
    ];

    const lowerFilename = filename.toLowerCase();

    return extensions.some(ext => lowerFilename.endsWith(ext)) ||
      importantFiles.some(name => lowerFilename.includes(name.toLowerCase()));
  }

  private shouldSkipDirectory(dirname: string): boolean {
    const skipDirs = [
      'node_modules', '.git', 'dist', 'build', 'target', 'bin', 'obj',
      '.next', '.nuxt', 'vendor', '__pycache__', '.pytest_cache', 'coverage',
      '.idea', '.vscode', 'tmp', 'temp', 'logs'
    ];

    return skipDirs.includes(dirname.toLowerCase());
  }

  async getImportantFiles(owner: string, repo: string): Promise<FileContent[]> {
    const spinner = ora('Analyzing repository files...').start();

    try {
      const allFiles = await this.getRepositoryFiles(owner, repo);

      // Prioritize certain files
      const priorityFiles = ['README.md', 'readme.md', 'package.json', 'Cargo.toml',
        'setup.py', 'requirements.txt', 'go.mod', 'pom.xml'];

      const important = allFiles.filter(file =>
        priorityFiles.some(pf => file.path.toLowerCase().includes(pf.toLowerCase()))
      );

      const others = allFiles.filter(file =>
        !priorityFiles.some(pf => file.path.toLowerCase().includes(pf.toLowerCase()))
      );

      // Limit total files to prevent token overflow
      const selected = [...important, ...others].slice(0, 20);

      spinner.succeed(`Analyzed ${chalk.cyan(selected.length)} files`);

      return selected;
    } catch (error: any) {
      spinner.fail('Failed to analyze files');
      throw new Error(`Failed to get repository files: ${error.message}`);
    }
  }
}
