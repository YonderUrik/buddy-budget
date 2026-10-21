/** Setup copy and field metadata; secret fields are never shown in the terminal. */
export const SECTIONS = [
  { id: 'address', title: 'Your address', description: 'Where will you open BuddyBudget? This is also used for sign-in links and bank callbacks.', fields: [
    { name: 'APP_URL', label: 'Public URL', required: true, default: 'http://localhost:3000', help: 'Testing on this computer? Press Enter for http://localhost:3000. On a server, enter your HTTPS address, e.g. https://budget.example.com.' },
    { name: 'APP_PORT', label: 'Local port', required: true, default: '3000', help: 'The port Docker will use on this computer. Keep the suggested value for local testing; behind an HTTPS reverse proxy, 3000 is usually fine.' },
  ] },
  { id: 'openrouter', title: 'AI features', level: 'Recommended', description: 'Get AI category suggestions and import CSV files from unsupported banks and brokers.', needed: 'One OpenRouter API key from an account with credit. AI requests may have a cost.', skip: 'AI will be off. Manual categories, rules and standard imports will still work.', link: 'https://openrouter.ai/settings/keys', linkLabel: 'Create your API key', check: true, fields: [
    { name: 'OPENROUTER_API_KEY', label: 'OpenRouter API key', secret: true, required: true },
    { name: 'OPENROUTER_MODEL', label: 'CSV import model', default: 'deepseek/deepseek-v4.1-flash', advanced: true, help: 'Use a provider/model that supports JSON and zero data retention (ZDR).' },
    { name: 'CATEGORIZATION_MODEL', label: 'Category suggestion model', default: 'typesafe/jev-1.13', advanced: true },
  ] },
  { id: 'yahoo', title: 'Market prices', description: 'Yahoo Finance is already included. You do not need an account or an API key.', check: true, fields: [] },
  { id: 'resend', title: 'Sign-in emails and notifications', level: 'Recommended', description: 'Receive sign-in links by email, plus the summaries and alerts you choose in Settings.', needed: 'A Resend API key and a sender email address on a domain you have verified in Resend.', skip: 'Sign-in links will be available in the app logs. Email notifications will be off.', link: 'https://resend.com/api-keys', linkLabel: 'Create your API key', check: true, fields: [
    { name: 'RESEND_API_KEY', label: 'Resend API key', secret: true, required: true },
    { name: 'RESEND_FROM', label: 'Sender email address', required: true, help: 'Example: BuddyBudget <budget@example.com>. Use a domain verified in your Resend account.' },
  ] },
  { id: 'gocardless', title: 'Bank sync', level: 'Optional', description: 'Automatically sync your bank balances and transactions.', needed: 'A Secret ID and Secret key from GoCardless Bank Account Data.', skip: 'Use manual accounts and CSV imports instead.', link: 'https://bankaccountdata.gocardless.com/', linkLabel: 'Get your bank API credentials', fields: [
    { name: 'GOCARDLESS_SECRET_ID', label: 'GoCardless Secret ID', secret: true, required: true },
    { name: 'GOCARDLESS_SECRET_KEY', label: 'GoCardless Secret key', secret: true, required: true },
  ] },
  { id: 'google', title: 'Google sign-in', level: 'Optional', description: 'Sign in with Google instead of using a sign-in link.', needed: 'An OAuth Client ID and Client secret from Google Cloud.', skip: 'Sign in with a link instead.', link: 'https://console.cloud.google.com/apis/credentials', linkLabel: 'Create OAuth credentials', fields: [
    { name: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', required: true },
    { name: 'GOOGLE_CLIENT_SECRET', label: 'Google Client secret', secret: true, required: true },
  ] },
  { id: 'logos', title: 'Merchant and investment logos', level: 'Optional', description: 'Show logos from Logo.dev instead of local icons.', needed: 'A Logo.dev public key (pk_…). A secret key (sk_…) is optional for merchant searches.', skip: 'Local icons will still be available.', link: 'https://www.logo.dev/', linkLabel: 'Get your Logo.dev keys', fields: [
    { name: 'LOGODEV_PUBLISHABLE_KEY', label: 'Logo.dev public key (pk_…)', required: true },
    { name: 'LOGODEV_SECRET_KEY', label: 'Logo.dev search key (sk_…)', secret: true },
  ] },
  { id: 'prices', title: 'Additional price providers', level: 'Optional', description: 'Add backup providers. Yahoo and the other included sources already work without these keys.', needed: 'Only the keys for providers you already use. Press Enter to skip any provider.', fields: [
    { name: 'ALPHAVANTAGE_API_KEY', label: 'Alpha Vantage API key', secret: true, link: 'https://www.alphavantage.co/support/#api-key' },
    { name: 'TWELVEDATA_API_KEY', label: 'Twelve Data API key', secret: true, link: 'https://twelvedata.com/account/api-keys' },
    { name: 'STOOQ_API_KEY', label: 'Stooq API key', secret: true, link: 'https://stooq.com/' },
    { name: 'COINGECKO_API_KEY', label: 'CoinGecko API key', secret: true, link: 'https://www.coingecko.com/en/developers/dashboard' },
    { name: 'OPENFIGI_API_KEY', label: 'OpenFIGI API key', secret: true, link: 'https://www.openfigi.com/api' },
  ] },
  { id: 'ollama', title: 'Local AI portfolio comments', level: 'Optional', description: 'Use your own Ollama server for portfolio commentary. This does not replace OpenRouter for categories or CSV imports.', needed: 'An Ollama server URL reachable from the app container and an installed model name.', link: 'https://ollama.com/', linkLabel: 'Set up Ollama', fields: [
    { name: 'OLLAMA_BASE_URL', label: 'Ollama server URL', required: true },
    { name: 'OLLAMA_MODEL', label: 'Installed Ollama model', default: 'llama3.2' },
  ] },
  { id: 'support', title: 'Instance support reports', level: 'Optional', description: 'Receive reports from people using your installation. Nothing is sent to BuddyBudget support by default.', needed: 'An email inbox you manage. Requires email delivery from step 5.', requiresEmail: true, fields: [
    { name: 'SUPPORT_EMAIL_TO', label: 'Email address to receive reports', required: true },
  ] },
];

export const FIELDS = [
  ...SECTIONS.flatMap(section => section.fields),
  { name: 'SELFHOST_AUTH_MODE', default: 'server' },
  { name: 'SELFHOST_OWNER_EMAIL' },
  { name: 'APP_BIND', default: '127.0.0.1' },
];
export const DEFAULTS = Object.fromEntries(FIELDS.filter(field => field.default).map(field => [field.name, field.default]));
