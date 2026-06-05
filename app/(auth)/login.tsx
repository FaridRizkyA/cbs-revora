import { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../../components/forms/AppButton";
import AppInput from "../../components/forms/AppInput";
import { getRouteByRole, saveAuthSession } from "../../utils/authSession";
import { API_BASE_URL } from "../../utils/api";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhoneLandscape = shortSide < 768 && width > height;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const isTabletLike = shortSide >= 768;
  const baseWidth = isTabletLike ? 520 : 360;
  const baseHeight = isTabletLike ? 700 : 740;
  const framePadding = isTabletLike ? 24 : 14;
  const safeWidth = Math.max(width - framePadding * 2, 280);
  const safeHeight = Math.max(height - insets.top - insets.bottom - framePadding * 2, 520);
  const widthScale = safeWidth / baseWidth;
  const heightScale = safeHeight / baseHeight;
  const fitScale = Math.min(1, widthScale, heightScale);
  const contentScale = isTabletLike ? fitScale : fitScale * 0.9;
  const contentWidth = baseWidth;
  const logoSize = isTabletLike ? 164 : 132;
  const verticalGap = isTabletLike ? 22 : 18;
  const titleSize = isTabletLike ? 30 : 28;
  const subtitleSize = 14;
  const subtitleWidth = 320;

  const handleLogin = async () => {
    const identifier = email.trim();

    if (!identifier || !password) {
      setLoginError("Email and password are required.");
      return;
    }

    try {
      setSubmitting(true);
      setLoginError(null);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: identifier,
          password,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Login failed.");
      }

      const token = payload?.data?.token;
      const user = payload?.data?.user;

      if (!token || !user) {
        throw new Error("Invalid login response.");
      }

      await saveAuthSession({ token, user });
      router.replace(getRouteByRole(user.role_name));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/images/ui/login_bg.png")}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.backgroundOverlay} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View
          style={[
            styles.container,
            Platform.OS === "ios" && styles.iosKeyboardSpacing,
            { paddingTop: Math.max(insets.top, framePadding), paddingBottom: Math.max(insets.bottom, framePadding) },
          ]}
        >
          <View style={[styles.contentScaleWrap, isPhoneLandscape && { transform: [{ translateY: -18 }] }]}>
            <View
              style={[
                styles.content,
                {
                  width: contentWidth,
                  gap: verticalGap,
                  transform: [{ scale: contentScale }],
                },
              ]}
            >
                <View style={styles.header}>
                  <View style={[styles.logoFrame, { height: logoSize }]}>
                    <Image
                      source={require("../../assets/images/ui/logo_clean.png")}
                      style={[styles.logo, { width: logoSize, height: logoSize }]}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.title, { fontSize: titleSize }]}>Sign in to REVORA</Text>
                  <Text style={[styles.subtitle, { fontSize: subtitleSize, maxWidth: subtitleWidth }]}>
                    Manage cooperative operations from one app.
                  </Text>
                </View>

                <View style={styles.card}>
                  <AppInput
                    label="Username or Email"
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />

                  <View style={styles.passwordSection}>
                    <Text style={styles.passwordLabel}>Password</Text>
                    <View style={styles.passwordInputWrap}>
                      <TextInput
                        placeholder="Enter your password"
                        placeholderTextColor="#61708a"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={password}
                        onChangeText={setPassword}
                        style={styles.passwordInput}
                      />
                      <Pressable
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.passwordIconButton}
                        hitSlop={10}
                      >
                        <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#0f274a" />
                      </Pressable>
                    </View>
                  </View>

                  <AppButton
                    title={submitting ? "Signing In..." : "Sign In"}
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={submitting}
                  />
                  {submitting ? (
                    <View style={styles.statusWrap}>
                      <ActivityIndicator size="small" color="#102852" />
                    </View>
                  ) : null}
                  {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
                  <Pressable style={styles.helpButton}>
                    <Text style={styles.helpText}>Need help signing in?</Text>
                  </Pressable>
                </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(243, 247, 253, 0.5)",
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  iosKeyboardSpacing: {
    paddingVertical: 22,
  },
  contentScaleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    gap: 10,
  },
  logoFrame: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 132,
    height: 132,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#102852",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#4b5f7b",
    textAlign: "center",
    maxWidth: 320,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: "#0b3c74",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  passwordSection: {
    gap: 8,
  },
  passwordLabel: {
    color: "#53657f",
    fontSize: 12,
    fontWeight: "800",
  },
  passwordInputWrap: {
    position: "relative",
  },
  passwordInput: {
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(147, 172, 206, 0.42)",
    borderRadius: 8,
    borderWidth: 1,
    color: "#061329",
    paddingHorizontal: 12,
    paddingRight: 44,
  },
  passwordIconButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButton: {
    backgroundColor: "#102852",
  },
  helpButton: {
    alignSelf: "center",
  },
  helpText: {
    color: "#496284",
    fontSize: 13,
    fontWeight: "700",
  },
  statusWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
