import { createClient } from "@/lib/supabase/server";
import UserIndicatorClient from "./UserIndicatorClient";

export default async function UserIndicatorServer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <UserIndicatorClient email={user?.email ?? null} />;
}
