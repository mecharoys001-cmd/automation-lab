import { createClient } from "@/lib/supabase/server";
import { isSiteAdmin, getSiteAdmin } from "@/lib/site-rbac";
import UserIndicatorClient from "./UserIndicatorClient";

export default async function UserIndicatorServer() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    let isAdmin = false;
    if (email) {
      const adminInfo = await getSiteAdmin(email);
      isAdmin = isSiteAdmin(adminInfo);
    }
    return <UserIndicatorClient email={email} isAdmin={isAdmin} />;
  } catch {
    return <UserIndicatorClient email={null} isAdmin={false} />;
  }
}
