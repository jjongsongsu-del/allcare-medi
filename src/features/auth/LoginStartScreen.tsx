import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
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
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = async (provider: "NAVER" | "KAKAO" | "GOOGLE") => {
    setError(null);
    try {
      await continueWithSocial(provider);
    } catch {
      setError("로그인 서버를 확인해 주세요. 지금은 비회원으로 먼저 사용할 수 있습니다.");
    }
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

      {recentProvider ? (
        <View style={styles.recentBadge}>
          <MaterialCommunityIcons name="history" size={18} color={colors.primary} />
          <Text style={styles.recentText}>최근 로그인: {providerLabels[recentProvider]}</Text>
        </View>
      ) : null}

      <View style={styles.buttonGroup}>
        <LoginButton label="네이버로 계속하기" backgroundColor="#03C75A" textColor="#FFFFFF" onPress={() => handleSocialLogin("NAVER")} />
        <LoginButton label="카카오톡으로 계속하기" backgroundColor="#FEE500" textColor="#111827" onPress={() => handleSocialLogin("KAKAO")} />
        <LoginButton label="Gmail로 계속하기" backgroundColor="#FFFFFF" textColor={colors.textStrong} bordered onPress={() => handleSocialLogin("GOOGLE")} />
        <LoginButton label="비회원으로 시작하기" backgroundColor="#FFFFFF" textColor={colors.primary} bordered highlight onPress={continueAsGuest} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.guestNotice}>
        비회원 기록은 이 기기에만 저장됩니다. 로그인하면 서버 동기화와 기기 변경 복구를 사용할 수 있습니다.
      </Text>
    </SafeAreaView>
  );
}

function LoginButton({
  label,
  backgroundColor,
  textColor,
  bordered,
  highlight,
  onPress
}: {
  label: string;
  backgroundColor: string;
  textColor: string;
  bordered?: boolean;
  highlight?: boolean;
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
  recentBadge: {
    minHeight: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  recentText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  buttonGroup: {
    gap: spacing.sm
  },
  loginButton: {
    minHeight: 56,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
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
    fontWeight: "800"
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
