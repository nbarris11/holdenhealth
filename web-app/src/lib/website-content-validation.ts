import type { WebsitePageConfig } from './website-pages';
function textField(form: FormData, key: string, max: number) { const value=String(form.get(key) ?? ''); if(value.length>max) throw new Error('Content is too long.'); return value; }
export function validatePageContent(page: WebsitePageConfig, raw: Record<string,string>) {
 const formData=new FormData(); Object.entries(raw).forEach(([k,v])=>formData.set(k,v));
 const value: Record<string,string>={...raw}; for (const key of ["published_at","updated_at","updated_by","created_at","page_key","id","published"]) delete value[key];
 for(const section of page.sections) for(const field of section.fields) {
   const input=raw[field.key];
   if(typeof input!=='string' || !input.trim() || input.length>field.maxLength) throw new Error(`Check ${field.label}.`);
   if(field.kind==='link' && !/^(?:https:\/\/|\/(?!\/)|[a-z0-9][a-z0-9-]*\.html(?:[?#].*)?$)/i.test(input)) throw new Error(`Check ${field.label}.`);
 }
  try {
    const overrides = JSON.parse(textField(formData, "visual_overrides", 500_000));
    if (!Array.isArray(overrides) || overrides.length > 1000) throw new Error("Invalid visual changes.");
    value.visual_overrides = JSON.stringify(overrides.map((item) => {
      if (!item || typeof item !== "object" || typeof item.selector !== "string" || item.selector.length > 500) throw new Error("Invalid visual change.");
      const clean: Record<string, string | boolean> = { selector: item.selector };
      for (const key of ["text", "href", "src", "alt", "placeholder", "font", "size", "color", "align"] as const) {
        if (typeof item[key] === "string") clean[key] = item[key].slice(0, key === "text" ? 3000 : 1000);
      }
      if (clean.font && !["site", "display", "clean"].includes(String(clean.font))) throw new Error("Invalid font choice.");
      if (clean.size && !["small", "regular", "large"].includes(String(clean.size))) throw new Error("Invalid size choice.");
      if (clean.color && !["default", "purple", "aqua"].includes(String(clean.color))) throw new Error("Invalid color choice.");
      if (clean.align && !["left", "center"].includes(String(clean.align))) throw new Error("Invalid alignment choice.");
      if (item.bold === true) clean.bold = true;
      if (item.italic === true) clean.italic = true;
      if (item.hidden === true) clean.hidden = true;
      if (clean.href && !/^(?:https:\/\/|mailto:|tel:|\/|#|[a-z0-9][a-z0-9-]*\.html(?:[?#].*)?$)/i.test(String(clean.href))) throw new Error("Invalid visual link.");
      if (clean.src && !/^(?:https:\/\/|\/|assets\/)/i.test(String(clean.src))) throw new Error("Invalid image location.");
      return clean;
    }));
  } catch {
    throw new Error("Check the page links, photos, and custom sections before publishing.");
  }
  try {
    const sections = JSON.parse(textField(formData, "custom_sections", 100_000));
    const templates = new Set(["text-photo", "announcement", "testimonial", "faq", "call-to-action"]);
    const themes = new Set(["light", "lavender", "dark"]);
    if (!Array.isArray(sections) || sections.length > 20) throw new Error("Invalid custom sections.");
    value.custom_sections = JSON.stringify(sections.map((item) => {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^section-[a-z0-9-]{6,80}$/i.test(item.id) || !templates.has(item.template) || !themes.has(item.theme)) throw new Error("Invalid custom section.");
      const clean: Record<string, unknown> = { id: item.id, template: item.template, theme: item.theme };
      for (const [key, limit] of [["eyebrow", 100], ["heading", 240], ["body", 1200], ["buttonLabel", 80], ["buttonUrl", 700], ["imageSrc", 1000], ["imageAlt", 300], ["attribution", 140]] as const) {
        if (typeof item[key] === "string") clean[key] = item[key].slice(0, limit);
      }
      if (clean.buttonUrl && !/^(?:https:\/\/|mailto:|tel:|\/|#|[a-z0-9][a-z0-9-]*\.html(?:[?#].*)?$)/i.test(String(clean.buttonUrl))) throw new Error("Invalid section link.");
      if (clean.imageSrc && !/^(?:https:\/\/|\/|assets\/)/i.test(String(clean.imageSrc))) throw new Error("Invalid section image.");
      if (item.hidden === true) clean.hidden = true;
      if (item.template === "faq") {
        if (!Array.isArray(item.items) || item.items.length < 1 || item.items.length > 12) throw new Error("Invalid questions.");
        clean.items = item.items.map((entry: unknown) => {
          if (!entry || typeof entry !== "object") throw new Error("Invalid question.");
          const faq = entry as Record<string, unknown>;
          return { question: String(faq.question ?? "").slice(0, 240), answer: String(faq.answer ?? "").slice(0, 800) };
        });
      }
      return clean;
    }));
  } catch {
    throw new Error("Check the page links, photos, and custom sections before publishing.");
  }
 return value;
}
