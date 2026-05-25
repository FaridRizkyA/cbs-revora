import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { canAccessCashierMode, getAuthSession, getRouteByRole } from "../../utils/authSession";

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

      if (!canAccessCashierMode(roleName)) {
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
