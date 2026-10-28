export type WebsiteField = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "link";
  help?: string;
  maxLength: number;
};

export type WebsiteSection = { label: string; fields: WebsiteField[] };
export type WebsiteVisualOverride = {
  selector: string;
  hidden?: boolean;
  text?: string;
  href?: string;
  src?: string;
  alt?: string;
  placeholder?: string;
  font?: "site" | "display" | "clean";
  size?: "small" | "regular" | "large";
  color?: "default" | "purple" | "aqua";
  align?: "left" | "center";
  bold?: boolean;
  italic?: boolean;
};
export type WebsiteCustomSectionTemplate = "text-photo" | "announcement" | "testimonial" | "faq" | "call-to-action";
export type WebsiteCustomSectionTheme = "light" | "lavender" | "dark";
export type WebsiteCustomSection = {
  id: string;
  template: WebsiteCustomSectionTemplate;
  theme: WebsiteCustomSectionTheme;
  eyebrow: string;
  heading: string;
  body: string;
  buttonLabel?: string;
  buttonUrl?: string;
  imageSrc?: string;
  imageAlt?: string;
  attribution?: string;
  items?: Array<{ question: string; answer: string }>;
  hidden?: boolean;
};
export const websiteSectionTemplates: Array<{ key: WebsiteCustomSectionTemplate; label: string; description: string; icon: string }> = [
  { key: "text-photo", label: "Text + photo", description: "Tell a story beside a supporting image.", icon: "▧" },
  { key: "announcement", label: "Announcement", description: "Call attention to news, dates, or an offer.", icon: "✦" },
  { key: "testimonial", label: "Testimonial", description: "Feature a client quote and their name.", icon: "“" },
  { key: "faq", label: "Questions & answers", description: "Answer common questions in a tidy list.", icon: "?" },
  { key: "call-to-action", label: "Call to action", description: "End with one clear next step.", icon: "→" },
];
export type WebsitePageKey = string;
export type WebsitePageConfig = {
  key: WebsitePageKey;
  label: string;
  pathname: string;
  description: string;
  sections: WebsiteSection[];
  defaults: Record<string, string>;
};

const text = (key: string, label: string, maxLength = 180): WebsiteField => ({ key, label, maxLength });
const area = (key: string, label: string, maxLength = 700): WebsiteField => ({ key, label, kind: "textarea", maxLength });
const link = (key: string, label: string): WebsiteField => ({ key, label, kind: "link", help: "Full HTTPS link or a page such as coaching.html", maxLength: 700 });
const simplePage = (key: string, label: string, pathname: string, description: string): WebsitePageConfig => ({ key, label, pathname, description, sections: [], defaults: {} });

