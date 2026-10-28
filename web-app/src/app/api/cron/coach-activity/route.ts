import {deliverCoachActivity} from "@/lib/coach-activity";
import {NextResponse} from "next/server";
export async function GET(request:Request) {
 if(!process.env.CRON_SECRET || request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 await deliverCoachActivity();return NextResponse.json({ok:true});
}
