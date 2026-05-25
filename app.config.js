const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.GOOGLE_ANDROID_CLIENT_ID || "";
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || "";
const kakaoRestApiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY || "";
const naverClientId = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || process.env.NAVER_CLIENT_ID || "";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    googleMapsApiKey,
    googleAndroidClientId,
    googleWebClientId,
    kakaoRestApiKey,
    naverClientId,
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    },
  },
  plugins: [
    ...(config.plugins || []),
    "expo-web-browser",
  ],
});
