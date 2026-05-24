import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/services/authStorage";
import { logoutFromServer, refreshLogin, socialLogin } from "@/services/serverApi";

export type LoginProvider = "NAVER" | "KAKAO" | "GOOGLE" | "GUEST";

export type AuthSession = {
  mode: "member" | "guest";
  provider: LoginProvider;
  accessToken?: string;
  refreshToken?: string;
  guestId?: string;
  userId?: number;
  deviceUuid?: string;
  nickname?: string;
};

const sessionModeKey = "allcaremedi.sessionMode";
const guestIdKey = "allcaremedi.guestId";
const recentLoginKey = "allcaremedi.recentLoginProvider";
const refreshTokenKey = "refreshToken";
const accessTokenKey = "accessToken";
const providerKey = "provider";
const nicknameKey = "nickname";
const userIdKey = "userId";

export async function loadStoredSession(): Promise<AuthSession | null> {
  const mode = await AsyncStorage.getItem(sessionModeKey);
  const recentProvider = await AsyncStorage.getItem(recentLoginKey);

  if (mode === "guest") {
    const guestId = await AsyncStorage.getItem(guestIdKey);
    if (!guestId) return null;
    return { mode: "guest", provider: "GUEST", guestId };
  }

  if (mode === "member") {
    const refreshToken = await getSecureItem(refreshTokenKey);
    if (!refreshToken) return null;
    return {
      mode: "member",
      provider: ((await getSecureItem(providerKey)) as LoginProvider) ?? ((recentProvider as LoginProvider) || "GOOGLE"),
      accessToken: (await getSecureItem(accessTokenKey)) ?? undefined,
      refreshToken,
      userId: Number(await getSecureItem(userIdKey)) || undefined,
      deviceUuid: (await AsyncStorage.getItem(guestIdKey)) ?? undefined,
      nickname: (await getSecureItem(nicknameKey)) ?? undefined
    };
  }

  return null;
}

export async function getRecentLoginProvider(): Promise<LoginProvider | null> {
  return (await AsyncStorage.getItem(recentLoginKey)) as LoginProvider | null;
}

export async function startGuestSession(): Promise<AuthSession> {
  const guestId = (await AsyncStorage.getItem(guestIdKey)) ?? createGuestId();
  await AsyncStorage.setItem(guestIdKey, guestId);
  await AsyncStorage.setItem(sessionModeKey, "guest");
  await AsyncStorage.setItem(recentLoginKey, "GUEST");
  return { mode: "guest", provider: "GUEST", guestId };
}

export async function startSocialSession(provider: Exclude<LoginProvider, "GUEST">): Promise<AuthSession> {
  const deviceUuid = (await AsyncStorage.getItem(guestIdKey)) ?? createGuestId();
  await AsyncStorage.setItem(guestIdKey, deviceUuid);

  const response = await socialLogin({
    provider,
    idToken: `dev-${provider.toLowerCase()}-${deviceUuid}`,
    deviceUuid
  });

  await AsyncStorage.setItem(sessionModeKey, "member");
  await AsyncStorage.setItem(recentLoginKey, provider);
  await setSecureItem(accessTokenKey, response.accessToken);
  await setSecureItem(refreshTokenKey, response.refreshToken);
  await setSecureItem(providerKey, provider);
  await setSecureItem(nicknameKey, response.user.nickname);
  await setSecureItem(userIdKey, String(response.user.userId));

  return {
    mode: "member",
    provider,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.user.userId,
    deviceUuid,
    nickname: response.user.nickname
  };
}

export async function refreshStoredSession(): Promise<AuthSession | null> {
  const refreshToken = await getSecureItem(refreshTokenKey);
  const deviceUuid = await AsyncStorage.getItem(guestIdKey);
  const provider = ((await getSecureItem(providerKey)) as LoginProvider | null) ?? "GOOGLE";
  if (!refreshToken || !deviceUuid || provider === "GUEST") return null;

  const response = await refreshLogin({ refreshToken, deviceUuid });
  await setSecureItem(accessTokenKey, response.accessToken);
  await setSecureItem(refreshTokenKey, response.refreshToken);
  await setSecureItem(nicknameKey, response.user.nickname);
  await setSecureItem(userIdKey, String(response.user.userId));

  return {
    mode: "member",
    provider,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.user.userId,
    deviceUuid,
    nickname: response.user.nickname
  };
}

export async function clearSession(session?: AuthSession | null) {
  if (session?.mode === "member" && session.refreshToken && session.deviceUuid) {
    await logoutFromServer({ refreshToken: session.refreshToken, deviceUuid: session.deviceUuid }).catch(() => undefined);
  }
  await Promise.allSettled([
    AsyncStorage.removeItem(sessionModeKey),
    deleteSecureItem(accessTokenKey),
    deleteSecureItem(refreshTokenKey),
    deleteSecureItem(providerKey),
    deleteSecureItem(nicknameKey),
    deleteSecureItem(userIdKey)
  ]);
}

function createGuestId() {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
