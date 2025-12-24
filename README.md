<div align="center">

# Buddy Budget

### Your Personal Finance Companion

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Testing](https://github.com/YonderUrik/buddy-budget/actions/workflows/testing.yml/badge.svg)](https://github.com/YonderUrik/buddy-budget/actions/workflows/testing.yml)
[![Release](https://github.com/YonderUrik/buddy-budget/actions/workflows/release.yml/badge.svg)](https://github.com/YonderUrik/buddy-budget/actions/workflows/release.yml)
[![Deploy](https://github.com/YonderUrik/buddy-budget/actions/workflows/deploy.yml/badge.svg)](https://github.com/YonderUrik/buddy-budget/actions/workflows/deploy.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#features) • [Demo](#demo) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [Contributing](CONTRIBUTING.md) • [License](#license)

</div>

---

## About

**Buddy Budget** is a modern, open-source personal finance application that helps you take control of your financial future. Built with cutting-edge web technologies, it combines powerful financial tools with an intuitive, beautiful interface.

Whether you're tracking expenses, monitoring investments, or planning for retirement, Buddy Budget provides the insights and tools you need to make informed financial decisions.

### Why Buddy Budget?

- **100% Open Source** - Complete transparency and community-driven development
- **Real-Time Market Data** - Integration with Yahoo Finance for live stock tracking
- **Privacy-First** - Self-host to keep your financial data under your control
- **Modern UX** - Beautiful, responsive design with dark mode support

---

## Security & Privacy

### Data Storage

Buddy Budget is designed with flexibility in mind:

- **Hosted Version** - Use our hosted instance at [buddybudget.io](https://buddybudget.io) for quick access
- **Self-Hosted** - Deploy your own instance to maintain complete control over your financial data
- **No Vendor Lock-in** - Your data, your choice

### Security Features

- **Open Source Transparency** - Audit the entire codebase yourself
- **HTTPS Encryption** - All data transmitted over secure connections
- **Direct API Integration** - Connects directly to Yahoo Finance without intermediary proxies
- **Regular Updates** - Continuous security patches and dependency updates
- **Modern Security Practices** - Built with Next.js security best practices

### Self-Hosting Benefits

When you self-host Buddy Budget:
- Full control over your financial data
- Choose your own hosting provider
- Set your own data retention policies
- Complete privacy and data sovereignty
- Customize security settings to your requirements

See [Deployment](#deployment) section for self-hosting instructions.

---

## Features

### Currently Available

#### Net Worth Predictor
Advanced financial planning tool powered by Monte Carlo simulations:
- **1,000+ simulations** per projection for statistical accuracy
- **Box-Muller Transform** for normally-distributed random returns
- **Inflation adjustment** showing real purchasing power over time
- **Volatility modeling** capturing market uncertainty
- **Percentile analysis** (10th, 50th, 90th percentile outcomes)
- Interactive visualizations with comprehensive statistics

[Read the technical documentation](buddy-budget/components/nw_predictor/NET_WORTH_PREDICTOR_EXPLAINED.md)

#### Finance Tracker (Yahoo Finance Integration)
Real-time stock market tracking and analysis:
- **Stock Search** - Find stocks by symbol or company name
- **Interactive Charts** - Visual price history with multiple timeframes (1M, 3M, 6M, 1Y, 5Y, YTD, MAX)
- **Live Data** - Real-time prices, statistics, and market metrics
- **Company Details** - Comprehensive financial information, earnings, ownership data
- **Custom Intervals** - Daily, weekly, or monthly data views

### Coming Soon

- **Expense Tracking** - Smart categorization and spending insights
- **Smart Budgeting** - Adaptive budgets that learn from your patterns
- **Investment Portfolio** - Monitor and optimize your portfolio performance
- **Savings Goals** - Track progress toward financial milestones
- **Financial Reports** - Automated monthly and yearly financial summaries
- **Multi-Currency Support** - Track finances in 10+ currencies

---

## Demo

🚀 **[Live Demo: buddybudget.io](https://buddybudget.io)**

Try out Buddy Budget at [buddybudget.io](https://buddybudget.io) to see all features in action!

### Screenshots

#### Net Worth Predictor
Monte Carlo simulation for long-term financial planning with percentile analysis and inflation adjustments.

![Net Worth Predictor](docs/images/net-worth-predictor.png)
*Advanced Monte Carlo simulations showing 10th, 50th, and 90th percentile outcomes*

#### Stock Tracker
Real-time stock market data with interactive charts and comprehensive financial metrics.

![Stock Tracker](docs/images/stock-tracker.png)
*Live stock tracking with Yahoo Finance integration and multiple timeframes*

#### Portfolio Dashboard
Monitor your investments and track market trends in one unified dashboard.

![Dashboard](docs/images/dashboard.png)
*Clean, intuitive interface with dark mode support*

> **Note:** Screenshots represent the latest development version. UI may vary slightly.

### Local Development

```bash
# Quick preview
bun dev
# Open http://localhost:3000
```

---


## Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **Bun** (recommended) or npm/yarn
- **Git**

#### Browser Support

Buddy Budget works on all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YonderUrik/buddy-budget.git
   cd buddy-budget/buddy-budget
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run the development server**
   ```bash
   bun dev
   ```

4. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Configuration

Buddy Budget works out of the box without configuration. For advanced setups, create a `.env.local` file following the `.env.example` file:

**Note:** No API keys are required for basic functionality. Yahoo Finance integration works without authentication.

### Build for Production

```bash
# Create optimized production build
bun run build

# Start production server
bun start
```

### Code Quality

```bash
# Run linter
bun run lint

# Fix linting issues automatically
bun run lint --fix
```

### Testing

```bash
# Run all tests
bun test

# Run tests in watch mode (great for development)
bun run test:watch

# Run tests with coverage report
bun run test:coverage
```

See [Testing Documentation](buddy-budget/components/nw_predictor/TESTING.md) for detailed information.

---

## Deployment

### Automated Deployment to Vercel

This project uses automated deployments to [Vercel](https://vercel.com) triggered by releases:

- **Pull Requests** → Testing workflow validates code
- **Merge to main** → Semantic-release creates a new version and GitHub release
- **New Release** → Automatically deploys to production on Vercel

The deployment workflow is configured to:
- Deploy only on new releases (not on every commit)
- Use semantic versioning for release management
- Maintain production stability with automated testing

### Manual Deployment

To deploy manually:

1. Link your Vercel project:
   ```bash
   vercel link
   ```

2. Deploy to production:
   ```bash
   vercel --prod
   ```

For continuous deployment setup, see [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

---

## Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`bun test && bun run lint`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Support

### Get Help

- **Documentation** - [View Docs](https://github.com/YonderUrik/buddy-budget/wiki)
- **Issues** - [Report a bug](https://github.com/YonderUrik/buddy-budget/issues)
- **Discussions** - [Join the community](https://github.com/YonderUrik/buddy-budget/discussions)

### Show Your Support

If you find Buddy Budget helpful, please consider:

- Starring the repository
- Sharing it with others
- [Sponsoring the project](https://github.com/sponsors/YonderUrik)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with by the open-source community.

Special thanks to:
- [Next.js](https://nextjs.org/) team for the amazing framework
- [Vercel](https://vercel.com/) for hosting and deployment tools
- [HeroUI](https://www.heroui.com/) for the beautiful component library
- [Yahoo Finance](https://finance.yahoo.com/) for financial data
- All our [contributors](https://github.com/YonderUrik/buddy-budget/graphs/contributors)

---

</div>
