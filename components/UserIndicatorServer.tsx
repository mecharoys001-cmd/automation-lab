import { createClient } from "@/lib/supabase/server";
import UserIndicatorClient from "./UserIndicatorClient";

export default async function UserIndicatorServer() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return <UserIndicatorClient email={user?.email ?? null} />;
  } catch {
    return <UserIndicatorClient email={null} />;
  }
}
