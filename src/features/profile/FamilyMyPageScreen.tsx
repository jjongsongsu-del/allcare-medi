import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useAuth } from "@/auth/AuthProvider";
import {
  clearLocalUserData,
  ConsentSettings,
  defaultConsentSettings,
  FamilyProfile,
  getConsentSettings,
  getLocalFamilyProfiles,
  getLocalFavoritePlaces,
  getLocalRecentPlaces,
  saveConsentSettings,
  saveLocalFamilyProfile,
  StoredPlace
} from "@/services/localUserData";
import { createFamilyProfile, fetchFamilyProfiles, migrateGuestData } from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const profilePresets = [
  { name: "나", relation: "SELF" },
  { name: "아이", relation: "CHILD" },
  { name: "어머니", relation: "PARENT" }
];

const consentLabels: Array<[keyof ConsentSettings, string]> = [
  ["terms", "서비스 이용약관"],
  ["privacy", "개인정보 처리방침"],
  ["age14", "만 14세 이상 확인"],
  ["location", "위치 기반 주변 병원/약국 검색"],
  ["push", "푸시 알림"],
  ["familyMedicalMemo", "가족 프로필 건강 메모 저장"],
  ["medicinePhotoStorage", "약 사진 분석 기록 저장"],
  ["aiImprovement", "AI 성능 개선 비식별 데이터 활용"],
  ["marketing", "마케팅 수신"]
];

