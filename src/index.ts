#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { improveCommand } from './commands/improve';
import chalk from 'chalk';

const program = new Command();

program
  .name('gh-describer')
  .description('A powerful CLI tool to generate and improve GitHub repository descriptions using multiple AI models')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate descriptions for repositories without descriptions')
  .option('-b, --batch', 'Batch process all repositories without prompts')
  .option('-u, --username <username>', 'Target specific GitHub username (defaults to authenticated user)')
  .action(async (options) => {
    try {
      await generateCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('improve')
  .description('Suggest improvements for existing repository descriptions')
  .option('-b, --batch', 'Batch process all repositories')
  .option('-u, --username <username>', 'Target specific GitHub username (defaults to authenticated user)')
  .action(async (options) => {
    try {
      await improveCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Custom help
program.addHelpText('after', `

Examples:
  $ gh-describer generate                    # Interactive mode to generate descriptions
  $ gh-describer generate --batch            # Batch generate for all repos
  $ gh-describer improve                     # Interactive mode to improve descriptions
  $ gh-describer improve --batch             # Batch improve all descriptions
  $ gh-describer generate -u username        # Generate for specific user's repos

Environment Variables:
  GITHUB_TOKEN         - GitHub Personal Access Token (required)
  OPENROUTER_API_KEY   - OpenRouter API Key (required)
  GITHUB_USERNAME      - Default GitHub username (optional)

Setup:
  1. Create a .env file in your project directory
  2. Add your GitHub token and OpenRouter API key
  3. Run 'gh-describer generate' to get started!

Get API Keys:
  GitHub Token:    https://github.com/settings/tokens
  OpenRouter Key:  https://openrouter.ai/keys
`);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
