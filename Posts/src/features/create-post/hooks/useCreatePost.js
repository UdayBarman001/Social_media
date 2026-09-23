import { useMemo, useRef, useState, useCallback } from "react";
import { Alert, Animated, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import COLORS from "../../../shared/theme/colors";
import { useCreatePostMutation } from "../../../shared/queries/useCreatePostMutation";
import { useFeed } from "../../feed/context/FeedContext";
import { useUser } from "../../../shared/context/LocalUserContext";
import { MAX_CHARS, MAX_IMAGES, MAX_TAGS } from "../constants";
import { tagsFromCaption } from "../../../shared/utils/hashtags";
import { deletePost } from "../../../shared/services/api";
import { useMediaPicker } from "../../../shared/hooks/useMediaPicker";

export function useCreatePost() {
  const router = useRouter();
  const { prependPost } = useFeed();
  const { userId: storedUserId, name: storedUserName } = useUser();
  const userId = storedUserId;
  const createMutation = useCreatePostMutation();

  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]); // array of local uris, up to MAX_IMAGES
  const [location, setLocation] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const AUDIENCE_PUBLIC = "Public";

  const pressAnim = useRef(new Animated.Value(1)).current;
  const photoCardAnim = useRef(new Animated.Value(1)).current;
  const locationInputAnim = useRef(new Animated.Value(0)).current;

  const remainingSlots = Math.max(0, MAX_IMAGES - images.length);

  // Multi-image retry bookkeeping
  const partialPostIdRef = useRef(null);
  const uploadedUrisRef = useRef(new Set());

  const resetPartialPostTracking = useCallback(() => {
    partialPostIdRef.current = null;
    uploadedUrisRef.current.clear();
  }, []);

  const addImages = useCallback((uris) => {
    setImages((prev) => {
      const merged = [...prev, ...uris];
      if (merged.length > MAX_IMAGES) {
        Alert.alert("Too many photos", `You can attach up to ${MAX_IMAGES} photos per post.`);
      }
      return merged.slice(0, MAX_IMAGES);
    });
  }, []);

  // Encapsulated media picker (shared with EditPostScreen)
  const mediaPicker = useMediaPicker({
    maxImages: MAX_IMAGES,
    remainingSlots,
    onAddImages: addImages,
    quality: 0.85,
  });

  const canPost = (description.trim().length > 0 || images.length > 0) && description.length <= MAX_CHARS && !createMutation.isPending;

  const handlePost = useCallback(async () => {
    if (!description.trim() && images.length === 0) return;
    Keyboard.dismiss();

    // Only send images that haven't already made it to the server from a
    // previous, partially-failed attempt (see refs above). On a first
    // attempt uploadedUrisRef is empty, so this is just `images`.
    const remainingImageUris = images.filter((uri) => !uploadedUrisRef.current.has(uri));
    const existingPostId = partialPostIdRef.current;

    try {
      const created = await createMutation.mutateAsync({
        fields: {
          description: description.trim(),
          location: location.trim() || undefined,
          audience: AUDIENCE_PUBLIC,
          // Facebook-style: the only source of a post's tags is #hashtags
          // typed directly in the caption — same `tags` field the backend
          // already autocompletes search against, so "#Krishiverse"
          // becomes findable without touching the search endpoint at all.
          tags: tagsFromCaption(description, MAX_TAGS),
        },
        imageUris: remainingImageUris,
        userId,
        options: {
          existingPostId,
          onPostCreated: (postId) => {
            partialPostIdRef.current = postId;
          },
          onImageUploaded: (uri) => {
            uploadedUrisRef.current.add(uri);
          },
        },
      });
      resetPartialPostTracking();
      prependPost(created);
      router.back();
    } catch (err) {
      console.error("CREATE POST ERROR:", err);
      const orphanPostId = partialPostIdRef.current;
      if (orphanPostId) {
        // A post already exists server-side with some (maybe all) of the
        // images attached — don't leave the choice implicit. Retry resumes
        // it (uploadedUrisRef ensures no duplicate images either); Discard
        // deletes it outright via the existing, already-safe deletePost()
        // (auth-checked + full cascade cleanup server-side) so nothing
        // orphaned is left behind.
        Alert.alert(
          "Couldn't finish posting",
          "Your post was created but not all photos uploaded. You can retry to finish, or discard it.",
          [
            {
              text: "Discard",
              style: "destructive",
              onPress: async () => {
                try {
                  await deletePost(orphanPostId, userId);
                } catch (cleanupErr) {
                  console.error("ORPHAN POST CLEANUP ERROR:", cleanupErr);
                } finally {
                  resetPartialPostTracking();
                }
              },
            },
            { text: "Retry", onPress: () => handlePost() },
          ],
        );
      } else {
        Alert.alert("Couldn't post", "Something went wrong. Please try again.");
      }
    }
  }, [description, images, location, userId, prependPost, router, createMutation, resetPartialPostTracking]);

  const openMediaSheet = useCallback(() => {
    if (createMutation.isPending) return;
    if (remainingSlots <= 0) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_IMAGES} photos per post.`);
      return;
    }
    Keyboard.dismiss();
    mediaPicker.openMediaSheet();
  }, [createMutation.isPending, remainingSlots, mediaPicker]);

  const removeImage = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearLocation = useCallback(() => {
    setLocation("");
    setShowLocationInput(false);
  }, []);

  const initials = useMemo(() => {
    return (
      (storedUserName || "")
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"
    );
  }, [storedUserName]);

  const animateLocationInput = useCallback((visible) => {
    setShowLocationInput(visible);
    Animated.timing(locationInputAnim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [locationInputAnim]);

  const OPTION_PILLS = useMemo(() => [
    {
      key: "location",
      label: "Location",
      iconName: "map-pin",
      active: !!(location.trim() || showLocationInput),
      onPress: () => animateLocationInput(!showLocationInput),
    },
  ], [location, showLocationInput, animateLocationInput]);

  return {
    description, setDescription,
    images,
    remainingSlots,
    location, setLocation,
    showLocationInput, setShowLocationInput: animateLocationInput,
    posting: createMutation.isPending,
    canPost,
    initials,

    mediaSheetVisible: mediaPicker.mediaSheetVisible,
    setMediaSheetVisible: mediaPicker.setMediaSheetVisible,

    pressAnim,
    photoCardAnim,
    locationInputAnim,

    OPTION_PILLS,

    handlePost,
    pickFromCamera: mediaPicker.pickFromCamera,
    pickFromGallery: mediaPicker.pickFromGallery,
    handleMediaSheetDismissed: mediaPicker.handleMediaSheetDismissed,
    openMediaSheet,
    removeImage,
    clearLocation,
    router,
  };
}