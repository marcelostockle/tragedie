import { LOCALES, type Locale } from "@tragedie/schema/browser";

export const isLocale = (s: string | undefined): s is Locale => LOCALES.includes(s as Locale);

/** `/es/tags/warm.timbre/`; `rest` has no leading slash. */
export const localePath = (locale: Locale, rest = ""): string =>
  `/${locale}/${rest}${rest && !rest.endsWith("/") ? "/" : ""}`;

/** The same page in another locale: swap the leading locale segment. */
export function switchLocale(pathname: string, to: Locale): string {
  const [, first, ...rest] = pathname.split("/");
  return isLocale(first) ? `/${[to, ...rest].join("/")}` : `/${to}/`;
}
