import { select, confirm, input, Separator } from '@inquirer/prompts';
import { GitHubService } from '../services/github';
import { OpenRouterService } from '../services/openrouter';
import { displayBanner, displayRepoTable, displaySuggestions, displaySuccess, displayError, displayBatchResults, displayInfo, displayComparisonTable } from '../utils/ui';
import { Repository, DescriptionSuggestion, BatchProcessResult } from '../types';
import chalk from 'chalk';
import ora from 'ora';

export async function improveCommand(options: { batch?: boolean; username?: string }) {
  displayBanner();

  const config = await import('../utils/config').then(m => m.getConfig());
  const github = new GitHubService(config.githubToken);
  const openrouter = new OpenRouterService(config.openRouterApiKey);

  try {
    // Verify GitHub authentication
    const spinner = ora('Authenticating with GitHub...').start();
    const user = await github.getAuthenticatedUser();
    spinner.succeed(`Authenticated as ${chalk.cyan(user.login)}`);

    // Get repositories with descriptions
    const repos = await github.getRepositoriesWithDescription(options.username || config.githubUsername);

    if (repos.length === 0) {
      displayInfo('No repositories with descriptions found!');
      displayInfo('Use the "generate" command to create descriptions first.');
      return;
    }

    displayRepoTable(repos, true);

    // Check if batch mode
    if (options.batch) {
      await batchImprove(repos, github, openrouter);
    } else {
      await interactiveImprove(repos, github, openrouter);
    }

  } catch (error: any) {
    displayError(error.message);
    process.exit(1);
  }
}

async function interactiveImprove(
  repos: Repository[],
  github: GitHubService,
  openrouter: OpenRouterService
) {
  displayInfo('Interactive mode: Select repositories to improve descriptions');

  // Let user select a repository
  const selectedRepo = await select({
    message: 'Select a repository to improve its description:',
    choices: repos.map((repo) => ({
      name: `${repo.name} ${chalk.gray(`- "${repo.description}"`)}`,
      value: repo,
    })),
    pageSize: 10,
  });

  console.log(chalk.cyan.bold(`\n📦 Analyzing ${selectedRepo.name}...\n`));

  // Get improvement suggestions from 3 different LLMs
  const suggestions = await openrouter.improveMultipleDescriptions(
    selectedRepo,
    selectedRepo.description!
  );

  const descSuggestion: DescriptionSuggestion = {
    repo: selectedRepo,
    current: selectedRepo.description,
    suggestions,
  };

  // Display suggestions with reasoning
  displaySuggestions(descSuggestion);

  // Show comparison table
  console.log(chalk.cyan.bold('📊 Side-by-Side Comparison:\n'));
  displayComparisonTable([
    { model: 'Current', description: selectedRepo.description! },
    ...suggestions,
  ]);

  // Let user choose
  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Keep current description (no changes)', value: 'keep' },
      new Separator(),
      ...suggestions.map((s, i) => ({
        name: `Use suggestion ${i + 1} from ${s.model}`,
        value: `use_${i}`,
      })),
      new Separator(),
      { name: 'Create custom description', value: 'custom' },
      { name: 'Skip this repository', value: 'skip' },
    ],
  });

  if (action === 'skip' || action === 'keep') {
    displayInfo(action === 'skip' ? 'Skipped' : 'Keeping current description');
    return;
  }

  let finalDescription: string;

  if (action === 'custom') {
    // Let user create custom description
    finalDescription = await input({
      message: 'Enter your custom description:',
      default: selectedRepo.description!,
    });
  } else {
    // Use selected suggestion
    const index = parseInt(action.split('_')[1]);
    finalDescription = suggestions[index].description;
  }

  // Show before/after
  console.log(chalk.yellow.bold('\n📝 Before:'));
  console.log(chalk.white(selectedRepo.description));
  console.log(chalk.green.bold('\n✨ After:'));
  console.log(chalk.white(finalDescription));

  // Confirm before updating
  const shouldUpdate = await confirm({
    message: `Update "${selectedRepo.name}" with this description?`,
    default: true,
  });

  if (shouldUpdate) {
    const [owner, repo] = selectedRepo.full_name.split('/');
    await github.updateRepositoryDescription(owner, repo, finalDescription);
    displaySuccess(`Description improved for ${selectedRepo.name}!`);

    // Ask if they want to continue
    if (repos.length > 1) {
      const continueProcessing = await confirm({
        message: 'Improve description for another repository?',
        default: true,
      });

      if (continueProcessing) {
        const remaining = repos.filter(r => r.id !== selectedRepo.id);
        await interactiveImprove(remaining, github, openrouter);
      }
    }
  } else {
    displayInfo('Update cancelled');
  }
}

async function batchImprove(
  repos: Repository[],
  github: GitHubService,
  openrouter: OpenRouterService
) {
  displayInfo(`Batch mode: Improving ${repos.length} repositories`);
  displayInfo('For each repository, multiple AI models will suggest improvements in parallel for your review.');

  const results: BatchProcessResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    console.log(chalk.cyan.bold(`\n[${i + 1}/${repos.length}] Processing ${repo.name}...`));

    try {
      // Analyze repository - for improvement we might just use basic info unless openrouter.improve needs analysis
      // Note: OpenRouterService.improveMultipleDescriptions only takes repo and currentDescription
      const suggestions = await openrouter.improveMultipleDescriptions(
        repo,
        repo.description!
      );

      const descSuggestion: DescriptionSuggestion = {
        repo,
        current: repo.description,
        suggestions,
      };

      // Display suggestions with reasoning
      displaySuggestions(descSuggestion);

      // Show comparison table
      console.log(chalk.cyan.bold('📊 Side-by-Side Comparison:\n'));
      displayComparisonTable([
        { model: 'Current', description: repo.description! },
        ...suggestions,
      ]);

      // Let user choose
      const choices = [
        { name: 'Keep current description (no changes)', value: 'keep' },
        new Separator(),
        ...suggestions.map((s, idx) => ({
          name: `Use suggestion ${idx + 1} from ${s.model}`,
          value: `use_${idx}`,
        })),
        new Separator(),
        { name: 'Create custom description', value: 'custom' },
        { name: 'Skip this repository', value: 'skip' },
        { name: chalk.red.bold('Stop batch processing'), value: 'stop' },
      ];

      const action = await select({
        message: 'What would you like to do?',
        choices,
      });

      if (action === 'stop') {
        displayInfo('Batch processing stopped by user.');
        break;
      }

      if (action === 'skip' || action === 'keep') {
        const msg = action === 'skip' ? 'Skipped' : 'Keeping current description';
        displayInfo(msg);
        results.push({
          repo,
          success: false,
          error: msg,
        });
        continue;
      }

      let finalDescription: string;
      if (action === 'custom') {
        finalDescription = await input({
          message: 'Enter your custom description:',
          default: repo.description!,
        });
      } else {
        const idx = parseInt(action.split('_')[1]);
        finalDescription = suggestions[idx].description;
      }

      // Update repository
      const [owner, repoName] = repo.full_name.split('/');
      await github.updateRepositoryDescription(owner, repoName, finalDescription);
      displaySuccess(`Improved ${repo.name}`);

      results.push({
        repo,
        success: true,
        oldDescription: repo.description,
        newDescription: finalDescription,
      });

    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      results.push({
        repo,
        success: false,
        error: error.message,
      });

      const shouldContinue = await confirm({
        message: 'An error occurred. Continue with next repository?',
        default: true
      });

      if (!shouldContinue) break;
    }
  }

  // Display batch results
  if (results.length > 0) {
    displayBatchResults(results);
  }
}
