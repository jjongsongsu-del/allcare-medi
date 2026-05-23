import { MaterialCommunityIcons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { useAuth } from "@/auth/AuthProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { getRecommendedHealthContents } from "@/services/healthContentService";
import {
  getLocalMedicationEvents,
  getLocalMedicineSchedules,
  getLocalRegisteredMedicines,
  saveLocalMedicationEvent,
  saveLocalMedicineSchedule
} from "@/services/localUserData";
import {
  ensureMedicationNotificationPermission,
  getMedicationNotificationPermissionStatus,
  getMedicationNotificationSettings,
  MedicationNotificationSettings,
  saveMedicationNotificationSettings,
  scheduleMedicationTestNotification,
  syncMedicationNotifications
} from "@/services/medicationNotificationService";
import { createMedicationEvent, createMedicineSchedule } from "@/services/serverApi";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { HealthContent, MedicationEvent, MedicineSchedule, RegisteredMedicine } from "@/types/domain";

const statusFilters = ["오늘", "예정", "복용완료", "건너뜀", "중요약", "개인관리"];
const reportPeriods = [
  { label: "오늘", days: 1 },
  { label: "7일", days: 7 },
  { label: "30일", days: 30 }
];
const defaultDoseTimes = ["08:00", "13:00", "19:00"];
const defaultNotificationSettings: MedicationNotificationSettings = {
  enabled: true,
  reminderMinutesBefore: 0,
  horizonDays: 7
};

type DoseRow = {
  id: string;
  medicine: RegisteredMedicine;
  schedule: MedicineSchedule;
  time: string;
  status: MedicationEvent["status"];
  event?: MedicationEvent;
  isDelayed: boolean;
};

type ReportRow = {
  date: string;
  time: string;
  medicineName: string;
  dose: string;
  timing: string;
  status: MedicationEvent["status"];
  takenAt?: string | null;
  memo?: string;
};

export function MedicationScreen() {
  const { session } = useAuth();
  const { selectedProfile } = useFamilyProfile();
  const [medicines, setMedicines] = useState<RegisteredMedicine[]>([]);
  const [schedules, setSchedules] = useState<MedicineSchedule[]>([]);
  const [events, setEvents] = useState<MedicationEvent[]>([]);
  const [contents, setContents] = useState<HealthContent[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("오늘");
  const [activeTab, setActiveTab] = useState<"schedule" | "report">("schedule");
  const [reportDays, setReportDays] = useState(7);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [doseAmount, setDoseAmount] = useState("1정");
  const [doseTiming, setDoseTiming] = useState("식후");
  const [doseTimesText, setDoseTimesText] = useState("08:00");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<MedicationNotificationSettings>(defaultNotificationSettings);
  const [notificationPermission, setNotificationPermission] = useState("undetermined");
  const [scheduledNotificationCount, setScheduledNotificationCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadMedicationData();
    getRecommendedHealthContents().then(setContents);
  }, [selectedProfile?.profileId]);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadMedicationData = async (options?: { requestNotificationPermission?: boolean }) => {
    const [storedMedicines, storedSchedules, storedEvents] = await Promise.all([
      getLocalRegisteredMedicines(selectedProfile),
      getLocalMedicineSchedules(selectedProfile),
      getLocalMedicationEvents(selectedProfile)
    ]);
    setMedicines(storedMedicines.filter((medicine) => medicine.status !== "ended"));
    setSchedules(storedSchedules);
    setEvents(storedEvents);
    if (!selectedMedicineId && storedMedicines[0]) {
      setSelectedMedicineId(storedMedicines[0].id);
    }
    await refreshMedicationNotifications(storedMedicines, storedSchedules, storedEvents, { requestPermission: options?.requestNotificationPermission ?? false });
  };

  const loadNotificationSettings = async () => {
    const [settings, permissionStatus] = await Promise.all([
      getMedicationNotificationSettings(),
      getMedicationNotificationPermissionStatus()
    ]);
    setNotificationSettings(settings);
    setNotificationPermission(permissionStatus);
  };

  const refreshMedicationNotifications = async (
    nextMedicines = medicines,
    nextSchedules = schedules,
    nextEvents = events,
    options?: { requestPermission?: boolean; settings?: MedicationNotificationSettings }
  ) => {
    const settings = options?.settings ?? await getMedicationNotificationSettings();
    setNotificationSettings(settings);
    const result = await syncMedicationNotifications({
      medicines: nextMedicines.filter((medicine) => medicine.status !== "ended"),
      schedules: nextSchedules,
      events: nextEvents,
      settings,
      requestPermission: options?.requestPermission ?? true
    }).catch(async () => {
      const permissionStatus = await getMedicationNotificationPermissionStatus();
      return { enabled: settings.enabled, permissionStatus, scheduled: 0 };
    });
    setNotificationPermission(result.permissionStatus);
    setScheduledNotificationCount(result.scheduled);
  };

  const today = useMemo(() => toDateKey(new Date()), []);
  const medicineById = useMemo(() => new Map(medicines.map((medicine) => [String(medicine.id), medicine])), [medicines]);
  const scheduleById = useMemo(() => new Map(schedules.map((schedule) => [String(schedule.id), schedule])), [schedules]);

  const doseRows = useMemo(() => {
    const rows = schedules.flatMap((schedule) => {
      const medicine = medicineById.get(String(schedule.medicineId));
      if (!medicine || !isScheduleActiveToday(schedule, today)) return [];
      return (schedule.doseTimes.length ? schedule.doseTimes : ["필요 시"]).map((time) => {
        const scheduledAt = `${today}T${time === "필요 시" ? "23:59" : time}:00`;
        const event = events.find(
          (item) =>
            String(item.medicineId) === String(medicine.id) &&
            String(item.scheduleId ?? "") === String(schedule.id) &&
            item.scheduledAt.startsWith(`${today}T${time}`)
        );
        const status = event?.status ?? "pending";
        return {
          id: `${schedule.id}-${medicine.id}-${time}`,
          medicine,
          schedule,
          time,
          status,
          event,
          isDelayed: status === "pending" && time !== "필요 시" && new Date(scheduledAt).getTime() < Date.now() - 30 * 60 * 1000
        };
      });
    });
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }, [events, medicineById, schedules, today]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return doseRows.filter((row) => {
      const matchedQuery =
        !query ||
        row.medicine.name.toLowerCase().includes(query) ||
        row.medicine.alias?.toLowerCase().includes(query) ||
        row.medicine.purpose?.toLowerCase().includes(query) ||
        row.schedule.doseTiming.toLowerCase().includes(query);
      if (!matchedQuery) return false;
      if (selectedFilter === "복용완료") return row.status === "taken";
      if (selectedFilter === "건너뜀") return row.status === "skipped";
      if (selectedFilter === "중요약") return row.medicine.highRisk || Boolean(row.medicine.durWarnings?.length);
      if (selectedFilter === "예정") return row.status === "pending";
      return true;
    });
  }, [doseRows, searchText, selectedFilter]);

  const stats = useMemo(() => buildStats(doseRows), [doseRows]);
  const nextDose = useMemo(() => doseRows.find((row) => row.status === "pending") ?? doseRows[0], [doseRows]);

  const reportRows = useMemo(() => {
    const fromDate = startDateForPeriod(reportDays);
    const rowsFromEvents: ReportRow[] = events
      .filter((event) => event.scheduledAt.slice(0, 10) >= fromDate)
      .map((event) => {
        const medicine = medicineById.get(String(event.medicineId));
        const schedule = event.scheduleId ? scheduleById.get(String(event.scheduleId)) : undefined;
        return {
          date: event.scheduledAt.slice(0, 10),
          time: event.scheduledAt.slice(11, 16),
          medicineName: medicine?.alias || medicine?.name || "알 수 없는 약",
          dose: schedule?.doseAmount ?? medicine?.dosage ?? "",
          timing: schedule?.doseTiming ?? medicine?.timing ?? "",
          status: event.status,
          takenAt: event.takenAt,
          memo: event.memo
        };
      });
    const pendingRows: ReportRow[] = reportDays === 1
      ? doseRows
          .filter((row) => !row.event)
          .map((row) => ({
            date: today,
            time: row.time,
            medicineName: row.medicine.alias || row.medicine.name,
            dose: row.schedule.doseAmount,
            timing: row.schedule.doseTiming,
            status: row.status,
            takenAt: null,
            memo: row.isDelayed ? "지연" : "예정"
          }))
      : [];
    return [...pendingRows, ...rowsFromEvents].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  }, [doseRows, events, medicineById, reportDays, scheduleById, today]);

  const reportStats = useMemo(() => {
    const total = reportRows.length;
    const taken = reportRows.filter((row) => row.status === "taken").length;
    const skipped = reportRows.filter((row) => row.status === "skipped").length;
    const pending = reportRows.filter((row) => row.status === "pending").length;
    return {
      total,
      taken,
      skipped,
      pending,
      adherence: total ? Math.round((taken / total) * 100) : 0
    };
  }, [reportRows]);

  const recordDose = async (row: DoseRow, status: MedicationEvent["status"]) => {
    const event: MedicationEvent = {
      id: row.event?.id ?? `local-dose-${row.id}-${Date.now()}`,
      medicineId: row.medicine.id,
      scheduleId: row.schedule.id,
      profileId: selectedProfile?.profileId ?? row.schedule.profileId,
      scheduledAt: `${today}T${row.time === "필요 시" ? "23:59" : row.time}:00`,
      status,
      takenAt: status === "taken" ? new Date().toISOString() : null,
      sharedWithGuardian: false,
      memo: status === "taken" ? "복약 완료" : "복약 건너뜀"
    };
    if (session?.mode === "member" && !row.medicine.id.startsWith("local-")) {
      await createMedicationEvent(event).catch(() => saveLocalMedicationEvent(event));
    } else {
      await saveLocalMedicationEvent(event);
    }
    setMessage(status === "taken" ? "복약 완료를 기록했습니다." : "이번 회차를 건너뜀으로 기록했습니다.");
    await loadMedicationData();
  };

  const requestNotificationPermission = async () => {
    const permissionStatus = await ensureMedicationNotificationPermission();
    setNotificationPermission(permissionStatus);
    const nextSettings = { ...notificationSettings, enabled: permissionStatus === "granted" };
    setNotificationSettings(nextSettings);
    await saveMedicationNotificationSettings(nextSettings);
    await refreshMedicationNotifications(medicines, schedules, events, { requestPermission: false, settings: nextSettings });
    setMessage(permissionStatus === "granted" ? "복약 알림 권한이 켜졌습니다." : "알림 권한이 허용되지 않았습니다. 기기 설정에서 변경할 수 있습니다.");
  };

  const updateNotificationSettings = async (nextSettings: MedicationNotificationSettings) => {
    setNotificationSettings(nextSettings);
    await saveMedicationNotificationSettings(nextSettings);
    await refreshMedicationNotifications(medicines, schedules, events, { requestPermission: nextSettings.enabled, settings: nextSettings });
    setMessage(nextSettings.enabled ? "복약 알림 설정을 저장했습니다." : "복약 알림을 껐습니다.");
  };

  const sendTestNotification = async () => {
    try {
      await scheduleMedicationTestNotification();
      setNotificationPermission("granted");
      setMessage("5초 뒤 테스트 알림을 보냅니다.");
    } catch {
      setMessage("테스트 알림을 보내려면 알림 권한이 필요합니다.");
    }
  };

  const openScheduleModal = () => {
    if (medicines[0]) setSelectedMedicineId(medicines[0].id);
    setScheduleModalVisible(true);
  };

  const saveSchedule = async () => {
    const medicine = medicines.find((item) => item.id === selectedMedicineId);
    if (!medicine) {
      setMessage("스케줄을 등록할 약을 먼저 선택하세요.");
      return;
    }
    const doseTimes = doseTimesText.split(/[,\s]+/).map((time) => time.trim()).filter(Boolean);
    const schedule: MedicineSchedule = {
      id: `local-schedule-${Date.now()}`,
      medicineId: medicine.id,
      profileId: selectedProfile?.profileId ?? medicine.profileId,
      doseAmount: doseAmount.trim() || "1정",
      doseMethod: medicine.takingMethod ?? "경구",
      doseTiming: doseTiming.trim() || "식후",
      purpose: medicine.purpose,
      timesPerDay: Math.max(doseTimes.length, 1),
      doseTimes: doseTimes.length ? doseTimes : ["08:00"],
      startDate: today,
      endDate: null,
      durationDays: null,
      repeatRule: "daily",
      notifyEnabled,
      notificationLevel: medicine.highRisk ? "strong" : "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (session?.mode === "member" && !medicine.id.startsWith("local-")) {
      await createMedicineSchedule(schedule).catch(() => saveLocalMedicineSchedule(schedule));
    } else {
      await saveLocalMedicineSchedule(schedule);
    }
    setScheduleModalVisible(false);
    setMessage(`${medicine.alias || medicine.name} 복약 일정을 추가했습니다.`);
    await loadMedicationData({ requestNotificationPermission: notifyEnabled });
  };

  const exportCsv = async () => {
    if (!reportRows.length) {
      setMessage("내보낼 복약 기록이 없습니다.");
      return;
    }
    const csv = buildMedicationCsv(reportRows, selectedProfile?.profileName ?? "나", reportDays);
    const file = new File(Paths.document, `allcare-medi-medication-${today}.csv`);
    file.create({ overwrite: true });
    file.write(csv);
    await shareFile(file.uri, "text/csv");
    setMessage("CSV 리포트를 생성했습니다.");
  };

  const exportPdf = async () => {
    if (!reportRows.length) {
      setMessage("내보낼 복약 기록이 없습니다.");
      return;
    }
    const pdf = buildMedicationPdf({
      profileName: selectedProfile?.profileName ?? "나",
      periodLabel: `${reportDays}일`,
      stats: reportStats,
      rows: reportRows
    });
    const file = new File(Paths.document, `allcare-medi-medication-${today}.pdf`);
    file.create({ overwrite: true });
    file.write(pdf);
    setMessage("PDF 리포트를 생성했습니다.");
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>복약</Text>
            <Text style={styles.title}>오늘 먹을 약</Text>
          </View>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          복약 시간과 알림을 한 곳에서 확인하고, 변경·중단·병용 여부는 방문 전 전문가 확인을 권장합니다.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="약 이름, 시간, 메모 검색"
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
        />
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.summaryGrid}>
        <MetricCard label="오늘 회차" value={`${stats.total}회`} icon="calendar-clock" />
        <MetricCard label="완료율" value={`${stats.adherence}%`} icon="check-decagram-outline" />
        <MetricCard label="미복약" value={`${stats.pending}회`} icon="clock-alert-outline" warning={stats.pending > 0} />
        <MetricCard label="지연" value={`${stats.delayed}회`} icon="alert-outline" warning={stats.delayed > 0} />
      </View>

      {message ? (
        <View style={styles.messageBox}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.primaryActionRow}>
        <Pressable style={styles.bigPrimaryButton} onPress={() => router.push("/(tabs)/pills")}>
          <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.bigPrimaryText}>복용약 등록</Text>
        </Pressable>
        <Pressable style={styles.outlinePrimaryButton} onPress={openScheduleModal}>
          <MaterialCommunityIcons name="calendar-plus" size={20} color={colors.primary} />
          <Text style={styles.outlinePrimaryText}>일정 추가</Text>
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        <QuickButton label="처방전 OCR" icon="text-recognition" onPress={() => router.push("/(tabs)/pills")} />
        <QuickButton label="약 검색 등록" icon="pill" onPress={() => router.push("/(tabs)/pills")} />
      </View>

      <NotificationPanel
        settings={notificationSettings}
        permissionStatus={notificationPermission}
        scheduledCount={scheduledNotificationCount}
        onRequestPermission={requestNotificationPermission}
        onChangeSettings={updateNotificationSettings}
        onTest={sendTestNotification}
      />

      <View style={styles.segmentShell}>
        <Pressable style={activeTab === "schedule" ? styles.segmentActive : styles.segmentInactive} onPress={() => setActiveTab("schedule")}>
          <Text style={activeTab === "schedule" ? styles.segmentActiveText : styles.segmentInactiveText}>복약 일정</Text>
        </Pressable>
        <Pressable style={activeTab === "report" ? styles.segmentActive : styles.segmentInactive} onPress={() => setActiveTab("report")}>
          <Text style={activeTab === "report" ? styles.segmentActiveText : styles.segmentInactiveText}>복약 리포트</Text>
        </Pressable>
      </View>

      {activeTab === "schedule" ? (
        <>
          <View style={styles.filterRow}>
            {statusFilters.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>{filter}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>다음 복약</Text>
            {nextDose ? (
              <View style={styles.nextSchedule}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{nextDose.time}</Text>
                  <Text style={styles.timeLabel}>{nextDose.status === "taken" ? "완료" : nextDose.isDelayed ? "지연" : "예정"}</Text>
                </View>
                <View style={styles.scheduleTextArea}>
                  <Text style={styles.scheduleTitle}>{nextDose.medicine.alias || nextDose.medicine.name}</Text>
                  <Text style={styles.scheduleDescription}>
                    {nextDose.schedule.doseAmount} · {nextDose.schedule.doseMethod} · {nextDose.schedule.doseTiming}
                  </Text>
                  <Text style={styles.scheduleMeta}>알림 {nextDose.schedule.notifyEnabled ? "켜짐" : "꺼짐"} · {nextDose.schedule.repeatRule}</Text>
                </View>
              </View>
            ) : (
              <EmptyBox title="오늘 등록된 복약 일정이 없습니다." description="복용약을 등록하면 시간별 복약 알림을 받을 수 있습니다." />
            )}
          </View>

          {filteredRows.map((row) => (
            <DoseCard key={row.id} row={row} onTaken={() => recordDose(row, "taken")} onSkipped={() => recordDose(row, "skipped")} />
          ))}

          {!filteredRows.length ? <EmptyBox title="조건에 맞는 복약 회차가 없습니다." description="검색어를 지우거나 다른 필터를 선택해보세요." /> : null}
        </>
      ) : (
        <ReportPanel
          reportDays={reportDays}
          setReportDays={setReportDays}
          stats={reportStats}
          rows={reportRows}
          onExportCsv={exportCsv}
          onExportPdf={exportPdf}
        />
      )}

      <View style={styles.contentSection}>
        <Text style={styles.sectionTitle}>맞춤 건강백과</Text>
        <Text style={styles.sectionDescription}>복약 상태와 관련 정보를 바탕으로 추천합니다.</Text>
      </View>

      {contents.slice(0, 2).map((content) => (
        <View key={content.id} style={styles.contentCard}>
          <Text style={styles.cardTitle}>{content.title}</Text>
          <Text style={styles.meta}>{content.category} · {content.lifeStage}</Text>
          <Text style={styles.body}>{content.summary}</Text>
        </View>
      ))}

      <ScheduleModal
        visible={scheduleModalVisible}
        medicines={medicines}
        selectedMedicineId={selectedMedicineId}
        onSelectMedicine={setSelectedMedicineId}
        doseAmount={doseAmount}
        setDoseAmount={setDoseAmount}
        doseTiming={doseTiming}
        setDoseTiming={setDoseTiming}
        doseTimesText={doseTimesText}
        setDoseTimesText={setDoseTimesText}
        notifyEnabled={notifyEnabled}
        setNotifyEnabled={setNotifyEnabled}
        onSave={saveSchedule}
        onClose={() => setScheduleModalVisible(false)}
      />
    </AppScreen>
  );
}

