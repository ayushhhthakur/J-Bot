# Contributing to J-Bot

Thank you for your interest in contributing to J-Bot! 🎉

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

### Suggesting Features

Feature suggestions are welcome! Please:
- Check existing issues first
- Describe the feature and use case
- Explain why it would be useful

### Code Contributions

1. **Fork the repository**

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Test your changes locally

4. **Commit your changes**
   ```bash
   git commit -m "Add: brief description of changes"
   ```
   
   Use prefixes:
   - `Add:` for new features
   - `Fix:` for bug fixes
   - `Update:` for improvements
   - `Docs:` for documentation

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Development Setup

1. Install dependencies: `npm install`
2. Copy `local.settings.example.json` to `local.settings.json`
3. Add your Telegram credentials
4. Start Azurite: `azurite`
5. Run locally: `npm start`

## Code Style

- Use meaningful variable names
- Add JSDoc comments for functions
- Keep functions focused and small
- Use async/await for async operations
- Handle errors gracefully

## Testing

Before submitting:
- Test locally with real job APIs
- Verify Telegram notifications work
- Check that filtering logic works correctly
- Ensure no sensitive data is exposed

## Questions?

Feel free to open an issue for any questions!
