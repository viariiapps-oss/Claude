import { z } from "zod";
import { CURRENCY_CODES } from "@/config/site";
import { apiHandler, HttpError, optionsHandler, parseQuery } from "@/lib/api";
import { getCurrencyRates } from "@/services/currency/currency.service";

const codes = CURRENCY_CODES as [string, ...string[]];
const query = z.object({
  amount: z.coerce.number().finite().min(0).max(1e15).optional(),
  from: z.enum(codes).default("USD"),
  to: z.enum(codes).optional(),
});

/** GET /api/currency[?amount=100&from=USD&to=EUR] — USD-based FX rates and optional conversion. */
export const GET = apiHandler(
  async (req) => {
    const { amount, from, to } = parseQuery(req, query);
    const rates = await getCurrencyRates();
    if (amount === undefined || !to) return rates;
    const rFrom = rates.rates[from];
    const rTo = rates.rates[to];
    if (!rFrom || !rTo) throw new HttpError(422, "Rate unavailable for the requested currency");
    return { ...rates, conversion: { amount, from, to, result: (amount / rFrom) * rTo, rate: rTo / rFrom } };
  },
  { cacheSeconds: 300, name: "currency" },
);

export const OPTIONS = optionsHandler();
