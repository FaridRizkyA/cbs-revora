import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { canAccessCashierModeWithGrade, getAuthSession, getRouteByRole, isAuthSessionExpired, logoutAuthSession } from "../../utils/authSession";

export default function CashierLayout() {
  const router = useRouter();
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
      const roleName = session?.user?.role_name;

      if (!session?.token || !roleName) {
        router.replace("/login");
        return;
      }
      if (isAuthSessionExpired(session)) {
        await logoutAuthSession();
        router.replace("/login?expired=1");
        return;
      }

      if (!canAccessCashierModeWithGrade(roleName, session?.user?.staff_grade_name || null)) {
        router.replace(getRouteByRole(roleName));
        return;
      }

      if (active) {
        scheduleExpiryLogout(session.expires_at);
        setReady(true);
      }
    };

    checkAuth().catch(() => {
      router.replace("/login");
    });

    return () => {
      active = false;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [router]);

  if (!ready) {
    return <View style={{ flex: 1 }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
