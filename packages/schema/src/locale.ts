import { z } from "zod";

/** Supported locales. Adding one is a one-line change; the compiler flags the rest. */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * The authoritative locale. Other locales may lag and fall back to this one.
 * Typed as the literal so `Localized<T>` can require it and nothing else.
 */
export const SOURCE_LOCALE = "en" satisfies Locale;

export const LocaleSchema = z.enum(LOCALES);

/** A value per locale: the source locale is required, the others optional. */
export type Localized<T> = Record<typeof SOURCE_LOCALE, T> & Partial<Record<Locale, T>>;

export function localized<T extends z.ZodType>(item: T) {
  const shape = Object.fromEntries(
    LOCALES.map((l) => [l, l === SOURCE_LOCALE ? item : item.optional()]),
  );
  return z.object(shape).strict() as unknown as z.ZodType<Localized<z.output<T>>>;
}

export const LocalizedString = localized(z.string().min(1));
export type LocalizedString = z.infer<typeof LocalizedString>;

/** Resolve a localized value, falling back to the source locale. */
export function pick<T>(value: Localized<T>, locale: Locale): T {
  return value[locale] ?? value[SOURCE_LOCALE];
}
