import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
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
  StoredPlace,
  updateLocalFamilyProfile
} from "@/services/localUserData";
import { migrateGuestData } from "@/services/serverApi";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type MenuTab = "mydata" | "family";
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
  const { profiles, selectedProfile, selectProfile: selectFamilyProfile, addProfile, reloadProfiles } = useFamilyProfile();
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
  const [message, setMessage] = useState<string | null>(null);

  const isMember = session?.mode === "member" && Boolean(session.userId);
  const storageLabel = isMember ? "서버 동기화" : "기기 저장";

  useEffect(() => {
    loadData();
  }, [session?.mode, session?.userId]);

  useEffect(() => {
    setMyDataDraft({
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
    setMessage("현재 관리 대상을 변경했습니다. 복약, 병원약국, 응급 메뉴에 이 기준을 연동합니다.");
  };

  const updateSelectedProfile = async (patch: Partial<FamilyProfile>) => {
    if (!selectedProfile) return;
    const nextProfile = { ...selectedProfile, ...patch };
    if (!isMember) {
      await updateLocalFamilyProfile(nextProfile);
      await reloadProfiles();
      setMessage("마이데이터를 이 기기에 저장했습니다.");
      return;
    }
    setMessage("회원 마이데이터는 서버 PATCH API 연결 지점입니다. 현재 구조는 서버 동기화 기준으로 분리했습니다.");
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
    if (!isMember) await reloadProfiles();
    setMessage("이 기기에 저장된 기록을 삭제했습니다.");
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="view-grid-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>전체 메뉴</Text>
            <Text style={styles.title}>가족 · 마이데이터</Text>
          </View>
        </View>
        <Text style={styles.description}>
          마이데이터와 가족 관리를 분리해서 관리합니다. 저장 방식은 로그인 상태에 따라 서버 또는 기기 내부로 나뉩니다.
        </Text>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="shield-check-outline" size={28} color={noticeText} />
        <Text style={styles.noticeText}>
          건강정보와 가족 연결 정보는 민감할 수 있습니다. 가족 연결은 SNS 아이디로 신청하고 상대 승인 후 공유 정보를 가져오는 구조입니다.
        </Text>
      </View>

      <View style={styles.segmented}>
        <SegmentButton label="마이데이터" active={activeMenu === "mydata"} onPress={() => setActiveMenu("mydata")} />
        <SegmentButton label="가족" active={activeMenu === "family"} onPress={() => setActiveMenu("family")} />
      </View>

      <View style={styles.actionGrid}>
        <MenuTile title="마이데이터 등록" description={storageLabel} icon="database-plus-outline" active={activeMenu === "mydata"} onPress={() => setMyDataModalVisible(true)} />
        <MenuTile title="가족 추가" description="SNS 신청" icon="account-plus-outline" active={activeMenu === "family"} onPress={() => setFamilyInviteModalVisible(true)} />
        <MenuTile title="동의 관리" description="개인정보" icon="file-document-check-outline" />
      </View>

      {activeMenu === "mydata" ? (
        <MyDataPanel
          isMember={isMember}
          sessionName={session?.nickname}
          profile={selectedProfile}
          favorites={favorites}
          recentPlaces={localRecentForProfile}
          consents={consents}
          onOpenModal={() => setMyDataModalVisible(true)}
          onToggleConsent={toggleConsent}
          onMigrate={migrateLocalData}
          onClearRecords={clearRecords}
          onLogout={logout}
        />
      ) : (
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
    </AppScreen>
  );
}

function MyDataPanel({
  isMember,
  sessionName,
  profile,
  favorites,
  recentPlaces,
  consents,
  onOpenModal,
  onToggleConsent,
  onMigrate,
  onClearRecords,
  onLogout
}: {
  isMember: boolean;
  sessionName?: string;
  profile?: FamilyProfile | null;
  favorites: StoredPlace[];
  recentPlaces: StoredPlace[];
  consents: ConsentSettings;
  onOpenModal: () => void;
  onToggleConsent: (key: keyof ConsentSettings) => void;
  onMigrate: () => void;
  onClearRecords: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>마이데이터</Text>
            <Text style={styles.body}>{isMember ? `${sessionName ?? "회원"} 계정에 활동 기록과 건강 메모를 동기화합니다.` : "비회원 마이데이터는 이 기기에만 저장됩니다."}</Text>
          </View>
          <Pressable style={styles.addButton} onPress={onOpenModal}>
            <Text style={styles.addButtonText}>등록</Text>
          </Pressable>
        </View>
        <InfoLine label="현재 대상" value={profile?.profileName ?? "나"} />
        <InfoLine label="혈액형" value={profile?.bloodType ?? "미등록"} />
        <InfoLine label="알레르기" value={profile?.allergies ?? "미등록"} />
        <InfoLine label="기저질환" value={profile?.chronicDiseases ?? "미등록"} />
        <InfoLine label="복용약" value={profile?.currentMedications ?? "미등록"} />
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>저장한 정보</Text>
        <InfoLine label="즐겨찾기" value={favorites.length ? favorites.map((item) => item.placeName).join(" · ") : "아직 저장한 장소가 없습니다."} />
        <InfoLine label="최근 본 병원/약국" value={recentPlaces.length ? recentPlaces.map((item) => item.placeName).join(" · ") : "최근 본 장소가 없습니다."} />
        <View style={styles.buttonRow}>
          {isMember ? <MenuButton label="비회원 기록 병합" icon="database-import" variant="outline" onPress={onMigrate} /> : null}
          <MenuButton label="검색 기록 삭제" icon="delete-outline" variant="outline" onPress={onClearRecords} />
          <MenuButton label="로그아웃" icon="logout" variant="outline" onPress={onLogout} />
        </View>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>약관/개인정보 동의</Text>
        <Text style={styles.body}>민감 정보는 기능별로 따로 동의합니다.</Text>
        {consentLabels.map(([key, label]) => (
          <Pressable key={key} style={styles.consentRow} onPress={() => onToggleConsent(key)}>
            <MaterialCommunityIcons name={consents[key] ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={colors.primary} />
            <Text style={styles.body}>{label}</Text>
          </Pressable>
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
    return (
      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>기본정보</Text>
        <InfoLine label="관계" value={relationLabel(profile.relationType)} />
        <InfoLine label="생년월일" value={profile.birthDate ?? birthYearMonth(profile)} />
        <InfoLine label="성별" value={profile.gender ?? "미입력"} />
        <InfoLine label="연락처" value={profile.phone ?? "미입력"} />
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
            <Text style={styles.sectionTitle}>마이데이터 등록</Text>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.body}>건강정보는 필요한 항목만 등록하고 언제든 삭제할 수 있습니다.</Text>
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

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MenuTile({ title, description, icon, active = false, onPress }: { title: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, active && styles.tileActive]}>
      <MaterialCommunityIcons name={icon} size={28} color={active ? "#FFFFFF" : colors.primary} />
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
    gap: spacing.lg
  },
  hero: {
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
    borderRadius: 8,
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
    minHeight: 104,
    borderRadius: 8,
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
  segmented: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.xs,
    flexDirection: "row",
    gap: spacing.xs
  },
  segmentButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
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
    minHeight: 122,
    borderRadius: 8,
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
    ...typography.sectionTitle,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
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
    ...typography.title,
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
    minHeight: 52,
    borderRadius: 8,
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
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  menuButton: {
    minHeight: 48,
    borderRadius: 8,
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
    minHeight: 44,
    borderRadius: 8,
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
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  statusBadge: {
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
