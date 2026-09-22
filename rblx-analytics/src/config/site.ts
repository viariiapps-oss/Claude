/** Client-safe site configuration (no secrets). */
export const siteConfig = {
  name: "RBLX Analytics",
  tagline: "Roblox Game Intelligence",
  description:
    "Explore player activity, visits, growth and estimated revenue across Roblox experiences.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  contactEmail: "hello@rblxanalytics.example",
  nav: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/games", label: "Games" },
    { href: "/trending", label: "Trending" },
    { href: "/revenue", label: "Revenue" },
    { href: "/developers", label: "Developers" },
    { href: "/compare", label: "Compare" },
    { href: "/about", label: "About" },
  ],
} as const;

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "KRW", name: "South Korean Won" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "INR", name: "Indian Rupee" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "SGD", name: "Singapore Dollar" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];
export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as CurrencyCode[];
