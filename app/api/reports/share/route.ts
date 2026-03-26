import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import { nanoid } from "nanoid";
import { requireAdmin, requireMinRole } from "@/lib/api-auth";

function getRedis() {
  const url = process.env.report01_REDIS_URL;
  if (!url) throw new Error("report01_REDIS_URL not configured");
  return new Redis(url, { lazyConnect: true, connectTimeout: 5000 });
}

const SHARE_PREFIX = "report:share:";
const EXPIRY_SECONDS = 60 * 60 * 24 * 90; // 90 days

// POST — store share data, return short ID
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { data } = await req.json();
    if (!data || typeof data !== "string") {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }
    if (data.length > 500_000) {
      return NextResponse.json({ error: "Data too large" }, { status: 413 });
    }

    const id = nanoid(8);
    const redis = getRedis();
    try {
      await redis.set(SHARE_PREFIX + id, data, "EX", EXPIRY_SECONDS);
    } finally {
      redis.disconnect();
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("Share POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

// GET — retrieve share data by ID
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const redis = getRedis();
    let data: string | null;
    try {
      data = await redis.get(SHARE_PREFIX + id);
    } finally {
      redis.disconnect();
    }

    if (!data) {
      return NextResponse.json({ error: "Not found or expired" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Share GET error:", err);
    return NextResponse.json({ error: "Failed to retrieve" }, { status: 500 });
  }
}
