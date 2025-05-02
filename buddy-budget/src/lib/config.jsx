import { Wallet, CreditCard, Building, Landmark, PiggyBank, ShoppingBag, Coffee, Home, Car, Plane, Utensils, Smartphone, Heart, Book, Music, Zap, Droplet, DollarSign, Briefcase, Gift, Award, TrendingUp, Dumbbell, Scissors, Gamepad, Shirt, Dog, Baby, Bus, Phone, Youtube } from "lucide-react"

const APP_NAME = "Buddy Budget"
const APP_DOMAIN_NAME = "buddybudget.net"
const SUPPORT_EMAIL_NAME = "support"
const AUTH_EMAIL_NAME = "auth"

export const config = {
    appName: APP_NAME,
    appDomainName: APP_DOMAIN_NAME,
    supportEmail: `${SUPPORT_EMAIL_NAME}@${APP_DOMAIN_NAME}`,
    authenticationEmail: `${AUTH_EMAIL_NAME}@${APP_DOMAIN_NAME}`
}

export const currencies = [
    { code: "USD", name: "United States Dollar ($)" },
    { code: "EUR", name: "Euro (€)" },
    { code: "GBP", name: "British Pound (£)" },
    { code: "CAD", name: "Canadian Dollar ($)" },
    { code: "AUD", name: "Australian Dollar ($)" },
    { code: "NZD", name: "New Zealand Dollar ($)" },
    { code: "CHF", name: "Swiss Franc (CHF)" },

]