export const websitePages: WebsitePageConfig[] = [
  {
    key: "homepage", label: "Home", pathname: "/", description: "The main welcome page customers see first.",
    sections: [
      { label: "Top of homepage", fields: [text("hero_eyebrow", "Small line above the headline"), area("hero_heading", "Main headline", 220), area("hero_body", "Intro paragraph", 600), text("primary_cta_label", "Main button text", 80), link("primary_cta_url", "Main button destination"), text("secondary_cta_label", "Second button text", 80), link("secondary_cta_url", "Second button destination")] },
      { label: "The Holden Health app", fields: [area("app_eyebrow", "Eyebrow", 700), area("app_heading", "Heading", 700), area("app_body", "Body", 700), area("app_benefit_1_title", "Benefit 1 title", 700), area("app_benefit_1_body", "Benefit 1 body", 700), area("app_benefit_2_title", "Benefit 2 title", 700), area("app_benefit_2_body", "Benefit 2 body", 700), area("app_benefit_3_title", "Benefit 3 title", 700), area("app_benefit_3_body", "Benefit 3 body", 700), area("app_access", "Access", 700), area("app_cta_label", "Cta label", 700), area("app_login_label", "Login label", 700), area("app_preview_heading", "Preview heading", 700), area("app_preview_workout", "Preview workout", 700), area("app_preview_dose", "Preview dose", 700), area("app_preview_note", "Preview note", 700), link("app_cta_url", "Cta url"), link("app_login_url", "Login url")] },
      { label: "Current program", fields: [text("offer_eyebrow", "Small program line"), area("offer_heading", "Program headline", 220), area("offer_body", "Program description"), text("offer_cta_label", "Program button text", 80), link("offer_cta_url", "Program button destination")] },
      { label: "Bottom invitation", fields: [area("final_heading", "Final headline", 220), area("final_body", "Final description"), text("final_cta_label", "Final button text", 80), link("final_cta_url", "Final button destination")] },
    ],
    defaults: {
      "app_eyebrow": "The Holden Health app", "app_heading": "Your next workout. Your daily habits. One place.", "app_body": "The Holden Health app keeps your workouts, habit check-ins, and progress together—with guidance from Kelsey along the way.", "app_benefit_1_title": "Know what’s next.", "app_benefit_1_body": "Open your workout and follow the instructions at your own pace.", "app_benefit_2_title": "Keep small promises.", "app_benefit_2_body": "Check off the habits you’re working on, one day at a time.", "app_benefit_3_title": "See your consistency.", "app_benefit_3_body": "Look back at completed workouts and the progress you’re making.", "app_access": "Works in your phone’s browser. No app-store download needed. Available features depend on your program.", "app_cta_label": "Find your program", "app_login_label": "Open the app", "app_preview_heading": "Make a little room for you.", "app_preview_workout": "Workouts for your program", "app_preview_dose": "Follow your plan, one workout at a time", "app_preview_note": "Your workouts, habits, and progress in one place.", "app_cta_url": "https://www.holden.health/coaching.html", "app_login_url": "https://portal.holden.health/login",
      hero_eyebrow: "Focus on You · Group fitness in Plymouth", hero_heading: "Come get stronger with people who'll be glad you showed up.", hero_body: "Coached total-body training, practical nutrition support, and accountability with me, Kelsey. Find a group session that fits your schedule.", primary_cta_label: "See group classes", primary_cta_url: "coaching.html", secondary_cta_label: "Ask Kelsey about it", secondary_cta_url: "book.html", offer_eyebrow: "Now enrolling · October 13–November 21", offer_heading: "Six weeks. Your choice of two or three days. One supportive room.", offer_body: "Join up to 25 people for one-hour, total-body sessions in Plymouth. Choose any two weekly classes for $199 or attend all three for $249.", offer_cta_label: "See dates, prices & details", offer_cta_url: "coaching.html", final_heading: "Ready for a stronger routine?", final_body: "See the upcoming Focus on You group program for dates, class times, and prices.", final_cta_label: "Join the session", final_cta_url: "https://portal.holden.health/register",
      mini_eyebrow: "Now enrolling · December 1–19", mini_heading: "Three weeks. Nine classes. A good reason to keep showing up.", mini_body: "The December Focus on You mini session includes coached group fitness, nutrition habits, check-ins, and full Holden Health app access. One package covers every Tuesday, Wednesday, and Saturday class.", mini_cta_label: "Join the December mini session", mini_cta_url: "https://portal.holden.health/register?session=08a7d2af-b019-44a4-bf76-ffb357dce789",
    },
  },
  {
    key: "coaching", label: "Coaching", pathname: "/coaching.html", description: "The Focus on You program details and enrollment page.",
    sections: [
      { label: "Top of page", fields: [text("hero_eyebrow", "Small line above the headline"), text("hero_heading", "Highlighted headline words", 140), area("hero_body", "Intro paragraph"), text("primary_cta_label", "Join button text", 80), link("primary_cta_url", "Join button destination"), text("secondary_cta_label", "Late enrollment button text", 80), link("secondary_cta_url", "Late enrollment destination")] },
      { label: "What customers can expect", fields: [text("room_eyebrow", "Room section label"), area("room_heading", "Room section headline", 220), area("room_body", "Room section description"), text("schedule_eyebrow", "Schedule section label"), area("schedule_heading", "Schedule section headline", 220), area("schedule_body", "Schedule section description")] },
      { label: "Bottom invitation", fields: [area("final_heading", "Final headline", 220), area("final_body", "Final description"), text("final_cta_label", "Final button text", 80), link("final_cta_url", "Final button destination")] },
    ],
    defaults: {
      hero_eyebrow: "Focus on You · Group fitness in Plymouth", hero_heading: "stronger and steadier.", hero_body: "Welcoming total-body classes, practical nutrition habits, and Kelsey in your corner. Choose the session that fits your schedule.", primary_cta_label: "Join the session", primary_cta_url: "https://portal.holden.health/register", secondary_cta_label: "Ask about joining late", secondary_cta_url: "https://holden.health/contact.html", room_eyebrow: "What happens in the room", room_heading: "You won't be left guessing.", room_body: "Each class is coached total-body conditioning. Kelsey demonstrates, adjusts, and helps you choose the version that works for your body that day.", schedule_eyebrow: "Your class choices", schedule_heading: "Pick the days that fit this week.", schedule_body: "Your days can change. If you miss one, come to another class during the same session.", final_heading: "Want one of the 25 spots?", final_body: "See the upcoming group program and build a routine with Kelsey in your corner.", final_cta_label: "Join the session", final_cta_url: "https://portal.holden.health/register",
      mini_eyebrow: "Now enrolling · December 1–19, 2026", mini_heading: "A shorter way to finish the year strong.", mini_body: "Join Kelsey for three weeks of coached total-body classes in Plymouth, with nutrition habits, check-ins, and full app access included. One package covers all nine classes.", mini_cta_label: "Join the December mini session", mini_cta_url: "https://portal.holden.health/register?session=08a7d2af-b019-44a4-bf76-ffb357dce789",
    },
  },
  {
    key: "training", label: "Online Training", pathname: "/fitness-coaching.html", description: "The four-week online personal training offer.",
    sections: [
      { label: "Top of page", fields: [text("hero_eyebrow", "Small line above the headline"), area("hero_heading", "Supporting headline", 220), area("hero_body", "Intro paragraph"), text("hero_cta_label", "Main button text", 80), link("hero_cta_url", "Main button destination")] },
      { label: "Coaching package", fields: [area("offer_heading", "Package headline", 220), area("offer_body", "Package description")] },
      { label: "Bottom invitation", fields: [area("final_heading", "Final headline", 220), area("final_body", "Final description"), text("final_cta_label", "Final button text", 80), link("final_cta_url", "Final button destination")] },
    ],
    defaults: {
      hero_eyebrow: "Online personal training · Wherever you train", hero_heading: "Your workouts. Your goals. Your plan.", hero_body: "This is not a workout plan you download and forget about. Kelsey builds your four-week plan around your goals, schedule, equipment, and fitness level, then coaches you through it.", hero_cta_label: "Book a free consultation", hero_cta_url: "https://holden.health/book.html", offer_heading: "A complete four-week plan with a real coach behind it.", offer_body: "You get the workouts, guidance, accountability, and adjustments you need to keep moving forward without arranging your week around in-person appointments.", final_heading: "Let's build a stronger, healthier you.", final_body: "Start with a free consultation. Kelsey will help you understand the plan and arrange payment when you are ready.", final_cta_label: "Book a free consultation", final_cta_url: "https://holden.health/book.html",
    },
  },
  {
    key: "about", label: "Meet Kelsey", pathname: "/about.html", description: "Kelsey's introduction, story, approach, and credentials.",
    sections: [
      { label: "Meet Kelsey", fields: [text("hero_eyebrow", "Small line above the headline"), text("hero_heading", "Highlighted name in headline", 80), area("hero_body", "Intro paragraph"), text("hero_cta_label", "Intro button text", 80), link("hero_cta_url", "Intro button destination")] },
      { label: "Story and approach", fields: [text("story_eyebrow", "Story section label"), area("story_heading", "Story section headline", 180), area("story_intro", "Opening story paragraph"), text("community_eyebrow", "Community section label"), area("community_heading", "Community section headline", 220), area("community_body", "Community section description")] },
      { label: "Bottom invitation", fields: [area("final_heading", "Final headline", 220), area("final_body", "Final description"), text("final_cta_label", "Final button text", 80), link("final_cta_url", "Final button destination")] },
    ],
    defaults: {
      hero_eyebrow: "Meet your coach", hero_heading: "Kelsey.", hero_body: "Certified personal trainer, nutrition coach, group fitness instructor, and a mom of two daughters who genuinely believes getting healthy shouldn't take over your life.", hero_cta_label: "Book a free call", hero_cta_url: "book.html", story_eyebrow: "My story", story_heading: "Why I do this", story_intro: "For years I watched people, including myself, jump from one extreme plan to the next. Lose some weight, burn out, gain it back, feel worse. The problem was never willpower. It was the all-or-nothing approach.", community_eyebrow: "More community, less intimidation", community_heading: "I've always coached people, not poses.", community_body: "Before Holden Health grew into in-person and online coaching, it looked like early mornings, park workouts, crowded group photos, kids tagging along, and people at every starting point showing up together.", final_heading: "Let's get to know each other", final_body: "Book a free intro call. We'll talk goals, life, and whether we're a good fit. No pressure at all.", final_cta_label: "Book a free intro call", final_cta_url: "book.html",
    },
  },
  {
    key: "resources", label: "Resources", pathname: "/resources.html", description: "Free guides, practical tools, and articles.",
    sections: [
      { label: "Top of page", fields: [text("hero_eyebrow", "Small line above the headline"), text("hero_heading", "Highlighted headline words", 120), area("hero_body", "Intro paragraph")] },
      { label: "Free guide", fields: [text("guide_eyebrow", "Guide label"), area("guide_heading", "Guide headline", 180), area("guide_body", "Guide description"), text("guide_cta_label", "Guide button text", 80)] },
      { label: "Start here and invitation", fields: [area("start_heading", "Start-here headline", 220), area("start_body", "Start-here description"), area("final_heading", "Final headline", 220), area("final_body", "Final description"), text("final_cta_label", "Final button text", 80), link("final_cta_url", "Final button destination")] },
    ],
    defaults: {
      hero_eyebrow: "Free resources & tips", hero_heading: "actually use.", hero_body: "No fluff, no fads. Practical tips on training, nutrition, and building habits that fit your real life, plus a free guide to get you started.", guide_eyebrow: "Free download", guide_heading: "5 habits that change everything", guide_body: "The five simple, no-diet habits Kelsey starts every client with. They make the biggest difference with the least overwhelm.", guide_cta_label: "Send me the guide", start_heading: "What do you need help with today?", start_body: "Skip the endless scrolling. Pick the situation that sounds most like your week and leave with one clear next step.", final_heading: "Want this tailored to you?", final_body: "Free tips are great, but a coach in your corner is better. Book a free intro call and let's build your plan.", final_cta_label: "Book a free intro call", final_cta_url: "book.html",
    },
  },
  {
    key: "contact", label: "Contact", pathname: "/contact.html", description: "How customers reach Kelsey and what the form says.",
    sections: [
      { label: "Contact introduction", fields: [text("hero_eyebrow", "Small line above the headline"), text("hero_heading", "Highlighted headline word", 80), area("hero_body", "Intro paragraph")] },
      { label: "Message form", fields: [area("form_heading", "Form headline", 180), area("form_body", "Form instructions"), text("form_cta_label", "Send button text", 80), area("success_heading", "Success headline", 180), area("success_body", "Success message")] },
    ],
    defaults: {
      hero_eyebrow: "Get in touch", hero_heading: "talk.", hero_body: "Questions about group classes, personal training, or the free habit challenge? Send Kelsey a note. Consultation requests receive a response within 12 hours.", form_heading: "Send a message", form_body: "Tell Kelsey a little about your goals and what you're looking for.", form_cta_label: "Send message", success_heading: "Message sent! 🎉", success_body: "Thanks for reaching out. Kelsey will get back to you soon.",
    },
  },
  simplePage("not-found", "Page Not Found", "/404.html", "The page visitors see for a missing link."),
  simplePage("personal-training", "Personal Training", "/personal-training.html", "One-to-one training in Plymouth; consultation first."),
  simplePage("backup-plan", "The Backup Plan Still Works", "/backup-plan.html", "A welcome note from Kelsey."),
  simplePage("nutrition", "Nutrition Coaching", "/nutrition-coaching.html", "Online nutrition coaching information."),
  simplePage("booking", "Book a Call", "/book.html", "The consultation booking page."),
  simplePage("wednesday-reset", "Wednesday Reset", "/wednesday-reset.html", "The free Wednesday Reset signup page."),
  simplePage("quiz", "Find Your Next Step Quiz", "/quiz.html", "The website coaching quiz."),
  simplePage("recipes", "Recipes", "/recipes.html", "The recipe library."),
  simplePage("strength-workout", "20-Minute Strength Workout", "/20-minute-strength-workout.html", "A free full-body strength workout."),
  simplePage("first-training-session", "Your First Personal Training Session", "/first-personal-training-session.html", "Preparing for personal training with Kelsey in Plymouth."),
  simplePage("online-trainer-vs-app", "Online Personal Trainer vs. Workout App", "/online-personal-trainer-vs-workout-app.html", "A guide to choosing the right amount of coaching support."),
  simplePage("lifting-guide", "Beginner's Lifting Guide", "/beginners-guide-to-lifting.html", "The beginner strength-training guide."),
  simplePage("back-on-track", "Get Back on Track", "/get-back-on-track.html", "A practical habit reset article."),
  simplePage("protein-habit", "Protein Habit", "/protein-habit.html", "A practical protein habit article."),
  simplePage("eating-out", "Eating Out With Your Goals", "/eating-out-with-your-goals.html", "A guide to eating out while supporting health goals."),
  simplePage("all-or-nothing", "All-or-Nothing Thinking", "/blog-all-or-nothing.html", "An article about moving beyond all-or-nothing habits."),
  simplePage("wednesday-note", "Wednesday Note", "/wednesday-note.html", "The Wednesday email signup page."),
  simplePage("privacy", "Privacy Policy", "/privacy.html", "The website privacy policy."),
  simplePage("terms", "Website Terms", "/terms.html", "The website terms."),
  simplePage("disclaimer", "Health Disclaimer", "/disclaimer.html", "The health and fitness disclaimer."),
];


