import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  getLocalMedicationEvents,
  getLocalMedicineSchedules,
  getLocalRegisteredMedicines,
  saveLocalMedicationEvent,
  type FamilyProfile
} from "@/services/localUserData";
import { MedicationEvent, MedicineSchedule, RegisteredMedicine } from "@/types/domain";

const notificationIdsKey = "allcaremedi.medicationNotificationIds.v1";
const notificationSettingsKey = "allcaremedi.medicationNotificationSettings.v1";
const normalChannelId = "allcaremedi-medication-normal";
const strongChannelId = "allcaremedi-medication-strong";
const medicationCategoryId = "allcaremedi-medication-dose-actions";
const takenActionId = "ALLCAREMEDI_MEDICATION_TAKEN";
const skippedActionId = "ALLCAREMEDI_MEDICATION_SKIPPED";

export type MedicationNotificationSettings = {
  enabled: boolean;
  reminderMinutesBefore: number;
  horizonDays: number;
};

export type MedicationNotificationSyncResult = {
  enabled: boolean;
  permissionStatus: Notifications.PermissionStatus | "undetermined";
  scheduled: number;
};

const defaultNotificationSettings: MedicationNotificationSettings = {
  enabled: true,
  reminderMinutesBefore: 0,
  horizonDays: 7
};

let configured = false;
let responseListenerConfigured = false;

export function configureMedicationNotificationHandler() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH
    })
  });
  void configureAndroidChannels();
  void configureMedicationCategories();
  configureNotificationResponseListener();
}

export async function getMedicationNotificationSettings(): Promise<MedicationNotificationSettings> {
  const raw = await AsyncStorage.getItem(notificationSettingsKey);
  if (!raw) return defaultNotificationSettings;
  try {
    return { ...defaultNotificationSettings, ...JSON.parse(raw) };
  } catch {
    return defaultNotificationSettings;
  }
}

export async function saveMedicationNotificationSettings(settings: MedicationNotificationSettings): Promise<void> {
  await AsyncStorage.setItem(notificationSettingsKey, JSON.stringify(settings));
}

export async function getMedicationNotificationPermissionStatus() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.status;
}

export async function ensureMedicationNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return current.status;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status;
}

export async function cancelMedicationNotifications(): Promise<void> {
  const identifiers = await getStoredNotificationIds();
  await Promise.all(identifiers.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.setItem(notificationIdsKey, JSON.stringify([]));
}

export async function syncMedicationNotifications({
  medicines,
  schedules,
  events,
  settings,
  requestPermission = true
}: {
  medicines: RegisteredMedicine[];
  schedules: MedicineSchedule[];
  events: MedicationEvent[];
  settings?: MedicationNotificationSettings;
  requestPermission?: boolean;
}): Promise<MedicationNotificationSyncResult> {
  configureMedicationNotificationHandler();
  const nextSettings = settings ?? await getMedicationNotificationSettings();
  if (!nextSettings.enabled) {
    await cancelMedicationNotifications();
    return { enabled: false, permissionStatus: "undetermined", scheduled: 0 };
  }

  const permissionStatus = requestPermission
    ? await ensureMedicationNotificationPermission()
    : await getMedicationNotificationPermissionStatus();
  if (permissionStatus !== Notifications.PermissionStatus.GRANTED) {
    await cancelMedicationNotifications();
    return { enabled: true, permissionStatus, scheduled: 0 };
  }

  await cancelMedicationNotifications();
  const medicineById = new Map(medicines.map((medicine) => [String(medicine.id), medicine]));
  const now = Date.now();
  const identifiers: string[] = [];
  const today = dateKey(new Date());

  for (const schedule of schedules) {
    if (!schedule.notifyEnabled || schedule.repeatRule === "as_needed") continue;
    if (schedule.startDate > today) continue;
    if (schedule.endDate && schedule.endDate < today) continue;
    const medicine = medicineById.get(String(schedule.medicineId));
    if (!medicine || medicine.status === "ended") continue;

    for (const date of nextDates(schedule, nextSettings.horizonDays)) {
      for (const doseTime of schedule.doseTimes) {
        const doseDate = dateAtDoseTime(date, doseTime);
        if (!doseDate) continue;
        if (schedule.endDate && dateKey(doseDate) > schedule.endDate) continue;
        const reminderAt = new Date(doseDate.getTime() - nextSettings.reminderMinutesBefore * 60 * 1000);
        if (reminderAt.getTime() <= now + 30 * 1000) continue;
        const scheduledAt = toLocalIso(doseDate);
        if (hasClosedEvent(events, schedule, scheduledAt)) continue;

        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: schedule.notificationLevel === "strong" ? "중요 복약 시간입니다" : "복약 시간입니다",
            body: `${doseTime} · ${medicine.alias || medicine.name} · ${schedule.doseAmount} · ${schedule.doseTiming}`,
            data: {
              kind: "medication",
              medicineId: medicine.id,
              scheduleId: schedule.id,
              profileId: schedule.profileId ?? medicine.profileId,
              scheduledAt
            },
            categoryIdentifier: medicationCategoryId,
            sound: true,
            priority: schedule.notificationLevel === "strong" ? "max" : "high",
            color: schedule.notificationLevel === "strong" ? colorsForNotification.strong : colorsForNotification.normal
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderAt,
            channelId: schedule.notificationLevel === "strong" ? strongChannelId : normalChannelId
          }
        });
        identifiers.push(identifier);
      }
    }
  }

  await AsyncStorage.setItem(notificationIdsKey, JSON.stringify(identifiers));
  return { enabled: true, permissionStatus, scheduled: identifiers.length };
}

