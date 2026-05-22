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
  getLocalFavoritePlaces,
  getLocalRecentPlaces,
  saveConsentSettings,
  StoredPlace,
  updateLocalFamilyProfile
} from "@/services/localUserData";
import { migrateGuestData } from "@/services/serverApi";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type DetailTab = "basic" | "health" | "medication" | "emergency" | "permission";

const relationOptions = [
  { label: "나", value: "SELF" },
  { label: "배우자", value: "SPOUSE" },
  { label: "자녀", value: "CHILD" },
  { label: "부모님", value: "PARENT" },
  { label: "기타", value: "ETC" }
];

const detailTabs: Array<{ key: DetailTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: "basic", label: "기본정보", icon: "account-outline" },
  { key: "health", label: "건강정보", icon: "heart-pulse" },
  { key: "medication", label: "복약관리", icon: "pill" },
  { key: "emergency", label: "응급카드", icon: "card-account-details-star-outline" },
  { key: "permission", label: "권한설정", icon: "shield-account" }
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
  const { profiles, selectedProfile, selectProfile: selectFamilyProfile, addProfile, reloadProfiles } = useFamilyProfile();
  const [activeTab, setActiveTab] = useState<DetailTab>("basic");
  const [favorites, setFavorites] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [consents, setConsents] = useState<ConsentSettings>(defaultConsentSettings);
  const [draft, setDraft] = useState<Partial<FamilyProfile>>({ profileName: "", relationType: "CHILD" });
  const [message, setMessage] = useState<string | null>(null);

  const isMember = session?.mode === "member" && Boolean(session.userId);
  useEffect(() => {
    loadData();
  }, [session?.mode, session?.userId]);

  const loadData = async () => {
    const [localFavorites, localRecent, localConsents] = await Promise.all([
      getLocalFavoritePlaces(),
      getLocalRecentPlaces(),
      getConsentSettings()
    ]);
    setFavorites(localFavorites);
    setRecentPlaces(localRecent);
    setConsents(localConsents);
  };

  const handleSelectProfile = async (profileId: string | number) => {
    await selectFamilyProfile(profileId);
    setMessage("현재 관리 대상을 변경했습니다. 복약, 병원검색, 응급 메뉴에 이 기준을 연동합니다.");
  };

  const addDraftProfile = async () => {
    if (!draft.profileName?.trim()) return;
    const payload = normalizeProfileDraft(draft);
    await addProfile(payload);
    setDraft({ profileName: "", relationType: "CHILD" });
    setMessage(isMember ? "가족 프로필을 서버에 저장했습니다." : "가족 프로필을 이 기기에 저장했습니다.");
  };

  const updateSelectedProfile = async (patch: Partial<FamilyProfile>) => {
    if (!selectedProfile) return;
    const nextProfile = { ...selectedProfile, ...patch };
    if (!isMember) {
      await updateLocalFamilyProfile(nextProfile);
      await reloadProfiles();
      setMessage("이 기기의 가족 프로필을 업데이트했습니다.");
      return;
    }
    setMessage("서버 저장 API는 다음 단계에서 PATCH로 연결됩니다. 현재 화면 상태에는 반영했습니다.");
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
    setMessage("비회원 데이터를 서버 가족 계정에 병합했습니다.");
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
    if (!isMember) await reloadProfiles();
    setMessage("이 기기에 저장된 기록을 삭제했습니다.");
  };

  return (
    <AppScreen>
      <SectionHeader
        title="가족관리"
        description="현재 관리 대상을 선택하면 복약관리, 병원추천, 응급카드의 기준으로 사용합니다."
      />

      <CurrentProfileSummary isMember={isMember} sessionName={session?.nickname} profile={selectedProfile} />

      <SectionHeader title="가족 전환" />
      <View style={styles.chipRow}>
        {profiles.map((profile) => {
          const active = String(profile.profileId) === String(selectedProfile?.profileId);
          return (
            <Pressable key={String(profile.profileId)} style={[styles.profileChip, active && styles.activeProfileChip]} onPress={() => handleSelectProfile(profile.profileId)}>
              <Text style={[styles.profileChipText, active && styles.activeProfileChipText]}>{profile.profileName}</Text>
            </Pressable>
          );
        })}
      </View>

      <KrdsCard>
        <SectionHeader title="가족 등록" description="나, 배우자, 자녀, 부모님을 등록합니다. 성인 가족은 초대/동의 상태로 관리합니다." />
        <TextInput
          accessibilityLabel="가족 이름"
          placeholder="예: 나, 배우자, 첫째, 어머니"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.profileName ?? ""}
          onChangeText={(value) => setDraft((current) => ({ ...current, profileName: value }))}
        />
        <View style={styles.chipRow}>
          {relationOptions.map((relation) => (
            <Pressable
              key={relation.value}
              style={[styles.smallChip, draft.relationType === relation.value && styles.activeSmallChip]}
              onPress={() => setDraft((current) => ({ ...current, relationType: relation.value }))}
            >
              <Text style={[styles.smallChipText, draft.relationType === relation.value && styles.activeSmallChipText]}>{relation.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.twoColumn}>
          <TextInput style={styles.input} placeholder="생년월일 YYYY-MM-DD" placeholderTextColor={colors.textMuted} value={draft.birthDate ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, birthDate: value }))} />
          <TextInput style={styles.input} placeholder="연락처" placeholderTextColor={colors.textMuted} value={draft.phone ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, phone: value }))} />
        </View>
        <ActionButton label="가족 등록" icon="account-plus" onPress={addDraftProfile} />
      </KrdsCard>

      {selectedProfile ? (
        <>
          <View style={styles.tabRow}>
            {detailTabs.map((tab) => (
              <Pressable key={tab.key} style={[styles.detailTab, activeTab === tab.key && styles.activeDetailTab]} onPress={() => setActiveTab(tab.key)}>
                <MaterialCommunityIcons name={tab.icon} size={18} color={activeTab === tab.key ? colors.onPrimary : colors.primary} />
                <Text style={[styles.detailTabText, activeTab === tab.key && styles.activeDetailTabText]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
          <ProfileDetail profile={selectedProfile} activeTab={activeTab} onUpdate={updateSelectedProfile} favorites={favorites} recentPlaces={recentPlaces} />
        </>
      ) : null}

      <SectionHeader title="저장한 정보와 병합" />
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

function CurrentProfileSummary({ isMember, sessionName, profile }: { isMember: boolean; sessionName?: string; profile?: FamilyProfile | null }) {
  return (
    <KrdsCard>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>현재 관리 대상: {profile?.profileName ?? "없음"}</Text>
          <Text style={styles.body}>
            {isMember ? `${sessionName ?? "회원"} 계정에 동기화됩니다.` : "비회원 기록은 이 기기에만 저장됩니다."}
          </Text>
          <Text style={styles.meta}>복약관리 · 병원추천 · 응급카드 · 보호자 알림에 연동 예정</Text>
        </View>
        <MaterialCommunityIcons name={isMember ? "cloud-check" : "cellphone"} size={30} color={colors.primary} />
      </View>
    </KrdsCard>
  );
}

function ProfileDetail({
  profile,
  activeTab,
  onUpdate,
  favorites,
  recentPlaces
}: {
  profile: FamilyProfile;
  activeTab: DetailTab;
  onUpdate: (patch: Partial<FamilyProfile>) => void;
  favorites: StoredPlace[];
  recentPlaces: StoredPlace[];
}) {
  if (activeTab === "basic") {
    return (
      <KrdsCard>
        <SectionHeader title="기본정보" />
        <InfoLine label="관계" value={relationLabel(profile.relationType)} />
        <InfoLine label="생년월일" value={profile.birthDate ?? birthYearMonth(profile)} />
        <InfoLine label="성별" value={profile.gender ?? "미입력"} />
        <InfoLine label="연락처" value={profile.phone ?? "미입력"} />
      </KrdsCard>
    );
  }

  if (activeTab === "health") {
    return (
      <KrdsCard>
        <SectionHeader title="건강정보 관리" description="혈액형, 알레르기, 기저질환, 복용약을 가족별로 관리합니다." />
        <TextInput style={styles.input} placeholder="혈액형 예: A+" placeholderTextColor={colors.textMuted} value={profile.bloodType ?? ""} onChangeText={(value) => onUpdate({ bloodType: value })} />
        <TextInput style={styles.input} placeholder="알레르기 예: 페니실린, 땅콩" placeholderTextColor={colors.textMuted} value={profile.allergies ?? ""} onChangeText={(value) => onUpdate({ allergies: value })} />
        <TextInput style={styles.input} placeholder="기저질환 예: 고혈압, 천식" placeholderTextColor={colors.textMuted} value={profile.chronicDiseases ?? ""} onChangeText={(value) => onUpdate({ chronicDiseases: value })} />
        <TextInput style={styles.input} placeholder="복용약 예: 혈압약 아침 식후" placeholderTextColor={colors.textMuted} value={profile.currentMedications ?? ""} onChangeText={(value) => onUpdate({ currentMedications: value })} />
        <TextInput style={styles.input} placeholder="응급 연락처" placeholderTextColor={colors.textMuted} value={profile.emergencyContact ?? ""} onChangeText={(value) => onUpdate({ emergencyContact: value })} />
      </KrdsCard>
    );
  }

  if (activeTab === "medication") {
    return (
      <KrdsCard>
        <SectionHeader title="복약관리 연동" description="가족별 약 목록, 스케줄, 보호자 알림의 기준입니다." />
        <InfoLine label="복용 중인 약" value={profile.currentMedications ?? "미입력"} />
        <InfoLine label="보호자 알림" value={profile.canReceiveAlert ? "알림 수신 가능" : "알림 수신 꺼짐"} />
        <ActionButton label="복약 스케줄 추가" icon="calendar-plus" tone="secondary" />
      </KrdsCard>
    );
  }

  if (activeTab === "emergency") {
    return (
      <KrdsCard>
        <SectionHeader title="응급카드" description="응급 상황에서 혈액형, 알레르기, 복용약, 보호자 연락처를 바로 확인합니다." />
        <InfoLine label="혈액형" value={profile.bloodType ?? "미입력"} />
        <InfoLine label="알레르기" value={profile.allergies ?? "미입력"} />
        <InfoLine label="기저질환" value={profile.chronicDiseases ?? "미입력"} />
        <InfoLine label="복용약" value={profile.currentMedications ?? "미입력"} />
        <InfoLine label="보호자 연락처" value={profile.emergencyContact ?? "미입력"} />
        <Text style={styles.meta}>잠금화면/QR 공유는 확장 기능으로 설계합니다.</Text>
      </KrdsCard>
    );
  }

  return (
    <KrdsCard>
      <SectionHeader title="권한설정" description="조회, 수정, 알림 수신, 긴급정보 조회 권한을 가족별로 관리합니다." />
      <PermissionToggle label="조회" value={Boolean(profile.canView)} onPress={() => onUpdate({ canView: !profile.canView })} />
      <PermissionToggle label="수정" value={Boolean(profile.canEdit)} onPress={() => onUpdate({ canEdit: !profile.canEdit })} />
      <PermissionToggle label="알림 수신" value={Boolean(profile.canReceiveAlert)} onPress={() => onUpdate({ canReceiveAlert: !profile.canReceiveAlert })} />
      <PermissionToggle label="응급조회" value={Boolean(profile.canViewEmergency)} onPress={() => onUpdate({ canViewEmergency: !profile.canViewEmergency })} />
      <InfoLine label="동의 상태" value={profile.consentStatus ?? "LOCAL_ONLY"} />
      <InfoLine label="최근 이용 기관" value={recentPlaces[0]?.placeName ?? favorites[0]?.placeName ?? "없음"} />
    </KrdsCard>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

function PermissionToggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.consentRow} onPress={onPress}>
      <MaterialCommunityIcons name={value ? "toggle-switch" : "toggle-switch-off-outline"} size={30} color={value ? colors.success : colors.textMuted} />
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  );
}

function normalizeProfileDraft(draft: Partial<FamilyProfile>) {
  return {
    profileName: draft.profileName?.trim() || "가족",
    relationType: draft.relationType ?? "ETC",
    birthDate: draft.birthDate ?? null,
    phone: draft.phone ?? null,
    gender: draft.gender ?? null,
    memo: draft.memo ?? null,
    canView: true,
    canEdit: true,
    canReceiveAlert: false,
    canViewEmergency: true,
    consentStatus: draft.relationType === "CHILD" || draft.relationType === "SELF" ? "LOCAL_ONLY" as const : "PENDING" as const
  };
}

function relationLabel(relation?: string | null) {
  return relationOptions.find((item) => item.value === relation)?.label ?? relation ?? "미입력";
}

function birthYearMonth(profile: FamilyProfile) {
  if (!profile.birthYear) return "미입력";
  return profile.birthMonth ? `${profile.birthYear}.${String(profile.birthMonth).padStart(2, "0")}` : String(profile.birthYear);
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
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  activeProfileChip: {
    backgroundColor: colors.primary
  },
  profileChipText: {
    ...typography.button,
    color: colors.primary
  },
  activeProfileChipText: {
    color: colors.onPrimary
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
  twoColumn: {
    gap: spacing.sm
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
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  detailTab: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  activeDetailTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  detailTabText: {
    ...typography.caption,
    color: colors.primary
  },
  activeDetailTabText: {
    color: colors.onPrimary
  },
  consentRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  infoLine: {
    gap: spacing.xs
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
