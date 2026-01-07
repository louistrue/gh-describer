import { select, confirm, input, Separator } from '@inquirer/prompts';
import { GitHubService } from '../services/github';
import { OpenRouterService } from '../services/openrouter';
import { RepositoryAnalyzer } from '../services/analyzer';
import { displayBanner, displayRepoTable, displaySuggestions, displaySuccess, displayError, displayBatchResults, displayInfo } from '../utils/ui';
import { Repository, DescriptionSuggestion, BatchProcessResult } from '../types';
import chalk from 'chalk';
import ora from 'ora';

export async function generateCommand(options: { batch?: boolean; username?: string }) {
  displayBanner();

  const config = await import('../utils/config').then(m => m.getConfig());
  const github = new GitHubService(config.githubToken);
  const openrouter = new OpenRouterService(config.openRouterApiKey);
  const analyzer = new RepositoryAnalyzer(github);

  try {
    // Verify GitHub authentication
    const spinner = ora('Authenticating with GitHub...').start();
    const user = await github.getAuthenticatedUser();
    spinner.succeed(`Authenticated as ${chalk.cyan(user.login)}`);

    // Get repositories without descriptions
    const repos = await github.getRepositoriesWithoutDescription(options.username || config.githubUsername);

    if (repos.length === 0) {
      displayInfo('All your repositories already have descriptions! 🎉');
      return;
    }

    displayRepoTable(repos, false);

    // Check if batch mode
    if (options.batch) {
      await batchGenerate(repos, github, openrouter, analyzer);
    } else {
      await interactiveGenerate(repos, github, openrouter, analyzer);
    }

  } catch (error: any) {
    displayError(error.message);
    process.exit(1);
  }
}

async function interactiveGenerate(
  repos: Repository[],
  github: GitHubService,
  openrouter: OpenRouterService,
  analyzer: RepositoryAnalyzer
) {
  displayInfo('Interactive mode: Select repositories to generate descriptions for');

  // Let user select a repository
  const selectedRepo = await select({
    message: 'Select a repository to generate a description:',
    choices: repos.map((repo, index) => ({
      name: `${repo.name} ${chalk.gray(`(${repo.language || 'N/A'})`)}`,
      value: repo,
    })),
    pageSize: 15,
  });

  console.log(chalk.cyan.bold(`\n📦 Analyzing ${selectedRepo.name}...\n`));

  // Analyze the repository
  const analysis = await analyzer.analyzeRepository(selectedRepo);

  // Generate descriptions with multiple LLMs
  const suggestions = await openrouter.generateMultipleDescriptions(analysis);

  const descSuggestion: DescriptionSuggestion = {
    repo: selectedRepo,
    current: selectedRepo.description,
    suggestions,
  };

  // Display suggestions
  displaySuggestions(descSuggestion);

  // Let user choose
  const action = await select({
    message: 'What would you like to do?',
    choices: [
      ...suggestions.map((s, i) => ({
        name: `Use suggestion ${i + 1} from ${s.model}`,
        value: `use_${i}`,
      })),
      new Separator(),
      { name: 'Edit/combine suggestions', value: 'edit' },
      { name: 'Skip this repository', value: 'skip' },
    ],
  });

  if (action === 'skip') {
    displayInfo('Skipped');
    return;
  }

  let finalDescription: string;

  if (action === 'edit') {
    // Let user edit
    finalDescription = await input({
      message: 'Enter the final description:',
      default: suggestions[0].description,
    });
  } else {
    // Use selected suggestion
    const index = parseInt(action.split('_')[1]);
    finalDescription = suggestions[index].description;
  }

  // Confirm before updating
  const shouldUpdate = await confirm({
    message: `Update "${selectedRepo.name}" with this description?`,
    default: true,
  });

  if (shouldUpdate) {
    const [owner, repo] = selectedRepo.full_name.split('/');
    await github.updateRepositoryDescription(owner, repo, finalDescription);
    displaySuccess(`Description updated for ${selectedRepo.name}!`);

    // Ask if they want to continue
    if (repos.length > 1) {
      const continueProcessing = await confirm({
        message: 'Generate description for another repository?',
        default: true,
      });

      if (continueProcessing) {
        const remaining = repos.filter(r => r.id !== selectedRepo.id);
        await interactiveGenerate(remaining, github, openrouter, analyzer);
      }
    }
  } else {
    displayInfo('Update cancelled');
  }
}

async function batchGenerate(
  repos: Repository[],
  github: GitHubService,
  openrouter: OpenRouterService,
  analyzer: RepositoryAnalyzer
) {
  displayInfo(`Batch mode: Processing ${repos.length} repositories`);

  const confirm_batch = await confirm({
    message: `This will generate and apply descriptions to ${repos.length} repositories. Continue?`,
    default: false,
  });

  if (!confirm_batch) {
    displayInfo('Batch processing cancelled');
    return;
  }

  // Ask which model to use for batch processing
  const models = openrouter.getGenerateModels();
  const selectedModel = await select({
    message: 'Select which AI model to use for batch generation:',
    choices: models.map((m, i) => ({
      name: m.name,
      value: i,
    })),
  });

  const results: BatchProcessResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    console.log(chalk.cyan(`\n[${i + 1}/${repos.length}] Processing ${repo.name}...`));

    try {
      // Analyze repository
      const analysis = await analyzer.analyzeRepository(repo);

      // Generate description with selected model
      const spinner = ora(`Generating description...`).start();
      const suggestion = await openrouter.generateDescription(analysis, models[selectedModel]);
      spinner.succeed('Description generated');

      // Update repository
      const [owner, repoName] = repo.full_name.split('/');
      await github.updateRepositoryDescription(owner, repoName, suggestion.description);

      results.push({
        repo,
        success: true,
        oldDescription: repo.description,
        newDescription: suggestion.description,
      });

    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      results.push({
        repo,
        success: false,
        oldDescription: repo.description,
        newDescription: null,
        error: error.message,
      });
    }
  }

  // Display batch results
  displayBatchResults(results);
}
