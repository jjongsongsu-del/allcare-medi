import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export type SocialCredential =
  | {
      provider: "GOOGLE";
      tokenType: "ID_TOKEN";
      providerToken: string;
    }
  | {
      provider: "KAKAO" | "NAVER";
      tokenType: "AUTHORIZATION_CODE";
      authorizationCode: string;
      redirectUri: string;
      oauthState?: string;
    };

type Provider = SocialCredential["provider"];

const redirectUri = AuthSession.makeRedirectUri({
  scheme: "allcaremedi",
  path: "auth"
});

const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token"
};

const kakaoDiscovery = {
  authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize"
};

const naverDiscovery = {
  authorizationEndpoint: "https://nid.naver.com/oauth2.0/authorize"
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as {
  googleAndroidClientId?: string;
  googleWebClientId?: string;
  kakaoRestApiKey?: string;
  naverClientId?: string;
};

export async function requestSocialCredential(provider: Provider): Promise<SocialCredential> {
  if (provider === "GOOGLE") {
    return requestGoogleCredential();
  }
  if (provider === "KAKAO") {
    return requestKakaoCredential();
  }
  return requestNaverCredential();
}

export function getSocialRedirectUri() {
  return redirectUri;
}

async function requestGoogleCredential(): Promise<SocialCredential> {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    expoExtra.googleAndroidClientId ||
    expoExtra.googleWebClientId ||
    "";
  if (!clientId) {
    throw new Error("Google 로그인 설정이 필요합니다.");
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["openid", "email", "profile"],
    usePKCE: true
  });

  const result = await request.promptAsync(googleDiscovery);
  if (result.type !== "success" || !result.params.code) {
    throw new Error("Google 로그인이 취소되었습니다.");
  }

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier ?? ""
      }
    },
    googleDiscovery
  );

  if (!token.idToken) {
    throw new Error("Google ID 토큰을 받지 못했습니다.");
  }

  return {
    provider: "GOOGLE",
    tokenType: "ID_TOKEN",
    providerToken: token.idToken
  };
}

async function requestKakaoCredential(): Promise<SocialCredential> {
  const clientId = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || expoExtra.kakaoRestApiKey || "";
  if (!clientId) {
    throw new Error("카카오 로그인 설정이 필요합니다.");
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["profile_nickname", "profile_image", "account_email"],
    usePKCE: false
  });

  const result = await request.promptAsync(kakaoDiscovery);
  if (result.type !== "success" || !result.params.code) {
    throw new Error("카카오 로그인이 취소되었습니다.");
  }

  return {
    provider: "KAKAO",
    tokenType: "AUTHORIZATION_CODE",
    authorizationCode: result.params.code,
    redirectUri,
    oauthState: result.params.state
  };
}

async function requestNaverCredential(): Promise<SocialCredential> {
  const clientId = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || expoExtra.naverClientId || "";
  if (!clientId) {
    throw new Error("네이버 로그인 설정이 필요합니다.");
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: false
  });

  const result = await request.promptAsync(naverDiscovery);
  if (result.type !== "success" || !result.params.code) {
    throw new Error("네이버 로그인이 취소되었습니다.");
  }

  return {
    provider: "NAVER",
    tokenType: "AUTHORIZATION_CODE",
    authorizationCode: result.params.code,
    redirectUri,
    oauthState: result.params.state
  };
}
