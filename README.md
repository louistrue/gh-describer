# 🚀 GitHub Repository Describer CLI

A powerful, interactive CLI tool that uses multiple AI models to generate and improve GitHub repository descriptions. Never struggle with writing compelling repo descriptions again!

## ✨ Features

- 🤖 **Multi-LLM Support**: Leverages OpenAI GPT-4, Claude Sonnet 4.5, and Google Gemini for diverse, high-quality suggestions
- 📊 **Two Modes of Operation**:
  - **Generate Mode**: Create descriptions for repositories without descriptions
  - **Improve Mode**: Enhance existing repository descriptions
- 🔍 **Deep Repository Analysis**: Scans all files (not just README) to understand your project
- 💬 **Interactive UI**: Beautiful, user-friendly interface with rich formatting
- ✏️ **Full Control**: Review, edit, and refine AI suggestions before applying
- 📦 **Batch Processing**: Process multiple repositories efficiently
- 🎯 **Smart File Detection**: Automatically identifies and analyzes important files (package.json, Cargo.toml, setup.py, etc.)
- 🎨 **Side-by-Side Comparison**: Compare current and suggested descriptions easily

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- A GitHub Personal Access Token
- An OpenRouter API Key

## 🛠️ Installation

### Option 1: Clone and Install Locally

```bash
# Clone the repository
git clone https://github.com/yourusername/gh-describer.git
cd gh-describer

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Option 2: Run with npx (coming soon)

```bash
npx gh-describer
```

## ⚙️ Setup

### 1. Get API Keys

#### GitHub Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (for private repositories)
   - OR `public_repo` (for public repositories only)
4. Generate and copy the token

#### OpenRouter API Key
1. Visit https://openrouter.ai/keys
2. Sign up or log in
3. Create a new API key
4. Copy the key

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
GITHUB_TOKEN=your_github_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
GITHUB_USERNAME=your_github_username  # Optional
```

## 🎮 Usage

### Generate Mode

Generate descriptions for repositories without descriptions.

#### Interactive Mode (Recommended)
```bash
gh-describer generate
```

Features:
- Select repositories from a list
- View AI-generated suggestions from multiple models
- Edit or combine suggestions
- Preview before applying

#### Batch Mode
```bash
gh-describer generate --batch
```

Quickly process all repositories without descriptions.

### Improve Mode

Suggest improvements for existing repository descriptions.

#### Interactive Mode
```bash
gh-describer improve
```

Features:
- Compare current vs. suggested descriptions
- Get insights from 3 different AI models
- Review reasoning behind each suggestion
- Apply, customize, or skip changes

#### Batch Mode
```bash
gh-describer improve --batch
```

Process multiple repositories with review queue.

### Additional Options

```bash
# Target a specific GitHub user's repositories
gh-describer generate --username octocat
gh-describer improve --username octocat

# Combine options
gh-describer generate --batch --username myorg
```

## 📖 Examples

### Example 1: Interactive Generation

```bash
$ gh-describer generate

╔════════════════════════════════════════════╗
║     GitHub Repository Describer CLI      ║
║   Powered by Multiple AI Models 🤖       ║
╚════════════════════════════════════════════╝

✔ Authenticated as username
✔ Found 15 repositories

? Select a repository to generate a description: my-awesome-project

📦 Analyzing my-awesome-project...

✨ AI-Generated Suggestions:

1. OpenAI GPT-4 Turbo:
A modern, fast web scraper built with TypeScript and Puppeteer for extracting structured data

2. Claude Sonnet 4.5:
TypeScript-based web scraping tool with built-in retry logic and headless browser automation

? What would you like to do?
❯ Use suggestion 1 from OpenAI GPT-4 Turbo
  Use suggestion 2 from Claude Sonnet 4.5
  ──────────────
  Edit/combine suggestions
  Skip this repository
```

### Example 2: Batch Improvement

```bash
$ gh-describer improve --batch

╔════════════════════════════════════════════╗
║     GitHub Repository Describer CLI      ║
║   Powered by Multiple AI Models 🤖       ║
╚════════════════════════════════════════════╝

✔ Authenticated as username
✔ Found 42 repositories with descriptions

? This will analyze and improve descriptions for 42 repositories. Continue? Yes
? Select which AI model to use: Claude Sonnet 4.5
? Automatically apply improvements? No

[1/42] Processing my-awesome-project...
✔ Improvement generated

📋 Review 42 improvements:

📦 my-awesome-project
Before: A web scraper
After:  Production-ready TypeScript web scraper with Puppeteer, automatic retries, and proxy support

? Apply this improvement? Yes
✔ Updated my-awesome-project
```

## 🏗️ Architecture

```
src/
├── commands/
│   ├── generate.ts      # Generate descriptions command
│   └── improve.ts       # Improve descriptions command
├── services/
│   ├── github.ts        # GitHub API integration
│   ├── openrouter.ts    # OpenRouter/LLM integration
│   └── analyzer.ts      # Repository analysis logic
├── utils/
│   ├── ui.ts           # UI/UX utilities and formatting
│   └── config.ts       # Configuration management
├── types/
│   └── index.ts        # TypeScript type definitions
└── index.ts            # CLI entry point
```

## 🤖 AI Models Used

### Generate Mode (2 models)
- **OpenAI GPT-4 Turbo**: Excellent at understanding code patterns and writing clear descriptions
- **Claude Sonnet 4.5**: Strong at analyzing project structure and technical details

### Improve Mode (3 models)
- **OpenAI GPT-4 Turbo**: Provides creative improvements with marketing appeal
- **Claude Sonnet 4.5**: Focuses on technical accuracy and clarity
- **Google Gemini Pro 1.5**: Offers unique perspectives and SEO optimization

## 🎨 UI/UX Features

- **Colorful Output**: Uses chalk for beautiful, readable terminal output
- **Progress Indicators**: Ora spinners for long-running operations
- **Formatted Tables**: cli-table3 for organized data display
- **Interactive Prompts**: @inquirer/prompts for smooth user interactions
- **Before/After Comparison**: Visual comparison of descriptions
- **Batch Processing Results**: Comprehensive summary tables

## 🔒 Security & Privacy

- Tokens are loaded from `.env` and never logged or exposed
- Only reads repository metadata and file contents (no write access to code)
- All API calls use HTTPS
- Repository data is sent to OpenRouter API for AI processing
- No data is stored persistently by this tool

## 🛣️ Roadmap

- [ ] Support for more AI models (Llama, Mistral, etc.)
- [ ] Custom prompt templates
- [ ] Export suggestions to file before applying
- [ ] Repository description templates by category
- [ ] Analytics on description improvements (stars, forks impact)
- [ ] Integration with GitHub Actions
- [ ] Support for organization repositories
- [ ] Description A/B testing suggestions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🙏 Acknowledgments

- [Octokit](https://github.com/octokit/octokit.js) for GitHub API integration
- [OpenRouter](https://openrouter.ai) for multi-LLM access
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) for interactive prompts
- [Chalk](https://github.com/chalk/chalk) for terminal styling

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/gh-describer/issues) page
2. Create a new issue with detailed information
3. Include error messages and environment details

---

Made with ❤️ by developers, for developers
