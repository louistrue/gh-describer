import dotenv from 'dotenv';
import { AppConfig } from '../types';
import chalk from 'chalk';

dotenv.config();

export function getConfig(): AppConfig {
  const githubToken = process.env.GITHUB_TOKEN;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!githubToken) {
    console.error(chalk.red('❌ Error: GITHUB_TOKEN is not set in .env file'));
    console.log(chalk.yellow('\nPlease create a .env file with your GitHub token:'));
    console.log(chalk.cyan('GITHUB_TOKEN=your_token_here\n'));
    console.log(chalk.gray('Get a token at: https://github.com/settings/tokens'));
    process.exit(1);
  }

  if (!openRouterApiKey) {
    console.error(chalk.red('❌ Error: OPENROUTER_API_KEY is not set in .env file'));
    console.log(chalk.yellow('\nPlease add your OpenRouter API key to .env:'));
    console.log(chalk.cyan('OPENROUTER_API_KEY=your_key_here\n'));
    console.log(chalk.gray('Get a key at: https://openrouter.ai/keys'));
    process.exit(1);
  }

  return {
    githubToken,
    openRouterApiKey,
    githubUsername: process.env.GITHUB_USERNAME,
  };
}
