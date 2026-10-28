"use client";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
const items = [
  { href: "/portal/today", label: "Today", icon: "sun" },
  { href: "/portal/workouts", label: "Workouts", icon: "work" },
  { href: "/portal/progress", label: "Progress", icon: "chart" },
  { href: "/portal/more", label: "More", icon: "more" },
];
function Icon({ name }: { name: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {name === "sun" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      ) : name === "work" ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="m8 9 2 2 5-5M8 15h8m-8 3h5" />
        </>
      ) : name === "chart" ? (
        <>
          <path d="M4 20h16M6 16v-4m6 4V5m6 11V9" />
        </>
      ) : (
        <>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </>
      )}
    </svg>
  );
}
export default function MemberNav({ hasClasses = false }: { hasClasses?: boolean }) {
  const navigation = hasClasses ? [...items.slice(0, 2), { href: "/portal/session", label: "Classes", icon: "work" }, ...items.slice(2)] : items;
  const path = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  const challenge = params.get("challenge");
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return (
    <nav className="member-bottom-nav" aria-label="Member app">
      {navigation.map((item) => {
        const active =
          path.startsWith(item.href) ||
          (item.label === "Today" && path === "/portal/habits") ||
          (item.label === "More" &&
            ["/portal/intake", "/portal/training"].some(
              (p) => path.startsWith(p),
            ));
        return (
          <Link
            key={item.href}
            href={`${item.href}${item.label === "Classes" && params.get("enrollment") ? `?enrollment=${encodeURIComponent(params.get("enrollment")!)}` : challenge ? `?challenge=${encodeURIComponent(challenge)}` : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MemberAccountLink() {
  const params = useSearchParams();
  const challenge = params.get("challenge");
  return <Link className="member-account" href={`/portal/more${challenge ? `?challenge=${encodeURIComponent(challenge)}` : ""}`}>My account</Link>;
}
