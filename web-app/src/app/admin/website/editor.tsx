"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { headerFields, type WebsiteHeader } from "@/lib/website-header";
import { emptyWebsiteDraft, type WebsiteDraft, type PromotionCopy } from "@/lib/website-draft";
import { saveWebsiteDraft, publishWebsiteDraft, previousWebsitePage } from "./draft-actions";
import {
  getWebsitePage,
  websiteSectionTemplates,
  type WebsiteCustomSection,
  type WebsiteCustomSectionTemplate,
  type WebsitePageKey,
  type WebsitePageConfig,
  type WebsiteVisualOverride,
} from "@/lib/website-pages";

type PageContent = Record<string, string> & { published_at: string };
type Program = { id:string; name:string; description:string|null; starts_on:string; ends_on:string; format:string; first_price_cents:number; second_price_cents:number; class_times: Array<{weekday:string;time:string}> };
type EditorProps = { pages: WebsitePageConfig[]; content: Record<WebsitePageKey, PageContent>; initialPage: WebsitePageKey; header:WebsiteHeader; programs:Program[]; featuredId:string; featuredCopy:PromotionCopy; bases:Record<string,string|null>; savedDraft:WebsiteDraft|null; draftRevision:number; dropInVisible:boolean };
type VisualSelection = WebsiteVisualOverride & { kind: "text" | "link" | "image" | "input" | "section"; legacySelector?: string; summary?: string; offscreen?: boolean; label: string; customSectionId?: string };

