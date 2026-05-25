import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { MenuHelpButton } from "@/components/MenuHelpButton";
import { useAuth } from "@/auth/AuthProvider";
import { useExperienceMode } from "@/experience/ExperienceModeProvider";
import { menuHelp } from "@/help/menuHelp";
import {
  clearLocalUserData,
  ConsentSettings,
  defaultConsentSettings,
  FamilyProfile,
  getConsentSettings,
  getLocalFavoritePlaces,
  getLocalMedicationEvents,
  getLocalMedicineSchedules,
  getLocalRegisteredMedicines,
  getLocalRecentPlaces,
  saveConsentSettings,
  StoredPlace
} from "@/services/localUserData";
import { migrateGuestData } from "@/services/serverApi";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type MenuTab = "mydata" | "family" | "consent";
type DetailTab = "basic" | "health" | "medication" | "emergency" | "permission";

type FamilyInvite = {
  id: string;
  snsId: string;
  relation: string;
  relationType: string;
  status: "PENDING" | "APPROVED";
  requestedAt: string;
};

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
  const { mode, isEasyMode, setMode } = useExperienceMode();
  const { profiles, selectedProfile, selectProfile: selectFamilyProfile, addProfile, updateProfile, reloadProfiles } = useFamilyProfile();
  const [activeMenu, setActiveMenu] = useState<MenuTab>("mydata");
  const [activeDetail, setActiveDetail] = useState<DetailTab>("basic");
  const [favorites, setFavorites] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [consents, setConsents] = useState<ConsentSettings>(defaultConsentSettings);
  const [myDataModalVisible, setMyDataModalVisible] = useState(false);
  const [familyInviteModalVisible, setFamilyInviteModalVisible] = useState(false);
  const [myDataDraft, setMyDataDraft] = useState<Partial<FamilyProfile>>({});
  const [inviteDraft, setInviteDraft] = useState({ snsId: "", relationType: "PARENT" });
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [dataSummary, setDataSummary] = useState({ medicines: 0, schedules: 0, events: 0 });
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isMember = session?.mode === "member" && Boolean(session.userId);
  const storageLabel = isMember ? "서버 동기화" : "기기 저장";

  useEffect(() => {
    loadData();
  }, [session?.mode, session?.userId]);

  useEffect(() => {
    setMyDataDraft({
      profileName: selectedProfile?.profileName ?? "나",
      relationType: selectedProfile?.relationType ?? "SELF",
      birthDate: selectedProfile?.birthDate ?? "",
      gender: selectedProfile?.gender ?? "",
      phone: selectedProfile?.phone ?? "",
      bloodType: selectedProfile?.bloodType ?? "",
      allergies: selectedProfile?.allergies ?? "",
      chronicDiseases: selectedProfile?.chronicDiseases ?? "",
      currentMedications: selectedProfile?.currentMedications ?? "",
      emergencyContact: selectedProfile?.emergencyContact ?? "",
      favoriteHospital: selectedProfile?.favoriteHospital ?? "",
      favoritePharmacy: selectedProfile?.favoritePharmacy ?? ""
    });
  }, [selectedProfile?.profileId]);

  const localRecentForProfile = useMemo(
    () => recentPlaces.filter((item) => !item.profileId || String(item.profileId) === String(selectedProfile?.profileId)),
    [recentPlaces, selectedProfile?.profileId]
  );
  const profileCompletion = useMemo(() => {
    const checks = [
      selectedProfile?.profileName,
      selectedProfile?.bloodType,
      selectedProfile?.allergies,
      selectedProfile?.currentMedications,
      selectedProfile?.emergencyContact
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [selectedProfile]);
  const consentCount = useMemo(() => Object.values(consents).filter(Boolean).length, [consents]);

  const loadData = async () => {
    const [localFavorites, localRecent, localConsents, medicines, medicineSchedules, medicationEvents] = await Promise.all([
      getLocalFavoritePlaces(),
      getLocalRecentPlaces(),
      getConsentSettings(),
      getLocalRegisteredMedicines(),
      getLocalMedicineSchedules(),
      getLocalMedicationEvents()
    ]);
    setFavorites(localFavorites);
    setRecentPlaces(localRecent);
    setConsents(localConsents);
    setDataSummary({
      medicines: medicines.length,
      schedules: medicineSchedules.length,
      events: medicationEvents.length
    });
  };

  const handleSelectProfile = async (profileId: string | number) => {
    await selectFamilyProfile(profileId);
    setMessage("현재 관리 대상을 변경했습니다. 복약, 병원약국, 응급 메뉴에 이 기준을 연동합니다.");
  };

  const updateSelectedProfile = async (patch: Partial<FamilyProfile>) => {
    if (!selectedProfile) return;
    const nextProfile = { ...selectedProfile, ...patch };
    await updateProfile(nextProfile);
    setMessage(isMember ? "마이데이터를 서버에 동기화했습니다." : "마이데이터를 이 기기에 저장했습니다.");
  };

  const saveMyData = async () => {
    await updateSelectedProfile(myDataDraft);
    setMyDataModalVisible(false);
  };

  const sendFamilyInvite = () => {
    const snsId = inviteDraft.snsId.trim();
    if (!snsId) return;
    const nextInvite: FamilyInvite = {
      id: `invite-${Date.now()}`,
      snsId,
      relation: relationLabel(inviteDraft.relationType),
      relationType: inviteDraft.relationType,
      status: "PENDING",
      requestedAt: "방금 전"
    };
    setInvites((current) => [nextInvite, ...current]);
    setInviteDraft({ snsId: "", relationType: "PARENT" });
    setFamilyInviteModalVisible(false);
    setMessage("SNS 아이디로 가족 연결 신청을 보냈습니다. 상대가 승인하면 가족 프로필과 공유 동의 정보를 가져오는 구조입니다.");
  };

  const approveInviteDemo = async (invite: FamilyInvite) => {
    const saved = await addProfile({
      profileName: invite.snsId,
      relationType: invite.relationType || "ETC",
      consentStatus: "ACCEPTED",
      canView: true,
      canEdit: false,
      canReceiveAlert: true,
      canViewEmergency: true,
      memo: "SNS 가족 연결 승인으로 가져온 프로필"
    });
    setInvites((current) => current.map((item) => item.id === invite.id ? { ...item, status: "APPROVED" } : item));
    await selectFamilyProfile(saved.profileId);
    setMessage("승인된 가족 정보를 가져와 가족 목록에 추가했습니다.");
  };

  const migrateLocalData = async () => {
    if (!session?.guestId && !session?.deviceUuid) return;
    const [medicines, medicineSchedules, medicationEvents] = await Promise.all([
      getLocalRegisteredMedicines(),
      getLocalMedicineSchedules(),
      getLocalMedicationEvents()
    ]);
    await migrateGuestData({
      guestId: session.guestId ?? session.deviceUuid ?? "unknown-guest",
      userId: session.userId,
      favorites,
      recentPlaces,
      familyProfiles: profiles,
      medicines,
      medicineSchedules,
      medicationEvents
    });
    setMessage("비회원 데이터를 회원 계정에 병합했습니다.");
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
    setDataSummary({ medicines: 0, schedules: 0, events: 0 });
    if (!isMember) await reloadProfiles();
    setMessage("이 기기에 저장된 기록을 삭제했습니다.");
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <AppScreen contentStyle={[styles.screen, isEasyMode && styles.easyScreen]}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="view-grid-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>전체 메뉴</Text>
            <Text style={styles.title}>가족 · 마이데이터</Text>
          </View>
          <MenuHelpButton content={menuHelp.menu} />
        </View>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="shield-check-outline" size={28} color={noticeText} />
        <Text style={styles.noticeText}>
          건강정보와 가족 연결 정보는 민감할 수 있습니다. 가족 연결은 SNS 아이디로 신청하고 상대 승인 후 공유 정보를 가져오는 구조입니다.
        </Text>
      </View>

      <View style={styles.modeCard}>
        <View style={styles.modeTextGroup}>
          <Text style={styles.sectionTitle}>화면 모드</Text>
          <Text style={styles.body}>{isEasyMode ? "쉬운모드로 꼭 필요한 기능만 크게 보여줍니다." : "상세모드로 전체 기능과 세부 관리를 보여줍니다."}</Text>
        </View>
        <View style={styles.modeSwitchRow}>
          <SegmentButton label="쉬운모드" active={mode === "easy"} onPress={() => setMode("easy")} />
          <SegmentButton label="상세모드" active={mode === "detail"} onPress={() => setMode("detail")} />
        </View>
      </View>

      {!isEasyMode ? <View style={styles.dashboardGrid}>
        <DashboardMetric label="저장 방식" value={isMember ? "서버" : "기기"} icon={isMember ? "cloud-check-outline" : "cellphone-lock"} tone={isMember ? "primary" : "warning"} />
        <DashboardMetric label="프로필 완성" value={`${profileCompletion}%`} icon="account-heart-outline" tone={profileCompletion >= 80 ? "success" : "warning"} />
        <DashboardMetric label="복약 데이터" value={`${dataSummary.medicines}/${dataSummary.schedules}`} icon="pill" tone="primary" />
        <DashboardMetric label="동의 항목" value={`${consentCount}/${consentLabels.length}`} icon="shield-check-outline" tone={consentCount >= 3 ? "success" : "warning"} />
      </View> : null}

      {!isEasyMode ? <View style={styles.shortcutGrid}>
        <ShortcutButton label="알약" icon="pill" onPress={() => router.push("/(tabs)/pills")} />
        <ShortcutButton label="복약" icon="calendar-check" onPress={() => router.push("/(tabs)/medication")} />
        <ShortcutButton label="병원약국" icon="map-marker-radius" onPress={() => router.push("/(tabs)/map")} />
        <ShortcutButton label="응급카드" icon="card-account-details-star-outline" danger onPress={() => router.push("/(tabs)/emergency")} />
      </View> : null}

      <View style={styles.actionGrid}>
        <MenuTile title="마이데이터" description="등록/수정" icon="database-plus-outline" active={activeMenu === "mydata"} onPress={() => setActiveMenu("mydata")} />
        <MenuTile title="가족 추가" description="SNS 신청" icon="account-plus-outline" active={activeMenu === "family"} onPress={() => setFamilyInviteModalVisible(true)} />
        <MenuTile title="동의 관리" description="개인정보" icon="file-document-check-outline" active={activeMenu === "consent"} onPress={() => setActiveMenu("consent")} />
      </View>

      {activeMenu === "mydata" ? (
        <MyDataPanel
          isMember={isMember}
          sessionName={session?.nickname}
          profile={selectedProfile}
          favorites={favorites}
          recentPlaces={localRecentForProfile}
          onOpenModal={() => setMyDataModalVisible(true)}
          onMigrate={migrateLocalData}
          onClearRecords={() => setClearConfirmVisible(true)}
          onLogout={handleLogout}
          dataSummary={dataSummary}
        />
      ) : activeMenu === "family" ? (
        <FamilyPanel
          profiles={profiles}
          selectedProfile={selectedProfile}
          activeDetail={activeDetail}
          invites={invites}
          favorites={favorites}
          recentPlaces={localRecentForProfile}
          onSelectProfile={handleSelectProfile}
          onOpenInvite={() => setFamilyInviteModalVisible(true)}
          onSetDetail={setActiveDetail}
          onUpdateProfile={updateSelectedProfile}
          onApproveInvite={approveInviteDemo}
        />
      ) : (
        <ConsentPanel consents={consents} onToggleConsent={toggleConsent} />
      )}

      {message ? <Text style={styles.successNotice}>{message}</Text> : null}

      <MyDataModal
        visible={myDataModalVisible}
        draft={myDataDraft}
        onChange={(patch) => setMyDataDraft((current) => ({ ...current, ...patch }))}
        onClose={() => setMyDataModalVisible(false)}
        onSave={saveMyData}
      />

      <FamilyInviteModal
        visible={familyInviteModalVisible}
        draft={inviteDraft}
        onChange={(patch) => setInviteDraft((current) => ({ ...current, ...patch }))}
        onClose={() => setFamilyInviteModalVisible(false)}
        onSend={sendFamilyInvite}
      />

      <ConfirmModal
        visible={clearConfirmVisible}
        title="기기 기록 삭제"
        description="비회원 로컬 즐겨찾기, 최근 기록, 가족 프로필, 약/복약 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={async () => {
          setClearConfirmVisible(false);
          await clearRecords();
        }}
        onClose={() => setClearConfirmVisible(false)}
      />
    </AppScreen>
  );
}

