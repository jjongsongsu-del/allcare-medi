import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { useAuth } from "@/auth/AuthProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import {
  getLocalRegisteredMedicines,
  saveLocalMedicationEvent,
  saveLocalMedicineSchedule,
  saveLocalRegisteredMedicine,
  updateLocalRegisteredMedicine
} from "@/services/localUserData";
import { recognizePillFromImage } from "@/services/pillRecognitionService";
import { createMedicineSchedule, createMedicationEvent, createRegisteredMedicine, fetchRegisteredMedicines, searchMedicines, updateRegisteredMedicine } from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicationEvent, MedicineSchedule, MedicineSearchResult, Pill, RegisteredMedicine } from "@/types/domain";

type PillTab = "medicine" | "prescription";
type RegisterMethod = "manual" | "search" | "prescription" | "ai";
type RegisterStep = "input" | "confirm" | "schedule";
type MedicineDraft = {
  name: string;
  alias: string;
  manufacturer: string;
  ingredient: string;
  dosage: string;
  form: string;
  color: string;
  purpose: string;
  memo: string;
};
const registrationMethods: Array<{
  key: RegisterMethod;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: "manual", title: "직접등록", description: "약명·용량 입력", icon: "square-edit-outline" },
  { key: "search", title: "검색등록", description: "e약은 API", icon: "magnify" },
  { key: "prescription", title: "처방전등록", description: "OCR 추출", icon: "file-document-edit-outline" },
  { key: "ai", title: "AI판독등록", description: "사진 후보 확인", icon: "camera-outline" }
];

const listFilters = ["전체", "복용중", "복용예정", "복용종료", "즐겨찾기", "고위험"];
const scheduleTimes = ["아침 08:00", "점심 13:00", "저녁 19:00", "취침 전 22:00"];

const registeredMedicinesSeed: RegisteredMedicine[] = [
  {
    id: "registered-001",
    name: "아모잘탄정",
    alias: "아침 혈압약",
    ingredient: "암로디핀/로사르탄",
    manufacturer: "한미약품",
    dosage: "1정",
    form: "정제",
    color: "분홍색",
    purpose: "혈압",
    timing: "아침 식후",
    schedule: "매일 08:00 · 30일",
    status: "taking",
    source: "manual",
    favorite: true,
    highRisk: true,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z"
  },
  {
    id: "registered-002",
    name: "비타민 D",
    alias: "저녁 영양제",
    ingredient: "콜레칼시페롤",
    manufacturer: "올케어제약",
    dosage: "1캡슐",
    form: "캡슐",
    color: "노란색",
    purpose: "영양",
    timing: "저녁 식후",
    schedule: "매일 21:00 · 장기",
    status: "scheduled",
    source: "manual",
    favorite: false,
    highRisk: false,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z"
  }
];