function ReportPanel({
  reportDays,
  setReportDays,
  stats,
  rows,
  onExportCsv,
  onExportPdf
}: {
  reportDays: number;
  setReportDays: (days: number) => void;
  stats: { total: number; taken: number; skipped: number; pending: number; adherence: number };
  rows: ReportRow[];
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  return (
    <View style={styles.reportCard}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.sectionTitle}>복약 리포트</Text>
          <Text style={styles.meta}>선택 기간의 복약 기록을 CSV 또는 PDF로 저장합니다.</Text>
        </View>
      </View>
      <View style={styles.filterRow}>
        {reportPeriods.map((period) => (
          <Pressable
            key={period.days}
            style={[styles.filterChip, reportDays === period.days && styles.filterChipActive]}
            onPress={() => setReportDays(period.days)}
          >
            <Text style={[styles.filterText, reportDays === period.days && styles.filterTextActive]}>{period.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.summaryGrid}>
        <MetricCard label="기록" value={`${stats.total}건`} icon="file-chart-outline" />
        <MetricCard label="완료" value={`${stats.taken}건`} icon="check-circle-outline" />
        <MetricCard label="건너뜀" value={`${stats.skipped}건`} icon="clock-alert-outline" warning={stats.skipped > 0} />
        <MetricCard label="완료율" value={`${stats.adherence}%`} icon="chart-line" />
      </View>
      <View style={styles.cardActions}>
        <MedicationButton label="CSV 저장" icon="file-delimited-outline" variant="filled" onPress={onExportCsv} />
        <MedicationButton label="PDF 저장" icon="file-pdf-box" variant="outline" onPress={onExportPdf} />
      </View>
      <Text style={styles.meta}>최근 기록</Text>
      {rows.slice(0, 5).map((row, index) => (
        <View key={`${row.date}-${row.time}-${index}`} style={styles.reportRow}>
          <View style={styles.reportDateBox}>
            <Text style={styles.reportDateText}>{row.date.slice(5)}</Text>
            <Text style={styles.reportTimeText}>{row.time}</Text>
          </View>
          <View style={styles.scheduleTextArea}>
            <Text style={styles.cardTitle}>{row.medicineName}</Text>
            <Text style={styles.meta}>{row.dose} · {row.timing} · {statusLabel(row.status)}</Text>
          </View>
        </View>
      ))}
      {!rows.length ? <EmptyBox title="리포트에 포함할 기록이 없습니다." description="복약 완료나 건너뜀을 기록하면 리포트에 표시됩니다." /> : null}
    </View>
  );
}

function NotificationPanel({
  settings,
  permissionStatus,
  scheduledCount,
  onRequestPermission,
  onChangeSettings,
  onTest
}: {
  settings: MedicationNotificationSettings;
  permissionStatus: string;
  scheduledCount: number;
  onRequestPermission: () => void;
  onChangeSettings: (settings: MedicationNotificationSettings) => void;
  onTest: () => void;
}) {
  const permissionGranted = permissionStatus === "granted";
  const updateReminder = (minutes: number) => onChangeSettings({ ...settings, reminderMinutesBefore: minutes });
  return (
    <View style={styles.notificationCard}>
      <View style={styles.notificationHeader}>
        <View style={styles.notificationTitleRow}>
          <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>복약 알림</Text>
            <Text style={styles.meta}>
              {permissionGranted ? `예약 ${scheduledCount}개 · ${settings.reminderMinutesBefore ? `${settings.reminderMinutesBefore}분 전` : "정시"}` : "권한 허용 후 예약됩니다"}
            </Text>
          </View>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => onChangeSettings({ ...settings, enabled })}
        />
      </View>
      <View style={styles.presetRow}>
        {[0, 10, 30].map((minutes) => (
          <Pressable
            key={minutes}
            style={[styles.presetChip, settings.reminderMinutesBefore === minutes && styles.presetChipActive]}
            onPress={() => updateReminder(minutes)}
          >
            <Text style={[styles.presetChipText, settings.reminderMinutesBefore === minutes && styles.presetChipTextActive]}>
              {minutes === 0 ? "정시" : `${minutes}분 전`}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.cardActions}>
        {!permissionGranted ? (
          <MedicationButton label="권한 허용" icon="bell-check-outline" variant="filled" onPress={onRequestPermission} />
        ) : (
          <MedicationButton label="다시 예약" icon="calendar-sync-outline" variant="filled" onPress={() => onChangeSettings(settings)} />
        )}
        <MedicationButton label="테스트" icon="bell-outline" variant="outline" onPress={onTest} />
      </View>
    </View>
  );
}

function MetricCard({ label, value, icon, warning = false }: { label: string; value: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; warning?: boolean }) {
  return (
    <View style={[styles.metricCard, warning && styles.metricCardWarning]}>
      <MaterialCommunityIcons name={icon} size={18} color={warning ? colors.warning : colors.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function DoseCard({ row, onTaken, onSkipped }: { row: DoseRow; onTaken: () => void; onSkipped: () => void }) {
  const done = row.status === "taken";
  const skipped = row.status === "skipped";
  const warning = row.isDelayed || row.medicine.highRisk || Boolean(row.medicine.durWarnings?.length);
  return (
    <View style={[styles.scheduleCard, warning && styles.scheduleCardWarning, done && styles.scheduleCardDone]}>
      <View style={styles.scheduleHeader}>
        <View style={styles.scheduleNameArea}>
          <Text style={styles.cardTime}>{row.time}</Text>
          <Text style={styles.cardTitle}>{row.medicine.alias || row.medicine.name}</Text>
        </View>
        <StatusBadge row={row} />
      </View>
      <Text style={styles.body}>{row.schedule.doseAmount} · {row.schedule.doseMethod} · {row.schedule.doseTiming}</Text>
      {row.medicine.durWarnings?.[0] ? (
        <View style={styles.durNotice}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={colors.warning} />
          <Text style={styles.durNoticeText}>{row.medicine.durWarnings[0]}</Text>
        </View>
      ) : null}
      <View style={styles.cardActions}>
        <MedicationButton label={done ? "완료됨" : "복약 완료"} icon="check-circle" variant="filled" disabled={done} onPress={onTaken} />
        <MedicationButton label={skipped ? "건너뜀" : "건너뜀"} icon="clock-alert-outline" variant="outline" disabled={skipped} onPress={onSkipped} />
      </View>
    </View>
  );
}

function StatusBadge({ row }: { row: DoseRow }) {
  const warning = row.isDelayed || Boolean(row.medicine.durWarnings?.length);
  const label = row.status === "taken" ? "완료" : row.status === "skipped" ? "건너뜀" : row.isDelayed ? "지연" : row.medicine.durWarnings?.length ? "DUR 주의" : "예정";
  return (
    <View style={[styles.shareBadge, warning && styles.shareBadgeWarning]}>
      <Text style={[styles.shareBadgeText, warning && styles.shareBadgeWarningText]}>{label}</Text>
    </View>
  );
}

function EmptyBox({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function MedicationButton({
  label,
  icon,
  variant,
  disabled = false,
  onPress
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  variant: "filled" | "outline";
  disabled?: boolean;
  onPress?: () => void;
}) {
  const filled = variant === "filled";
  return (
    <Pressable disabled={disabled} style={[styles.smallButton, filled ? styles.smallButtonFilled : styles.smallButtonOutline, disabled && styles.disabledButton]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.smallButtonText, filled ? styles.smallButtonTextFilled : styles.smallButtonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

function QuickButton({ label, icon, onPress }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={styles.quickButton} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      <Text style={styles.quickButtonText}>{label}</Text>
    </Pressable>
  );
}

function ScheduleModal({
  visible,
  medicines,
  selectedMedicineId,
  onSelectMedicine,
  doseAmount,
  setDoseAmount,
  doseTiming,
  setDoseTiming,
  doseTimesText,
  setDoseTimesText,
  notifyEnabled,
  setNotifyEnabled,
  onSave,
  onClose
}: {
  visible: boolean;
  medicines: RegisteredMedicine[];
  selectedMedicineId: string;
  onSelectMedicine: (id: string) => void;
  doseAmount: string;
  setDoseAmount: (value: string) => void;
  doseTiming: string;
  setDoseTiming: (value: string) => void;
  doseTimesText: string;
  setDoseTimesText: (value: string) => void;
  notifyEnabled: boolean;
  setNotifyEnabled: (value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.sectionTitle}>복약 일정 추가</Text>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textStrong} />
            </Pressable>
          </View>
          <Text style={styles.meta}>일정을 등록할 약을 선택하세요.</Text>
          <View style={styles.medicineChipRow}>
            {medicines.map((medicine) => (
              <Pressable
                key={medicine.id}
                style={[styles.medicineChip, selectedMedicineId === medicine.id && styles.medicineChipActive]}
                onPress={() => onSelectMedicine(medicine.id)}
              >
                <Text style={[styles.medicineChipText, selectedMedicineId === medicine.id && styles.medicineChipTextActive]} numberOfLines={1}>
                  {medicine.alias || medicine.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {!medicines.length ? <Text style={styles.emptyDescription}>먼저 알약 메뉴에서 복용약을 등록하세요.</Text> : null}
          <TextInput value={doseAmount} onChangeText={setDoseAmount} placeholder="복용량 예: 1정" style={styles.input} />
          <TextInput value={doseTiming} onChangeText={setDoseTiming} placeholder="복용 시점 예: 식후" style={styles.input} />
          <TextInput value={doseTimesText} onChangeText={setDoseTimesText} placeholder="복용 시간 예: 08:00, 13:00" style={styles.input} />
          <View style={styles.presetRow}>
            {defaultDoseTimes.map((time) => (
              <Pressable key={time} style={styles.presetChip} onPress={() => setDoseTimesText(mergeDoseTime(doseTimesText, time))}>
                <Text style={styles.presetChipText}>{time}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.body}>복약 알림</Text>
            <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
          </View>
          <View style={styles.modalActions}>
            <MedicationButton label="저장" icon="content-save-outline" variant="filled" onPress={onSave} />
            <MedicationButton label="취소" icon="close-circle-outline" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startDateForPeriod(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  return toDateKey(date);
}

function isScheduleActiveToday(schedule: MedicineSchedule, today: string) {
  if (schedule.startDate > today) return false;
  if (schedule.endDate && schedule.endDate < today) return false;
  return ["daily", "weekly", "alternate_day", "as_needed"].includes(schedule.repeatRule);
}

function buildStats(rows: DoseRow[]) {
  const total = rows.length;
  const taken = rows.filter((row) => row.status === "taken").length;
  const skipped = rows.filter((row) => row.status === "skipped").length;
  const delayed = rows.filter((row) => row.isDelayed).length;
  return {
    total,
    taken,
    skipped,
    delayed,
    pending: Math.max(total - taken - skipped, 0),
    adherence: total ? Math.round((taken / total) * 100) : 0
  };
}

function mergeDoseTime(current: string, time: string) {
  const values = new Set(current.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean));
  values.add(time);
  return Array.from(values).sort().join(", ");
}

function statusLabel(status: MedicationEvent["status"]) {
  if (status === "taken") return "복약 완료";
  if (status === "skipped") return "건너뜀";
  if (status === "delayed") return "지연";
  return "예정";
}

function csvCell(value?: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildMedicationCsv(rows: ReportRow[], profileName: string, days: number) {
  const header = ["프로필", "기간", "날짜", "시간", "약명", "복용량", "복용시점", "상태", "복약시간", "메모"];
  const body = rows.map((row) => [
    profileName,
    `${days}일`,
    row.date,
    row.time,
    row.medicineName,
    row.dose,
    row.timing,
    statusLabel(row.status),
    row.takenAt ?? "",
    row.memo ?? ""
  ]);
  return "\uFEFF" + [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

function buildMedicationPdf({
  profileName,
  periodLabel,
  stats,
  rows
}: {
  profileName: string;
  periodLabel: string;
  stats: { total: number; taken: number; skipped: number; pending: number; adherence: number };
  rows: ReportRow[];
}) {
  const lines = [
    "올케어메디 복약 리포트",
    `대상: ${profileName}   기간: ${periodLabel}   생성일: ${toDateKey(new Date())}`,
    `전체 기록 ${stats.total}건 / 복약 완료 ${stats.taken}건 / 건너뜀 ${stats.skipped}건 / 완료율 ${stats.adherence}%`,
    "",
    "최근 기록",
    ...rows.slice(0, 18).map((row) =>
      `${row.date} ${row.time}  ${row.medicineName}  ${row.dose} ${row.timing}  ${statusLabel(row.status)}`
    ),
    "",
    "본 리포트는 사용자가 기록한 복약 이력을 정리한 자료이며, 의학적 판단은 의료 전문가와 상의하세요."
  ];
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 790 Td",
    `${utf16HexText(lines[0])} Tj`,
    "/F1 11 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -24 Td", `${utf16HexText(line)} Tj`]),
    "ET"
  ].join("\n");
  return makePdf(content);
}

function utf16HexText(value: string) {
  const hex = Array.from(value).map((char) => {
    const code = char.charCodeAt(0);
    return code.toString(16).padStart(4, "0").toUpperCase();
  }).join("");
  return `<${hex}>`;
}

function makePdf(content: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /HYGoThic-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [6 0 R] >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYGoThic-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> /FontDescriptor 7 0 R >>",
    "<< /Type /FontDescriptor /FontName /HYGoThic-Medium /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildMedicationReportHtml({
  profileName,
  periodLabel,
  stats,
  rows
}: {
  profileName: string;
  periodLabel: string;
  stats: { total: number; taken: number; skipped: number; pending: number; adherence: number };
  rows: ReportRow[];
}) {
  const rowHtml = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.time)}</td>
          <td>${escapeHtml(row.medicineName)}</td>
          <td>${escapeHtml(row.dose)}</td>
          <td>${escapeHtml(row.timing)}</td>
          <td>${escapeHtml(statusLabel(row.status))}</td>
          <td>${escapeHtml(row.memo ?? "")}</td>
        </tr>`
    )
    .join("");
  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", Arial, sans-serif; color: #111827; padding: 28px; }
          h1 { color: #005EA8; font-size: 26px; margin: 0 0 6px; }
          .meta { color: #6B7280; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
          .card { border: 1px solid #D8E0EA; border-radius: 8px; padding: 12px; }
          .value { font-size: 22px; font-weight: 800; color: #003E73; }
          .label { font-size: 12px; color: #6B7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
          th { background: #E7F1FB; color: #003E73; text-align: left; }
          th, td { border: 1px solid #D8E0EA; padding: 8px; vertical-align: top; }
          .notice { margin-top: 18px; color: #6B7280; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>올케어메디 복약 리포트</h1>
        <div class="meta">대상: ${escapeHtml(profileName)} · 기간: ${escapeHtml(periodLabel)} · 생성일: ${escapeHtml(toDateKey(new Date()))}</div>
        <div class="grid">
          <div class="card"><div class="value">${stats.total}</div><div class="label">전체 기록</div></div>
          <div class="card"><div class="value">${stats.taken}</div><div class="label">복약 완료</div></div>
          <div class="card"><div class="value">${stats.skipped}</div><div class="label">건너뜀</div></div>
          <div class="card"><div class="value">${stats.adherence}%</div><div class="label">완료율</div></div>
        </div>
        <table>
          <thead><tr><th>날짜</th><th>시간</th><th>약명</th><th>복용량</th><th>복용시점</th><th>상태</th><th>메모</th></tr></thead>
          <tbody>${rowHtml || '<tr><td colspan="7">기록이 없습니다.</td></tr>'}</tbody>
        </table>
        <div class="notice">본 리포트는 사용자가 기록한 복약 이력을 정리한 자료이며, 의학적 판단은 의료 전문가와 상의하세요.</div>
      </body>
    </html>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function shareFile(uri: string, mimeType: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available) return;
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: "복약 리포트 공유"
  });
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.sm
  },
  hero: {
    borderRadius: 8,
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
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  title: {
    ...typography.title,
    color: colors.textStrong
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.text
  },
  searchBox: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    minHeight: 44,
    color: colors.textStrong
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    gap: spacing.xs
  },
  metricCardWarning: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  metricValue: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "800"
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  messageBox: {
    borderRadius: 8,
    backgroundColor: "#E8F5EE",
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  messageText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "800"
  },
  primaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  bigPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  bigPrimaryText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  outlinePrimaryButton: {
    minHeight: 44,
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
  outlinePrimaryText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  quickButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  notificationCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    padding: spacing.sm,
    gap: spacing.sm
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  notificationTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  filterChip: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.caption,
    color: colors.text
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  segmentShell: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    overflow: "hidden"
  },
  segmentActive: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentInactive: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  segmentActiveText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "800"
  },
  segmentInactiveText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  summaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    gap: spacing.sm
  },
  reportCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.textStrong
  },
  nextSchedule: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "stretch"
  },
  timeBox: {
    minWidth: 78,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm
  },
  timeText: {
    ...typography.sectionTitle,
    color: colors.primary
  },
  timeLabel: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  scheduleTextArea: {
    flex: 1,
    gap: spacing.xs
  },
  scheduleTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "800"
  },
  scheduleDescription: {
    ...typography.body,
    color: colors.text
  },
  scheduleMeta: {
    ...typography.caption,
    color: colors.textMuted
  },
  emptyBox: {
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    justifyContent: "center",
    gap: spacing.xs
  },
  emptyTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "800"
  },
  emptyDescription: {
    ...typography.body,
    color: colors.text
  },
  scheduleCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    gap: spacing.sm
  },
  scheduleCardWarning: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  scheduleCardDone: {
    borderColor: "#B7E4C7"
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  scheduleNameArea: {
    flex: 1
  },
  cardTime: {
    ...typography.sectionTitle,
    color: colors.primary
  },
  cardTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "800"
  },
  shareBadge: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  shareBadgeWarning: {
    backgroundColor: "#FFF1D8"
  },
  shareBadgeText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  shareBadgeWarningText: {
    color: colors.warning
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  durNotice: {
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs
  },
  durNoticeText: {
    ...typography.caption,
    flex: 1,
    color: colors.warning,
    lineHeight: 19
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  smallButton: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  smallButtonFilled: {
    backgroundColor: colors.primary
  },
  smallButtonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.primary
  },
  disabledButton: {
    opacity: 0.6
  },
  smallButtonText: {
    ...typography.caption,
    fontWeight: "800"
  },
  smallButtonTextFilled: {
    color: "#FFFFFF"
  },
  smallButtonTextOutline: {
    color: colors.primary
  },
  reportRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm
  },
  reportDateBox: {
    minWidth: 68,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm
  },
  reportDateText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  reportTimeText: {
    ...typography.caption,
    color: colors.text
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  contentSection: {
    gap: spacing.xs
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  contentCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.xs
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.sm
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  medicineChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  medicineChip: {
    minHeight: 36,
    maxWidth: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  medicineChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  medicineChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  medicineChipTextActive: {
    color: "#FFFFFF"
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textStrong
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  presetChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  presetChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  presetChipTextActive: {
    color: "#FFFFFF"
  },
  switchRow: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  }
});