export const dateFormats = [
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
    { value: "YYYY/MM/DD", label: "YYYY/MM/DD" },
    { value: "YY/DDD", label: "YY/DDD" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
    { value: "DD.MM.YYYY", label: "DD.MM.YYYY" },
]

export const accountIcons = [
    { value: "wallet", icon: <Wallet className="h-5 w-5" /> },
    { value: "credit-card", icon: <CreditCard className="h-5 w-5" /> },
    { value: "building", icon: <Building className="h-5 w-5" /> },
    { value: "landmark", icon: <Landmark className="h-5 w-5" /> },
    { value: "piggy-bank", icon: <PiggyBank className="h-5 w-5" /> },
]

export const accountTypes = (translation) => {
    return [
        { value: "checking", label: translation("accountTypes.checking") },
        { value: "savings", label: translation("accountTypes.savings") },
        { value: "credit", label: translation("accountTypes.credit") },
        { value: "investment", label: translation("accountTypes.investment") },
        { value: "cash", label: translation("accountTypes.cash") },
    ]
}

export const expenseIcons = [
    { value: "shopping-bag", icon: <ShoppingBag className="h-4 w-4" />, label: "Shopping" },
    { value: "coffee", icon: <Coffee className="h-4 w-4" />, label: "Coffee" },
    { value: "home", icon: <Home className="h-4 w-4" />, label: "Home" },
    { value: "car", icon: <Car className="h-4 w-4" />, label: "Car" },
    { value: "plane", icon: <Plane className="h-4 w-4" />, label: "Travel" },
    { value: "utensils", icon: <Utensils className="h-4 w-4" />, label: "Food" },
    { value: "smartphone", icon: <Smartphone className="h-4 w-4" />, label: "Tech" },
    { value: "heart", icon: <Heart className="h-4 w-4" />, label: "Health" },
    { value: "book", icon: <Book className="h-4 w-4" />, label: "Education" },
    { value: "music", icon: <Music className="h-4 w-4" />, label: "Entertainment" },
    { value: "zap", icon: <Zap className="h-4 w-4" />, label: "Utilities" },
    { value: "droplet", icon: <Droplet className="h-4 w-4" />, label: "Water" },
    { value: "dumbbell", icon: <Dumbbell className="h-4 w-4" />, label: "Fitness" },
    { value: "scissors", icon: <Scissors className="h-4 w-4" />, label: "Beauty" },
    { value: "gamepad", icon: <Gamepad className="h-4 w-4" />, label: "Gaming" },
    { value: "shirt", icon: <Shirt className="h-4 w-4" />, label: "Clothing" },
    { value: "pet", icon: <Dog className="h-4 w-4" />, label: "Pets" },
    { value: "baby", icon: <Baby className="h-4 w-4" />, label: "Children" },
    { value: "bus", icon: <Bus className="h-4 w-4" />, label: "Transport" },
    { value: "phone", icon: <Phone className="h-4 w-4" />, label: "Phone" }
]

export const incomeIcons = [
    { value: "dollar-sign", icon: <DollarSign className="h-4 w-4" />, label: "Salary" },
    { value: "briefcase", icon: <Briefcase className="h-4 w-4" />, label: "Work" },
    { value: "gift", icon: <Gift className="h-4 w-4" />, label: "Gift" },
    { value: "home", icon: <Home className="h-4 w-4" />, label: "Rent" },
    { value: "zap", icon: <Zap className="h-4 w-4" />, label: "Bonus" },
    { value: "trending-up", icon: <TrendingUp className="h-4 w-4" />, label: "Investments" },
    { value: "award", icon: <Award className="h-4 w-4" />, label: "Awards" },
    { value: "heart", icon: <Heart className="h-4 w-4" />, label: "Support" },
    { value: "book", icon: <Book className="h-4 w-4" />, label: "Royalties" },
    { value: "youtube", icon: <Youtube className="h-4 w-4" />, label: "Content" }
]

// Default categories with icons
export const defaultExpenseCategories = [
    { name: "food_dining", color: "#2563eb", icon: "utensils" },
    { name: "transportation", color: "#0ea5e9", icon: "car" },
    { name: "housing", color: "#8b5cf6", icon: "home" },
    { name: "entertainment", color: "#f59e0b", icon: "music" },
    { name: "shopping", color: "#ec4899", icon: "shopping-bag" },
    { name: "utilities", color: "#6366f1", icon: "zap" },
    { name: "healthcare", color: "#ef4444", icon: "heart" },
    { name: "education", color: "#0891b2", icon: "book" },
    { name: "fitness", color: "#84cc16", icon: "dumbbell" },
    { name: "beauty_care", color: "#f472b6", icon: "scissors" },
    { name: "gaming", color: "#7c3aed", icon: "gamepad" },
    { name: "clothing", color: "#ea580c", icon: "shirt" },
    { name: "pets", color: "#a16207", icon: "pet" },
    { name: "children", color: "#be185d", icon: "baby" },
    { name: "public_transport", color: "#15803d", icon: "bus" }
]

export const defaultIncomeCategories = [
    { name: "salary", color: "#2563eb", icon: "dollar-sign" },
    { name: "investments", color: "#0ea5e9", icon: "trending-up" },
    { name: "freelance", color: "#8b5cf6", icon: "briefcase" },
    { name: "gifts", color: "#f59e0b", icon: "gift" },
    { name: "rental_income", color: "#84cc16", icon: "home" },
    { name: "awards_bonuses", color: "#7c3aed", icon: "award" },
    { name: "support_donations", color: "#ef4444", icon: "heart" },
    { name: "royalties", color: "#0891b2", icon: "book" },
    { name: "content_creation", color: "#ea580c", icon: "youtube" }
]

export const formatDate = (date, format, language) => {
    try {
        if (!date) return "Invalid Date";

        const day = date.getDate();
        const month = date.getMonth() + 1; // getMonth() returns 0-11
        const year = date.getFullYear();
        const shortYear = year.toString().slice(-2);
        const dayOfYear = getDayOfYear(date);

        switch (format) {
            case "DD/MM/YYYY":
                return `${padZero(day)}/${padZero(month)}/${year}`;
            case "YYYY/MM/DD":
                return `${year}/${padZero(month)}/${padZero(day)}`;
            case "YY/DDD":
                return `${shortYear}/${padZero(dayOfYear, 3)}`;
            case "YYYY-MM-DD":
                return `${year}-${padZero(month)}-${padZero(day)}`;
            case "MM/DD/YYYY":
                return `${padZero(month)}/${padZero(day)}/${year}`;
            case "DD.MM.YYYY":
                return `${padZero(day)}.${padZero(month)}.${year}`;
            default:
                // Fallback to browser's Intl API
                return new Intl.DateTimeFormat(language || 'en-US').format(date);
        }
    } catch (error) {
        return "Invalid Date";
    }
}

// Helper function to pad with zeros
const padZero = (num, places = 2) => {
    return String(num).padStart(places, '0');
}

// Helper function to get day of year (1-366)
const getDayOfYear = (date) => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

export const formatCurrency = (amount, currency, language) => {
    // Add specific fixed options while preserving language support
    try {
        return new Intl.NumberFormat(language || 'en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)
    } catch (error) {
        return "0.00"
    }
}

