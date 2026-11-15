import { z } from "zod";
import { CurrencySchema, EcosystemSchema } from "./transaction.schema";
export { CurrencySchema, PaymentRailSchema, type Currency, type PaymentRail } from "./transaction.schema";

export const EcosystemIdSchema = EcosystemSchema;
export type EcosystemId = z.infer<typeof EcosystemIdSchema>;

export const DirectionSchema = z.enum(["ltr", "rtl"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const LocaleSchema = z.enum(["en", "fa"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const EcosystemConfigSchema = z.strictObject({
  id: EcosystemIdSchema,
  name: z.string(),
  subtitle: z.string(),
  locale: LocaleSchema,
  direction: DirectionSchema,
  currency: CurrencySchema,
  currencySymbol: z.string(),
  primaryGateway: z.string(),
  bnplProvider: z.string(),
  fontFamily: z.string(),
  requiresVpnCheck: z.boolean(),
});
export type EcosystemConfig = z.infer<typeof EcosystemConfigSchema>;

export const ECOSYSTEM_CONFIGS: Record<EcosystemId, EcosystemConfig> = {
  GLOBAL_STRIPE: {
    id: "GLOBAL_STRIPE",
    name: "Global Fintech Rails",
    subtitle: "Tier-1 Stripe Acquiring & Klarna BNPL",
    locale: "en",
    direction: "ltr",
    currency: "USD",
    currencySymbol: "$",
    primaryGateway: "Stripe Payment Intents",
    bnplProvider: "Klarna Pay in 4",
    fontFamily: "var(--primitive-font-en)",
    requiresVpnCheck: false,
  },
  IRAN_SHAPARAK: {
    id: "IRAN_SHAPARAK",
    name: "اکوسیستم پرداخت شاپرک",
    subtitle: "درگاه پرداخت اینترنتی شاپرک و اسنپ‌پی اقساطی",
    locale: "fa",
    direction: "rtl",
    currency: "IRT",
    currencySymbol: "تومان",
    primaryGateway: "Shaparak IPG (Saman/Mellat)",
    bnplProvider: "SnappPay BNPL (4 اقساط)",
    fontFamily: "var(--primitive-font-fa)",
    requiresVpnCheck: true,
  },
};
