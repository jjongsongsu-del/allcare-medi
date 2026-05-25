import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { ExperienceMode, useExperienceMode } from "@/experience/ExperienceModeProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const providerLabels = {
  NAVER: "네이버",
  KAKAO: "카카오톡",
  GOOGLE: "Gmail",
  GUEST: "비회원"
};

export function LoginStartScreen() {
  const { continueAsGuest, continueWithSocial, recentProvider } = useAuth();
  const { mode, setMode } = useExperienceMode();
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = async (provider: "NAVER" | "KAKAO" | "GOOGLE") => {
    setError(null);
    try {
      await continueWithSocial(provider);
    } catch {
      setError("로그인 서버를 확인해 주세요. 지금은 비회원으로 먼저 사용할 수 있습니다.");
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
        <Text style={styles.subtitle}>
          비회원으로 바로 쓰고, 로그인하면 가족 프로필과 즐겨찾기, 복약 기록을 이어서 보관할 수 있습니다.
        </Text>
      </View>

      <View style={styles.modeCard}>
        <Text style={styles.modeTitle}>사용 방식을 선택하세요</Text>
        <View style={styles.modeRow}>
          <ModeButton
            title="쉬운모드"
            description="큰 여백과 필수 기능 중심"
            active={mode === "easy"}
            onPress={() => chooseMode("easy")}
          />
          <ModeButton
            title="상세모드"
            description="전체 기능과 상세 관리"
            active={mode === "detail"}
            onPress={() => chooseMode("detail")}
          />
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <LoginButton label="네이버로 계속하기" backgroundColor="#03C75A" textColor="#FFFFFF" recent={recentProvider === "NAVER"} onPress={() => handleSocialLogin("NAVER")} />
        <LoginButton label="카카오톡으로 계속하기" backgroundColor="#FEE500" textColor="#111827" recent={recentProvider === "KAKAO"} onPress={() => handleSocialLogin("KAKAO")} />
        <LoginButton label="Gmail로 계속하기" backgroundColor="#FFFFFF" textColor={colors.textStrong} bordered recent={recentProvider === "GOOGLE"} onPress={() => handleSocialLogin("GOOGLE")} />
        <LoginButton label="비회원으로 시작하기" backgroundColor="#FFFFFF" textColor={colors.primary} bordered highlight recent={recentProvider === "GUEST"} onPress={handleGuestLogin} />
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
  description,
  active,
  onPress
}: {
  title: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" style={[styles.modeButton, active && styles.modeButtonActive]} onPress={onPress}>
      <MaterialCommunityIcons name={active ? "check-circle" : "circle-outline"} size={22} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.modeButtonTitle, active && styles.modeButtonTitleActive]}>{title}</Text>
      <Text style={styles.modeButtonDescription}>{description}</Text>
    </Pressable>
  );
}

function LoginButton({
  label,
  backgroundColor,
  textColor,
  bordered,
  highlight,
  recent,
  onPress
}: {
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
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center"
  },
  buttonGroup: {
    gap: spacing.sm
  },
  modeCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  modeTitle: {
    ...typography.body,
    color: colors.textStrong,
    fontWeight: "800"
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  modeButton: {
    flex: 1,
    minHeight: 112,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
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
  modeButtonDescription: {
    ...typography.caption,
    color: colors.textMuted
  },
  loginButton: {
    minHeight: 56,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingHorizontal: 96
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
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    textAlign: "center"
  },
  recentInlineBadge: {
    position: "absolute",
    right: spacing.md,
    top: 14,
    minHeight: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    gap: 4
  },
  recentInlineBadgeOnColor: {
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(0,0,0,0.16)"
  },
  recentInlineText: {
    fontSize: 13,
    lineHeight: 18,
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
