import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { InventoryConfirmModal, InventoryResultModal } from "../../components/inventory/ActionModals";
import AppButton from "../../components/forms/AppButton";
import AppInput from "../../components/forms/AppInput";
import { API_BASE_URL } from "../../utils/api";
import { getRouteByRole, saveAuthSession } from "../../utils/authSession";
import { isValidPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "../../utils/passwordPolicy";

type AuthView = "login" | "forgot-email" | "forgot-otp" | "forgot-reset";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ expired?: string; displaced?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhoneLandscape = shortSide < 768 && width > height;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [displacedModalOpen, setDisplacedModalOpen] = useState(false);
  const isTabletLike = shortSide >= 768;
  const baseWidth = isTabletLike ? 560 : 420;
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

  useEffect(() => {
    if (params.expired === "1") {
      setLoginError("Your session has expired. Please sign in again.");
    }
    if (params.displaced === "1") {
      setDisplacedModalOpen(true);
    }
  }, [params.expired, params.displaced]);

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

      await saveAuthSession({ token, user, expires_at: payload?.data?.expires_at || null });
      router.replace(getRouteByRole(user.role_name));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitForgotEmail = async () => {
    const targetEmail = resetEmail.trim();
    if (!targetEmail) {
      setLoginError("Email is required.");
      return;
    }
    try {
      setSubmitting(true);
      setLoginError(null);
      setResetMessage(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to send OTP.");
      setResetMessage("OTP has been sent to your email.");
      setAuthView("forgot-otp");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Failed to send OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async () => {
    if (!resetOtp.trim()) {
      setLoginError("OTP is required.");
      return;
    }
    try {
      setSubmitting(true);
      setLoginError(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim(), otp: resetOtp.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Invalid OTP.");
      setAuthView("forgot-reset");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Failed to verify OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitResetPassword = async () => {
    if (!isValidPasswordPolicy(newPassword)) {
      setLoginError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setLoginError("Password confirmation does not match.");
      return;
    }
    try {
      setSubmitting(true);
      setLoginError(null);
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: resetOtp.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Failed to reset password.");
      setPassword("");
      setResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setAuthView("login");
      setResetMessage("Password reset successfully. Please sign in.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setLoginError(null);
    setResetMessage(null);
    setAuthView("forgot-email");
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
                  <View style={[styles.logoFrame, { height: logoSize, flexDirection: "row", gap: 16 }]}>
                    <Image
                      source={require("../../assets/images/ui/logo_koperasi_cbs.png")}
                      style={[styles.logo, { width: logoSize, height: logoSize }]}
                      resizeMode="contain"
                    />
                    <Image
                      source={require("../../assets/images/ui/logo_clean.png")}
                      style={[styles.logo, { width: logoSize, height: logoSize }]}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[styles.title, { fontSize: titleSize }]}>Sign in to CBS REVORA</Text>
                  <Text style={[styles.subtitle, { fontSize: subtitleSize, maxWidth: subtitleWidth }]}>
                    Manage cooperative operations from one app.
                  </Text>
                </View>

                <View style={styles.card}>
                  {authView === "login" ? (
                    <>
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
                    </>
                  ) : null}

                  {authView === "forgot-email" ? (
                    <>
                      <Text style={styles.formTitle}>Forgot your password?</Text>
                      <AppInput
                        label="Email"
                        placeholder="Enter your registered email"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        value={resetEmail}
                        onChangeText={setResetEmail}
                      />
                      <AppButton title={submitting ? "Sending OTP..." : "Send OTP"} style={styles.loginButton} onPress={submitForgotEmail} disabled={submitting} />
                    </>
                  ) : null}

                  {authView === "forgot-otp" ? (
                    <>
                      <Text style={styles.formTitle}>Verify OTP</Text>
                      <AppInput label="OTP" placeholder="Enter OTP code" keyboardType="number-pad" value={resetOtp} onChangeText={setResetOtp} />
                      <AppButton title={submitting ? "Verifying..." : "Next"} style={styles.loginButton} onPress={submitOtp} disabled={submitting} />
                    </>
                  ) : null}

                  {authView === "forgot-reset" ? (
                    <>
                      <Text style={styles.formTitle}>Set New Password</Text>
                      <TextInput placeholder="New Password" placeholderTextColor="#61708a" secureTextEntry autoCapitalize="none" autoCorrect={false} value={newPassword} onChangeText={setNewPassword} style={styles.passwordInput} />
                      <TextInput placeholder="Confirm Password" placeholderTextColor="#61708a" secureTextEntry autoCapitalize="none" autoCorrect={false} value={confirmPassword} onChangeText={setConfirmPassword} style={styles.passwordInput} />
                      <AppButton title={submitting ? "Saving..." : "Reset Password"} style={styles.loginButton} onPress={submitResetPassword} disabled={submitting} />
                    </>
                  ) : null}

                  {submitting ? (
                    <View style={styles.statusWrap}>
                      <ActivityIndicator size="small" color="#102852" />
                    </View>
                  ) : null}
                  {resetMessage ? <Text style={styles.successText}>{resetMessage}</Text> : null}
                  {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
                  <Pressable
                    style={styles.helpButton}
                    onPress={() => {
                      if (authView === "login") openForgotPassword();
                      else {
                        setAuthView("login");
                        setLoginError(null);
                        setResetMessage(null);
                      }
                    }}
                  >
                    <Text style={styles.helpText}>{authView === "login" ? "Forgot your password?" : "Back to sign in"}</Text>
                  </Pressable>
                </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
      <InventoryResultModal
        visible={displacedModalOpen}
        status="info"
        title="Account Displaced"
        message="Your account has been logged in on a new device. This session has been automatically deactivated."
        onClose={() => {
          setDisplacedModalOpen(false);
          router.setParams({ displaced: undefined });
        }}
      />
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
  formTitle: {
    color: "#102852",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
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
  successText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
