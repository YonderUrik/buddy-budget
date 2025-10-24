<div align="center">

# Buddy Budget

### Your Personal Finance Companion

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/YonderUrik/buddy-budget/actions/workflows/ci.yml/badge.svg)](https://github.com/YonderUrik/buddy-budget/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
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
- **Privacy-First** - Your financial data stays with you
- **Modern UX** - Beautiful, responsive design with dark mode support

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

> Add screenshots or GIFs of your application here

```bash
# Quick preview
bun dev
# Open http://localhost:3000
```

---

## Tech Stack

### Frontend
- **[Next.js 15.3](https://nextjs.org/)** - React framework with App Router
- **[React 18.3](https://react.dev/)** - UI library
- **[TypeScript 5.6](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS 4.1](https://tailwindcss.com/)** - Utility-first styling
- **[HeroUI 2.8](https://www.heroui.com/)** - Comprehensive UI components
- **[Framer Motion](https://www.framer.com/motion/)** - Smooth animations

### Data & APIs
- **[Yahoo Finance2](https://www.npmjs.com/package/yahoo-finance2)** - Real-time stock market data
- **[Recharts](https://recharts.org/)** - Interactive data visualizations

### Development
- **[Turbopack](https://turbo.build/)** - Lightning-fast bundler
- **[ESLint](https://eslint.org/)** - Code quality
- **[Prettier](https://prettier.io/)** - Code formatting
- **[Bun](https://bun.sh/)** - Fast package manager and runtime

---

## Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **Bun** (recommended) or npm/yarn
- **Git**

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

## Project Structure

```
buddy-budget/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── stocks/        # Stock data endpoints
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # App providers
│
├── components/            # React components
│   ├── ui/               # UI primitives & animations
│   ├── yahoo-finance/    # Stock tracking components
│   ├── nw_predictor/     # Net Worth Predictor
│   ├── navbar.tsx        # Navigation
│   └── footer.tsx        # Footer
│
├── config/               # Configuration
│   ├── site.ts          # Site metadata
│   └── fonts.ts         # Font configuration
│
├── lib/                  # Utilities
├── styles/              # Global styles
└── types/               # TypeScript types
```

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

## Roadmap

- [ ] Expense tracking with smart categorization
- [ ] Budget management with AI insights
- [ ] Investment portfolio tracking
- [ ] Savings goals with milestones
- [ ] Mobile app (React Native)
- [ ] Cloud sync and backup
- [ ] Multi-user support
- [ ] API for third-party integrations
- [ ] Bank account integration (Plaid)
- [ ] Cryptocurrency tracking

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