function parseArray<T>(value: string | undefined): T[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// The website no longer shows a featured promotion, so an old promotion draft
// would only block publishing with a program error.
function withoutPromotion(draft: WebsiteDraft | null): WebsiteDraft {
  if (!draft?.promotion) return draft ?? emptyWebsiteDraft();
  const next = { ...draft, bases: { ...draft.bases } };
  delete next.promotion; delete next.bases["website:settings"];
  return next;
}

function newSectionId() {
  return `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeSection(template: WebsiteCustomSectionTemplate): WebsiteCustomSection {
  const id = newSectionId();
  const common = { id, template, theme: "light" as const, eyebrow: "New section", heading: "Add your headline here", body: "Click this section to replace these words with your own." };
  if (template === "text-photo") return { ...common, imageSrc: "assets/photos/kelsey-holden-portrait.jpg", imageAlt: "Kelsey Holden" };
  if (template === "announcement") return { ...common, theme: "lavender", eyebrow: "Good to know", heading: "Share an important update", body: "Add the date, offer, or announcement your visitors should see." };
  if (template === "testimonial") return { ...common, eyebrow: "Client story", heading: "This made healthy habits finally feel doable.", body: "Add a short, specific client quote here.", attribution: "Client name" };
  if (template === "faq") return { ...common, eyebrow: "Common questions", heading: "A few things you may be wondering", body: "", items: [{ question: "Add your first question", answer: "Add a clear, reassuring answer." }, { question: "Add another question", answer: "Keep the answer short and helpful." }] };
  return { ...common, theme: "dark", eyebrow: "Ready when you are", heading: "Invite visitors to take the next step", body: "Explain what happens next and make it feel easy.", buttonLabel: "Get started", buttonUrl: "book.html" };
}


function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <label className="visual-choice"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function SectionEditor({ section, index, count, onChange, onMove, onDuplicate, onDelete, onUpload, uploading }: {
  section: WebsiteCustomSection;
  index: number;
  count: number;
  onChange: (patch: Partial<WebsiteCustomSection>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpload: (file?: File) => void;
  uploading: boolean;
}) {
  const templateLabel = websiteSectionTemplates.find((item) => item.key === section.template)?.label ?? "Custom section";
  const updateFaq = (itemIndex: number, patch: Partial<{ question: string; answer: string }>) => onChange({ items: (section.items ?? []).map((item, current) => current === itemIndex ? { ...item, ...patch } : item) });
  return <div className="custom-section-editor">
    <div className="visual-selection-heading"><span>Custom section</span><strong>{templateLabel}</strong></div>
    <div className="section-quick-actions" aria-label="Section actions">
      <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>↑ Move up</button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(1)}>↓ Move down</button>
      <button type="button" onClick={onDuplicate}>Duplicate</button>
    </div>
    <div className="section-style-row">
      <Choice label="Background" value={section.theme} options={[{ value: "light", label: "Light" }, { value: "lavender", label: "Lavender" }, { value: "dark", label: "Dark" }]} onChange={(theme) => onChange({ theme })} />
      <label className="visual-toggle"><input type="checkbox" checked={Boolean(section.hidden)} onChange={(event) => onChange({ hidden: event.target.checked })} /><span>Hide section</span></label>
    </div>
    <label className="website-editor-field"><span><strong>Small label</strong></span><input value={section.eyebrow} maxLength={100} onChange={(event) => onChange({ eyebrow: event.target.value })} /></label>
    <label className="website-editor-field"><span><strong>Headline</strong></span><textarea rows={3} value={section.heading} maxLength={240} onChange={(event) => onChange({ heading: event.target.value })} /></label>
    {section.template !== "faq" ? <label className="website-editor-field"><span><strong>{section.template === "testimonial" ? "Quote" : "Description"}</strong><small>Press Enter twice to start a new paragraph.</small></span><textarea rows={5} value={section.body} maxLength={1200} onChange={(event) => onChange({ body: event.target.value })} /></label> : null}
    {section.template === "testimonial" ? <label className="website-editor-field"><span><strong>Client name or description</strong></span><input value={section.attribution ?? ""} maxLength={140} onChange={(event) => onChange({ attribution: event.target.value })} /></label> : null}
    {section.template === "text-photo" ? <>
      <label className="website-editor-field"><span><strong>Replace photo</strong><small>JPG, PNG, WebP, or GIF · maximum 8 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => onUpload(event.target.files?.[0])} /></label>
      <label className="website-editor-field"><span><strong>Photo description</strong></span><input value={section.imageAlt ?? ""} maxLength={300} onChange={(event) => onChange({ imageAlt: event.target.value })} /></label>
    </> : null}
    {section.template === "faq" ? <div className="faq-editor-list">{(section.items ?? []).map((item, itemIndex) => <div className="faq-editor-item" key={`${section.id}-faq-${itemIndex}`}>
      <label className="website-editor-field"><span><strong>Question {itemIndex + 1}</strong></span><input value={item.question} maxLength={240} onChange={(event) => updateFaq(itemIndex, { question: event.target.value })} /></label>
      <label className="website-editor-field"><span><strong>Answer</strong></span><textarea rows={3} value={item.answer} maxLength={800} onChange={(event) => updateFaq(itemIndex, { answer: event.target.value })} /></label>
      {(section.items?.length ?? 0) > 1 ? <button className="text-action danger" type="button" onClick={() => onChange({ items: section.items?.filter((_, current) => current !== itemIndex) })}>Remove question</button> : null}
    </div>)}<button className="button secondary compact-button" type="button" onClick={() => onChange({ items: [...(section.items ?? []), { question: "New question", answer: "Add the answer here." }] })}>+ Add question</button></div> : null}
    {section.template === "call-to-action" ? <div className="section-link-fields">
      <label className="website-editor-field"><span><strong>Button text</strong></span><input value={section.buttonLabel ?? ""} maxLength={80} onChange={(event) => onChange({ buttonLabel: event.target.value })} /></label>
      <label className="website-editor-field"><span><strong>Button destination</strong><small>Use an HTTPS link or a website page.</small></span><input value={section.buttonUrl ?? ""} maxLength={700} onChange={(event) => onChange({ buttonUrl: event.target.value })} /></label>
    </div> : null}
    <button className="button secondary visual-delete-section" type="button" onClick={onDelete}>Delete section</button>
  </div>;
}

export default function WebsiteEditor({ pages, content, initialPage, header, programs, featuredId, featuredCopy, bases, savedDraft, draftRevision, dropInVisible }: EditorProps) {
  const [selectedPage, setSelectedPage] = useState<WebsitePageKey>(initialPage);
  const [published, setPublished] = useState(content);
  const [publishedHeader, setPublishedHeader] = useState(header);
  const [publishedFeature, setPublishedFeature] = useState(featuredCopy);
  const [workspace, setWorkspace] = useState<WebsiteDraft>(()=>withoutPromotion(savedDraft));
  const [recordBases, setRecordBases] = useState(bases);
  const revisionRef = useRef(draftRevision);
  const savedRef = useRef(JSON.stringify(savedDraft ?? emptyWebsiteDraft()));
  const workspaceRef = useRef(workspace);
  useEffect(()=>{workspaceRef.current=workspace;},[workspace]);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const [saveStatus,setSaveStatus]=useState("Draft saved");
  const [error,setError]=useState("");
  const [publishing,setPublishing]=useState(false);
  const [review,setReview]=useState(false);
  const [device,setDevice]=useState<"desktop"|"phone">("desktop");
  const [panel,setPanel]=useState<"page"|"header"|"promotion">("page");
  const [previewReady,setPreviewReady]=useState(false);
  const [previewAttempt,setPreviewAttempt]=useState(0);
  const [previewSlow,setPreviewSlow]=useState(false);
  useEffect(()=>{if(previewReady)return;const timer=setTimeout(()=>setPreviewSlow(true),10000);return()=>clearTimeout(timer);},[previewReady,previewAttempt]);
  const [publishedNotice,setPublishedNotice]=useState("");
  const dirtyPages = new Set(Object.keys(workspace.pages));
  const drafts = useMemo(()=>({...published,...workspace.pages}),[published,workspace.pages]);
  const currentHeader=workspace.header ?? publishedHeader;
  const sharedDirty=Boolean(workspace.header||workspace.promotion);
  const saveWorkspace = useCallback(async function saveLatest(): Promise<boolean> {
    if(savingRef.current) { await savingRef.current; return saveLatest(); }
    const snapshot=JSON.stringify(workspaceRef.current);
    if(snapshot===savedRef.current) return true;
    setSaveStatus("Saving draft…");
    const task=(async()=>{
      try {
        const result=await saveWebsiteDraft(JSON.parse(snapshot),revisionRef.current);
        if(result.error||result.revision===undefined) {setError(result.error||"Draft could not be saved.");setSaveStatus("Unsaved changes");return false;}
        revisionRef.current=result.revision;savedRef.current=snapshot;setSaveStatus("Draft saved");setError("");return true;
      } catch {setError("Connection lost. Your edits are still here. Retry saving before leaving.");setSaveStatus("Unsaved changes");return false;}
    })();
    savingRef.current=task;
    try{return await task;}finally{savingRef.current=null;}
  },[]);
  useEffect(()=>{const timer=setTimeout(()=>{void saveWorkspace();},650);return()=>clearTimeout(timer);},[workspace,saveWorkspace]);
  const markBase=(draft:WebsiteDraft,key:string)=>({...draft.bases,[key]:Object.prototype.hasOwnProperty.call(draft.bases,key)?draft.bases[key]:recordBases[key] ?? null});
  const editHeader=(key:string,value:string|boolean)=>{setSaveStatus("Unsaved changes");setPublishedNotice("");setReview(false);setWorkspace(current=>({...current,header:{...(current.header??publishedHeader),[key]:value},bases:markBase(current,"website:header")}));};
  const promotionFor=useCallback((key:string):PromotionCopy=>{
    if(workspace.promotion) return workspace.promotion;
    const program=programs.find(p=>p.id===publishedFeature.sessionId) ?? programs.find(p=>p.id===featuredId);
    const pageContent=drafts[key];
    const legacy=Boolean(program && pageContent?.mini_cta_url?.includes(`session=${program.id}`));
    const shared=publishedFeature.sessionId===program?.id;
    return {sessionId:program?.id??"",headline:(shared?publishedFeature.headline:legacy?pageContent.mini_heading:"")||`Join ${program?.name??"our next program"}.`,body:(shared?publishedFeature.body:legacy?pageContent.mini_body:"")||program?.description||"Join Kelsey for coached group fitness in Plymouth.",button:(shared?publishedFeature.button:legacy?pageContent.mini_cta_label:"")||"See dates and sign up"};
  },[workspace.promotion,programs,publishedFeature,featuredId,drafts]);
  const promotion=promotionFor(selectedPage);
  const editPromotion=(patch:Partial<PromotionCopy>)=>{setSaveStatus("Unsaved changes");setPublishedNotice("");setReview(false);setWorkspace(current=>({...current,promotion:{...promotion,...patch},bases:markBase(current,"website:settings")}));};
  const [inventory, setInventory] = useState<VisualSelection[]>([]);
  const [contentSearch, setContentSearch] = useState("");
  const [browseMode, setBrowseMode] = useState(false);
  const [selection, setSelection] = useState<VisualSelection | null>(null);
  const [showSectionLibrary, setShowSectionLibrary] = useState(false);
  const [removedSection, setRemovedSection] = useState<{ page: WebsitePageKey; section: WebsiteCustomSection; index: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewSize, setPreviewSize] = useState({ height: 760, scale: 1 });
  const previewRequest = useRef(0);
  const previewOrigin = useRef("https://www.holden.health");
  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const page = getWebsitePage(selectedPage, pages) ?? pages[0];
  const values = drafts[selectedPage];
  const overrides = useMemo(() => parseArray<WebsiteVisualOverride>(values.visual_overrides), [values.visual_overrides]);
  const customSections = useMemo(() => parseArray<WebsiteCustomSection>(values.custom_sections), [values.custom_sections]);
  const selectedOverride = selection && !selection.customSectionId ? overrides.find((item) => item.selector === selection.selector) ?? overrides.find((item) => item.selector === selection.legacySelector) : undefined;
  const selectedSectionIndex = selection?.customSectionId ? customSections.findIndex((item) => item.id === selection.customSectionId) : -1;
  const selectedSection = selectedSectionIndex >= 0 ? customSections[selectedSectionIndex] : undefined;
  const effective = selection && !selection.customSectionId ? { ...selection, ...selectedOverride } : null;
  const previewUrl = `https://www.holden.health${page.pathname}?holden-editor=1`;

  const sendPreview = useCallback((pageKey: WebsitePageKey, draft: PageContent) => {
    previewRef.current?.contentWindow?.postMessage({ type: "holden-health-editor-preview", pageKey, content: { ...draft, drop_in_visible:dropInVisible, ...((pageKey==='homepage'||pageKey==='coaching') ? {featured_program: (()=>{const copy=promotionFor(pageKey);const program=programs.find(p=>p.id===copy.sessionId);return program?{...program,headline:copy.headline,body:copy.body,button:copy.button}:null;})()} : {}) }, header:currentHeader, review, requestId:++previewRequest.current }, previewOrigin.current);
  }, [currentHeader, review, dropInVisible, programs, promotionFor]);

  const saveDraftValue = (pageKey: WebsitePageKey, field: string, value: string) => {
    setSaveStatus("Unsaved changes");setReview(false);setPublishedNotice("");
    setWorkspace(current=>({...current,pages:{...current.pages,[pageKey]:{...(current.pages[pageKey]??published[pageKey]),[field]:value}},bases:markBase(current,`website:${pageKey}`)}));
  };

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { if (JSON.stringify(workspaceRef.current)!==savedRef.current || savingRef.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, []);

  useEffect(() => {
    const receivePreviewMessage = (event: MessageEvent) => {
      if (!["https://holden.health", "https://www.holden.health"].includes(event.origin) || event.source !== previewRef.current?.contentWindow) return;
      previewOrigin.current = event.origin;
      if (event.data?.type === "holden-health-editor-inventory" && event.data.pageKey === selectedPage && Array.isArray(event.data.items)) {
        setInventory(event.data.items);
      }
      if(event.data?.type === "holden-health-editor-applied") {if(event.data.requestId===previewRequest.current && event.data.pageKey===selectedPage){setPreviewReady(true);setPreviewSlow(false);}return;}
      if (event.data?.type === "holden-health-editor-header") { setPanel("header");setSelection(null);return; }
      if (event.data?.type === "holden-health-editor-featured-program") { setPanel("promotion");setSelection(null);return; }
      if (event.data?.type === "holden-health-editor-ready") {
        setBrowseMode(false);
        const openedPage = getWebsitePage(event.data.pageKey, pages)?.key;
        if (openedPage && openedPage !== selectedPage) { setSelectedPage(openedPage); setSelection(null); }
        if (openedPage) sendPreview(openedPage, drafts[openedPage]);
      }
      if (event.data?.type === "holden-health-editor-selection" && event.data.selection?.selector) {
        setPanel("page");setSelection(event.data.selection as VisualSelection);
        setUploadError("");
      }
    };
    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, [drafts, pages, selectedPage, sendPreview]);

  useEffect(() => { sendPreview(selectedPage, values); }, [selectedPage, sendPreview, values]);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return;
    const resize = () => setPreviewSize({ height: Math.max(620, Math.min(900, window.innerHeight - 150)), scale: Math.min(1, frame.clientWidth / (device === "phone" ? 390 : 1280)) });
    const observer = new ResizeObserver(resize);
    observer.observe(frame); resize();
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [device, review]);

  const focusPreview = (target: { contentKey?: string; sectionId?: string; selector?: string }) => previewRef.current?.contentWindow?.postMessage({ type: "holden-health-editor-focus", ...target }, previewOrigin.current);

  const updateVisualOverride = (patch: Partial<WebsiteVisualOverride>) => {
    if (!selection) return;
    const next = overrides.filter((item) => item.selector !== selection.selector && item.selector !== selection.legacySelector);
    next.push({ ...selection, ...selectedOverride, ...patch, selector: selection.selector });
    const stored = next.map(({ selector, hidden, text, href, src, alt, placeholder, font, size, color, align, bold, italic }) => ({ selector, ...(hidden ? { hidden } : {}), ...(text !== undefined ? { text } : {}), ...(href !== undefined ? { href } : {}), ...(src !== undefined ? { src } : {}), ...(alt !== undefined ? { alt } : {}), ...(placeholder !== undefined ? { placeholder } : {}), ...(font ? { font } : {}), ...(size ? { size } : {}), ...(color ? { color } : {}), ...(align ? { align } : {}), ...(bold ? { bold } : {}), ...(italic ? { italic } : {}) }));
    saveDraftValue(selectedPage, "visual_overrides", JSON.stringify(stored));
  };

  const resetVisualOverride = () => {
    if (!selection) return;
    saveDraftValue(selectedPage, "visual_overrides", JSON.stringify(overrides.filter((item) => item.selector !== selection.selector && item.selector !== selection.legacySelector)));
    setSelection(null);
  };

  const deleteVisualItem = () => {
    if (!effective || !window.confirm(`Delete this ${effective.kind}? You can restore it anytime.`)) return;
    updateVisualOverride({ hidden: true });
  };

  const saveSections = (sections: WebsiteCustomSection[]) => saveDraftValue(selectedPage, "custom_sections", JSON.stringify(sections));

  const selectSection = (section: WebsiteCustomSection) => {
    setPanel("page");setSelection({ selector: `[data-holden-section-id="${section.id}"]`, kind: "section", label: "Custom section", customSectionId: section.id });
    focusPreview({ sectionId: section.id });
  };

  const addSection = (template: WebsiteCustomSectionTemplate) => {
    const section = makeSection(template);
    saveSections([...customSections, section]);
    setShowSectionLibrary(false);
    setRemovedSection(null);
    window.setTimeout(() => selectSection(section), 80);
  };

  const updateSection = (id: string, patch: Partial<WebsiteCustomSection>) => saveSections(customSections.map((section) => section.id === id ? { ...section, ...patch } : section));

  const moveSection = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= customSections.length) return;
    const next = [...customSections];
    [next[index], next[destination]] = [next[destination], next[index]];
    saveSections(next);
  };

  const duplicateSection = (index: number) => {
    const copy = { ...customSections[index], id: newSectionId(), heading: `${customSections[index].heading} (copy)`, items: customSections[index].items?.map((item) => ({ ...item })) };
    const next = [...customSections]; next.splice(index + 1, 0, copy); saveSections(next); selectSection(copy);
  };

  const deleteSection = (index: number) => {
    const section = customSections[index];
    if (!window.confirm(`Delete “${section.heading}”? You can undo this until you leave the page.`)) return;
    setRemovedSection({ page: selectedPage, section, index });
    saveSections(customSections.filter((_, current) => current !== index));
    setSelection(null);
  };

  const undoDelete = () => {
    if (!removedSection || removedSection.page !== selectedPage) return;
    const next = [...customSections]; next.splice(Math.min(removedSection.index, next.length), 0, removedSection.section); saveSections(next); setRemovedSection(null); selectSection(removedSection.section);
  };

  const uploadImage = async (file: File | undefined, onUrl: (url: string) => void) => {
    if (!file) return;
    setUploading(true); setUploadError("");
    const body = new FormData(); body.set("file", file); body.set("pageKey", selectedPage);
    try {
      const response = await fetch("/api/site-media", { method: "POST", body });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "The image could not be uploaded.");
      onUrl(result.url);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setUploading(false); }
  };

  const publishedLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Detroit" }).format(new Date(values.published_at));
  const isDirty = dirtyPages.has(selectedPage)||sharedDirty;
  const scope=[...(dirtyPages.has(selectedPage)?[page.label]:[]),...(workspace.header?["Header on all pages"]:[]),...(workspace.promotion?["Promotion on Home and Coaching"]:[])];
  const switchPage=(key:string)=>{setSelectedPage(key);setSelection(null);setInventory([]);setContentSearch("");setBrowseMode(false);setShowSectionLibrary(false);setPanel("page");setReview(false);setPreviewReady(false);};
  const restorePrevious=async()=>{
    if(!window.confirm(`Load the previous published ${page.label} into your draft? This replaces pending edits to this page. Header and promotion drafts stay unchanged. Nothing goes live until you preview and publish.`))return;
    const result=await previousWebsitePage(selectedPage);
    if(result.error||!result.content){setError(result.error??"Previous version unavailable.");return;}
    setWorkspace(current=>({...current,pages:{...current.pages,[selectedPage]:result.content as PageContent},bases:{...current.bases,[`website:${selectedPage}`]:result.base??null}}));setReview(false);setSelection(null);
  };
  const discard=()=>{
    if(!window.confirm(`Discard changes to ${page.label} and any pending header or promotion edits? Other page drafts will stay saved.`))return;
    setWorkspace(current=>{const next={pages:{...current.pages},bases:{...current.bases}};delete next.pages[selectedPage];for(const key of [`website:${selectedPage}`,"website:header","website:settings"])delete next.bases[key];return next;});setSelection(null);setReview(false);setPublishedNotice("");
  };
  const openReview=async()=>{if(await saveWorkspace()){setBrowseMode(false);setReview(true);setPreviewReady(false);}};
  const publish=async()=>{
    if(!review||!previewReady||publishing) return;
    setPublishing(true);setError("");
    try {
      if(!await saveWorkspace()) return;
      const result=await publishWebsiteDraft(selectedPage,revisionRef.current);
      if(result.error||result.revision===undefined||!result.remaining) {setError(result.error??"Publication failed. Your draft is safe.");return;}
      const previous=workspaceRef.current;
      setPublished(current=>({...current,...(previous.pages[selectedPage]?{[selectedPage]:{...previous.pages[selectedPage],published_at:result.publishedAt!}}:{})}));
      if(previous.header)setPublishedHeader(previous.header);
      if(previous.promotion)setPublishedFeature(previous.promotion);
      revisionRef.current=result.revision;savedRef.current=JSON.stringify(result.remaining);workspaceRef.current=result.remaining;setWorkspace(result.remaining);
      setRecordBases(current=>({...current,...result.bases}));setSaveStatus("Draft saved");setReview(false);setPublishedNotice("Published. Your updates are now live.");
    }catch{setError("We could not confirm publication. Your draft is preserved. Reload in another tab before retrying.");}
    finally{setPublishing(false);}
  };
  return <div className={`visual-website-editor exact-site-editor ${review?"website-review-mode":""}`}>
    <div className="website-workflow-toolbar">
      <label>Page<select value={selectedPage} disabled={publishing} onChange={event=>switchPage(event.target.value)}>{pages.map(item=><option key={item.key} value={item.key}>{item.label}{dirtyPages.has(item.key)?" · Draft":""}</option>)}</select></label>
      <div className="website-workflow-steps" aria-label="Editing steps"><strong aria-current={!review?"step":undefined}>1 Edit</strong><strong aria-current={review?"step":undefined}>2 Preview</strong><span>3 Publish</span></div>
      <div className="website-device-controls"><button type="button" aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')}>Desktop</button><button type="button" aria-pressed={device==='phone'} onClick={()=>setDevice('phone')}>Phone</button></div>
    </div>
    {error?<p className="notice error" role="alert">{error} <button type="button" onClick={()=>void saveWorkspace()}>Retry draft save</button></p>:null}
    {publishedNotice?<p className="notice success" role="status">{publishedNotice} <a href={`https://www.holden.health${page.pathname}`} target="_blank" rel="noreferrer">View live page ↗</a></p>:null}
    {review?<div className="website-review-notice"><strong>Unpublished preview</strong><p>{isDirty?`Publish will update: ${scope.join("; ")}. Other page drafts stay private.`:"This page has no unpublished changes."}</p><button className="button secondary" type="button" disabled={publishing} onClick={()=>setReview(false)}>← Back to editing</button></div>:<p className="website-edit-hint">Click text, a button, a photo, or the header to edit it. Your live website stays unchanged until you publish.</p>}
    {!previewReady?<p role="status" className="website-preview-loading">{previewSlow?"The preview is taking longer than expected. Your draft is safe.":"Loading your page preview…"} <button type="button" onClick={()=>{setPreviewReady(false);setPreviewSlow(false);setPreviewAttempt(value=>value+1);}}>Reload preview</button></p>:null}
    <div className="exact-editor-layout">
      <aside hidden={review} className="website-fields-panel" aria-label={`${page.label} page editor`}>
        <div className="website-panel-tabs"><button type="button" onClick={()=>setPanel("page")}>Page content</button><button type="button" onClick={()=>setPanel("header")}>Header</button></div>
        {panel==="header"?<section className="website-shared-editor"><span className="eyebrow">All pages</span><h2>Website header</h2><p>Changes appear in the desktop and phone menus.</p>{headerFields.map(field=><label className="website-editor-field" key={field.key}><span>{field.label}</span><input value={String(currentHeader[field.key]??"")} maxLength={"link" in field?700:30} onChange={event=>editHeader(field.key,event.target.value)} /></label>)}{[["call_visible","Show Free call button"]].map(([key,label])=><label className="check-label" key={key}><input type="checkbox" checked={currentHeader[key]===true} onChange={event=>editHeader(key,event.target.checked)} />{label}</label>)}</section>:panel==="promotion"?<section className="website-shared-editor"><span className="eyebrow">Home and Coaching</span><h2>Featured promotion</h2><p>Publishing these words updates both pages.</p><label className="website-editor-field"><span>Program</span><select value={promotion.sessionId} onChange={event=>editPromotion({sessionId:event.target.value})}>{programs.map(program=><option key={program.id} value={program.id}>{program.name}</option>)}</select></label>{([["headline","Headline",240],["body","Short invitation",1600],["button","Button text",100]] as const).map(([key,label,max])=><label className="website-editor-field" key={key}><span>{label}</span><textarea rows={key==='body'?5:2} value={promotion[key]} maxLength={max} onChange={event=>editPromotion({[key]:event.target.value})} /></label>)}<p>Dates, prices, and class times come from the program.</p><a href={`/admin/settings?program=${encodeURIComponent(promotion.sessionId)}`} target="_blank" rel="noreferrer">Edit program details ↗</a></section>:<>
        <details className="panel"><summary><strong>Edit page text and search appearance</strong></summary><p>These fields work even if the preview asks for the website password. Preview your changes before publishing.</p>{page.sections.map(section=><fieldset key={section.label}><legend>{section.label}</legend>{section.fields.map(field=><label className="website-editor-field" key={field.key}><span>{field.label}</span><textarea rows={field.kind === "textarea" ? 3 : 2} value={values[field.key] || ""} maxLength={field.maxLength} onChange={event=>{
          saveDraftValue(selectedPage,field.key,event.target.value);
          const contentSelector = `[data-site-content="${field.key}"]`;
          const linkSelector = `[data-site-link="${field.key}"]`;
          saveDraftValue(selectedPage,"visual_overrides",JSON.stringify(overrides.map(override => {
            const next = { ...override };
            if (next.selector === contentSelector || next.selector.startsWith(contentSelector + "[")) delete next.text;
            if (next.selector === linkSelector || next.selector.startsWith(linkSelector + "[")) delete next.href;
            return next;
          })));
        }} /></label>)}</fieldset>)}</details>
        <details className="panel website-content-inventory">
          <summary><strong>All page content ({inventory.length})</strong></summary>
          <p>Find text, links, photos, form labels, and placeholders here—even items hidden in a closed section. Text around a link is edited separately to keep the link intact.</p>
          <label className="website-editor-field"><span>Find something on this page</span><input type="search" value={contentSearch} onChange={event => setContentSearch(event.target.value)} placeholder="Search words, links, or photos" /></label>
          <div className="section-navigator-list" style={{ maxHeight: 350, overflowY: "auto" }}>
            {inventory.filter(item => `${item.summary} ${item.label} ${item.href || ""}`.toLowerCase().includes(contentSearch.toLowerCase())).map(item => <button key={item.selector} type="button" className={selection?.selector === item.selector ? "active" : ""} onClick={() => { setPanel("page");setSelection(item); focusPreview({ selector: item.selector }); }}><strong>{item.summary || item.label}</strong><small>{item.label}{item.offscreen ? " · Currently hidden" : ""}</small></button>)}
          </div>
          {!inventory.length ? <p>Content appears when the page preview loads.</p> : null}
        </details>
        <label className="visual-toggle"><input type="checkbox" checked={browseMode} onChange={event => { setBrowseMode(event.target.checked); previewRef.current?.contentWindow?.postMessage({ type: "holden-health-editor-mode", browse: event.target.checked }, previewOrigin.current); }} /><span>Explore page: open menus, quiz steps, and accordions</span></label>
        {browseMode ? <p>Turn Explore page off to click and edit. Customer form submissions are disabled in this preview.</p> : null}
        <div className="website-fields-heading"><span className="eyebrow">{page.label} page</span><h2>{selection ? "Edit what you selected" : "Choose something to edit"}</h2><p>{selection ? "The controls below only affect the highlighted item." : "Click anything in the page preview, or jump to a section below."}</p></div>
        <section className={`visual-selection-editor ${selection ? "has-selection" : ""}`} aria-live="polite">
          {selectedSection ? <SectionEditor section={selectedSection} index={selectedSectionIndex} count={customSections.length} onChange={(patch) => updateSection(selectedSection.id, patch)} onMove={(direction) => moveSection(selectedSectionIndex, direction)} onDuplicate={() => duplicateSection(selectedSectionIndex)} onDelete={() => deleteSection(selectedSectionIndex)} onUpload={(file) => void uploadImage(file, (url) => updateSection(selectedSection.id, { imageSrc: url }))} uploading={uploading} /> : !effective ? <div className="visual-selection-empty"><strong>Click something on the right</strong><p>Its words, style, link, or photo controls will appear here.</p></div> : <>
            <div className="visual-selection-heading"><span>Selected on page</span><strong>{effective.label}</strong></div>
            {effective.hidden ? <p className="visual-hidden-item-note">This item is deleted from the page. Use Restore this item to bring it back.</p> : null}
            {effective.text !== undefined ? <>
              <label className="website-editor-field"><span><strong>Words</strong><small>Press Enter twice to start a new paragraph.</small></span><textarea className="visual-selection-textarea" value={effective.text} maxLength={3000} rows={7} onChange={(event) => updateVisualOverride({ text: event.target.value })} /></label>
              <details className="visual-formatting-panel"><summary>More options: style</summary><div className="visual-format-grid">
                <Choice label="Font" value={effective.font ?? "site"} options={[{ value: "site", label: "Page default" }, { value: "display", label: "Brand heading" }, { value: "clean", label: "Clean text" }]} onChange={(font) => updateVisualOverride({ font })} />
                <Choice label="Size" value={effective.size ?? "regular"} options={[{ value: "small", label: "Small" }, { value: "regular", label: "Regular" }, { value: "large", label: "Large" }]} onChange={(size) => updateVisualOverride({ size })} />
                <Choice label="Color" value={effective.color ?? "default"} options={[{ value: "default", label: "Page default" }, { value: "purple", label: "Purple" }, { value: "aqua", label: "Aqua" }]} onChange={(color) => updateVisualOverride({ color })} />
                <Choice label="Alignment" value={effective.align ?? "left"} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centered" }]} onChange={(align) => updateVisualOverride({ align })} />
              </div><div className="visual-inline-toggles"><label><input type="checkbox" checked={Boolean(effective.bold)} onChange={(event) => updateVisualOverride({ bold: event.target.checked })} /> Bold</label><label><input type="checkbox" checked={Boolean(effective.italic)} onChange={(event) => updateVisualOverride({ italic: event.target.checked })} /> Italic</label></div></details>
            </> : null}
            {effective.kind === "input" ? <label className="website-editor-field"><span><strong>Placeholder text</strong><small>The hint shown before a visitor types.</small></span><input value={effective.placeholder || ""} maxLength={1000} onChange={event => updateVisualOverride({ placeholder: event.target.value })} /></label> : null}
            {effective.kind === "link" ? <label className="website-editor-field"><span><strong>Link destination</strong><small>Use a full HTTPS link, email link, phone link, or website page.</small></span><input value={effective.href || ""} maxLength={1000} onChange={(event) => updateVisualOverride({ href: event.target.value })} /></label> : null}
            {effective.kind === "image" ? <><label className="website-editor-field"><span><strong>Replace photo</strong><small>JPG, PNG, WebP, or GIF · maximum 8 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => void uploadImage(event.target.files?.[0], (url) => updateVisualOverride({ src: url }))} /></label><label className="website-editor-field"><span><strong>Photo description</strong><small>Describe the image for accessibility and search.</small></span><input value={effective.alt || ""} maxLength={1000} onChange={(event) => updateVisualOverride({ alt: event.target.value })} /></label></> : null}
            {uploading ? <p className="visual-upload-note">Uploading photo…</p> : null}{uploadError ? <p className="visual-upload-error">{uploadError}</p> : null}
            {!effective.hidden ? <button className="button secondary visual-delete-item" type="button" onClick={deleteVisualItem}>Delete this item</button> : null}
            {selectedOverride ? <button className="button secondary visual-reset-button" type="button" onClick={resetVisualOverride}>Restore this item</button> : null}
          </>}
        </section>
        {removedSection?.page === selectedPage ? <div className="section-undo" role="status"><span>Section deleted.</span><button type="button" onClick={undoDelete}>Undo</button></div> : null}
        <details className="panel"><summary>Version history</summary><p>Load the previous published page as a private draft, then preview before publishing.</p><button type="button" className="button secondary" onClick={()=>void restorePrevious()}>Restore previous page</button></details>
        <section className="page-section-navigator">
          <div className="section-navigator-heading"><div><span className="eyebrow">Page sections</span><strong>Jump to a section</strong></div><button type="button" onClick={() => setShowSectionLibrary((current) => !current)}>+ Add section</button></div>
          <div className="section-navigator-list">{page.sections.map((section, index) => <button key={section.label} type="button" onClick={() => focusPreview({ contentKey: section.fields[0]?.key })}><span>{index + 1}</span><strong>{section.label}</strong><small>Built in</small></button>)}{customSections.map((section, index) => <button className={selection?.customSectionId === section.id ? "active" : ""} key={section.id} type="button" onClick={() => selectSection(section)}><span>{page.sections.length + index + 1}</span><strong>{section.heading || "Untitled section"}</strong><small>{section.hidden ? "Hidden" : "Added section"}</small></button>)}</div>
          {showSectionLibrary ? <div className="section-template-library"><div><strong>Add a section</strong><p>Choose a layout. You can change all of its words and styling next.</p></div>{websiteSectionTemplates.map((template) => <button key={template.key} type="button" onClick={() => addSection(template.key)}><span aria-hidden="true">{template.icon}</span><div><strong>{template.label}</strong><small>{template.description}</small></div></button>)}</div> : null}
          {!showSectionLibrary ? <button className="add-section-wide" type="button" onClick={() => setShowSectionLibrary(true)}>+ Add a new section</button> : null}
        </section>
        </>}
      </aside>
      <section className={`real-website-preview ${device==='phone'?'website-phone-preview':''}`} aria-label="Live customer website preview"><div className="website-browser-bar" aria-hidden="true"><span className="browser-dots"><i /><i /><i /></span><span className="browser-address">holden.health{page.pathname === "/" ? "" : page.pathname}</span><span className="browser-device">{review?"Unpublished preview":"Click to edit"}</span></div><div className="real-website-preview-frame" ref={previewFrameRef} style={{ height: previewSize.height }}><iframe key={`${previewUrl}:${previewAttempt}`} ref={previewRef} title={`Holden Health ${page.label} page`} src={previewUrl} onLoad={() => sendPreview(selectedPage, values)} style={{ width:device === "phone" ? 390 : 1280, height: previewSize.height / previewSize.scale, transform: `scale(${previewSize.scale})` }} /></div></section>
    </div>
    <div className="visual-publish-bar"><div className="publish-status"><span className={`save-state-dot ${isDirty?"changed":"saved"}`} /><div><strong>{isDirty?saveStatus:`${page.label} is published`}</strong><small>{isDirty?"Your changes are private until you publish.":`Last published ${publishedLabel}`}</small></div></div><div className="publish-actions">{isDirty&&!review?<button className="button secondary" type="button" onClick={discard}>Discard changes</button>:null}{review?<button className="button primary" type="button" disabled={!isDirty||!previewReady||publishing||uploading} onClick={()=>void publish()}>{publishing?"Publishing…":"Publish changes"}</button>:<button className="button primary" type="button" disabled={publishing||uploading} onClick={()=>void openReview()}>Preview changes →</button>}</div></div>
  </div>;
}
