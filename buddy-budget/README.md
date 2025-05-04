# Buddy Budget

Buddy Budget is a web application designed to help users manage their personal finances, track expenses and income, and monitor their overall wealth. With a focus on comprehensive financial tracking, it helps manage investments, retirement plans, mortgages, and other long-term financial commitments. Built with Next.js, Prisma, and MongoDB.

## ✨ Current Features

*   **Account Management:** Add and manage various types of financial accounts (e.g., bank accounts, investment accounts).
*   **Category Tracking:** Define custom income and expense categories to understand spending patterns.
*   **Networth Track:** Periodically capture the total value of your assets for wealth tracking over time.
*   **User Authentication:** Secure user accounts with email/password and OAuth (Google, GitHub, Apple) options.
*   **Currency & Date Formatting:** Customize primary currency, multi-currency support with automatic exchange rates, and date display preferences.
*   **User Onboarding:** Guided setup for new users.
*   **Support System:** Integrated support ticket system for user assistance.
*   **Multi-Language Support:** Internationalization (i18n) support with English as the default language, ready for additional language implementations.


## 🚀 Getting Started

### Prerequisites

*   Node.js (Check `package.json` for version, though not explicitly specified)
*   Bun (Optional, can use npm or yarn)
*   MongoDB instance

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd buddy-budget
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    # or
    # npm install
    # or
    # yarn install
    ```
3.  **Set up environment variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Fill in the required values in the `.env` file:
        *   `DATABASE_URL`: Your MongoDB connection string.
        *   `RESEND_API_KEY`: Your API key from Resend for sending emails.
        *   `NEXTAUTH_SECRET`: A secret key for NextAuth session encryption (generate a strong random string).
        *   `NEXTAUTH_URL`: The base URL of your deployed application (e.g., `http://localhost:3000` for development).
        *   OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.) if you want to enable those login methods.

4.  **Set up the database:**
    *   Ensure your MongoDB server is running.
    *   Generate Prisma Client:
        ```bash
        npx prisma generate
        ```

### Running the Application

1.  **Start the development server:**
    ```bash
    bun run dev
    # or
    # npm run dev
    # or
    # yarn dev
    ```
2.  Open your browser and navigate to `http://localhost:3000` (or the port specified).

## 🛠️ Built With

*   **Framework:** [Next.js](https://nextjs.org/)
*   **ORM:** [Prisma](https://www.prisma.io/)
*   **Database:** [MongoDB](https://www.mongodb.com/)
*   **Authentication:** [NextAuth.js](https://next-auth.js.org/)
*   **UI Components:** [Radix UI](https://www.radix-ui.com/) / [shadcn/ui](https://ui.shadcn.com/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Email:** [Resend](https://resend.com/)
*   **Forms:** [React Hook Form](https://react-hook-form.com/)
*   **Schema Validation:** [Zod](https://zod.dev/)
*   **Stock Data:** [yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2)

## 🗺️ Roadmap

### Core Features
*   ⚪️ [ ] Expense & Income Management
    * Add, edit and categorize transactions
    * Recurring transactions support
    * Multi-currency support
    * Detailed spending analytics and reports

### Budgeting
*   ⚪️ [ ] Budget Planning & Tracking
    * Create custom budgets by category
    * Progress tracking and alerts
    * Spending pattern analysis
    * Future projections based on habits

### Investments
*   ⚪️ [ ] Stock Market Tracking
    * Individual stock analysis
    * Dividend tracking and projections
    * Bond investments monitoring
    * Portfolio performance analytics

*   ⚪️ [ ] Cryptocurrency Support
    * Multi-coin wallet tracking
    * Price monitoring
    * Transaction history
    * Portfolio performance

### Real Estate & Loans
*   ⚪️ [ ] Property Management
    * Real estate portfolio tracking
    * Mortgage management
    * Property value tracking
    * Rental income monitoring

### Retirement Planning
*   ⚪️ [ ] Pension & Retirement Tools
    * Retirement plan tracking
    * Future value projections
    * Multiple scenarios modeling
    * Goal-based planning

### Analytics & Reporting
*   ⚪️ [ ] Advanced Analytics
    * Comprehensive spending reports
    * Investment performance analysis
    * Net worth tracking
    * Future projections across all assets

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines (TODO: Create `CONTRIBUTING.md`) before submitting pull requests.

## 📄 License


