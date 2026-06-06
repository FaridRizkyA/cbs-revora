import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { getAuthSession, getRouteByRole } from "../utils/authSession";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      getAuthSession()
        .then((session) => {
          if (!session?.token || !session?.user?.role_name) {
            router.replace("/login");
            return;
          }

          router.replace(getRouteByRole(session.user.role_name));
        })
        .catch(() => {
          router.replace("/login");
        });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Image
          source={require("../assets/images/ui/logo_koperasi_cbs.png")}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <Image
          source={require("../assets/images/ui/logo_horizontal.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logo: {
    width: 320,
    height: 320,
    maxWidth: "90%",
  },
});
