import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const securePrefix = "allcaremedi.secure.";

export async function getSecureItem(key: string) {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(`${securePrefix}${key}`);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(`${securePrefix}${key}`, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(`${securePrefix}${key}`);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
