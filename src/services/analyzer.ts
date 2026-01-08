import { Repository, FileContent, RepoAnalysis } from '../types';
import { GitHubService } from './github';

export class RepositoryAnalyzer {
  constructor(private github: GitHubService) {}

  async analyzeRepository(repo: Repository): Promise<RepoAnalysis> {
    const [owner, repoName] = repo.full_name.split('/');

    // Get important files from the repository
    const files = await this.github.getImportantFiles(owner, repoName);

    // Analyze the files to extract meaningful information
    const languages = this.extractLanguages(files, repo);
    const mainPurpose = this.inferPurpose(files, repo);
    const summary = this.createSummary(files, repo);

    return {
      repo,
      files,
      summary,
      languages,
      mainPurpose,
    };
  }

  private extractLanguages(files: FileContent[], repo: Repository): string[] {
    const languages = new Set<string>();

    // Add primary language if available
    if (repo.language) {
      languages.add(repo.language);
    }

    // Detect languages from file extensions
    const extensionMap: { [key: string]: string } = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React',
      '.tsx': 'React/TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.r': 'R',
      '.m': 'MATLAB',
      '.lua': 'Lua',
      '.sh': 'Shell',
      '.sql': 'SQL',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SASS',
    };

    files.forEach(file => {
      const ext = file.path.substring(file.path.lastIndexOf('.'));
      if (extensionMap[ext]) {
        languages.add(extensionMap[ext]);
      }
    });

    return Array.from(languages);
  }

  private inferPurpose(files: FileContent[], repo: Repository): string {
    // Check for common project types
    const hasPackageJson = files.some(f => f.path.includes('package.json'));
    const hasCargoToml = files.some(f => f.path.includes('Cargo.toml'));
    const hasSetupPy = files.some(f => f.path.includes('setup.py'));
    const hasDockerfile = files.some(f => f.path.includes('Dockerfile'));
    const hasGoMod = files.some(f => f.path.includes('go.mod'));

    // Analyze package.json for Node.js projects
    if (hasPackageJson) {
      const packageJson = files.find(f => f.path.includes('package.json'));
      if (packageJson) {
        try {
          const pkg = JSON.parse(packageJson.content);

          // Check dependencies for framework detection
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };

          if (deps['react']) return 'React Application';
          if (deps['next']) return 'Next.js Application';
          if (deps['vue']) return 'Vue.js Application';
          if (deps['angular']) return 'Angular Application';
          if (deps['express']) return 'Express.js Server';
          if (deps['fastify']) return 'Fastify Server';
          if (deps['electron']) return 'Electron App';

          // Check if it's a library
          if (pkg.main || pkg.module) return 'JavaScript/TypeScript Library';
        } catch (e) {
          // Invalid JSON, continue
        }
      }
    }

    if (hasCargoToml) return 'Rust Project';
    if (hasGoMod) return 'Go Application';
    if (hasSetupPy) return 'Python Package';
    if (hasDockerfile) return 'Containerized Application';

    // Check README for clues
    const readme = files.find(f => f.path.toLowerCase().includes('readme'));
    if (readme) {
      const content = readme.content.toLowerCase();
      if (content.includes('library')) return 'Library';
      if (content.includes('framework')) return 'Framework';
      if (content.includes('cli') || content.includes('command line')) return 'CLI Tool';
      if (content.includes('api')) return 'API Service';
      if (content.includes('website') || content.includes('web app')) return 'Web Application';
      if (content.includes('mobile')) return 'Mobile Application';
      if (content.includes('bot')) return 'Bot';
      if (content.includes('plugin') || content.includes('extension')) return 'Plugin/Extension';
    }

    // Default based on language
    if (repo.language === 'Python') return 'Python Application';
    if (repo.language === 'JavaScript' || repo.language === 'TypeScript') return 'JavaScript/TypeScript Project';

    return 'Software Project';
  }

  private createSummary(files: FileContent[], repo: Repository): string {
    const parts: string[] = [];

    // Repository metadata
    parts.push(`Repository: ${repo.name}`);
    if (repo.language) parts.push(`Language: ${repo.language}`);
    if (repo.topics.length > 0) parts.push(`Topics: ${repo.topics.join(', ')}`);

    // File count and types
    const fileTypes = files.map(f => f.path.split('.').pop()).filter(Boolean);
    const uniqueTypes = Array.from(new Set(fileTypes));
    parts.push(`Files analyzed: ${files.length}`);
    parts.push(`File types: ${uniqueTypes.join(', ')}`);

    // Key files
    const keyFiles = files
      .filter(f =>
        f.path.toLowerCase().includes('readme') ||
        f.path.includes('package.json') ||
        f.path.includes('Cargo.toml') ||
        f.path.includes('setup.py')
      )
      .map(f => f.path);

    if (keyFiles.length > 0) {
      parts.push(`Key files: ${keyFiles.join(', ')}`);
    }

    return parts.join('\n');
  }

  async batchAnalyze(repos: Repository[]): Promise<RepoAnalysis[]> {
    const analyses: RepoAnalysis[] = [];

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      console.log(`\n[${i + 1}/${repos.length}] Analyzing ${repo.name}...`);

      try {
        const analysis = await this.analyzeRepository(repo);
        analyses.push(analysis);
      } catch (error: any) {
        console.error(`Failed to analyze ${repo.name}: ${error.message}`);
      }
    }

    return analyses;
  }
}
