import { Modal, View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";

export default function MediaSourceSheet({ visible, onClose, onPickCamera, onPickGallery, onDismiss }) {
  return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => onClose()}
        onDismiss={onDismiss}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => onClose()}
        >
          <Pressable
            onPress={() => {}}
            className="bg-surfaceWhite rounded-t-[22px] px-4 pt-2.5 pb-7"
          >
            <View className="self-center mb-[14px] w-10 h-1 rounded-sm bg-borderDefault" />
            <Text className="text-[15px] font-poppins-sb mb-[14px] px-1 text-textPrimary">
              Add a photo
            </Text>

            <Pressable
              onPress={onPickCamera}
              className="flex-row items-center gap-[12px] px-1 py-3"
            >
              <View className="items-center justify-center w-[42px] h-[42px] rounded-[21px] bg-categoryBg">
                <Feather name="camera" size={19} color={COLORS.accentGreen} />
              </View>
              <View>
                <Text className="text-[14px] font-poppins-sb text-textPrimary">
                  Take a photo
                </Text>
                <Text className="text-[12px] font-poppins text-textSecondary">
                  Use your camera
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onPickGallery}
              className="flex-row items-center gap-[12px] px-1 py-3"
            >
              <View className="items-center justify-center w-[42px] h-[42px] rounded-[21px] bg-categoryBg">
                <Feather name="image" size={19} color={COLORS.accentGreen} />
              </View>
              <View>
                <Text className="text-[14px] font-poppins-sb text-textPrimary">
                  Choose from gallery
                </Text>
                <Text className="text-[12px] font-poppins text-textSecondary">
                  Pick an existing photo
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => onClose()}
              className="items-center mt-[10px] py-3 rounded-[14px] bg-surfaceGray"
            >
              <Text className="text-[14px] font-poppins-sb text-textSecondary">
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
  );
}