const seoDefaults: Record<string, {seo_title:string;seo_description:string}> = {
  "/nutrition-coaching.html": {
    "seo_title": "Online Nutrition Coaching in Metro Detroit | Holden Health",
    "seo_description": "Habit-based online nutrition coaching with Kelsey Holden for busy adults in Metro Detroit and beyond. Practical guidance without rigid meal plans or guilt."
  },
  "/wednesday-reset.html": {
    "seo_title": "Free Wednesday Reset | Get Back on Track",
    "seo_description": "Build a free 60-second fitness and nutrition reset from Holden Health. Get a small, realistic plan for a week that went sideways. No email required."
  },
  "/fitness-coaching.html": {
    "seo_title": "Online Personal Training | Holden Health",
    "seo_description": "Online personal training with Kelsey Holden: a personalized four-week workout plan, weekly Zoom coaching, direct text support, accountability, and progress tracking for $199."
  },
  "/": {
    "seo_title": "Personal Training & Group Fitness in Plymouth, MI | Holden Health",
    "seo_description": "Group fitness in Plymouth, MI and online personal training with Kelsey Holden. Get practical nutrition support, guided workouts, and habit tracking in one app."
  },
  "/coaching.html": {
    "seo_title": "Group Fitness Sessions in Plymouth, MI | Holden Health",
    "seo_description": "Join Focus on You group fitness in Plymouth with coached classes, nutrition habits, and accountability. See upcoming session dates and prices."
  },
  "/20-minute-strength-workout.html": {
    "seo_title": "20-Minute Full-Body Strength Workout | Holden Health",
    "seo_description": "A complete 20-minute full-body strength workout for busy weeks, with beginner-friendly exercise swaps and a simple progression plan."
  },
  "/about.html": {
    "seo_title": "Kelsey Holden | Metro Detroit Personal Trainer",
    "seo_description": "Meet Kelsey Holden, a Metro Detroit personal trainer and nutrition coach with experience dating to 2011. Learn her story, credentials, and approach."
  },
  "/contact.html": {
    "seo_title": "Contact a Personal Trainer in Plymouth, MI | Holden Health",
    "seo_description": "Contact Kelsey Holden about group fitness in Plymouth or online fitness and nutrition coaching. Send a message or request a free intro call."
  },
  "/get-back-on-track.html": {
    "seo_title": "How to Get Back on Track After an Off Week",
    "seo_description": "A kind, practical reset after missed workouts, travel, illness, or an off week without punishment, restriction, or waiting for Monday."
  },
  "/disclaimer.html": {
    "seo_title": "Health Disclaimer | Holden Health",
    "seo_description": "Important health and fitness information for visitors to Holden Health."
  },
  "/terms.html": {
    "seo_title": "Website Terms | Holden Health",
    "seo_description": "Terms for using the Holden Health website and its educational content."
  },
  "/protein-habit.html": {
    "seo_title": "How to Eat More Protein Without Tracking | Holden Health",
    "seo_description": "A practical, no-tracking guide to eating more protein at breakfast, lunch, and dinner so meals feel satisfying and strength training is better supported."
  },
  "/wednesday-note.html": {
    "seo_title": "The Wednesday Note | Fitness Advice from Kelsey Holden",
    "seo_description": "A short weekly fitness and nutrition note from Kelsey Holden: one useful thought, one realistic action, and no pressure to start over."
  },
  "/quiz.html": {
    "seo_title": "Fitness & Nutrition Coaching Quiz | Holden Health",
    "seo_description": "Not sure which coaching plan fits? Take this quick quiz and get a personalized recommendation from Holden Health in under a minute."
  },
  "/eating-out-with-your-goals.html": {
    "seo_title": "Eating Out Without Derailing Your Goals | Holden Health",
    "seo_description": "Enjoy restaurants while supporting your nutrition goals with a flexible plate guide, ordering tips, and a no-guilt approach to special meals."
  },
  "/resources.html": {
    "seo_title": "Fitness & Nutrition Resources | Holden Health",
    "seo_description": "Free fitness and nutrition resources from Holden Health. Practical tips on training, nutrition, and building lasting habits, plus a free 5-habits guide."
  },
  "/beginners-guide-to-lifting.html": {
    "seo_title": "Beginner's Guide to Lifting Without Fear | Holden Health",
    "seo_description": "A plain-English beginner's guide to strength training: what to do, how much weight to use, gym etiquette, soreness, and a simple first workout."
  },
  "/blog-all-or-nothing.html": {
    "seo_title": "How to Break the All-or-Nothing Fitness Mindset",
    "seo_description": "The all-or-nothing mindset, not willpower, is what stalls most people. Here's the shift that finally lets results stick, from coach Kelsey Holden."
  },
  "/book.html": {
    "seo_title": "Free Fitness Coaching Consultation | Holden Health",
    "seo_description": "Book a free, no-pressure 30–60 minute consultation with Kelsey Holden. Talk through your goals and find the right fitness or nutrition coaching plan for you."
  },
  "/custom-page.html": {
    "seo_title": "Holden Health",
    "seo_description": "Personal fitness and nutrition coaching from Holden Health."
  },
  "/recipes.html": {
    "seo_title": "High-Protein Recipes | Holden Health",
    "seo_description": "Simple, high-protein recipes from coach Kelsey Holden. Real food, real fast, built for busy mornings and no-diet eating."
  },
  "/privacy.html": {
    "seo_title": "Privacy Policy | Holden Health",
    "seo_description": "How Holden Health collects, uses, and protects information you share through this website."
  }
};
for (const page of websitePages) {
 const defaults = seoDefaults[page.pathname];
 if (!defaults) continue;
 page.sections.push({label:"Search appearance",fields:[text("seo_title","Page title",120),area("seo_description","Search description",300)]});
 Object.assign(page.defaults,defaults);
}

