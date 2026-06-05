import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { getAuthSession, normalizeRole } from "../../utils/authSession";

export default function MemberLayout() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then(async (session) => {
        if (!active) return;
        if (!session?.token || !normalizeRole(session?.user?.role_name)) {
          router.replace("/login");
          return;
        }

        const response = await fetchWithAuth("/api/member/access");
        const payload = await response.json();
        if (!response.ok || !payload?.data?.is_member) {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));

    return () => {
      active = false;
    };
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
