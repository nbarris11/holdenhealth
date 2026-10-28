import { verifyAdmin } from "@/lib/auth";
import ChatInbox from "@/components/chat-inbox";
export default async function Communicate({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  await verifyAdmin();
  return (
    <ChatInbox admin initialConversation={(await searchParams).conversation} />
  );
}
