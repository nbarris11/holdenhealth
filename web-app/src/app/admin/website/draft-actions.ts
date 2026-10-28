'use server';
import { verifyAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getWebsitePage, normalizeWebsiteSettings, websitePagesForSettings } from '@/lib/website-pages';
import { headerFields, validHeaderLink } from '@/lib/website-header';
import { validatePageContent } from '@/lib/website-content-validation';
import type { WebsiteDraft } from '@/lib/website-draft';

function message(error: { message: string }) {
  if (/CONFLICT/.test(error.message)) return 'Another tab or editor saved newer changes. Your work is still here. Reload in a separate tab to compare before continuing.';
  return 'The changes could not be saved. Your draft is still here; please try again.';
}
export async function saveWebsiteDraft(draft: WebsiteDraft, revision: number) {
  await verifyAdmin();
  if (!draft || !draft.pages || !draft.bases || JSON.stringify(draft).length > 3_000_000) return { error: 'This draft is too large to save.' };
  const db = await createClient();
  const { data, error } = await db.rpc('save_website_editor_draft', { expected_revision: revision, draft });
  return error ? { error: message(error) } : { revision: Number(data) };
}
export async function publishWebsiteDraft(pageKey: string, revision: number) {
  const admin = await verifyAdmin();
  const db = await createClient();
  const [{ data: saved, error: draftError }, { data: record, error: settingsError }] = await Promise.all([
    db.from('website_editor_drafts').select('payload,revision').eq('user_id',admin.userId).maybeSingle(),
    db.from('site_content').select('value').eq('content_key','website:settings').maybeSingle(),
  ]);
  if (draftError || settingsError || !saved || Number(saved.revision)!==revision) return { error: 'The draft changed. Return to editing and preview it again.' };
  const draft=saved.payload as WebsiteDraft;
  const settings=normalizeWebsiteSettings(record?.value);
  const page=getWebsitePage(pageKey,websitePagesForSettings(settings));
  if(!page) return {error:'This page is no longer available.'};
  const changes: Array<{key:string;value:unknown;base:string|null}> = [];
  const add=(key:string,value:unknown)=>{
    if(!Object.prototype.hasOwnProperty.call(draft.bases,key)) throw new Error('The published version is missing. Reload before editing.');
    changes.push({key,value,base:draft.bases[key]});
  };
  try {
    if(draft.pages[pageKey]) add(`website:${pageKey}`,validatePageContent(page,draft.pages[pageKey]));
    if(draft.header) {
      for(const field of headerFields) {
        const value=draft.header[field.key];
        if(typeof value!=='string' || !value.trim() || value.length>('link' in field?700:30) || ('link' in field && !validHeaderLink(value))) throw new Error(`Check ${field.label}.`);
      }
      add('website:header',draft.header);
    }
    if(draft.promotion) {
      const promo=draft.promotion;
      for(const [key,max] of [['headline',240],['body',1600],['button',100]] as const) if(typeof promo[key]!=='string'||!promo[key].trim()||promo[key].length>max) throw new Error(`Check the promotion ${key}.`);
      const {data:program,error}=await db.from('sessions').select('id,published,status,starts_on').eq('id',promo.sessionId).maybeSingle();
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if(error||!program||!program.published||program.status!=='enrolling'||program.starts_on<=today) throw new Error('Choose a future program that is open for registration.');
      add('website:settings',{...settings,featured_session_id:promo.sessionId,featured_headline:promo.headline,featured_body:promo.body,featured_button:promo.button});
    }
    if(!changes.length) return {error:'There are no changes to publish.'};
  } catch(error) { return {error:error instanceof Error?error.message:'Check your changes.'}; }
  const remaining: WebsiteDraft={pages:{...draft.pages},bases:{...draft.bases}};
  delete remaining.pages[pageKey];
  for(const change of changes) delete remaining.bases[change.key];
  const {data,error}=await db.rpc('publish_website_editor_draft',{expected_revision:revision,changes,remaining_draft:remaining});
  if(error) return {error:message(error)};
  return {revision:Number(data.revision),bases:data.bases as Record<string,string>,publishedAt:data.published_at as string,remaining};
}

export async function previousWebsitePage(pageKey: string) {
  await verifyAdmin();
  const db=await createClient();
  const [{data:history,error},{data:current},{data:settingsRow}]=await Promise.all([
    db.from('website_publication_history').select('previous_records').contains('published_records',[{key:`website:${pageKey}`}]).order('published_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('site_content').select('updated_at').eq('content_key',`website:${pageKey}`).maybeSingle(),
    db.from('site_content').select('value').eq('content_key','website:settings').maybeSingle(),
  ]);
  const page=getWebsitePage(pageKey,websitePagesForSettings(normalizeWebsiteSettings(settingsRow?.value)));
  if(error||!history||!page)return {error:'No previous version is available for this page yet.'};
  const entries=history.previous_records as Array<{key:string;record:{value:Record<string,string>}|null}>;
  const previous=entries.find(entry=>entry.key===`website:${pageKey}`);
  const {data:legacy}=pageKey==='homepage'&&!previous?.record?await db.from('website_content').select('*').eq('page_key','homepage').maybeSingle():{data:null};
  return {content:{visual_overrides:'[]',custom_sections:'[]',...page.defaults,...legacy,...previous?.record?.value,published_at:new Date().toISOString()},base:current?.updated_at??null};
}
