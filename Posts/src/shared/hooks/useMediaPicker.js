import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { compressImages } from "../utils/imageCompressor";

/**
 * useMediaPicker: Unifies camera & gallery selection between CreatePost and EditPost.
 * Handles iOS modal presentation conflict, permission requests, and selection limit.
 */
export function useMediaPicker({
  maxImages = 5,
  remainingSlots = 5,
  onAddImages,
  quality = 0.85,
}) {
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const pendingMediaActionRef = useRef(null);
  const dismissFallbackTimerRef = useRef(null);

  // Recover camera results if process was recreated after backgrounding
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let isMounted = true;

    async function checkPendingResult() {
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        if (!isMounted || !pending || pending.canceled) return;
        const uri = pending.assets?.[0]?.uri;
        if (uri) {
          const compressed = await compressImages([uri]);
          if (isMounted) {
            onAddImages?.(compressed);
          }
        }
      } catch (err) {
        console.warn("Error retrieving pending camera result:", err);
      }
    }

    checkPendingResult();
    return () => {
      isMounted = false;
    };
  }, [onAddImages]);

  const runPickerAction = useCallback(
    async (type) => {
      try {
        if (remainingSlots <= 0) {
          Alert.alert("Limit reached", `You can attach up to ${maxImages} photos per post.`);
          return;
        }

        if (type === "camera") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Camera access is required to take a photo.");
            return;
          }
          // Release cached bitmaps from Glide before launching native camera to avoid OS low-memory kill
          if (Platform.OS === "android") {
            try {
              await Image.clearMemoryCache();
            } catch (cacheErr) {
              console.warn("Failed to clear memory cache:", cacheErr);
            }
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            // Compress raw camera photo (typically 4MB-8MB) down to ~300KB before adding
            const compressed = await compressImages([result.assets[0].uri]);
            onAddImages?.(compressed);
          }
        } else if (type === "gallery") {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Gallery access is required to pick a photo.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality,
            allowsMultipleSelection: true,
            selectionLimit: remainingSlots,
          });
          if (!result.canceled && result.assets?.length) {
            const rawUris = result.assets.map((a) => a.uri).filter(Boolean);
            // Parallel client-side compression for all picked gallery photos
            const compressed = await compressImages(rawUris);
            onAddImages?.(compressed);
          }
        }
      } catch (err) {
        console.error("MEDIA PICKER ERROR:", err);
        Alert.alert("Couldn't open media picker", "Something went wrong. Please try again.");
      }
    },
    [remainingSlots, maxImages, quality, onAddImages]
  );

  // iOS modal onDismiss handler
  const handleMediaSheetDismissed = useCallback(() => {
    if (dismissFallbackTimerRef.current) {
      clearTimeout(dismissFallbackTimerRef.current);
      dismissFallbackTimerRef.current = null;
    }
    const type = pendingMediaActionRef.current;
    pendingMediaActionRef.current = null;
    if (type) runPickerAction(type);
  }, [runPickerAction]);

  // iOS dismiss event fallback timer
  const armDismissFallback = useCallback(
    (type) => {
      if (dismissFallbackTimerRef.current) clearTimeout(dismissFallbackTimerRef.current);
      dismissFallbackTimerRef.current = setTimeout(() => {
        dismissFallbackTimerRef.current = null;
        if (pendingMediaActionRef.current === type) {
          pendingMediaActionRef.current = null;
          runPickerAction(type);
        }
      }, 600);
    },
    [runPickerAction]
  );

  const pickFromCamera = useCallback(() => {
    pendingMediaActionRef.current = "camera";
    setMediaSheetVisible(false);
    if (Platform.OS === "android") {
      pendingMediaActionRef.current = null;
      setTimeout(() => runPickerAction("camera"), 0);
    } else {
      armDismissFallback("camera");
    }
  }, [runPickerAction, armDismissFallback]);

  const pickFromGallery = useCallback(() => {
    pendingMediaActionRef.current = "gallery";
    setMediaSheetVisible(false);
    if (Platform.OS === "android") {
      pendingMediaActionRef.current = null;
      setTimeout(() => runPickerAction("gallery"), 0);
    } else {
      armDismissFallback("gallery");
    }
  }, [runPickerAction, armDismissFallback]);

  const openMediaSheet = useCallback((canOpen = true) => {
    if (!canOpen) return;
    setMediaSheetVisible(true);
  }, []);

  const closeMediaSheet = useCallback(() => {
    setMediaSheetVisible(false);
  }, []);

  return {
    mediaSheetVisible,
    setMediaSheetVisible,
    openMediaSheet,
    closeMediaSheet,
    handleMediaSheetDismissed,
    pickFromCamera,
    pickFromGallery,
    sheetProps: {
      visible: mediaSheetVisible,
      onClose: closeMediaSheet,
      onDismiss: handleMediaSheetDismissed,
      onPickCamera: pickFromCamera,
      onPickGallery: pickFromGallery,
    },
  };
}
