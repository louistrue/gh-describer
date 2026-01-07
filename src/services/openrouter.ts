import axios from 'axios';
import { LLMConfig, LLMResponse, RepoAnalysis, Repository } from '../types';
import ora from 'ora';
import chalk from 'chalk';

export class OpenRouterService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // LLM configurations for different modes
  getGenerateModels(): LLMConfig[] {
    return [
      {
        name: 'OpenAI GPT-4 Turbo',
        model: 'openai/gpt-4-turbo',
        temperature: 0.7,
      },
      {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4.5',
        temperature: 0.7,
      },
    ];
  }

  getImproveModels(): LLMConfig[] {
    return [
      {
        name: 'OpenAI GPT-4 Turbo',
        model: 'openai/gpt-4-turbo',
        temperature: 0.7,
      },
      {
        name: 'Claude Sonnet 4.5',
        model: 'anthropic/claude-sonnet-4.5',
        temperature: 0.7,
      },
      {
        name: 'Google Gemini Pro 1.5',
        model: 'google/gemini-pro-1.5',
        temperature: 0.7,
      },
    ];
  }

  async generateDescription(analysis: RepoAnalysis, model: LLMConfig): Promise<LLMResponse> {
    const prompt = this.buildGeneratePrompt(analysis);

    try {
      const response = await this.callLLM(model, prompt);
      return {
        model: model.name,
        description: this.extractDescription(response),
      };
    } catch (error: any) {
      throw new Error(`${model.name} failed: ${error.message}`);
    }
  }

  async improveDescription(repo: Repository, currentDescription: string, model: LLMConfig): Promise<LLMResponse> {
    const prompt = this.buildImprovePrompt(repo, currentDescription);

    try {
      const response = await this.callLLM(model, prompt);
      const improved = this.extractDescription(response);

      return {
        model: model.name,
        description: improved,
        reasoning: this.extractReasoning(response),
      };
    } catch (error: any) {
      throw new Error(`${model.name} failed: ${error.message}`);
    }
  }

  async generateMultipleDescriptions(analysis: RepoAnalysis): Promise<LLMResponse[]> {
    const models = this.getGenerateModels();
    const spinner = ora('Generating descriptions with multiple AI models...').start();

    try {
      const results: LLMResponse[] = [];

      for (const model of models) {
        spinner.text = `Generating with ${chalk.cyan(model.name)}...`;
        const result = await this.generateDescription(analysis, model);
        results.push(result);
      }

      spinner.succeed(`Generated ${chalk.green(results.length)} AI descriptions`);
      return results;
    } catch (error: any) {
      spinner.fail('Failed to generate descriptions');
      throw error;
    }
  }

  async improveMultipleDescriptions(repo: Repository, currentDescription: string): Promise<LLMResponse[]> {
    const models = this.getImproveModels();
    const spinner = ora('Generating improvements with multiple AI models...').start();

    try {
      const results: LLMResponse[] = [];

      for (const model of models) {
        spinner.text = `Analyzing with ${chalk.cyan(model.name)}...`;
        const result = await this.improveDescription(repo, currentDescription, model);
        results.push(result);
      }

      spinner.succeed(`Generated ${chalk.green(results.length)} improvement suggestions`);
      return results;
    } catch (error: any) {
      spinner.fail('Failed to generate improvements');
      throw error;
    }
  }

  private async callLLM(model: LLMConfig, prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: model.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: model.temperature || 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/gh-describer',
            'X-Title': 'GitHub Repository Describer',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data.error?.message || 'Unknown error'}`);
      }
      throw new Error(`Network Error: ${error.message}`);
    }
  }

  private buildGeneratePrompt(analysis: RepoAnalysis): string {
    const filesList = analysis.files
      .slice(0, 10)
      .map(f => `- ${f.path} (${f.size} bytes)`)
      .join('\n');

    const filesContent = analysis.files
      .filter(f => f.path.toLowerCase().includes('readme') ||
                   f.path.toLowerCase().includes('package.json') ||
                   f.path.toLowerCase().includes('cargo.toml'))
      .map(f => `\n--- ${f.path} ---\n${f.content.slice(0, 2000)}`)
      .join('\n');

    return `You are an expert at analyzing GitHub repositories and writing concise, compelling repository descriptions.

Repository: ${analysis.repo.name}
Primary Language: ${analysis.repo.language || 'Not specified'}
Topics: ${analysis.repo.topics.join(', ') || 'None'}
Stars: ${analysis.repo.stargazers_count}

Key Files Found:
${filesList}

${filesContent}

Task: Write a concise, professional GitHub repository description (100-150 characters max).

Requirements:
- Be specific about what the project does
- Mention the primary technology/language if relevant
- Make it engaging and clear
- Keep it under 150 characters
- Do NOT use phrases like "This repository" or "A project that"
- Start with an action verb or direct description

Return ONLY the description text, nothing else.`;
  }

  private buildImprovePrompt(repo: Repository, currentDescription: string): string {
    return `You are an expert at analyzing and improving GitHub repository descriptions.

Repository: ${repo.name}
Primary Language: ${repo.language || 'Not specified'}
Topics: ${repo.topics.join(', ') || 'None'}
Stars: ${repo.stargazers_count}

Current Description:
"${currentDescription}"

Task: Improve this repository description to make it more compelling, clear, and professional.

Requirements:
- Keep it concise (100-150 characters ideal)
- Make it more specific and actionable
- Remove redundant words
- Ensure it clearly communicates the value/purpose
- Use active language
- Maintain or improve SEO keywords

Format your response as:
IMPROVED: [your improved description]
REASONING: [brief explanation of what you improved and why]

Return only in this format.`;
  }

  private extractDescription(response: string): string {
    // If response contains "IMPROVED:", extract that part
    const improvedMatch = response.match(/IMPROVED:\s*(.+?)(?:\n|REASONING:|$)/s);
    if (improvedMatch) {
      return improvedMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Otherwise, return cleaned response
    return response.trim().replace(/^["']|["']$/g, '');
  }

  private extractReasoning(response: string): string | undefined {
    const reasoningMatch = response.match(/REASONING:\s*(.+)/s);
    if (reasoningMatch) {
      return reasoningMatch[1].trim();
    }
    return undefined;
  }
}