export function PillIdentificationScreen() {
  const { session } = useAuth();
  const { selectedProfile } = useFamilyProfile();
  const [pills, setPills] = useState<Pill[]>([]);
  const [activeTab, setActiveTab] = useState<PillTab>("medicine");
  const [selectedMethod, setSelectedMethod] = useState<RegisterMethod>("manual");
  const [activeStep, setActiveStep] = useState<RegisterStep>("input");
  const [registrationModalVisible, setRegistrationModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [medicineSearchQuery, setMedicineSearchQuery] = useState("");
  const [medicineSearchResults, setMedicineSearchResults] = useState<MedicineSearchResult[]>([]);
  const [selectedSearchMedicine, setSelectedSearchMedicine] = useState<MedicineSearchResult | null>(null);
  const [medicineSearchLoading, setMedicineSearchLoading] = useState(false);
  const [medicineSearchError, setMedicineSearchError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("전체");
  const [draft, setDraft] = useState<MedicineDraft>({
    name: "",
    alias: "",
    manufacturer: "",
    ingredient: "",
    dosage: "1정",
    form: "정제",
    color: "",
    purpose: "",
    memo: ""
  });
  const [medicines, setMedicines] = useState<RegisteredMedicine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const isMember = session?.mode === "member" && Boolean(session.userId);

  useEffect(() => {
    recognizePillFromImage().then(setPills);
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [session?.mode, session?.userId, selectedProfile?.profileId]);

  const loadMedicines = async () => {
    if (isMember && session?.userId) {
      const serverMedicines = await fetchRegisteredMedicines({ userId: session.userId, profileId: selectedProfile?.profileId }).catch(() => []);
      if (serverMedicines.length) {
        setMedicines(serverMedicines);
        return;
      }
    }
    const localMedicines = await getLocalRegisteredMedicines(selectedProfile);
    setMedicines(localMedicines.length ? localMedicines : seedForSelectedProfile(selectedProfile));
  };

  const filteredMedicines = useMemo(() => {
    const normalizedSearch = searchText.trim();
    return medicines
      .filter((medicine) => {
        if (listFilter === "복용중" && medicine.status !== "taking") return false;
        if (listFilter === "복용예정" && medicine.status !== "scheduled") return false;
        if (listFilter === "복용종료" && medicine.status !== "ended") return false;
        if (listFilter === "즐겨찾기" && !medicine.favorite) return false;
        if (listFilter === "고위험" && !medicine.highRisk) return false;
        if (!normalizedSearch) return true;
        return [medicine.name, medicine.alias, medicine.ingredient, medicine.purpose].join(" ").includes(normalizedSearch);
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }, [listFilter, medicines, searchText]);

  const selectedMethodMeta = registrationMethods.find((method) => method.key === selectedMethod) ?? registrationMethods[0];

  const openRegistrationModal = (method: RegisterMethod) => {
    setSelectedMethod(method);
    setActiveStep("input");
    setRegistrationModalVisible(true);
    setMedicineSearchError(null);
    if (method !== "search") {
      setSelectedSearchMedicine(null);
      setMedicineSearchResults([]);
    }
  };

  const closeRegistrationModal = () => {
    setRegistrationModalVisible(false);
    setSelectedSearchMedicine(null);
    setMedicineSearchResults([]);
    setMedicineSearchQuery("");
    setActiveStep("input");
  };

  const runMedicineSearch = async () => {
    const query = medicineSearchQuery.trim();
    if (!query) {
      setMedicineSearchError("검색할 약명, 성분명 또는 식별문자를 입력해 주세요.");
      return;
    }
    setMedicineSearchLoading(true);
    setMedicineSearchError(null);
    setSelectedSearchMedicine(null);
    try {
      const results = await searchMedicines(query);
      setMedicineSearchResults(results);
      if (!results.length) {
        setMedicineSearchError("검색 결과가 없습니다. 약명이나 성분명을 조금 더 넓게 입력해 보세요.");
      }
    } catch {
      setMedicineSearchError("e약은 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setMedicineSearchResults([]);
    } finally {
      setMedicineSearchLoading(false);
    }
  };

  const selectMedicineSearchResult = (medicine: MedicineSearchResult) => {
    setSelectedSearchMedicine(medicine);
    setDraft((current) => ({
      ...current,
      name: medicine.productName ?? medicine.name,
      manufacturer: medicine.manufacturer ?? current.manufacturer,
      ingredient: medicine.ingredient ?? current.ingredient,
      dosage: medicine.dosage ?? current.dosage,
      form: medicine.form ?? current.form,
      color: medicine.color ?? current.color,
      purpose: medicine.efficacy ?? current.purpose,
      memo: [medicine.usage, medicine.caution, medicine.interaction, medicine.sideEffects, medicine.storageMethod].filter(Boolean).join("\n\n") || current.memo
    }));
    setActiveStep("confirm");
  };

  const proceedRegistrationStep = () => {
    if (selectedMethod === "search" && activeStep === "input") {
      if (!selectedSearchMedicine) {
        setMedicineSearchError("검색 결과에서 등록할 약을 먼저 선택해 주세요.");
        return;
      }
      setActiveStep("confirm");
      return;
    }
    if (activeStep === "input") {
      setActiveStep("confirm");
      return;
    }
    if (activeStep === "confirm") {
      setActiveStep("schedule");
      return;
    }
    saveDraftMedicine();
  };

  const persistMedicine = async (medicine: RegisteredMedicine) => {
    if (isMember && session?.userId && !medicine.id.startsWith("local-")) {
      await updateRegisteredMedicine(session.userId, medicine).catch(() => updateLocalRegisteredMedicine(medicine));
    } else {
      await updateLocalRegisteredMedicine(medicine);
    }
    await loadMedicines();
  };

  const toggleFavorite = async (medicineId: string) => {
    const medicine = medicines.find((item) => item.id === medicineId);
    if (!medicine) return;
    await persistMedicine({ ...medicine, favorite: !medicine.favorite });
  };

  const endMedicine = async (medicineId: string) => {
    const medicine = medicines.find((item) => item.id === medicineId);
    if (!medicine) return;
    await persistMedicine({ ...medicine, status: "ended" });
    setMessage("삭제 대신 복용종료로 처리했습니다. 연결된 스케줄과 이력은 보존됩니다.");
  };

  const saveDraftMedicine = async () => {
    const name = draft.name.trim();
    if (!name) {
      setMessage("약명은 필수 입력값입니다.");
      setActiveStep("input");
      return;
    }
    const duplicate = medicines.find((medicine) => [medicine.name, medicine.productName, medicine.alias].filter(Boolean).includes(name));
    const baseMedicine: RegisteredMedicine = {
      id: `local-medicine-${Date.now()}`,
      userId: session?.userId,
      profileId: selectedProfile?.profileId,
      profileName: selectedProfile?.profileName,
      name,
      alias: draft.alias,
      productName: name,
      ingredient: draft.ingredient,
      manufacturer: draft.manufacturer,
      dosage: draft.dosage,
      form: draft.form,
      color: draft.color,
      purpose: draft.purpose,
      timing: "식후",
      takingMethod: "경구",
      memo: draft.memo,
      durWarnings: duplicate ? ["이미 등록된 약과 이름이 비슷합니다. 중복 복용 여부를 확인하세요."] : [],
      status: activeStep === "schedule" ? "taking" : "scheduled",
      source: selectedMethod,
      favorite: false,
      highRisk: Boolean(duplicate),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedMedicine = isMember && session?.userId
      ? await createRegisteredMedicine(session.userId, baseMedicine).catch(async () => {
          const localList = await saveLocalRegisteredMedicine(baseMedicine);
          return localList[0];
        })
      : (await saveLocalRegisteredMedicine(baseMedicine))[0];

    if (activeStep === "schedule") {
      await saveScheduleForMedicine(savedMedicine);
    }
    await loadMedicines();
    setMessage(duplicate ? "약을 저장했습니다. 다만 기존 등록 약과 중복 가능성이 있어 확인이 필요합니다." : "약을 저장했습니다. 오늘 복약 목록 보기 또는 약 추가 등록을 선택할 수 있습니다.");
    setDraft({ name: "", alias: "", manufacturer: "", ingredient: "", dosage: "1정", form: "정제", color: "", purpose: "", memo: "" });
    setSelectedSearchMedicine(null);
    setMedicineSearchResults([]);
    setMedicineSearchQuery("");
    setActiveStep("input");
    setRegistrationModalVisible(false);
  };

  const saveScheduleForMedicine = async (medicine: RegisteredMedicine) => {
    const schedule: MedicineSchedule = {
      id: `local-schedule-${Date.now()}`,
      medicineId: medicine.id,
      profileId: selectedProfile?.profileId,
      doseAmount: medicine.dosage ?? "1정",
      doseMethod: medicine.takingMethod ?? "경구",
      doseTiming: medicine.timing ?? "식후",
      purpose: medicine.purpose,
      timesPerDay: 1,
      doseTimes: ["08:00"],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      durationDays: null,
      repeatRule: "daily",
      notifyEnabled: true,
      notificationLevel: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (isMember && session?.userId && !medicine.id.startsWith("local-")) {
      await createMedicineSchedule(schedule).catch(() => saveLocalMedicineSchedule(schedule));
    } else {
      await saveLocalMedicineSchedule(schedule);
    }
  };

  const recordDose = async (medicine: RegisteredMedicine, status: MedicationEvent["status"]) => {
    const event: MedicationEvent = {
      id: `local-dose-${Date.now()}`,
      medicineId: medicine.id,
      scheduleId: null,
      profileId: selectedProfile?.profileId,
      scheduledAt: new Date().toISOString(),
      status,
      takenAt: status === "taken" ? new Date().toISOString() : null,
      sharedWithGuardian: medicine.highRisk,
      memo: medicine.highRisk ? "중요 약 복약 상태 보호자 공유 대상" : undefined
    };
    if (isMember && session?.userId && !medicine.id.startsWith("local-")) {
      await createMedicationEvent(event).catch(() => saveLocalMedicationEvent(event));
    } else {
      await saveLocalMedicationEvent(event);
    }
    setMessage(status === "taken" ? "복약 완료를 기록했습니다." : "이번 회차를 건너뜀으로 기록했습니다.");
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="archive-outline" size={36} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>내 약통</Text>
        <Text style={styles.title}>약관리</Text>
        <Text style={styles.description}>직접등록, 검색등록, 처방전등록, AI판독등록으로 약을 등록하고 복약 스케줄까지 이어서 설정합니다.</Text>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="alert-circle-outline" size={28} color={noticeText} />
        <Text style={styles.noticeText}>
          OCR과 AI 판독 결과는 자동 저장하지 않습니다. 사용자가 후보와 상세 정보를 최종 확인한 뒤 저장하며, DUR 위험 정보는 쉬운 설명으로 표시합니다.
        </Text>
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.segmented}>
        <SegmentButton label="약관리" active={activeTab === "medicine"} onPress={() => setActiveTab("medicine")} />
        <SegmentButton label="처방전 관리" active={activeTab === "prescription"} onPress={() => setActiveTab("prescription")} />
      </View>

      <View style={styles.actionGrid}>
        {registrationMethods.map((method) => (
          <RegistrationTile
            key={method.key}
            title={method.title}
            description={method.description}
            icon={method.icon}
            active={selectedMethod === method.key}
            onPress={() => openRegistrationModal(method.key)}
          />
        ))}
      </View>

      <View style={styles.todayCard}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>오늘 복약 목록</Text>
            <Text style={styles.body}>시간대별로 완료, 건너뜀, 지연 상태를 기록합니다.</Text>
          </View>
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>보호자 공유 가능</Text>
          </View>
        </View>
        {medicines.filter((medicine) => medicine.status !== "ended").map((medicine) => (
          <TodayDoseRow key={medicine.id} medicine={medicine} onTaken={() => recordDose(medicine, "taken")} onSkipped={() => recordDose(medicine, "skipped")} />
        ))}
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>등록된 약 목록</Text>
          <Pressable style={styles.addButton} onPress={() => openRegistrationModal("manual")}>
            <Text style={styles.addButtonText}>등록</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="약명, 성분명, 복용 목적 검색"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {listFilters.map((filter) => (
            <Pressable key={filter} onPress={() => setListFilter(filter)} style={[styles.filterChip, listFilter === filter && styles.filterChipActive]}>
              <Text style={[styles.filterText, listFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </View>

        {filteredMedicines.length ? filteredMedicines.map((medicine) => (
          <MedicineListItem key={medicine.id} medicine={medicine} onToggleFavorite={() => toggleFavorite(medicine.id)} onEnd={() => endMedicine(medicine.id)} />
        )) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>조건에 맞는 약이 없습니다.</Text>
            <Text style={styles.emptyDescription}>검색어를 지우거나 전체 목록을 확인해 보세요.</Text>
          </View>
        )}
      </View>

      <View style={styles.candidateSection}>
        <Text style={styles.sectionTitle}>AI 판독 후보</Text>
        <Text style={styles.sectionDescription}>정확도가 낮은 경우 후보 목록을 보여주고, 사용자가 최종 선택합니다.</Text>
      </View>

      {pills.map((pill) => (
        <AiCandidateCard key={pill.id} pill={pill} />
      ))}

      <MedicineRegistrationModal
        visible={registrationModalVisible}
        method={selectedMethod}
        methodTitle={selectedMethodMeta.title}
        activeStep={activeStep}
        draft={draft}
        pills={pills}
        searchQuery={medicineSearchQuery}
        searchResults={medicineSearchResults}
        selectedSearchMedicine={selectedSearchMedicine}
        searchLoading={medicineSearchLoading}
        searchError={medicineSearchError}
        onClose={closeRegistrationModal}
        onStepChange={setActiveStep}
        onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSearchQueryChange={setMedicineSearchQuery}
        onSearch={runMedicineSearch}
        onSelectSearchResult={selectMedicineSearchResult}
        onNext={proceedRegistrationStep}
        onSaveLater={saveDraftMedicine}
      />

      {message ? <Text style={styles.successNotice}>{message}</Text> : null}
    </AppScreen>
  );
}

function MedicineRegistrationModal({
  visible,
  method,
  methodTitle,
  activeStep,
  draft,
  pills,
  searchQuery,
  searchResults,
  selectedSearchMedicine,
  searchLoading,
  searchError,
  onClose,
  onStepChange,
  onDraftChange,
  onSearchQueryChange,
  onSearch,
  onSelectSearchResult,
  onNext,
  onSaveLater
}: {
  visible: boolean;
  method: RegisterMethod;
  methodTitle: string;
  activeStep: RegisterStep;
  draft: MedicineDraft;
  pills: Pill[];
  searchQuery: string;
  searchResults: MedicineSearchResult[];
  selectedSearchMedicine: MedicineSearchResult | null;
  searchLoading: boolean;
  searchError: string | null;
  onClose: () => void;
  onStepChange: (step: RegisterStep) => void;
  onDraftChange: (patch: Partial<MedicineDraft>) => void;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelectSearchResult: (medicine: MedicineSearchResult) => void;
  onNext: () => void;
  onSaveLater: () => void;
}) {
  const nextLabel = activeStep === "schedule" ? "약 저장" : activeStep === "input" && method === "search" ? "선택 후 다음" : "다음 단계";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>약 등록 절차</Text>
              <Text style={styles.body}>{methodTitle} 방식으로 약 정보 확인 후 복약 스케줄까지 설정합니다.</Text>
            </View>
            <Pressable style={styles.iconAction} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.stepRow}>
            <StepPill label="1 입력/검색" active={activeStep === "input"} onPress={() => onStepChange("input")} />
            <StepPill label="2 후보 확인" active={activeStep === "confirm"} onPress={() => onStepChange("confirm")} />
            <StepPill label="3 스케줄" active={activeStep === "schedule"} onPress={() => onStepChange("schedule")} />
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {activeStep === "input" && method === "search" ? (
              <SearchRegistrationStep
                query={searchQuery}
                results={searchResults}
                selected={selectedSearchMedicine}
                loading={searchLoading}
                error={searchError}
                onQueryChange={onSearchQueryChange}
                onSearch={onSearch}
                onSelect={onSelectSearchResult}
              />
            ) : null}

            {activeStep === "input" && method !== "search" ? (
              <RegistrationInput method={method} draft={draft} onChange={onDraftChange} />
            ) : null}

            {activeStep === "confirm" ? (
              <CandidateConfirmation method={method} pills={pills} draftName={draft.name} selectedMedicine={selectedSearchMedicine} />
            ) : null}

            {activeStep === "schedule" ? <ScheduleDraft /> : null}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable style={styles.primaryButton} onPress={onNext}>
              <MaterialCommunityIcons name={activeStep === "schedule" ? "content-save-outline" : "arrow-right"} size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{nextLabel}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={activeStep === "schedule" ? onSaveLater : onClose}>
              <MaterialCommunityIcons name={activeStep === "schedule" ? "skip-next-outline" : "close-circle-outline"} size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>{activeStep === "schedule" ? "스케줄 없이 저장" : "닫기"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SearchRegistrationStep({
  query,
  results,
  selected,
  loading,
  error,
  onQueryChange,
  onSearch,
  onSelect
}: {
  query: string;
  results: MedicineSearchResult[];
  selected: MedicineSearchResult | null;
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (medicine: MedicineSearchResult) => void;
}) {
  return (
    <View style={styles.inputStack}>
      <Text style={styles.body}>e약은 API를 통해 약명, 성분명, 식별문자를 검색하고 등록할 약을 선택합니다.</Text>
      <View style={styles.searchRegisterRow}>
        <TextInput
          style={[styles.input, styles.searchRegisterInput]}
          placeholder="예: 타이레놀, 아세트아미노펜, GB"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onSearch}
        />
        <Pressable style={styles.searchRegisterButton} onPress={onSearch}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />}
        </Pressable>
      </View>
      {error ? <Text style={styles.dangerText}>{error}</Text> : null}
      {results.map((medicine) => {
        const active = selected?.id === medicine.id;
        return (
          <Pressable key={medicine.id} style={[styles.searchResultItem, active && styles.searchResultItemActive]} onPress={() => onSelect(medicine)}>
            <View style={styles.pillIcon}>
              <MaterialCommunityIcons name="pill" size={24} color={colors.primary} />
            </View>
            <View style={styles.resultText}>
              <Text style={styles.resultTitle}>{medicine.productName ?? medicine.name}</Text>
              <Text style={styles.resultMeta}>{medicine.manufacturer ?? "제조사 정보 없음"} · {medicine.ingredient ?? medicine.efficacy ?? "효능 정보 없음"}</Text>
              <Text style={styles.meta}>{medicine.form ?? "제형 미상"} · {medicine.color ?? "색상 미상"} · 식별문자 {medicine.imprint ?? "정보 없음"}</Text>
            </View>
            {active ? <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function RegistrationInput({
  method,
  draft,
  onChange
}: {
  method: RegisterMethod;
  draft: MedicineDraft;
  onChange: (patch: Partial<MedicineDraft>) => void;
}) {
  const methodHint = {
    manual: "약명은 필수입니다. 제조사, 성분명, 용량, 제형, 색상, 메모를 직접 입력합니다.",
    search: "e약은 API 또는 의약품 정보 API로 약명, 성분명, 식별문자를 검색한 뒤 선택 등록합니다.",
    prescription: "처방전 이미지를 촬영 또는 업로드하면 OCR이 약명, 용량, 복용횟수, 복용일수를 초안으로 채웁니다.",
    ai: "알약 사진으로 모양, 색상, 식별문자를 분석하고 후보 약 목록을 제시합니다."
  }[method];

  return (
    <View style={styles.inputStack}>
      <Text style={styles.body}>{methodHint}</Text>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="약명 필수" placeholderTextColor={colors.textMuted} value={draft.name} onChangeText={(value) => onChange({ name: value })} />
        <TextInput style={styles.input} placeholder="별칭 예: 아침 혈압약" placeholderTextColor={colors.textMuted} value={draft.alias} onChangeText={(value) => onChange({ alias: value })} />
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="제조사" placeholderTextColor={colors.textMuted} value={draft.manufacturer} onChangeText={(value) => onChange({ manufacturer: value })} />
        <TextInput style={styles.input} placeholder="성분명" placeholderTextColor={colors.textMuted} value={draft.ingredient} onChangeText={(value) => onChange({ ingredient: value })} />
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="용량 예: 1정" placeholderTextColor={colors.textMuted} value={draft.dosage} onChangeText={(value) => onChange({ dosage: value })} />
        <TextInput style={styles.input} placeholder="제형 예: 정제" placeholderTextColor={colors.textMuted} value={draft.form} onChangeText={(value) => onChange({ form: value })} />
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="색상" placeholderTextColor={colors.textMuted} value={draft.color} onChangeText={(value) => onChange({ color: value })} />
        <TextInput style={styles.input} placeholder="복용 목적 예: 혈압" placeholderTextColor={colors.textMuted} value={draft.purpose} onChangeText={(value) => onChange({ purpose: value })} />
      </View>
      <TextInput style={styles.input} placeholder="개인 메모" placeholderTextColor={colors.textMuted} value={draft.memo} onChangeText={(value) => onChange({ memo: value })} />
    </View>
  );
}

function CandidateConfirmation({ method, pills, draftName, selectedMedicine }: { method: RegisterMethod; pills: Pill[]; draftName: string; selectedMedicine?: MedicineSearchResult | null }) {
  const title = method === "ai" ? "AI 후보 확인" : method === "prescription" ? "OCR 추출 결과 확인" : "약 상세 정보 확인";

  return (
    <View style={styles.inputStack}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>중복 등록 여부, 제품명, 성분명, DUR 위험 정보를 확인한 뒤 저장합니다.</Text>
      <View style={styles.warningRow}>
        <MaterialCommunityIcons name="alert-decagram-outline" size={18} color={noticeText} />
        <Text style={styles.warningText}>중복성분, 병용금기, 연령주의, 임부금기 정보가 있으면 쉬운 설명으로 표시합니다.</Text>
      </View>
      {selectedMedicine ? (
        <View style={styles.candidateBox}>
          <Text style={styles.cardTitle}>{selectedMedicine.productName ?? selectedMedicine.name}</Text>
          <Text style={styles.body}>{selectedMedicine.manufacturer ?? "제조사 정보 없음"} · {selectedMedicine.efficacy ?? selectedMedicine.ingredient ?? "효능 정보 없음"}</Text>
          <Text style={styles.meta}>e약은 검색 결과 선택 완료 · 저장 전 최종 확인</Text>
        </View>
      ) : null}
      {(method === "ai" ? pills : pills.slice(0, 1)).map((pill) => (
        <View key={pill.id} style={styles.candidateBox}>
          <Text style={styles.cardTitle}>{draftName || pill.productName}</Text>
          <Text style={styles.body}>{pill.manufacturer} · {pill.ingredient}</Text>
          <Text style={styles.meta}>후보 신뢰도 {Math.round(pill.confidence * 100)}% · 최종 확인 후 저장</Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleDraft() {
  return (
    <View style={styles.inputStack}>
      <Text style={styles.cardTitle}>복약 스케줄 설정</Text>
      <Text style={styles.body}>스케줄 없이 약만 저장할 수 있고, 처방전 OCR 결과는 스케줄 초안으로 자동 생성됩니다.</Text>
      <View style={styles.filterRow}>
        <MiniChoice label="1일 1회" active />
        <MiniChoice label="1일 2회" />
        <MiniChoice label="1일 3회" />
        <MiniChoice label="필요 시" />
      </View>
      <View style={styles.filterRow}>
        {scheduleTimes.map((time, index) => (
          <MiniChoice key={time} label={time} active={index === 0} />
        ))}
      </View>
      <View style={styles.twoColumn}>
        <TextInput style={styles.input} placeholder="시작일 YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
        <TextInput style={styles.input} placeholder="복용일수 입력 시 종료일 자동 계산" placeholderTextColor={colors.textMuted} />
      </View>
      <View style={styles.filterRow}>
        <MiniChoice label="매일" active />
        <MiniChoice label="특정 요일" />
        <MiniChoice label="격일" />
        <MiniChoice label="알림 켜기" active />
        <MiniChoice label="강한 알림" />
      </View>
    </View>
  );
}

function TodayDoseRow({ medicine, onTaken, onSkipped }: { medicine: RegisteredMedicine; onTaken: () => void; onSkipped: () => void }) {
  return (
    <View style={[styles.todayDoseRow, medicine.highRisk && styles.highRiskRow]}>
      <View style={styles.doseTimeBox}>
        <Text style={styles.doseTime}>{medicine.schedule?.split(" ")[1] ?? "08:00"}</Text>
        <Text style={styles.meta}>{medicine.timing}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{medicine.alias || medicine.name}</Text>
        <Text style={styles.body}>{medicine.dosage} · {medicine.form} · {medicine.purpose}</Text>
        {medicine.highRisk ? <Text style={styles.dangerText}>중요도 높은 약 · 보호자 공유 권장</Text> : null}
      </View>
      <View style={styles.statusActions}>
        <Pressable style={styles.iconAction} onPress={onTaken}>
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.success} />
        </Pressable>
        <Pressable style={styles.iconAction} onPress={onSkipped}>
          <MaterialCommunityIcons name="clock-alert-outline" size={22} color={colors.warning} />
        </Pressable>
      </View>
    </View>
  );
}

function MedicineListItem({ medicine, onToggleFavorite, onEnd }: { medicine: RegisteredMedicine; onToggleFavorite: () => void; onEnd: () => void }) {
  return (
    <View style={styles.medicineItem}>
      <View style={styles.resultTop}>
        <Pressable onPress={onToggleFavorite} style={styles.pillIcon}>
          <MaterialCommunityIcons name={medicine.favorite ? "star" : "star-outline"} size={24} color={medicine.favorite ? colors.warning : colors.primary} />
        </Pressable>
        <View style={styles.resultText}>
          <Text style={styles.resultTitle}>{medicine.alias || medicine.name}</Text>
          <Text style={styles.resultMeta}>{medicine.name} · {medicine.ingredient}</Text>
        </View>
        <StatusBadge status={medicine.status} highRisk={medicine.highRisk} />
      </View>
      <Text style={styles.body}>{medicine.manufacturer} · {medicine.dosage} · {medicine.timing} · {medicine.schedule}</Text>
      <View style={styles.resultActions}>
        <Pressable style={styles.secondaryButton}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>수정</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton}>
          <MaterialCommunityIcons name="calendar-plus" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>스케줄</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onEnd}>
          <MaterialCommunityIcons name="stop-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>복용종료</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>삭제 전 연결된 복약 스케줄과 이력을 안내하고, 삭제 대신 복용종료를 선택할 수 있습니다.</Text>
    </View>
  );
}

function AiCandidateCard({ pill }: { pill: Pill }) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultTop}>
        <View style={styles.pillIcon}>
          <MaterialCommunityIcons name="pill" size={26} color={colors.primary} />
        </View>
        <View style={styles.resultText}>
          <Text style={styles.resultTitle}>{pill.productName}</Text>
          <Text style={styles.resultMeta}>{pill.manufacturer} · {pill.ingredient}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>{Math.round(pill.confidence * 100)}%</Text>
        </View>
      </View>
      <Text style={styles.body}>{pill.shape} · {pill.color} · 식별문자 {pill.imprint}</Text>
      {pill.warnings.map((warning) => (
        <View key={warning} style={styles.warningRow}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={noticeText} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ))}
      <View style={styles.resultActions}>
        <Pressable style={styles.primaryButton}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>이 약 선택</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>상세보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RegistrationTile({ title, description, icon, active = false, onPress }: { title: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, active && styles.tileActive]}>
      <MaterialCommunityIcons name={icon} size={34} color={active ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.tileTitle, active && styles.tileTitleActive]}>{title}</Text>
      <Text style={[styles.tileDescription, active && styles.tileDescriptionActive]}>{description}</Text>
    </Pressable>
  );
}

function StepPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.stepPill, active && styles.stepPillActive]}>
      <Text style={[styles.stepText, active && styles.stepTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MiniChoice({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status, highRisk }: { status: RegisteredMedicine["status"]; highRisk: boolean }) {
  const label = highRisk ? "고위험" : status === "taking" ? "복용중" : status === "scheduled" ? "복용예정" : "복용종료";
  return (
    <View style={[styles.statusBadge, highRisk ? styles.highRiskBadge : status === "ended" ? styles.endedBadge : styles.takingBadge]}>
      <Text style={[styles.statusBadgeText, highRisk && styles.highRiskBadgeText]}>{label}</Text>
    </View>
  );
}

function seedForSelectedProfile(profile?: { profileId?: string | number | null; profileName?: string | null } | null): RegisteredMedicine[] {
  return registeredMedicinesSeed.map((medicine) => ({
    ...medicine,
    profileId: profile?.profileId,
    profileName: profile?.profileName
  }));
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
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md
  },
  eyebrow: {
    ...typography.title,
    color: colors.primary,
    fontWeight: "800"
  },
  title: {
    ...typography.display,
    color: colors.textStrong
  },
  description: {
    ...typography.bodyLarge,
    color: colors.text,
    lineHeight: 30
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
    color: colors.primary,
    textAlign: "center"
  },
  segmentTextActive: {
    color: "#FFFFFF"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
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
  flowCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
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
  saveBadge: {
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  saveBadgeText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  stepRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  stepPill: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  stepPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  stepText: {
    ...typography.caption,
    color: colors.primary
  },
  stepTextActive: {
    color: "#FFFFFF"
  },
  inputStack: {
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
  twoColumn: {
    gap: spacing.sm
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.caption,
    color: colors.primary
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  candidateBox: {
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  todayCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    gap: spacing.md
  },
  todayBadge: {
    borderRadius: 8,
    backgroundColor: "#E8F5EE",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  todayBadgeText: {
    ...typography.caption,
    color: colors.success
  },
  todayDoseRow: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  highRiskRow: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  doseTimeBox: {
    width: 82,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    padding: spacing.sm,
    gap: 2
  },
  doseTime: {
    ...typography.sectionTitle,
    color: colors.primary
  },
  dangerText: {
    ...typography.caption,
    color: noticeText
  },
  statusActions: {
    gap: spacing.xs
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
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
  searchBox: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  searchInput: {
    ...typography.bodyLarge,
    minHeight: 58,
    color: colors.textStrong
  },
  emptyBox: {
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.xs
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  emptyDescription: {
    ...typography.bodyLarge,
    color: colors.text
  },
  medicineItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  takingBadge: {
    backgroundColor: colors.primarySoft
  },
  endedBadge: {
    backgroundColor: "#F3F4F6"
  },
  highRiskBadge: {
    backgroundColor: "#FFF7ED"
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  highRiskBadgeText: {
    color: noticeText
  },
  candidateSection: {
    gap: spacing.xs
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  resultCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  pillIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  resultText: {
    flex: 1,
    gap: 2
  },
  resultTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  resultMeta: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  confidenceBadge: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  confidenceText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "800"
  },
  warningRow: {
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start"
  },
  warningText: {
    ...typography.caption,
    flex: 1,
    color: noticeText,
    lineHeight: 19
  },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  primaryButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.primary
  },
  successNotice: {
    ...typography.body,
    color: colors.success,
    textAlign: "center"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  modalBody: {
    maxHeight: 520
  },
  modalBodyContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  searchRegisterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center"
  },
  searchRegisterInput: {
    flex: 1
  },
  searchRegisterButton: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  searchResultItem: {
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchResultItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  }
});