function MyDataPanel({
  isMember,
  sessionName,
  profile,
  favorites,
  recentPlaces,
  dataSummary,
  onOpenModal,
  onMigrate,
  onClearRecords,
  onLogout
}: {
  isMember: boolean;
  sessionName?: string;
  profile?: FamilyProfile | null;
  favorites: StoredPlace[];
  recentPlaces: StoredPlace[];
  dataSummary: { medicines: number; schedules: number; events: number };
  onOpenModal: () => void;
  onMigrate: () => void;
  onClearRecords: () => void;
  onLogout: () => void;
}) {
  const healthItems = [
    { label: "혈액형", value: profile?.bloodType },
    { label: "알레르기", value: profile?.allergies },
    { label: "기저질환", value: profile?.chronicDiseases },
    { label: "복용약", value: profile?.currentMedications },
    { label: "응급 연락처", value: profile?.emergencyContact }
  ];
  const filledHealthItems = healthItems.filter((item) => Boolean(item.value));

  return (
    <>
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>마이데이터</Text>
            <Text style={styles.body}>{isMember ? `${sessionName ?? "회원"} 계정에 활동 기록과 건강 메모를 동기화합니다.` : "비회원 마이데이터는 이 기기에만 저장됩니다."}</Text>
          </View>
          <Pressable style={styles.addButton} onPress={onOpenModal}>
            <Text style={styles.addButtonText}>{filledHealthItems.length ? "수정" : "등록"}</Text>
          </Pressable>
        </View>
        <View style={styles.myDataSummary}>
          <View style={styles.profileAvatar}>
            <MaterialCommunityIcons name="account-heart-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{profile?.profileName ?? "나"}</Text>
            <Text style={styles.meta}>
              {relationLabel(profile?.relationType)} · {profile?.gender || "성별 미입력"} · {profile?.birthDate || birthYearMonth(profile ?? ({ profileId: "", profileName: "" } as FamilyProfile))}
            </Text>
          </View>
        </View>
        <View style={styles.healthChipRow}>
          {filledHealthItems.length ? filledHealthItems.map((item) => (
            <View key={item.label} style={styles.healthChip}>
              <Text style={styles.healthChipLabel}>{item.label}</Text>
              <Text style={styles.healthChipText} numberOfLines={1}>{item.value}</Text>
            </View>
          )) : (
            <Pressable style={styles.emptyDataBox} onPress={onOpenModal}>
              <MaterialCommunityIcons name="database-plus-outline" size={22} color={colors.primary} />
              <Text style={[styles.body, styles.emptyDataText]}>아직 등록된 건강정보가 없습니다. 필요한 항목만 등록해 주세요.</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>저장한 정보</Text>
          <Text style={styles.meta}>{isMember ? "서버 동기화" : "기기 저장"}</Text>
        </View>
        <View style={styles.miniMetricRow}>
          <MiniMetric label="등록 약" value={`${dataSummary.medicines}개`} />
          <MiniMetric label="복약 일정" value={`${dataSummary.schedules}개`} />
          <MiniMetric label="복약 기록" value={`${dataSummary.events}건`} />
        </View>
        <View style={styles.placeSummaryRow}>
          <MiniMetric label="즐겨찾기" value={`${favorites.length}곳`} />
          <MiniMetric label="최근 본 장소" value={`${recentPlaces.length}곳`} />
        </View>
        <View style={styles.buttonRow}>
          {isMember ? <MenuButton label="비회원 기록 병합" icon="database-import" variant="outline" onPress={onMigrate} /> : null}
          <MenuButton label="검색 기록 삭제" icon="delete-outline" variant="outline" onPress={onClearRecords} />
          <MenuButton label="로그아웃" icon="logout" variant="outline" onPress={onLogout} />
        </View>
      </View>
    </>
  );
}

function ConsentPanel({
  consents,
  onToggleConsent
}: {
  consents: ConsentSettings;
  onToggleConsent: (key: keyof ConsentSettings) => void;
}) {
  const requiredKeys: Array<keyof ConsentSettings> = ["terms", "privacy", "age14"];
  const optionalItems = consentLabels.filter(([key]) => !requiredKeys.includes(key));
  const agreedRequired = requiredKeys.filter((key) => consents[key]).length;

  return (
    <>
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>동의 관리</Text>
            <Text style={styles.body}>약관, 개인정보, 위치, 알림 같은 동의 항목을 한곳에서 관리합니다.</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{agreedRequired}/{requiredKeys.length} 필수</Text>
          </View>
        </View>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>필수 동의</Text>
        {consentLabels.filter(([key]) => requiredKeys.includes(key)).map(([key, label]) => (
          <ConsentRow key={key} label={label} checked={consents[key]} onPress={() => onToggleConsent(key)} required />
        ))}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>선택 동의</Text>
        <Text style={styles.body}>민감 정보와 편의 기능은 필요할 때만 켜도 됩니다.</Text>
        {optionalItems.map(([key, label]) => (
          <ConsentRow key={key} label={label} checked={consents[key]} onPress={() => onToggleConsent(key)} />
        ))}
      </View>
    </>
  );
}

function FamilyPanel({
  profiles,
  selectedProfile,
  activeDetail,
  invites,
  favorites,
  recentPlaces,
  onSelectProfile,
  onOpenInvite,
  onSetDetail,
  onUpdateProfile,
  onApproveInvite
}: {
  profiles: FamilyProfile[];
  selectedProfile?: FamilyProfile | null;
  activeDetail: DetailTab;
  invites: FamilyInvite[];
  favorites: StoredPlace[];
  recentPlaces: StoredPlace[];
  onSelectProfile: (profileId: string | number) => void;
  onOpenInvite: () => void;
  onSetDetail: (tab: DetailTab) => void;
  onUpdateProfile: (patch: Partial<FamilyProfile>) => void;
  onApproveInvite: (invite: FamilyInvite) => void;
}) {
  return (
    <>
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>가족</Text>
            <Text style={styles.body}>SNS 아이디로 가족 연결을 신청하고, 상대가 승인하면 공유 동의 범위의 정보를 가져옵니다.</Text>
          </View>
          <Pressable style={styles.addButton} onPress={onOpenInvite}>
            <Text style={styles.addButtonText}>추가</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {profiles.map((profile) => {
            const active = String(profile.profileId) === String(selectedProfile?.profileId);
            return (
              <Pressable key={String(profile.profileId)} style={[styles.profileChip, active && styles.profileChipActive]} onPress={() => onSelectProfile(profile.profileId)}>
                <Text style={[styles.profileChipText, active && styles.profileChipTextActive]}>{profile.profileName}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>가족 연결 신청</Text>
        {invites.length ? invites.map((invite) => (
          <View key={invite.id} style={styles.inviteRow}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{invite.snsId}</Text>
              <Text style={styles.meta}>{invite.relation} · {invite.status === "PENDING" ? "승인 대기" : "승인 완료"} · {invite.requestedAt}</Text>
            </View>
            {invite.status === "PENDING" ? (
              <MenuButton label="승인 가져오기" icon="cloud-download-outline" variant="outline" onPress={() => onApproveInvite(invite)} />
            ) : (
              <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>연결됨</Text></View>
            )}
          </View>
        )) : <Text style={styles.body}>아직 보낸 가족 연결 신청이 없습니다.</Text>}
      </View>

      {selectedProfile ? (
        <>
          <View style={styles.tabRow}>
            {detailTabs.map((tab) => (
              <Pressable key={tab.key} style={[styles.detailTab, activeDetail === tab.key && styles.detailTabActive]} onPress={() => onSetDetail(tab.key)}>
                <MaterialCommunityIcons name={tab.icon} size={18} color={activeDetail === tab.key ? "#FFFFFF" : colors.primary} />
                <Text style={[styles.detailTabText, activeDetail === tab.key && styles.detailTabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
          <ProfileDetail profile={selectedProfile} activeTab={activeDetail} onUpdate={onUpdateProfile} favorites={favorites} recentPlaces={recentPlaces} />
        </>
      ) : null}
    </>
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
    const basicItems = [
      { label: "관계", value: relationLabel(profile.relationType) },
      { label: "생년월일", value: profile.birthDate ?? birthYearMonth(profile) },
      { label: "성별", value: profile.gender ?? "미입력" },
      { label: "연락처", value: profile.phone ?? "미입력" }
    ];
    const careItems = [
      { label: "자주 가는 병원", value: profile.favoriteHospital },
      { label: "자주 가는 약국", value: profile.favoritePharmacy },
      { label: "동의 상태", value: profile.consentStatus ?? "LOCAL_ONLY" },
      { label: "최근 이용 기관", value: recentPlaces[0]?.placeName ?? favorites[0]?.placeName }
    ].filter((item) => Boolean(item.value));

    return (
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>기본정보</Text>
            <Text style={styles.body}>현재 가족의 기본 정보와 앱 연동 상태를 요약합니다.</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{relationLabel(profile.relationType)}</Text>
          </View>
        </View>
        <View style={styles.myDataSummary}>
          <View style={styles.profileAvatar}>
            <MaterialCommunityIcons name="account-heart-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{profile.profileName}</Text>
            <Text style={styles.meta}>
              {relationLabel(profile.relationType)} · {profile.gender || "성별 미입력"} · {profile.birthDate || birthYearMonth(profile)}
            </Text>
          </View>
        </View>
        <View style={styles.healthChipRow}>
          {basicItems.map((item) => (
            <View key={item.label} style={styles.healthChip}>
              <Text style={styles.healthChipLabel}>{item.label}</Text>
              <Text style={styles.healthChipText} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.miniMetricRow}>
          <MiniMetric label="조회 권한" value={profile.canView ? "가능" : "꺼짐"} />
          <MiniMetric label="수정 권한" value={profile.canEdit ? "가능" : "꺼짐"} />
          <MiniMetric label="알림 수신" value={profile.canReceiveAlert ? "가능" : "꺼짐"} />
        </View>
        {careItems.length ? (
          <View style={styles.healthChipRow}>
            {careItems.map((item) => (
              <View key={item.label} style={styles.healthChip}>
                <Text style={styles.healthChipLabel}>{item.label}</Text>
                <Text style={styles.healthChipText} numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  if (activeTab === "health") {
    return (
      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>건강정보 관리</Text>
        <Text style={styles.body}>마이데이터 등록 모달과 같은 항목을 가족별로 관리합니다.</Text>
        <TextInput style={styles.input} placeholder="혈액형 예: A+" placeholderTextColor={colors.textMuted} value={profile.bloodType ?? ""} onChangeText={(value) => onUpdate({ bloodType: value })} />
        <TextInput style={styles.input} placeholder="알레르기 예: 페니실린, 땅콩" placeholderTextColor={colors.textMuted} value={profile.allergies ?? ""} onChangeText={(value) => onUpdate({ allergies: value })} />
        <TextInput style={styles.input} placeholder="기저질환 예: 고혈압, 천식" placeholderTextColor={colors.textMuted} value={profile.chronicDiseases ?? ""} onChangeText={(value) => onUpdate({ chronicDiseases: value })} />
        <TextInput style={styles.input} placeholder="복용약 예: 혈압약 아침 식후" placeholderTextColor={colors.textMuted} value={profile.currentMedications ?? ""} onChangeText={(value) => onUpdate({ currentMedications: value })} />
        <TextInput style={styles.input} placeholder="응급 연락처" placeholderTextColor={colors.textMuted} value={profile.emergencyContact ?? ""} onChangeText={(value) => onUpdate({ emergencyContact: value })} />
      </View>
    );
  }

  if (activeTab === "medication") {
    return (
      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>복약관리 연동</Text>
        <InfoLine label="복용 중인 약" value={profile.currentMedications ?? "미입력"} />
        <InfoLine label="보호자 알림" value={profile.canReceiveAlert ? "알림 수신 가능" : "알림 수신 꺼짐"} />
      </View>
    );
  }

  if (activeTab === "emergency") {
    return (
      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>응급카드</Text>
        <InfoLine label="혈액형" value={profile.bloodType ?? "미입력"} />
        <InfoLine label="알레르기" value={profile.allergies ?? "미입력"} />
        <InfoLine label="기저질환" value={profile.chronicDiseases ?? "미입력"} />
        <InfoLine label="복용약" value={profile.currentMedications ?? "미입력"} />
        <InfoLine label="보호자 연락처" value={profile.emergencyContact ?? "미입력"} />
      </View>
    );
  }

  return (
    <View style={styles.listCard}>
      <Text style={styles.sectionTitle}>권한설정</Text>
      <PermissionToggle label="조회" value={Boolean(profile.canView)} onPress={() => onUpdate({ canView: !profile.canView })} />
      <PermissionToggle label="수정" value={Boolean(profile.canEdit)} onPress={() => onUpdate({ canEdit: !profile.canEdit })} />
      <PermissionToggle label="알림 수신" value={Boolean(profile.canReceiveAlert)} onPress={() => onUpdate({ canReceiveAlert: !profile.canReceiveAlert })} />
      <PermissionToggle label="응급조회" value={Boolean(profile.canViewEmergency)} onPress={() => onUpdate({ canViewEmergency: !profile.canViewEmergency })} />
      <InfoLine label="동의 상태" value={profile.consentStatus ?? "LOCAL_ONLY"} />
      <InfoLine label="최근 이용 기관" value={recentPlaces[0]?.placeName ?? favorites[0]?.placeName ?? "없음"} />
    </View>
  );
}

function MyDataModal({
  visible,
  draft,
  onChange,
  onClose,
  onSave
}: {
  visible: boolean;
  draft: Partial<FamilyProfile>;
  onChange: (patch: Partial<FamilyProfile>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>마이데이터 등록/수정</Text>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.body}>건강정보는 필요한 항목만 등록하고 언제든 삭제할 수 있습니다.</Text>
          <TextInput style={styles.input} placeholder="프로필 이름 예: 나, 어머니" placeholderTextColor={colors.textMuted} value={draft.profileName ?? ""} onChangeText={(value) => onChange({ profileName: value })} />
          <View style={styles.chipRow}>
            {relationOptions.map((relation) => (
              <Pressable key={relation.value} style={[styles.smallChip, draft.relationType === relation.value && styles.smallChipActive]} onPress={() => onChange({ relationType: relation.value })}>
                <Text style={[styles.smallChipText, draft.relationType === relation.value && styles.smallChipTextActive]}>{relation.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="생년월일 예: 1980-05-12" placeholderTextColor={colors.textMuted} value={draft.birthDate ?? ""} onChangeText={(value) => onChange({ birthDate: value })} />
          <TextInput style={styles.input} placeholder="성별 예: 여성, 남성" placeholderTextColor={colors.textMuted} value={draft.gender ?? ""} onChangeText={(value) => onChange({ gender: value })} />
          <TextInput style={styles.input} placeholder="연락처" placeholderTextColor={colors.textMuted} value={draft.phone ?? ""} onChangeText={(value) => onChange({ phone: value })} />
          <TextInput style={styles.input} placeholder="혈액형 예: A+" placeholderTextColor={colors.textMuted} value={draft.bloodType ?? ""} onChangeText={(value) => onChange({ bloodType: value })} />
          <TextInput style={styles.input} placeholder="알레르기" placeholderTextColor={colors.textMuted} value={draft.allergies ?? ""} onChangeText={(value) => onChange({ allergies: value })} />
          <TextInput style={styles.input} placeholder="기저질환" placeholderTextColor={colors.textMuted} value={draft.chronicDiseases ?? ""} onChangeText={(value) => onChange({ chronicDiseases: value })} />
          <TextInput style={styles.input} placeholder="복용 중인 약" placeholderTextColor={colors.textMuted} value={draft.currentMedications ?? ""} onChangeText={(value) => onChange({ currentMedications: value })} />
          <TextInput style={styles.input} placeholder="응급 연락처" placeholderTextColor={colors.textMuted} value={draft.emergencyContact ?? ""} onChangeText={(value) => onChange({ emergencyContact: value })} />
          <TextInput style={styles.input} placeholder="자주 가는 병원" placeholderTextColor={colors.textMuted} value={draft.favoriteHospital ?? ""} onChangeText={(value) => onChange({ favoriteHospital: value })} />
          <TextInput style={styles.input} placeholder="자주 가는 약국" placeholderTextColor={colors.textMuted} value={draft.favoritePharmacy ?? ""} onChangeText={(value) => onChange({ favoritePharmacy: value })} />
          <View style={styles.buttonRow}>
            <MenuButton label="저장" icon="content-save-outline" variant="filled" onPress={onSave} />
            <MenuButton label="취소" icon="close-circle-outline" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FamilyInviteModal({
  visible,
  draft,
  onChange,
  onClose,
  onSend
}: {
  visible: boolean;
  draft: { snsId: string; relationType: string };
  onChange: (patch: Partial<{ snsId: string; relationType: string }>) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>SNS 가족 추가 신청</Text>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.body}>상대 SNS 아이디로 가족 연결을 신청합니다. 승인 후 공유 범위에 따라 가족 정보와 응급/복약 정보를 가져옵니다.</Text>
          <TextInput style={styles.input} placeholder="SNS 아이디 또는 이메일" placeholderTextColor={colors.textMuted} value={draft.snsId} onChangeText={(value) => onChange({ snsId: value })} />
          <View style={styles.chipRow}>
            {relationOptions.filter((item) => item.value !== "SELF").map((relation) => (
              <Pressable key={relation.value} style={[styles.smallChip, draft.relationType === relation.value && styles.smallChipActive]} onPress={() => onChange({ relationType: relation.value })}>
                <Text style={[styles.smallChipText, draft.relationType === relation.value && styles.smallChipTextActive]}>{relation.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.flowBox}>
            <Text style={styles.meta}>연결 흐름</Text>
            <Text style={styles.body}>신청 전송 → 상대 가족 승인 → 권한/동의 확인 → 가족 프로필 가져오기</Text>
          </View>
          <View style={styles.buttonRow}>
            <MenuButton label="신청 보내기" icon="send-outline" variant="filled" onPress={onSend} />
            <MenuButton label="취소" icon="close-circle-outline" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.body}>{description}</Text>
          <View style={styles.buttonRow}>
            <MenuButton label={confirmLabel} icon="delete-outline" variant="filled" onPress={onConfirm} />
            <MenuButton label="취소" icon="close-circle-outline" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConsentRow({
  label,
  checked,
  required = false,
  onPress
}: {
  label: string;
  checked: boolean;
  required?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.consentManageRow} onPress={onPress}>
      <MaterialCommunityIcons name={checked ? "checkbox-marked" : "checkbox-blank-outline"} size={26} color={checked ? colors.primary : colors.textMuted} />
      <View style={styles.flex}>
        <Text style={styles.body}>{label}</Text>
        <Text style={styles.meta}>{required ? "서비스 이용을 위한 기본 동의" : "기능 사용 시 언제든 변경 가능"}</Text>
      </View>
      <Text style={[styles.consentState, checked && styles.consentStateActive]}>{checked ? "동의" : "미동의"}</Text>
    </Pressable>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DashboardMetric({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: "primary" | "success" | "warning";
}) {
  const warning = tone === "warning";
  const success = tone === "success";
  return (
    <View style={[styles.dashboardCard, warning && styles.dashboardWarning, success && styles.dashboardSuccess]}>
      <MaterialCommunityIcons name={icon} size={20} color={warning ? colors.warning : success ? colors.success : colors.primary} />
      <Text style={styles.dashboardValue}>{value}</Text>
      <Text style={styles.dashboardLabel}>{label}</Text>
    </View>
  );
}

function ShortcutButton({
  label,
  icon,
  danger = false,
  onPress
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.shortcutButton, danger && styles.shortcutDanger]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? "#D92D20" : colors.primary} />
      <Text style={[styles.shortcutText, danger && styles.shortcutDangerText]}>{label}</Text>
    </Pressable>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniMetricValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

function MenuTile({ title, description, icon, active = false, onPress }: { title: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, active && styles.tileActive]}>
      <MaterialCommunityIcons name={icon} size={24} color={active ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.tileTitle, active && styles.tileTitleActive]}>{title}</Text>
      <Text style={[styles.tileDescription, active && styles.tileDescriptionActive]}>{description}</Text>
    </Pressable>
  );
}

function MenuButton({ label, icon, variant, onPress }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; variant: "filled" | "outline"; onPress?: () => void }) {
  const filled = variant === "filled";
  return (
    <Pressable onPress={onPress} style={[styles.menuButton, filled ? styles.menuButtonFilled : styles.menuButtonOutline]}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.menuButtonText, filled ? styles.menuButtonTextFilled : styles.menuButtonTextOutline]}>{label}</Text>
    </Pressable>
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

function relationLabel(relation?: string | null) {
  return relationOptions.find((item) => item.value === relation)?.label ?? relation ?? "미입력";
}

function birthYearMonth(profile: FamilyProfile) {
  if (!profile.birthYear) return "미입력";
  return profile.birthMonth ? `${profile.birthYear}.${String(profile.birthMonth).padStart(2, "0")}` : String(profile.birthYear);
}

const noticeText = "#A83B15";

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.md
  },
  easyScreen: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl
  },
  hero: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs
  },
  heroHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  heroTitleGroup: {
    flex: 1,
    justifyContent: "center"
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800",
    lineHeight: 22
  },
  title: {
    ...typography.title,
    color: colors.textStrong,
    lineHeight: 32
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23
  },
  notice: {
    minHeight: 78,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  noticeText: {
    ...typography.body,
    flex: 1,
    color: noticeText,
    fontWeight: "800",
    lineHeight: 24
  },
  modeCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.md
  },
  modeTextGroup: {
    gap: spacing.xs
  },
  modeSwitchRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  dashboardCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 82,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    gap: spacing.xs
  },
  dashboardWarning: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  dashboardSuccess: {
    borderColor: "#B7E4C7",
    backgroundColor: "#F0FFF4"
  },
  dashboardValue: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "800"
  },
  dashboardLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  shortcutButton: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  shortcutDanger: {
    borderColor: "#FFB4AB",
    backgroundColor: "#FFF1F1"
  },
  shortcutText: {
    ...typography.button,
    color: colors.primary
  },
  shortcutDangerText: {
    color: "#D92D20"
  },
  segmented: {
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.xs,
    flexDirection: "row",
    gap: spacing.xs
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.primary
  },
  segmentText: {
    ...typography.button,
    color: colors.primary
  },
  segmentTextActive: {
    color: "#FFFFFF"
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  tile: {
    flex: 1,
    minHeight: 94,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    justifyContent: "space-between"
  },
  tileActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  tileTitle: {
    ...typography.bodyLarge,
    fontWeight: "800",
    color: colors.primary
  },
  tileTitleActive: {
    color: "#FFFFFF"
  },
  tileDescription: {
    ...typography.body,
    color: colors.text
  },
  tileDescriptionActive: {
    color: "#FFFFFF"
  },
  listCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  flex: {
    flex: 1,
    gap: spacing.xs
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
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
  addButton: {
    minWidth: 64,
    minHeight: 46,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  addButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  infoLine: {
    gap: spacing.xs
  },
  myDataSummary: {
    minHeight: 70,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  healthChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  healthChip: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 54,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    padding: spacing.sm,
    justifyContent: "center",
    gap: 2
  },
  healthChipLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  healthChipText: {
    ...typography.body,
    color: colors.textStrong,
    fontWeight: "800"
  },
  emptyDataBox: {
    width: "100%",
    minHeight: 64,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  emptyDataText: {
    flex: 1,
    flexShrink: 1
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  miniMetricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  miniMetric: {
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    justifyContent: "center"
  },
  miniMetricValue: {
    ...typography.bodyLarge,
    color: colors.primary,
    fontWeight: "800"
  },
  placeSummaryRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  menuButton: {
    minHeight: 48,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  menuButtonFilled: {
    backgroundColor: colors.primary
  },
  menuButtonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.primary
  },
  menuButtonText: {
    ...typography.button
  },
  menuButtonTextFilled: {
    color: "#FFFFFF"
  },
  menuButtonTextOutline: {
    color: colors.primary
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  profileChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  profileChipActive: {
    backgroundColor: colors.primary
  },
  profileChipText: {
    ...typography.button,
    color: colors.primary
  },
  profileChipTextActive: {
    color: "#FFFFFF"
  },
  inviteRow: {
    minHeight: 72,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  statusBadge: {
    borderRadius: 4,
    backgroundColor: "#E8F5EE",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.success
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  detailTab: {
    minHeight: 42,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  detailTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  detailTabText: {
    ...typography.caption,
    color: colors.primary
  },
  detailTabTextActive: {
    color: "#FFFFFF"
  },
  consentRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  consentManageRow: {
    minHeight: 66,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  consentState: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800"
  },
  consentStateActive: {
    color: colors.primary
  },
  input: {
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.bodyLarge,
    color: colors.textStrong
  },
  smallChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  smallChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  smallChipText: {
    ...typography.caption,
    color: colors.text
  },
  smallChipTextActive: {
    color: colors.primaryStrong
  },
  flowBox: {
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.42)",
    padding: spacing.lg,
    justifyContent: "center"
  },
  modalCard: {
    maxHeight: "92%",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  successNotice: {
    ...typography.body,
    color: colors.success,
    textAlign: "center"
  }
});