function configureNotificationResponseListener() {
  if (responseListenerConfigured) return;
  responseListenerConfigured = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    const actionIdentifier = response.actionIdentifier;
    if (actionIdentifier !== takenActionId && actionIdentifier !== skippedActionId) return;
    const data = response.notification.request.content.data ?? {};
    const medicineId = data.medicineId;
    if (medicineId == null) return;
    const event: MedicationEvent = {
      id: `local-dose-${Date.now()}`,
      medicineId: String(medicineId),
      scheduleId: data.scheduleId == null ? null : String(data.scheduleId),
      profileId: data.profileId == null ? null : String(data.profileId),
      scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : new Date().toISOString(),
      status: actionIdentifier === takenActionId ? "taken" : "skipped",
      takenAt: actionIdentifier === takenActionId ? new Date().toISOString() : null,
      sharedWithGuardian: false,
      memo: actionIdentifier === takenActionId ? "알림에서 복약 완료" : "알림에서 건너뜀"
    };
    void saveLocalMedicationEvent(event);
  });
}

export async function rescheduleLocalMedicationNotifications(profile?: FamilyProfile | null) {
  const [medicines, schedules, events] = await Promise.all([
    getLocalRegisteredMedicines(profile),
    getLocalMedicineSchedules(profile),
    getLocalMedicationEvents(profile)
  ]);
  return syncMedicationNotifications({ medicines, schedules, events });
}

export async function scheduleMedicationTestNotification(): Promise<void> {
  configureMedicationNotificationHandler();
  const permissionStatus = await ensureMedicationNotificationPermission();
  if (permissionStatus !== Notifications.PermissionStatus.GRANTED) {
    throw new Error("notification-permission-denied");
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "복약 알림 테스트",
      body: "알림이 정상적으로 도착하는지 확인합니다.",
      data: { kind: "medication-test" },
      sound: true,
      priority: "high",
      color: colorsForNotification.normal
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: normalChannelId
    }
  });
}

async function configureAndroidChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(normalChannelId, {
    name: "복약 알림",
    description: "복약 시간과 일정 변경을 알려줍니다.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: "#2563EB",
    sound: "default"
  });
  await Notifications.setNotificationChannelAsync(strongChannelId, {
    name: "중요 복약 알림",
    description: "고위험 또는 중요한 약의 복약 시간을 강하게 알려줍니다.",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 350, 160, 350, 160, 350],
    lightColor: "#DC2626",
    sound: "default"
  });
}

async function configureMedicationCategories() {
  await Notifications.setNotificationCategoryAsync(medicationCategoryId, [
    {
      identifier: takenActionId,
      buttonTitle: "복약완료",
      options: {
        opensAppToForeground: false
      }
    },
    {
      identifier: skippedActionId,
      buttonTitle: "건너뜀",
      options: {
        opensAppToForeground: false,
        isDestructive: true
      }
    }
  ]).catch(() => undefined);
}

async function getStoredNotificationIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(notificationIdsKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function nextDates(schedule: MedicineSchedule, horizonDays: number) {
  const dates: Date[] = [];
  const start = parseDateKey(schedule.startDate) ?? new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let index = 0; index < horizonDays; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    if (date < start) continue;
    const daysFromStart = Math.floor((date.getTime() - start.getTime()) / 86400000);
    if (schedule.repeatRule === "alternate_day" && daysFromStart % 2 !== 0) continue;
    if (schedule.repeatRule === "weekday" && schedule.weekdays?.length && !schedule.weekdays.includes(date.getDay())) continue;
    if (schedule.repeatRule === "weekly") {
      const interval = schedule.weekInterval ?? 1;
      const weekIndex = Math.floor(daysFromStart / 7);
      if (weekIndex % interval !== 0) continue;
      if (schedule.weekdays?.length && !schedule.weekdays.includes(date.getDay())) continue;
    }
    if (schedule.repeatRule === "monthly" && !isMonthlyDoseDate(schedule, date)) continue;
    if (schedule.repeatRule === "interval" && schedule.intervalDays && daysFromStart % schedule.intervalDays !== 0) continue;
    if (schedule.repeatRule === "cycle") {
      const activeDays = schedule.cycleActiveDays ?? 0;
      const restDays = schedule.cycleRestDays ?? 0;
      const cycleDays = activeDays + restDays;
      if (cycleDays > 0 && daysFromStart % cycleDays >= activeDays) continue;
    }
    dates.push(date);
  }
  return dates;
}

function isMonthlyDoseDate(schedule: MedicineSchedule, date: Date) {
  if (schedule.monthlyMode === "last_day") {
    return date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
  if (schedule.monthlyMode === "weekday") {
    const ordinal = schedule.monthlyWeekOrdinal ?? 1;
    const weekday = schedule.monthlyWeekday ?? date.getDay();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const offset = (weekday - firstDay.getDay() + 7) % 7;
    const targetDate = 1 + offset + (ordinal - 1) * 7;
    return date.getDate() === targetDate;
  }
  const days = schedule.monthDays?.length ? schedule.monthDays : [new Date(schedule.startDate).getDate()];
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return days.some((day) => date.getDate() === (day > lastDay && schedule.missingDatePolicy === "last_day" ? lastDay : day));
}

function dateAtDoseTime(date: Date, time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function toLocalIso(date: Date) {
  return `${dateKey(date)}T${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}:00`;
}

function hasClosedEvent(events: MedicationEvent[], schedule: MedicineSchedule, scheduledAt: string) {
  return events.some(
    (event) =>
      String(event.scheduleId ?? "") === String(schedule.id) &&
      String(event.medicineId) === String(schedule.medicineId) &&
      event.scheduledAt.startsWith(scheduledAt.slice(0, 16)) &&
      (event.status === "taken" || event.status === "skipped")
  );
}

const colorsForNotification = {
  normal: "#2563EB",
  strong: "#DC2626"
};
