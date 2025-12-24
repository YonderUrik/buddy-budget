# Contributing to Buddy Budget

Thank you for your interest in contributing to Buddy Budget! We welcome contributions from the community and are excited to have you here.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. Please be kind and courteous in all interactions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Create a new branch for your contribution
5. Make your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- Bun (recommended) or npm/yarn
- Git

### Installation

1. Clone your fork of the repository:
```bash
git clone https://github.com/YonderUrik/buddy-budget.git
cd buddy-budget/buddy-budget
```

2. Install dependencies:
```bash
bun install
```

3. Run the development server:
```bash
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## How to Contribute

### Types of Contributions

- **Bug fixes**: Help us squash bugs and improve stability
- **New features**: Add new functionality to enhance the application
- **Documentation**: Improve or add documentation
- **UI/UX improvements**: Make the interface more intuitive and beautiful
- **Performance optimizations**: Help make the app faster and more efficient
- **Tests**: Add or improve test coverage

### Finding Issues to Work On

- Check the [Issues](https://github.com/YonderUrik/buddy-budget/issues) page
- Look for issues labeled `good first issue` if you're new to the project
- Issues labeled `help wanted` are great opportunities to contribute

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly:
   ```bash
   bun run build
   bun run lint
   ```

4. **Commit your changes** following our commit guidelines

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch with:
   - A clear title describing the change
   - A detailed description of what changed and why
   - Screenshots for UI changes
   - Reference any related issues (e.g., "Fixes #123")

7. **Wait for review** - maintainers will review your PR and may request changes

8. **Address feedback** if requested

9. Once approved, your PR will be merged!

## Coding Standards

### TypeScript/React

- Use TypeScript for all new files
- Follow React best practices and hooks guidelines
- Use functional components with hooks
- Prefer named exports over default exports
- Use meaningful variable and function names

### Code Style

- We use ESLint and Prettier for code formatting
- Run `bun run lint` to check your code
- Format code before committing
- Follow the existing code structure and patterns

### Component Structure

```typescript
// Component imports
import { ... } from "...";

// Type definitions
type ComponentProps = {
  // ...
};

// Component definition
export const ComponentName = ({ prop1, prop2 }: ComponentProps) => {
  // Hooks
  // Event handlers
  // Render logic

  return (
    // JSX
  );
};
```

### File Organization

- Components go in `/components`
- Pages go in `/app`
- Utilities go in `/lib`
- Configuration goes in `/config`
- Types go in `/types`

## Commit Guidelines

We follow conventional commit messages for clarity:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Examples

```
feat: add dark mode toggle to settings page
fix: resolve navigation issue on mobile devices
docs: update README with new setup instructions
style: format code with prettier
refactor: simplify authentication logic
test: add unit tests for budget calculator
chore: update dependencies
```

## Reporting Bugs

If you find a bug, please create an issue with:

1. **Clear title** describing the bug
2. **Description** of what happened vs. what you expected
3. **Steps to reproduce** the issue
4. **Screenshots** if applicable
5. **Environment details** (browser, OS, etc.)

## Suggesting Features

We welcome feature suggestions! Please create an issue with:

1. **Clear title** describing the feature
2. **Description** of the feature and its benefits
3. **Use cases** explaining when/why it would be useful
4. **Mockups or examples** if applicable

## Questions?

If you have questions about contributing, feel free to:

- Open an issue for discussion
- Check existing issues and discussions
- Reach out to the maintainers

## Support the Project

If you find this project helpful, please consider:

- Starring the repository
- Sharing it with others
- [Sponsoring the project](https://github.com/sponsors/YonderUrik)

Thank you for contributing to Buddy Budget!
