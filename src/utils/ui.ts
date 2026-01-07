import chalk from 'chalk';
import Table from 'cli-table3';
import { Repository, LLMResponse, DescriptionSuggestion } from '../types';

export function displayBanner() {
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║     GitHub Repository Describer CLI      ║'));
  console.log(chalk.cyan.bold('║   Powered by Multiple AI Models 🤖       ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝\n'));
}

export function displayRepoTable(repos: Repository[], showDescription: boolean = true) {
  const headers = ['#', 'Repository', 'Language', 'Stars'];
  if (showDescription) {
    headers.push('Description');
  }

  const table = new Table({
    head: headers.map(h => chalk.cyan.bold(h)),
    colWidths: showDescription ? [5, 35, 15, 8, 50] : [5, 35, 15, 8],
    wordWrap: true,
    style: {
      head: [],
      border: ['gray']
    }
  });

  repos.forEach((repo, index) => {
    const row: any[] = [
      chalk.gray(index + 1),
      chalk.green(repo.name),
      repo.language || chalk.gray('N/A'),
      chalk.yellow(repo.stargazers_count.toString())
    ];

    if (showDescription) {
      row.push(repo.description || chalk.red('No description'));
    }

    table.push(row);
  });

  console.log(table.toString());
}

export function displaySuggestions(suggestion: DescriptionSuggestion) {
  console.log(chalk.cyan.bold(`\n📦 Repository: ${suggestion.repo.name}`));
  console.log(chalk.gray(`URL: ${suggestion.repo.html_url}`));

  if (suggestion.current) {
    console.log(chalk.yellow.bold('\n📝 Current Description:'));
    console.log(chalk.white(suggestion.current));
  } else {
    console.log(chalk.red.bold('\n❌ No current description'));
  }

  console.log(chalk.green.bold('\n✨ AI-Generated Suggestions:\n'));

  suggestion.suggestions.forEach((llm, index) => {
    console.log(chalk.magenta.bold(`${index + 1}. ${llm.model}:`));
    console.log(chalk.white(llm.description));
    if (llm.reasoning) {
      console.log(chalk.gray(`   Reasoning: ${llm.reasoning}`));
    }
    console.log();
  });
}

export function displayComparisonTable(suggestions: LLMResponse[]) {
  const table = new Table({
    head: [chalk.cyan.bold('Model'), chalk.cyan.bold('Suggestion')],
    colWidths: [25, 75],
    wordWrap: true,
    style: {
      head: [],
      border: ['gray']
    }
  });

  suggestions.forEach(llm => {
    table.push([
      chalk.magenta(llm.model),
      chalk.white(llm.description)
    ]);
  });

  console.log(table.toString());
}

export function displaySuccess(message: string) {
  console.log(chalk.green.bold(`\n✅ ${message}\n`));
}

export function displayError(message: string) {
  console.log(chalk.red.bold(`\n❌ ${message}\n`));
}

export function displayWarning(message: string) {
  console.log(chalk.yellow.bold(`\n⚠️  ${message}\n`));
}

export function displayInfo(message: string) {
  console.log(chalk.blue(`\nℹ️  ${message}\n`));
}

export function displayProgress(current: number, total: number, repoName: string) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  console.log(chalk.cyan(`\n[${bar}] ${percentage}% (${current}/${total})`));
  console.log(chalk.gray(`Processing: ${repoName}`));
}

export function clearLastLines(count: number) {
  for (let i = 0; i < count; i++) {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
  }
}

export function displayBatchResults(results: Array<{repo: Repository, success: boolean, error?: string}>) {
  console.log(chalk.cyan.bold('\n📊 Batch Processing Results:\n'));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  const table = new Table({
    head: [chalk.cyan.bold('Repository'), chalk.cyan.bold('Status'), chalk.cyan.bold('Details')],
    colWidths: [35, 12, 50],
    wordWrap: true,
    style: {
      head: [],
      border: ['gray']
    }
  });

  results.forEach(result => {
    table.push([
      chalk.white(result.repo.name),
      result.success ? chalk.green('✅ Success') : chalk.red('❌ Failed'),
      result.error ? chalk.red(result.error) : chalk.gray('Description updated')
    ]);
  });

  console.log(table.toString());

  console.log(chalk.cyan.bold('\n📈 Summary:'));
  console.log(chalk.green(`  ✅ Successful: ${successful}`));
  console.log(chalk.red(`  ❌ Failed: ${failed}`));
  console.log(chalk.white(`  📊 Total: ${results.length}\n`));
}