export const websitePageKeys = websitePages.map((page) => page.key);

export type WebsiteCustomPage = { key: string; label: string; slug: string };
export type WebsiteSettings = { drop_in_visible: boolean; page_order: string[]; custom_pages: WebsiteCustomPage[]; featured_session_id: string; featured_headline: string; featured_body: string; featured_button: string };

const defaultNavigationKeys = ["homepage", "coaching", "training", "about", "resources", "contact"];

export function customWebsitePage(custom: WebsiteCustomPage): WebsitePageConfig {
  return {
    key: custom.key,
    label: custom.label,
    pathname: `/pages/${custom.slug}`,
    description: "A custom page created in the website editor.",
    sections: [{ label: "Top of page", fields: [text("hero_eyebrow", "Small line above the headline"), area("hero_heading", "Main headline", 220), area("hero_body", "Intro paragraph"), text("hero_cta_label", "Button text", 80), link("hero_cta_url", "Button destination")] }],
    defaults: {
      hero_eyebrow: "Holden Health",
      hero_heading: custom.label,
      hero_body: "Add a clear, welcoming introduction to this page.",
      hero_cta_label: "Talk with Kelsey",
      hero_cta_url: "book.html",
    },
  };
}

export function normalizeWebsiteSettings(value: unknown): WebsiteSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const customPages = Array.isArray(source.custom_pages) ? source.custom_pages.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const page = item as Record<string, unknown>;
    const slug = String(page.slug ?? "").trim().toLowerCase();
    const label = String(page.label ?? "").trim().slice(0, 80);
    const key = String(page.key ?? "").trim();
    return /^custom:[a-z0-9][a-z0-9-]{1,62}$/.test(key) && /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) && label ? [{ key, label, slug }] : [];
  }).slice(0, 30) : [];
  const validKeys = new Set([...websitePageKeys, ...customPages.map((page) => page.key)]);
  const savedOrder = Array.isArray(source.page_order) ? source.page_order.map(String).filter((key) => validKeys.has(key)) : [];
  const pageOrder = [...new Set([...savedOrder, ...websitePageKeys, ...customPages.map((page) => page.key)])];
  return { drop_in_visible: source.drop_in_visible === true, page_order: pageOrder, custom_pages: customPages,
    featured_session_id: typeof source.featured_session_id === "string" ? source.featured_session_id : "",
    featured_headline: typeof source.featured_headline === "string" ? source.featured_headline.slice(0, 220) : "",
    featured_body: typeof source.featured_body === "string" ? source.featured_body.slice(0, 700) : "",
    featured_button: typeof source.featured_button === "string" ? source.featured_button.slice(0, 80) : "" };
}

export function websitePagesForSettings(settings: WebsiteSettings) {
  const pages = [...websitePages, ...settings.custom_pages.map(customWebsitePage)];
  const order = new Map(settings.page_order.map((key, index) => [key, index]));
  return pages.sort((a, b) => (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER));
}

export function websiteNavigationForSettings(settings: WebsiteSettings) {
  const visibleKeys = new Set([...defaultNavigationKeys, ...settings.custom_pages.map((page) => page.key)]);
  return websitePagesForSettings(settings).filter((page) => visibleKeys.has(page.key)).map((page) => ({ key: page.key, label: page.label, href: page.pathname === "/" ? "/index.html" : page.pathname }));
}

export function getWebsitePage(key: string | null | undefined, pages: WebsitePageConfig[] = websitePages) { return pages.find((page) => page.key === key); }
