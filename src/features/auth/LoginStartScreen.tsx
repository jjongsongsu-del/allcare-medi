import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { ExperienceMode, useExperienceMode } from "@/experience/ExperienceModeProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function LoginStartScreen() {
  const { continueAsGuest, continueWithSocial, recentProvider } = useAuth();
  const { mode, setMode } = useExperienceMode();
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = async (provider: "NAVER" | "KAKAO" | "GOOGLE") => {
    setError(null);
    try {
      await continueWithSocial(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : "로그인을 완료하지 못했습니다.";
      setError(message);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    await continueAsGuest();
  };

  const chooseMode = async (nextMode: ExperienceMode) => {
    await setMode(nextMode);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.visualArea}>
        <Image source={require("../../../app_img/allcaremedi_hp.png")} style={styles.heroImage} resizeMode="contain" />
      </View>

      <View style={styles.copyArea}>
        <Text style={styles.brand}>AllCareMedi</Text>
        <Text style={styles.title}>올케어메디 시작하기</Text>
      </View>

      <View style={styles.modeCard}>
        <View style={styles.modeRow}>
          <ModeButton
            title="쉬운모드"
            active={mode === "easy"}
            onPress={() => chooseMode("easy")}
          />
          <ModeButton
            title="상세모드"
            active={mode === "detail"}
            onPress={() => chooseMode("detail")}
          />
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <LoginButton provider="NAVER" label="네이버" backgroundColor="#03C75A" textColor="#FFFFFF" recent={recentProvider === "NAVER"} onPress={() => handleSocialLogin("NAVER")} />
        <LoginButton provider="KAKAO" label="카카오" backgroundColor="#FEE500" textColor="#111827" recent={recentProvider === "KAKAO"} onPress={() => handleSocialLogin("KAKAO")} />
        <LoginButton provider="GOOGLE" label="구글" backgroundColor="#FFFFFF" textColor={colors.textStrong} bordered recent={recentProvider === "GOOGLE"} onPress={() => handleSocialLogin("GOOGLE")} />
        <LoginButton provider="GUEST" label="비회원" backgroundColor="#FFFFFF" textColor={colors.primary} bordered highlight recent={recentProvider === "GUEST"} onPress={handleGuestLogin} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.guestNotice}>
        비회원 기록은 이 기기에만 저장됩니다. 로그인하면 서버 동기화와 기기 변경 복구를 사용할 수 있습니다.
      </Text>
    </SafeAreaView>
  );
}

function ModeButton({
  title,
  active,
  onPress
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" style={[styles.modeButton, active && styles.modeButtonActive]} onPress={onPress}>
      <MaterialCommunityIcons name={active ? "check-circle" : "circle-outline"} size={22} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.modeButtonTitle, active && styles.modeButtonTitleActive]}>{title}</Text>
    </Pressable>
  );
}

function LoginButton({
  provider,
  label,
  backgroundColor,
  textColor,
  bordered,
  highlight,
  recent,
  onPress
}: {
  provider: "NAVER" | "KAKAO" | "GOOGLE" | "GUEST";
  label: string;
  backgroundColor: string;
  textColor: string;
  bordered?: boolean;
  highlight?: boolean;
  recent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.loginButton,
        { backgroundColor },
        bordered && styles.borderedButton,
        highlight && styles.highlightButton
      ]}
      onPress={onPress}
    >
      <ProviderLogo provider={provider} />
      <Text style={[styles.loginButtonText, { color: textColor }]}>{label}</Text>
      {recent ? (
        <View style={[styles.recentInlineBadge, !bordered && styles.recentInlineBadgeOnColor]}>
          <MaterialCommunityIcons name="history" size={14} color={bordered ? colors.primary : "#FFFFFF"} />
          <Text style={[styles.recentInlineText, !bordered && styles.recentInlineTextOnColor]}>최근</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ProviderLogo({ provider }: { provider: "NAVER" | "KAKAO" | "GOOGLE" | "GUEST" }) {
  if (provider === "NAVER") {
    return (
      <View style={[styles.providerLogo, styles.naverLogo]}>
        <Text style={styles.naverLogoText}>N</Text>
      </View>
    );
  }

  if (provider === "KAKAO") {
    return (
      <View style={[styles.providerLogo, styles.kakaoLogo]}>
        <MaterialCommunityIcons name="chat" size={23} color="#111827" />
      </View>
    );
  }

  if (provider === "GOOGLE") {
    return (
      <View style={[styles.providerLogo, styles.googleLogo]}>
        <MaterialCommunityIcons name="gmail" size={25} color="#EA4335" />
      </View>
    );
  }

  return (
    <View style={[styles.providerLogo, styles.guestLogo]}>
      <MaterialCommunityIcons name="account-outline" size={24} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    gap: spacing.md
  },
  visualArea: {
    minHeight: 250,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  heroImage: {
    width: "100%",
    height: 230
  },
  copyArea: {
    alignItems: "center",
    gap: spacing.sm
  },
  brand: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.primary
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.textStrong,
    textAlign: "center"
  },
  buttonGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  modeCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  modeButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  modeButtonTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "900"
  },
  modeButtonTitleActive: {
    color: colors.primaryStrong
  },
  loginButton: {
    width: "48.5%",
    minHeight: 48,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  borderedButton: {
    borderWidth: 1,
    borderColor: colors.border
  },
  highlightButton: {
    borderColor: colors.primary,
    borderWidth: 2
  },
  loginButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    textAlign: "center"
  },
  providerLogo: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  naverLogo: {
    backgroundColor: "#FFFFFF"
  },
  naverLogoText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#03C75A"
  },
  kakaoLogo: {
    backgroundColor: "rgba(255,255,255,0.42)"
  },
  googleLogo: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF"
  },
  guestLogo: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  recentInlineBadge: {
    position: "absolute",
    right: 6,
    top: 5,
    minHeight: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    gap: 2
  },
  recentInlineBadgeOnColor: {
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(0,0,0,0.16)"
  },
  recentInlineText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: colors.primary
  },
  recentInlineTextOnColor: {
    color: "#FFFFFF"
  },
  guestNotice: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    color: colors.textMuted,
    textAlign: "center"
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: "center"
  }
});
