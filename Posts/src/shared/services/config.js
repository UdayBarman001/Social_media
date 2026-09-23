import { Platform } from "react-native";

// Set EXPO_PUBLIC_LAN_IP in a .env file (gitignored) to your machine's LAN IP
// on whatever network you're currently dev-testing on — this changes every
// time you switch Wi-Fi networks, so it doesn't belong hardcoded in source.
const LAN_IP = process.env.EXPO_PUBLIC_LAN_IP || "192.168.1.36";
const PORT = process.env.EXPO_PUBLIC_API_PORT || 4000;

export const API_URL =
  Platform.OS === "web" ? `http://localhost:${PORT}` : `http://${LAN_IP}:${PORT}`;
