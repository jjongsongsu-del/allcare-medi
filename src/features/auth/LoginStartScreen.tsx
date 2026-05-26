import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { ExperienceMode, useExperienceMode } from "@/experience/ExperienceModeProvider";
import { colors } from "@/theme/colors";
import { designOne } from "@/theme/designOne";
import { designTwo } from "@/theme/designTwo";
import { useDesignMode } from "@/theme/DesignModeProvider";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function LoginStartScreen() {
  const { continueAsGuest, continueWithSocial, recentProvider } = useAuth();
  const { mode, setMode } = useExperienceMode();
  const { isDesignOne, isDesignTwo } = useDesignMode();
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
    <SafeAreaView style={[styles.container, isDesignOne && styles.designOneContainer, isDesignTwo && styles.designTwoContainer]}>
      <View style={[styles.visualArea, isDesignOne && styles.designOneVisualArea, isDesignTwo && styles.designTwoVisualArea]}>
        <Image source={require("../../../app_img/allcaremedi_hp.png")} style={[styles.heroImage, isDesignOne && styles.designOneHeroImage, isDesignTwo && styles.designTwoHeroImage]} resizeMode="contain" />
      </View>

      <View style={[styles.loginPanel, isDesignOne && styles.designOneLoginPanel, isDesignTwo && styles.designTwoLoginPanel]}>
        <View style={styles.copyArea}>
          <Text style={[styles.brand, isDesignOne && styles.designOneBrand, isDesignTwo && styles.designTwoBrand]}>AllCareMedi</Text>
          <Text style={[styles.title, isDesignOne && styles.designOneTitle, isDesignTwo && styles.designTwoTitle]}>올케어메디 시작하기</Text>
        </View>

        <View style={[styles.modeCard, isDesignOne && styles.designOneModeCard, isDesignTwo && styles.designTwoModeCard]}>
          <View style={styles.modeRow}>
            <ModeButton
              title="쉬운모드"
              active={mode === "easy"}
              designOne={isDesignOne}
              designTwo={isDesignTwo}
              onPress={() => chooseMode("easy")}
            />
            <ModeButton
              title="상세모드"
              active={mode === "detail"}
              designOne={isDesignOne}
              designTwo={isDesignTwo}
              onPress={() => chooseMode("detail")}
            />
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <LoginButton provider="NAVER" label="네이버 로그인" backgroundColor={isDesignOne || isDesignTwo ? "#FFFFFF" : "#03C75A"} textColor={isDesignOne ? designOne.text : isDesignTwo ? designTwo.text : "#FFFFFF"} bordered={isDesignOne || isDesignTwo} designOne={isDesignOne} designTwo={isDesignTwo} recent={recentProvider === "NAVER"} onPress={() => handleSocialLogin("NAVER")} />
          <LoginButton provider="KAKAO" label="카카오톡 로그인" backgroundColor={isDesignOne || isDesignTwo ? "#FFFFFF" : "#FEE500"} textColor={isDesignOne ? designOne.text : isDesignTwo ? designTwo.text : "#111827"} bordered={isDesignOne || isDesignTwo} designOne={isDesignOne} designTwo={isDesignTwo} recent={recentProvider === "KAKAO"} onPress={() => handleSocialLogin("KAKAO")} />
          <LoginButton provider="GOOGLE" label="구글 로그인" backgroundColor="#FFFFFF" textColor={colors.textStrong} bordered designOne={isDesignOne} designTwo={isDesignTwo} recent={recentProvider === "GOOGLE"} onPress={() => handleSocialLogin("GOOGLE")} />
          <LoginButton provider="GUEST" label="비회원 로그인" backgroundColor={isDesignTwo ? designTwo.primary : "#FFFFFF"} textColor={isDesignTwo ? "#FFFFFF" : isDesignOne ? designOne.primary : colors.primary} bordered={!isDesignTwo} highlight designOne={isDesignOne} designTwo={isDesignTwo} recent={recentProvider === "GUEST"} onPress={handleGuestLogin} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.guestNotice}>
          비회원 기록은 이 기기에만 저장됩니다. 로그인하면 서버 동기화와 기기 변경 복구를 사용할 수 있습니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ModeButton({
  title,
  active,
  designOne,
  designTwo,
  onPress
}: {
  title: string;
  active: boolean;
  designOne?: boolean;
  designTwo?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" style={[styles.modeButton, designOne && styles.designOneModeButton, designTwo && styles.designTwoModeButton, active && styles.modeButtonActive, designOne && active && styles.designOneModeButtonActive, designTwo && active && styles.designTwoModeButtonActive]} onPress={onPress}>
      <MaterialCommunityIcons name={active ? "check-circle" : "circle-outline"} size={22} color={active ? (designOne || designTwo ? "#FFFFFF" : colors.primary) : colors.textMuted} />
      <Text style={[styles.modeButtonTitle, active && styles.modeButtonTitleActive, designOne && active && styles.designOneModeButtonTitleActive, designTwo && active && styles.designTwoModeButtonTitleActive]}>{title}</Text>
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
  designOne,
  designTwo,
  recent,
  onPress
}: {
  provider: "NAVER" | "KAKAO" | "GOOGLE" | "GUEST";
  label: string;
  backgroundColor: string;
  textColor: string;
  bordered?: boolean;
  highlight?: boolean;
  designOne?: boolean;
  designTwo?: boolean;
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
        highlight && styles.highlightButton,
        designOne && styles.designOneLoginButton,
        designOne && highlight && styles.designOneHighlightButton,
        designTwo && styles.designTwoLoginButton,
        designTwo && highlight && styles.designTwoHighlightButton
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
        <MaterialCommunityIcons name="chat" size={20} color="#111827" />
      </View>
    );
  }

  if (provider === "GOOGLE") {
    return (
      <View style={[styles.providerLogo, styles.googleLogo]}>
        <MaterialCommunityIcons name="gmail" size={21} color="#EA4335" />
      </View>
    );
  }

  return (
    <View style={[styles.providerLogo, styles.guestLogo]}>
      <MaterialCommunityIcons name="account-outline" size={21} color={colors.primary} />
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
  designOneContainer: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    backgroundColor: designOne.background,
    gap: 0
  },
  designTwoContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: designTwo.background,
    gap: spacing.lg
  },
  visualArea: {
    minHeight: 250,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  designOneVisualArea: {
    minHeight: 190,
    justifyContent: "center",
    paddingTop: spacing.lg
  },
  designTwoVisualArea: {
    minHeight: 172,
    justifyContent: "center",
    paddingTop: spacing.lg
  },
  heroImage: {
    width: "100%",
    height: 230
  },
  designOneHeroImage: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: "#DDD7FF"
  },
  designTwoHeroImage: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: designTwo.primaryLight
  },
  loginPanel: {
    gap: spacing.md
  },
  designOneLoginPanel: {
    flex: 1,
    borderTopLeftRadius: designOne.radiusPanel,
    borderTopRightRadius: designOne.radiusPanel,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  designTwoLoginPanel: {
    gap: spacing.lg
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
  designOneBrand: {
    color: designOne.primary,
    fontSize: 22,
    lineHeight: 28
  },
  designTwoBrand: {
    color: designTwo.primary,
    fontSize: 22,
    lineHeight: 28
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.textStrong,
    textAlign: "center"
  },
  designOneTitle: {
    color: designOne.text,
    fontSize: 28,
    lineHeight: 36
  },
  designTwoTitle: {
    color: designTwo.text,
    fontSize: 27,
    lineHeight: 34
  },
  buttonGroup: {
    gap: spacing.sm
  },
  modeCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm
  },
  designOneModeCard: {
    borderWidth: 0,
    backgroundColor: designOne.surfaceAlt,
    borderRadius: designOne.radiusCard,
    padding: 6
  },
  designTwoModeCard: {
    borderWidth: 0,
    backgroundColor: designTwo.primaryLight,
    borderRadius: designTwo.radiusButton,
    padding: 6
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
  designOneModeButton: {
    borderWidth: 0,
    borderRadius: designOne.radiusButton,
    backgroundColor: "transparent"
  },
  designTwoModeButton: {
    borderWidth: 0,
    borderRadius: designTwo.radiusButton,
    backgroundColor: "transparent"
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  designOneModeButtonActive: {
    backgroundColor: designOne.primary
  },
  designTwoModeButtonActive: {
    backgroundColor: designTwo.primary
  },
  modeButtonTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "900"
  },
  modeButtonTitleActive: {
    color: colors.primaryStrong
  },
  designOneModeButtonTitleActive: {
    color: "#FFFFFF"
  },
  designTwoModeButtonTitleActive: {
    color: "#FFFFFF"
  },
  loginButton: {
    width: "100%",
    minHeight: 42,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    gap: spacing.xs
  },
  designOneLoginButton: {
    minHeight: 52,
    borderRadius: designOne.radiusCard,
    borderColor: designOne.border,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.md,
    ...designOne.shadow
  },
  designTwoLoginButton: {
    minHeight: 54,
    borderRadius: designTwo.radiusButton,
    borderColor: designTwo.border,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.md,
    backgroundColor: designTwo.cardSoft
  },
  borderedButton: {
    borderWidth: 1,
    borderColor: colors.border
  },
  highlightButton: {
    borderColor: colors.primary,
    borderWidth: 2
  },
  designOneHighlightButton: {
    borderColor: designOne.primary
  },
  designTwoHighlightButton: {
    borderColor: designTwo.primary,
    backgroundColor: designTwo.primary
  },
  loginButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center"
  },
  providerLogo: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  naverLogo: {
    backgroundColor: "#FFFFFF"
  },
  naverLogoText: {
    fontSize: 17,
    lineHeight: 21,
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
