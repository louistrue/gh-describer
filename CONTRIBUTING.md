# Contributing to GitHub Repository Describer CLI

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/gh-describer.git
   cd gh-describer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Build the Project**
   ```bash
   npm run build
   ```

5. **Run in Development**
   ```bash
   npm run dev -- generate
   npm run dev -- improve
   ```

## Project Structure

```
src/
├── commands/        # CLI command implementations
├── services/        # Business logic (GitHub, OpenRouter, Analyzer)
├── utils/           # Utility functions (UI, config)
├── types/           # TypeScript type definitions
└── index.ts         # CLI entry point
```

## Coding Standards

- **TypeScript**: Use strict typing, avoid `any` when possible
- **Formatting**: Follow existing code style
- **Functions**: Keep functions focused and single-purpose
- **Comments**: Add comments for complex logic
- **Error Handling**: Always handle errors gracefully with user-friendly messages

## Adding New Features

### Adding a New LLM Model

1. Edit `src/services/openrouter.ts`
2. Add model to `getGenerateModels()` or `getImproveModels()`
3. Test with various repository types

### Adding a New Command

1. Create file in `src/commands/`
2. Export command function
3. Register in `src/index.ts`
4. Update README with usage examples

### Improving UI/UX

1. Edit `src/utils/ui.ts` for display functions
2. Use chalk for colors, ora for spinners, cli-table3 for tables
3. Test on different terminal sizes

## Testing

Currently, this project doesn't have automated tests. Contributions to add testing infrastructure are welcome!

Manual testing checklist:
- [ ] Test `generate` command in interactive mode
- [ ] Test `generate --batch` command
- [ ] Test `improve` command in interactive mode
- [ ] Test `improve --batch` command
- [ ] Test with repositories of different languages
- [ ] Test error handling (invalid tokens, network issues)
- [ ] Test with various terminal widths

## Submitting Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clear, concise commit messages
   - Keep commits focused on single changes

3. **Test Thoroughly**
   - Build the project: `npm run build`
   - Test all affected commands
   - Verify no TypeScript errors

4. **Submit Pull Request**
   - Describe what your PR does
   - Reference any related issues
   - Include screenshots for UI changes

## Areas for Contribution

We welcome contributions in these areas:

- 🧪 **Testing**: Add unit tests, integration tests
- 📚 **Documentation**: Improve README, add tutorials
- 🎨 **UI/UX**: Enhance terminal UI, add themes
- 🤖 **AI Models**: Support more LLM providers
- 🔧 **Features**: Custom prompts, templates, analytics
- 🐛 **Bug Fixes**: Fix reported issues
- ♿ **Accessibility**: Improve screen reader support

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the project
- Welcome newcomers and help them learn

## Questions?

Feel free to open an issue for:
- Questions about the codebase
- Suggestions for improvements
- Bugs or issues you've found

Thank you for contributing! 🎉
