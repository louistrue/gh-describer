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
  displayInfo(`Batch mode: Processing ${repos.length} repositories`);

  const confirmBatch = await confirm({
    message: `This will analyze and improve descriptions for ${repos.length} repositories. Continue?`,
    default: false,
  });

  if (!confirmBatch) {
    displayInfo('Batch processing cancelled');
    return;
  }

  // Ask which model to use for batch processing
  const models = openrouter.getImproveModels();
  const selectedModel = await select({
    message: 'Select which AI model to use for batch improvements:',
    choices: models.map((m, i) => ({
      name: m.name,
      value: i,
    })),
  });

  // Ask for auto-apply or review
  const autoApply = await confirm({
    message: 'Automatically apply improvements? (No = review each suggestion)',
    default: false,
  });

  const results: BatchProcessResult[] = [];
  const reviewQueue: Array<{repo: Repository, oldDesc: string, newDesc: string}> = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    console.log(chalk.cyan(`\n[${i + 1}/${repos.length}] Processing ${repo.name}...`));

    try {
      // Generate improvement with selected model
      const spinner = ora(`Generating improvement...`).start();
      const suggestion = await openrouter.improveDescription(
        repo,
        repo.description!,
        models[selectedModel]
      );
      spinner.succeed('Improvement generated');

      if (autoApply) {
        // Automatically apply
        const [owner, repoName] = repo.full_name.split('/');
        await github.updateRepositoryDescription(owner, repoName, suggestion.description);

        results.push({
          repo,
          success: true,
          oldDescription: repo.description,
          newDescription: suggestion.description,
        });
      } else {
        // Queue for review
        reviewQueue.push({
          repo,
          oldDesc: repo.description!,
          newDesc: suggestion.description,
        });
      }

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

  // If not auto-apply, review queue
  if (!autoApply && reviewQueue.length > 0) {
    console.log(chalk.cyan.bold(`\n\n📋 Review ${reviewQueue.length} improvements:\n`));

    for (const item of reviewQueue) {
      console.log(chalk.cyan.bold(`\n📦 ${item.repo.name}`));
      console.log(chalk.yellow('Before: ') + chalk.white(item.oldDesc));
      console.log(chalk.green('After:  ') + chalk.white(item.newDesc));

      const shouldApply = await confirm({
        message: 'Apply this improvement?',
        default: true,
      });

      if (shouldApply) {
        try {
          const [owner, repoName] = item.repo.full_name.split('/');
          await github.updateRepositoryDescription(owner, repoName, item.newDesc);

          results.push({
            repo: item.repo,
            success: true,
            oldDescription: item.oldDesc,
            newDescription: item.newDesc,
          });
        } catch (error: any) {
          results.push({
            repo: item.repo,
            success: false,
            oldDescription: item.oldDesc,
            newDescription: null,
            error: error.message,
          });
        }
      } else {
        results.push({
          repo: item.repo,
          success: false,
          oldDescription: item.oldDesc,
          newDescription: null,
          error: 'Skipped by user',
        });
      }
    }
  }

  // Display batch results
  if (results.length > 0) {
    displayBatchResults(results);
  }
}
