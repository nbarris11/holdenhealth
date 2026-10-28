import { redirect } from "next/navigation";
import { hasChatAccess } from "@/lib/chat-access";
import { verifySession } from "@/lib/auth";
import ChatInbox from "@/components/chat-inbox";
export default async function Communicate({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  await verifySession();
  if (!(await hasChatAccess())) redirect("/portal/workouts");
  return <ChatInbox initialConversation={(await searchParams).conversation} />;
}
