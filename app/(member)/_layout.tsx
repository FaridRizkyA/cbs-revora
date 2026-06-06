import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import {
  canAccessMemberPath,
  getAuthSession,
  getRouteByRole,
  isAuthSessionExpired,
  logoutAuthSession,
  normalizeRole,
} from "../../utils/authSession";

export default function MemberLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleExpiryLogout = (expiresAt?: string | null) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      if (!expiresAt) return;
      const delay = new Date(expiresAt).getTime() - Date.now();
      if (!Number.isFinite(delay)) return;
      expiryTimer = setTimeout(async () => {
        if (!active) return;
        await logoutAuthSession();
        router.replace("/login?expired=1");
      }, Math.max(delay, 0));
    };

    const checkAuth = async () => {
      const session = await getAuthSession();
      const roleName = normalizeRole(session?.user?.role_name);

      if (!session?.token || !roleName) {
        router.replace("/login");
        return;
      }

      if (isAuthSessionExpired(session)) {
        await logoutAuthSession();
        router.replace("/login?expired=1");
        return;
      }

      // Check if path is valid for members
      if (!canAccessMemberPath(pathname)) {
        // Only redirect if we are actually in the member segment but at an invalid sub-path
        if (pathname.startsWith("/(member)") || pathname.startsWith("/member")) {
           router.replace("/(member)/dashboard");
        }
        return;
      }

      const response = await fetchWithAuth("/api/member/access");
      const payload = await response.json();
      if (!response.ok || !payload?.data?.is_member) {
        // If not a member, kick back to their role's default route or login
        router.replace(getRouteByRole(roleName));
        return;
      }

      if (active) {
        scheduleExpiryLogout(session.expires_at);
        setReady(true);
      }
    };

    checkAuth().catch(() => {
      if (active) router.replace("/login");
    });

    return () => {
      active = false;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [pathname, router]);

  if (!ready) {
    return <View style={{ flex: 1 }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
