import type { WebsiteHeader } from './website-header';
export type PageContent = Record<string, string> & { published_at: string };
export type PromotionCopy = { sessionId: string; headline: string; body: string; button: string };
export type WebsiteDraft = {
  pages: Record<string, PageContent>;
  bases: Record<string, string | null>;
  header?: WebsiteHeader;
  promotion?: PromotionCopy;
};
export const emptyWebsiteDraft = (): WebsiteDraft => ({ pages: {}, bases: {} });
