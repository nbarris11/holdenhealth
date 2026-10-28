export type MemberNavItem = { href: string; label: "Workouts" | "Habits" | "Messages"; icon: "work" | "habits" | "chat"; badge?: number };

// Messages is only shown to members who can use it (paid programs).
export function memberNavItems({ canChat, habitUnread }: { canChat: boolean; habitUnread: number }): MemberNavItem[] {
  return [
    { href: "/portal/workouts", label: "Workouts", icon: "work" },
    { href: "/portal/habits", label: "Habits", icon: "habits", ...(habitUnread > 0 ? { badge: habitUnread } : {}) },
    ...(canChat ? [{ href: "/portal/communicate", label: "Messages" as const, icon: "chat" as const }] : []),
  ];
}
