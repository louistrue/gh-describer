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
        name: 'Google Gemini 3 Pro (Preview)',
        model: 'google/gemini-3-pro-preview',
        temperature: 0.8,
      },
      {
        name: 'Claude 4.5 Sonnet (Optimized)',
        model: 'anthropic/claude-sonnet-4.5',
        temperature: 0.7,
      },
    ];
  }

  getImproveModels(): LLMConfig[] {
    return [
      {
        name: 'Google Gemini 3 Pro (Preview)',
        model: 'google/gemini-3-pro-preview',
        temperature: 0.8,
      },
      {
        name: 'Claude 4.5 Sonnet (Optimized)',
        model: 'anthropic/claude-sonnet-4.5',
        temperature: 0.7,
      },
      {
        name: 'Minimax M2.1',
        model: 'minimax/minimax-m2.1',
        temperature: 0.7,
      },
    ];
  }

  async generateDescription(analysis: RepoAnalysis, model: LLMConfig): Promise<LLMResponse> {
    const prompt = this.buildGeneratePrompt(analysis);

    try {
      const response = await this.callLLM(model, prompt);
      const description = this.extractDescription(response);

      if (!description || description.trim().length === 0) {
        throw new Error('Generated description is empty');
      }

      return {
        model: model.name,
        description,
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

      if (!improved || improved.trim().length === 0) {
        throw new Error('Generated improvement is empty');
      }

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
    const spinner = ora('Generating descriptions with multiple AI models in parallel...').start();

    try {
      const settledResults = await Promise.allSettled(
        models.map(model => this.generateDescription(analysis, model))
      );

      const results: LLMResponse[] = [];
      const errors: string[] = [];

      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const errorMessage = result.reason?.message || String(result.reason) || 'Unknown error';
          // Error message already includes model name from generateDescription
          errors.push(errorMessage);
          console.error(chalk.red(`\n⚠️  ${errorMessage}`));
        }
      });

      if (results.length === 0) {
        spinner.fail('All models failed to generate descriptions');
        throw new Error(`All models failed:\n${errors.join('\n')}`);
      }

      if (errors.length > 0) {
        spinner.stop();
        console.log(chalk.yellow(`⚠️  Generated ${chalk.green(results.length)}/${chalk.yellow(models.length)} AI descriptions (${chalk.red(errors.length)} failed)`));
      } else {
        spinner.succeed(`Generated ${chalk.green(results.length)} AI descriptions`);
      }

      return results;
    } catch (error: any) {
      spinner.fail('Failed to generate descriptions');
      throw error;
    }
  }

  async refineDescription(
    repo: Repository,
    currentDescription: string,
    feedback: string
  ): Promise<LLMResponse> {
    const prompt = this.buildRefinePrompt(repo, currentDescription, feedback);
    const model = this.getGenerateModels()[0]; // Use first model (Gemini) for refinement

    try {
      const response = await this.callLLM(model, prompt);
      const refined = this.extractDescription(response);

      if (!refined || refined.trim().length === 0) {
        throw new Error('Generated refinement is empty');
      }

      return {
        model: model.name,
        description: refined,
      };
    } catch (error: any) {
      throw new Error(`Refinement failed: ${error.message}`);
    }
  }

  async improveMultipleDescriptions(repo: Repository, currentDescription: string): Promise<LLMResponse[]> {
    const models = this.getImproveModels();
    const spinner = ora('Generating improvements with multiple AI models in parallel...').start();

    try {
      const settledResults = await Promise.allSettled(
        models.map(model => this.improveDescription(repo, currentDescription, model))
      );

      const results: LLMResponse[] = [];
      const errors: string[] = [];

      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const errorMessage = result.reason?.message || String(result.reason) || 'Unknown error';
          // Error message already includes model name from improveDescription
          errors.push(errorMessage);
          console.error(chalk.red(`\n⚠️  ${errorMessage}`));
        }
      });

      if (results.length === 0) {
        spinner.fail('All models failed to generate improvements');
        throw new Error(`All models failed:\n${errors.join('\n')}`);
      }

      if (errors.length > 0) {
        spinner.stop();
        console.log(chalk.yellow(`⚠️  Generated ${chalk.green(results.length)}/${chalk.yellow(models.length)} improvement suggestions (${chalk.red(errors.length)} failed)`));
      } else {
        spinner.succeed(`Generated ${chalk.green(results.length)} improvement suggestions`);
      }

      return results;
    } catch (error: any) {
      spinner.fail('Failed to generate improvements');
      throw error;
    }
  }

  private async callLLM(model: LLMConfig, prompt: string): Promise<string> {
    try {
      // Gemini models may use reasoning tokens, so increase max_tokens significantly
      // Reasoning tokens don't count toward content, so we need extra room
      const isGemini = model.model.includes('gemini');
      const maxTokens = isGemini ? 1000 : 200;

      // For Gemini models, add system message to encourage direct output
      const messages = isGemini
        ? [
          {
            role: 'system',
            content: 'You are a helpful assistant. Provide direct, concise answers without extensive reasoning or thinking process.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ]
        : [
          {
            role: 'user',
            content: prompt,
          },
        ];

      const response = await axios.post(
        this.baseURL,
        {
          model: model.model,
          messages,
          temperature: model.temperature || 0.7,
          max_tokens: maxTokens,
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

      const message = response.data.choices?.[0]?.message;
      let content = message?.content;
      const finishReason = response.data.choices?.[0]?.finish_reason;
      const hitTokenLimit = finishReason === 'length' || finishReason === 'MAX_TOKENS';

      // Handle Gemini models that may return content in reasoning field when hitting token limits
      if ((!content || content.trim().length === 0) && message?.reasoning) {
        const reasoning = message.reasoning;

        // Use Claude to extract the actual description from Gemini's reasoning text
        // This harness ensures we get a proper description even when Gemini returns reasoning
        try {
          content = await this.extractDescriptionFromReasoning(reasoning, prompt);
        } catch (harnessError: any) {
          // If harness fails, fall back to pattern-based extraction
          content = this.fallbackExtractFromReasoning(reasoning);
        }
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        // Debug logging for empty responses
        console.error(chalk.yellow(`\n[DEBUG] ${model.name} - Raw API response:`));
        console.error(chalk.gray(JSON.stringify(response.data, null, 2)));
        throw new Error('API returned empty or invalid response');
      }

      return content;
    } catch (error: any) {
      // If it's our own validation error, re-throw as-is
      if (error.message === 'API returned empty or invalid response') {
        throw error;
      }
      // Handle axios errors
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${error.response.data.error?.message || 'Unknown error'}`);
      }
      // Handle network errors
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

  private buildRefinePrompt(repo: Repository, currentDescription: string, feedback: string): string {
    return `You are an expert at refining GitHub repository descriptions based on user feedback.

Repository: ${repo.name}
Primary Language: ${repo.language || 'Not specified'}
Topics: ${repo.topics.join(', ') || 'None'}
Stars: ${repo.stargazers_count}

Current Description:
"${currentDescription}"

User Feedback:
"${feedback}"

Task: Refine the description based on the user's feedback. Apply the requested changes while maintaining:
- Conciseness (100-150 characters ideal)
- Clarity and professionalism
- Accurate representation of the repository
- Engaging language

Return ONLY the refined description text, nothing else.`;
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

  /**
   * Harness: Use Claude to extract the actual description from Gemini's reasoning text
   * This ensures we get a proper description even when Gemini returns thinking process
   */
  private async extractDescriptionFromReasoning(reasoning: string, originalPrompt: string): Promise<string> {
    try {
      // Use Claude to extract the actual description from reasoning
      const extractionPrompt = `A language model was asked to write a GitHub repository description, but instead returned its thinking process/reasoning.

Original task: ${originalPrompt.substring(0, 500)}

Reasoning/thinking process returned:
${reasoning.substring(0, 2000)}

Your task: Extract the ACTUAL repository description that the model should have written. 
- Ignore all thinking process, analysis, or meta-commentary
- Extract only the final, concise description (100-150 characters)
- Return ONLY the description text, nothing else
- If no clear description is found, write a concise description based on the original task`;

      const response = await axios.post(
        this.baseURL,
        {
          model: 'anthropic/claude-sonnet-4.5',
          messages: [
            {
              role: 'user',
              content: extractionPrompt,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent extraction
          max_tokens: 200,
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

      const extracted = response.data.choices?.[0]?.message?.content;
      if (extracted && extracted.trim().length > 10) {
        return this.extractDescription(extracted);
      }

      throw new Error('Harness extraction returned empty result');
    } catch (error: any) {
      throw new Error(`Harness extraction failed: ${error.message}`);
    }
  }

  /**
   * Fallback extraction using pattern matching when harness fails
   */
  private fallbackExtractFromReasoning(reasoning: string): string {
    // Remove markdown headers and thinking markers
    let cleaned = reasoning.replace(/\*\*[^*]+\*\*/g, '').trim();

    // Look for quoted text or final sentences that look like descriptions
    const quotedMatch = reasoning.match(/"([^"]{20,150})"/);
    if (quotedMatch) {
      return quotedMatch[1].trim();
    }

    // Split into sentences and filter out thinking process
    const sentences = cleaned.split(/[.!?]\s+/).map((s: string) => s.trim()).filter((s: string) => {
      const lower = s.toLowerCase();
      return s.length >= 20 &&
        s.length <= 200 &&
        !lower.includes('i\'m') &&
        !lower.includes('i\'ve') &&
        !lower.includes('i am') &&
        !lower.includes('considering') &&
        !lower.includes('analyzing') &&
        !lower.includes('narrowed it down') &&
        !lower.includes('confirmed the character');
    });

    if (sentences.length > 0) {
      // Prefer shorter, more direct sentences
      const best = sentences
        .filter((s: string) => s.length >= 30 && s.length <= 150)
        .sort((a: string, b: string) => a.length - b.length)[0] || sentences[sentences.length - 1];

      return best.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    }

    // Last resort: return a truncated version
    return reasoning.substring(0, 150).replace(/\*\*/g, '').trim();
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