export function FamilyMyPageScreen() {
  const { session, logout } = useAuth();
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [favorites, setFavorites] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [consents, setConsents] = useState<ConsentSettings>(defaultConsentSettings);
  const [profileName, setProfileName] = useState("");
  const [relationType, setRelationType] = useState("CHILD");
  const [message, setMessage] = useState<string | null>(null);

  const isMember = session?.mode === "member" && Boolean(session.userId);

  useEffect(() => {
    loadData();
  }, [session?.mode, session?.userId]);

  const loadData = async () => {
    const [localProfiles, localFavorites, localRecent, localConsents] = await Promise.all([
      getLocalFamilyProfiles(),
      getLocalFavoritePlaces(),
      getLocalRecentPlaces(),
      getConsentSettings()
    ]);
    setFavorites(localFavorites);
    setRecentPlaces(localRecent);
    setConsents(localConsents);

    if (isMember && session?.userId) {
      try {
        setProfiles(await fetchFamilyProfiles(session.userId));
      } catch {
        setProfiles(localProfiles);
      }
    } else {
      setProfiles(localProfiles);
    }
  };

  const addProfile = async (name: string, relation: string) => {
    if (!name.trim()) return;
    const payload = { profileName: name.trim(), relationType: relation };
    const saved = isMember && session?.userId
      ? await createFamilyProfile(session.userId, payload)
      : await saveLocalFamilyProfile(payload);
    setProfiles((current) => [...current, saved]);
    setProfileName("");
    setMessage(isMember ? "가족 프로필을 서버에 저장했습니다." : "가족 프로필을 이 기기에 저장했습니다.");
  };

  const migrateLocalData = async () => {
    if (!session?.guestId && !session?.deviceUuid) return;
    await migrateGuestData({
      guestId: session.guestId ?? session.deviceUuid ?? "unknown-guest",
      userId: session.userId,
      favorites,
      recentPlaces,
      familyProfiles: profiles
    });
    setMessage("이 기기의 비회원 데이터를 계정 병합 대기 상태로 보냈습니다.");
  };

  const toggleConsent = async (key: keyof ConsentSettings) => {
    const next = { ...consents, [key]: !consents[key] };
    setConsents(next);
    await saveConsentSettings(next);
  };

  const clearRecords = async () => {
    await clearLocalUserData();
    setFavorites([]);
    setRecentPlaces([]);
    if (!isMember) setProfiles([]);
    setMessage("이 기기에 저장된 기록을 삭제했습니다.");
  };

  return (
    <AppScreen>
      <SectionHeader
        title="가족/마이"
        description={isMember ? "회원 기록은 서버 동기화 대상입니다." : "비회원 기록은 이 기기에만 저장됩니다."}
      />

      <KrdsCard>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{isMember ? session?.nickname ?? "회원" : "비회원 사용자"}</Text>
            <Text style={styles.body}>
              {isMember ? "가족 프로필, 즐겨찾기, 복약 기록을 계정에 이어서 보관합니다." : "로그인하면 기기 변경 복구와 서버 동기화를 사용할 수 있습니다."}
            </Text>
          </View>
          <MaterialCommunityIcons name={isMember ? "cloud-check" : "cellphone"} size={30} color={colors.primary} />
        </View>
      </KrdsCard>

      <SectionHeader title="오늘은 누구를 위해 찾으시나요?" />
      <View style={styles.chipRow}>
        {profiles.map((profile) => (
          <View key={String(profile.profileId)} style={styles.profileChip}>
            <Text style={styles.profileChipText}>{profile.profileName}</Text>
          </View>
        ))}
        {profilePresets.map((preset) => (
          <Pressable key={preset.name} style={styles.addChip} onPress={() => addProfile(preset.name, preset.relation)}>
            <Text style={styles.addChipText}>+ {preset.name}</Text>
          </Pressable>
        ))}
      </View>

      <KrdsCard>
        <SectionHeader title="프로필 추가" description="건강정보는 나중에 입력할 수 있습니다." />
        <TextInput
          accessibilityLabel="프로필 이름"
          placeholder="예: 첫째, 어머니"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={profileName}
          onChangeText={setProfileName}
        />
        <View style={styles.chipRow}>
          {["SELF", "CHILD", "PARENT", "SPOUSE", "ETC"].map((relation) => (
            <Pressable key={relation} style={[styles.smallChip, relationType === relation && styles.activeSmallChip]} onPress={() => setRelationType(relation)}>
              <Text style={[styles.smallChipText, relationType === relation && styles.activeSmallChipText]}>{relation}</Text>
            </Pressable>
          ))}
        </View>
        <ActionButton label="프로필 저장" icon="account-plus" onPress={() => addProfile(profileName, relationType)} />
      </KrdsCard>

      <SectionHeader title="저장한 정보" />
      <KrdsCard>
        <Text style={styles.meta}>즐겨찾기</Text>
        <Text style={styles.body}>{favorites.length ? favorites.map((item) => item.placeName).join(" · ") : "아직 저장한 장소가 없습니다."}</Text>
        <Text style={styles.meta}>최근 본 병원/약국</Text>
        <Text style={styles.body}>{recentPlaces.length ? recentPlaces.map((item) => item.placeName).join(" · ") : "최근 본 장소가 없습니다."}</Text>
        {isMember ? <ActionButton label="비회원 기록 병합" icon="database-import" tone="secondary" onPress={migrateLocalData} /> : null}
      </KrdsCard>

      <SectionHeader title="약관/개인정보 동의" description="민감 정보는 기능별로 따로 동의합니다." />
      <KrdsCard>
        {consentLabels.map(([key, label]) => (
          <Pressable key={key} style={styles.consentRow} onPress={() => toggleConsent(key)}>
            <MaterialCommunityIcons name={consents[key] ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={colors.primary} />
            <Text style={styles.body}>{label}</Text>
          </Pressable>
        ))}
      </KrdsCard>

      <SectionHeader title="개인정보 관리" />
      <KrdsCard>
        <View style={styles.buttonRow}>
          <ActionButton label="검색 기록 삭제" icon="delete-outline" tone="secondary" onPress={clearRecords} />
          <ActionButton label="약 사진 기록 삭제" icon="image-remove-outline" tone="secondary" onPress={clearRecords} />
          <ActionButton label="로그아웃" icon="logout" tone="secondary" onPress={logout} />
        </View>
      </KrdsCard>

      {message ? <Text style={styles.notice}>{message}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  flex: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  profileChip: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  profileChipText: {
    ...typography.button,
    color: colors.onPrimary
  },
  addChip: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  addChipText: {
    ...typography.button,
    color: colors.primary
  },
  input: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.bodyLarge,
    color: colors.textStrong
  },
  smallChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  activeSmallChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  smallChipText: {
    ...typography.caption,
    color: colors.text
  },
  activeSmallChipText: {
    color: colors.primaryStrong
  },
  consentRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  notice: {
    ...typography.body,
    color: colors.success,
    textAlign: "center"
  }
});
