export const headerFields = [
  {key:"brand_name",label:"Brand name",value:"Holden Health"},
  {key:"brand_tagline",label:"Brand tagline",value:"Train · Nourish · Thrive"},
  {key:"brand_url",label:"Logo destination",value:"/index.html",link:true},
  {key:"logo_url",label:"Logo image URL",value:"/assets/logo.png",link:true},
  {key:"personal-training_label",label:"Personal training link",value:"Personal Training"},
  {key:"personal-training_url",label:"Personal training destination",value:"/personal-training.html",link:true},
  {key:"group_url",label:"Group fitness destination",value:"/coaching.html",link:true},
  {key:"training_url",label:"Online training destination",value:"/fitness-coaching.html",link:true},
  {key:"about_url",label:"About destination",value:"/about.html",link:true},
  { key: "coaching_label", label: "Coaching menu", value: "Coaching" },
  { key: "group_label", label: "Group fitness link", value: "Group Fitness" },
  {
    key: "training_label",
    label: "Online training link",
    value: "Online Training",
  },
  { key: "about_label", label: "About link", value: "About Me" },
  { key: "login_label", label: "Login link text", value: "Log in" },
  {
    key: "login_url",
    label: "Login destination",
    value: "https://portal.holden.health/login",
    link: true,
  },
  { key: "call_label", label: "Free call button text", value: "Free call" },
  {
    key: "call_url",
    label: "Free call destination",
    value: "/book.html",
    link: true,
  },
] as const;
export type WebsiteHeader = Record<string, string | boolean>;
export function validHeaderLink(value: string) {
  if (
    /^\/(?!\/)[a-z0-9/_\-.]*(?:[?#][^\s\\]*)?$/i.test(value) &&
    !value.includes("\\")
  )
    return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function normalizeHeader(value: unknown): WebsiteHeader {
  const raw =
    value && typeof value === "object" ? (value as WebsiteHeader) : {};
  return {
    ...Object.fromEntries(
      headerFields.map((f) => [
        f.key,
        typeof raw[f.key] === "string" &&
        String(raw[f.key]).trim() &&
        String(raw[f.key]).length <= ("link" in f ? 700 : 30) &&
        (!("link" in f) || validHeaderLink(String(raw[f.key])))
          ? raw[f.key]
          : f.value,
      ]),
    ),
    call_visible: raw.call_visible !== false,
  };
}
