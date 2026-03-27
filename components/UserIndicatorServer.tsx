import { createClient } from "@/lib/supabase/server";
import { isSiteAdmin, getSiteAdmin } from "@/lib/site-rbac";
import { getUserSuites } from "@/lib/tool-access";
import UserIndicatorClient from "./UserIndicatorClient";

export default async function UserIndicatorServer() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email ?? null;
    let isAdmin = false;
    let isSuiteManager = false;
    if (email) {
      const adminInfo = await getSiteAdmin(email);
      isAdmin = isSiteAdmin(adminInfo);
      if (!isAdmin) {
        const suites = await getUserSuites(email);
        isSuiteManager = suites.some(s => s.role === 'manager');
      }
    }
    return <UserIndicatorClient email={email} isAdmin={isAdmin} isSuiteManager={isSuiteManager} />;
  } catch {
    return <UserIndicatorClient email={null} isAdmin={false} isSuiteManager={false} />;
  }
}
