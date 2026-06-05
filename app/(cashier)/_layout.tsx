import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { canAccessCashierModeWithGrade, getAuthSession, getRouteByRole } from "../../utils/authSession";

export default function CashierLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const session = await getAuthSession();
      const roleName = session?.user?.role_name;

      if (!session?.token || !roleName) {
        router.replace("/login");
        return;
      }

      if (!canAccessCashierModeWithGrade(roleName, session?.user?.staff_grade_name || null)) {
        router.replace(getRouteByRole(roleName));
        return;
      }

      if (active) {
        setReady(true);
      }
    };

    checkAuth().catch(() => {
      router.replace("/login");
    });

    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return <View style={{ flex: 1 }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
