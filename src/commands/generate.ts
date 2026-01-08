import { select, confirm, input, Separator } from '@inquirer/prompts';
import { GitHubService } from '../services/github';
import { OpenRouterService } from '../services/openrouter';
import { RepositoryAnalyzer } from '../services/analyzer';
import { displayBanner, displayRepoTable, displaySuggestions, displaySuccess, displayError, displayBatchResults, displayInfo } from '../utils/ui';
import { Repository, DescriptionSuggestion, BatchProcessResult, LLMResponse } from '../types';
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

async function refineWithFeedback(
  repo: Repository,
  suggestions: LLMResponse[],
  openrouter: OpenRouterService
): Promise<string | null> {
  // Let user select a starting suggestion
  const startingChoice = await select({
    message: 'Select a suggestion to refine:',
    choices: suggestions.map((s, i) => ({
      name: `${i + 1}. ${s.model}: ${s.description.substring(0, 60)}...`,
      value: i,
    })),
  });

  let currentDescription = suggestions[startingChoice].description;
  let iteration = 0;
  const maxIterations = 5;

  while (iteration < maxIterations) {
    console.log(chalk.cyan.bold(`\n📝 Current description:`));
    console.log(chalk.white(currentDescription));
    console.log(chalk.gray(`(${currentDescription.length} characters)\n`));

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: '✅ Accept this description', value: 'accept' },
        { name: '🔄 Refine with feedback', value: 'refine' },
        { name: '↩️  Go back to suggestions', value: 'back' },
      ],
    });

    if (action === 'accept') {
      return currentDescription;
    }

    if (action === 'back') {
      return null;
    }

    // Get feedback from user
    const feedback = await input({
      message: 'Enter your feedback (e.g., "make it shorter", "add more technical details", "mention TypeScript"):',
    });

    if (!feedback.trim()) {
      displayInfo('No feedback provided, keeping current description');
      continue;
    }

    // Refine with AI
    const spinner = ora('Refining description with AI...').start();
    try {
      const refined = await openrouter.refineDescription(repo, currentDescription, feedback);
      spinner.succeed('Description refined');
      currentDescription = refined.description;
      iteration++;
    } catch (error: any) {
      spinner.fail(`Refinement failed: ${error.message}`);
      const shouldContinue = await confirm({
        message: 'Try again with different feedback?',
        default: true,
      });
      if (!shouldContinue) {
        return null;
      }
    }
  }

  // Max iterations reached, ask if they want to accept current or go back
  console.log(chalk.yellow(`\n⚠️  Reached maximum refinements (${maxIterations})`));
  const accept = await confirm({
    message: 'Accept current description?',
    default: true,
  });

  return accept ? currentDescription : null;
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
      { name: 'Refine with AI feedback', value: 'refine' },
      { name: 'Skip this repository', value: 'skip' },
    ],
  });

  if (action === 'skip') {
    displayInfo('Skipped');
    return;
  }

  let finalDescription: string;

  if (action === 'refine') {
    // Let user refine with AI feedback
    const refined = await refineWithFeedback(selectedRepo, suggestions, openrouter);
    if (!refined) {
      return; // User cancelled
    }
    finalDescription = refined;
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
  displayInfo('For each repository, multiple AI models will generate suggestions in parallel for your review.');

  const results: BatchProcessResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    console.log(chalk.cyan.bold(`\n[${i + 1}/${repos.length}] Processing ${repo.name}...`));

    try {
      // Analyze repository
      const analysis = await analyzer.analyzeRepository(repo);

      // Generate descriptions with multiple LLMs in parallel
      const suggestions = await openrouter.generateMultipleDescriptions(analysis);

      const descSuggestion: DescriptionSuggestion = {
        repo,
        current: repo.description,
        suggestions,
      };

      // Display suggestions
      displaySuggestions(descSuggestion);

      // Let user choose
      const choices = [
        ...suggestions.map((s, idx) => ({
          name: `Use suggestion ${idx + 1} from ${s.model}`,
          value: `use_${idx}`,
        })),
        new Separator(),
        { name: 'Refine with AI feedback', value: 'refine' },
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

      if (action === 'skip') {
        displayInfo('Skipped');
        results.push({
          repo,
          success: false,
          error: 'Skipped by user',
        });
        continue;
      }

      let finalDescription: string | null = null;
      if (action === 'refine') {
        // Let user refine with AI feedback
        const refined = await refineWithFeedback(repo, suggestions, openrouter);
        if (!refined) {
          results.push({
            repo,
            success: false,
            error: 'Refinement cancelled by user',
          });
          continue;
        }
        finalDescription = refined;
      } else {
        const idx = parseInt(action.split('_')[1]);
        finalDescription = suggestions[idx].description;
      }

      if (!finalDescription) {
        continue;
      }

      // Update repository
      const [owner, repoName] = repo.full_name.split('/');
      await github.updateRepositoryDescription(owner, repoName, finalDescription);
      displaySuccess(`Updated ${repo.name}`);

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
