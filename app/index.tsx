import { router } from "expo-router";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { LoginStartScreen } from "@/features/auth/LoginStartScreen";
import { AppStartupStatus, fetchAppStartupStatus } from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const startupImages = [
  require("../app_img/allcaremedi_ai.png"),
  require("../app_img/allcaremedi_dr.png"),
  require("../app_img/allcaremedi_hp.png"),
  require("../app_img/allcaremedi_sh.png")
];

type StartupState =
  | { type: "checking" }
  | { type: "ready"; status: AppStartupStatus }
  | { type: "update"; status: AppStartupStatus }
  | { type: "error"; message: string };

export default function IndexScreen() {
  const { loading, session, continueAsGuest } = useAuth();
  const [startupState, setStartupState] = useState<StartupState>({ type: "checking" });
  const [imageIndex, setImageIndex] = useState(0);

  const currentVersion = useMemo(() => Constants.expoConfig?.version ?? "0.0.0", []);

  const checkStartup = async () => {
    setStartupState({ type: "checking" });
    try {
      const status = await fetchAppStartupStatus();
      if (isVersionLower(currentVersion, status.latestVersion)) {
        setStartupState({ type: "update", status });
      } else {
        setStartupState({ type: "ready", status });
      }
    } catch {
      setStartupState({
        type: "error",
        message: "서버 연결이 원활하지 않습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      });
    }
  };

  useEffect(() => {
    checkStartup();
  }, []);

  useEffect(() => {
    if (startupState.type !== "checking") {
      return;
    }
    const timer = setInterval(() => {
      setImageIndex((index) => (index + 1) % startupImages.length);
    }, 1100);
    return () => clearInterval(timer);
  }, [startupState.type]);

  useEffect(() => {
    if (startupState.type === "ready" && !loading && session) {
      router.replace("/(tabs)");
    }
  }, [loading, session, startupState.type]);

  if (startupState.type === "checking" || loading || (startupState.type === "ready" && session)) {
    return (
      <StartupLoading imageIndex={imageIndex} />
    );
  }

  if (startupState.type === "update") {
    return <StartupUpdate status={startupState.status} currentVersion={currentVersion} />;
  }

  if (startupState.type === "error") {
    return <StartupError message={startupState.message} onRetry={checkStartup} onContinue={continueAsGuest} />;
  }

  return <LoginStartScreen />;
}

function StartupLoading({ imageIndex }: { imageIndex: number }) {
  const label = ["AI 건강 길잡이를 준비하고 있어요", "의료 정보를 확인하고 있어요", "가까운 병원과 약국을 연결하고 있어요", "안전한 복약 관리를 준비하고 있어요"][imageIndex];
  return (
    <View style={styles.startupContainer}>
      <Image source={startupImages[imageIndex]} style={styles.startupImage} resizeMode="contain" />
      <View style={styles.startupTextBox}>
        <Text style={styles.startupBrand}>AllCareMedi</Text>
        <Text style={styles.startupTitle}>올케어메디 실행 중</Text>
        <Text style={styles.startupSubtitle}>{label}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${38 + imageIndex * 16}%` }]} />
        </View>
      </View>
    </View>
  );
}

function StartupUpdate({ status, currentVersion }: { status: AppStartupStatus; currentVersion: string }) {
  const openStore = async () => {
    const fallback = "https://play.google.com/store/apps/details?id=kr.allcaremedi.app";
    await Linking.openURL(status.androidStoreUrl || fallback).catch(() => Linking.openURL(fallback));
  };

  return (
    <View style={styles.startupContainer}>
      <Image source={require("../app_img/allcaremedi_dr.png")} style={styles.startupImage} resizeMode="contain" />
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>업데이트가 필요합니다</Text>
        <Text style={styles.noticeText}>
          현재 버전은 {currentVersion}이고, 최신 버전은 {status.latestVersion}입니다. 안정적인 의료정보 제공을 위해 업데이트 후 이용해 주세요.
        </Text>
        <Pressable style={styles.primaryButton} onPress={openStore}>
          <Text style={styles.primaryButtonText}>스토어로 이동</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StartupError({ message, onRetry, onContinue }: { message: string; onRetry: () => void; onContinue: () => void }) {
  const contactUrl = process.env.EXPO_PUBLIC_SUPPORT_CONTACT_URL ?? "mailto:support@allcaremedi.local";
  return (
    <View style={styles.startupContainer}>
      <Image source={require("../app_img/allcaremedi_sh.png")} style={styles.startupImage} resizeMode="contain" />
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>잠시 연결이 어렵습니다</Text>
        <Text style={styles.noticeText}>{message}</Text>
        <Text style={styles.noticeHint}>병원·약국, 응급실, 약 검색처럼 서버가 필요한 기능은 일시적으로 제한될 수 있습니다.</Text>
        <Pressable style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>다시 시도</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(contactUrl)}>
          <Text style={styles.secondaryButtonText}>문의하기</Text>
        </Pressable>
        <Pressable style={styles.textButton} onPress={onContinue}>
          <Text style={styles.textButtonText}>비회원으로 계속 사용</Text>
        </Pressable>
      </View>
    </View>
  );
}

function isVersionLower(current: string, target: string) {
  const currentParts = current.split(".").map((part) => Number(part) || 0);
  const targetParts = target.split(".").map((part) => Number(part) || 0);
  const length = Math.max(currentParts.length, targetParts.length);
  for (let index = 0; index < length; index += 1) {
    const currentValue = currentParts[index] ?? 0;
    const targetValue = targetParts[index] ?? 0;
    if (currentValue < targetValue) return true;
    if (currentValue > targetValue) return false;
  }
  return false;
}

const styles = StyleSheet.create({
  startupContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg
  },
  startupImage: {
    width: "100%",
    height: 320
  },
  startupTextBox: {
    width: "100%",
    alignItems: "center",
    gap: spacing.sm
  },
  startupBrand: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.primary
  },
  startupTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    color: colors.textStrong,
    textAlign: "center"
  },
  startupSubtitle: {
    ...typography.body,
    color: colors.text,
    textAlign: "center"
  },
  progressTrack: {
    width: "78%",
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginTop: spacing.sm
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  noticeCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md
  },
  noticeTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    color: colors.textStrong
  },
  noticeText: {
    ...typography.body,
    color: colors.text
  },
  noticeHint: {
    ...typography.caption,
    color: colors.textMuted
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  primaryButtonText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: colors.onPrimary
  },
  secondaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary
  },
  secondaryButtonText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: colors.primary
  },
  textButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  textButtonText: {
    ...typography.body,
    color: colors.textMuted
  }
});
