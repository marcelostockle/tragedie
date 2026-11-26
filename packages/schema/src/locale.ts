import { z } from "zod";

/** Supported locales. Adding one is a one-line change; the compiler flags the rest. */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/** The authoritative locale. Other locales may lag and fall back to this one. */
export const SOURCE_LOCALE: Locale = "en";

export const LocaleSchema = z.enum(LOCALES);

/** Text per locale: the source locale is required, the others optional. */
export function localized<T extends z.ZodType>(item: T) {
  const shape = Object.fromEntries(
    LOCALES.map((l) => [l, l === SOURCE_LOCALE ? item : item.optional()]),
  ) as Record<Locale, T>;
  return z.object(shape).strict();
}

export const LocalizedString = localized(z.string().min(1));
export type LocalizedString = z.infer<typeof LocalizedString>;

/** Resolve a localized value, falling back to the source locale. */
export function pick<T>(
  value: Partial<Record<Locale, T>> & Record<typeof SOURCE_LOCALE, T>,
  locale: Locale,
): T {
  return value[locale] ?? value[SOURCE_LOCALE];
}
