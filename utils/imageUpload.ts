import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

export type PickedImage = {
  uri: string;
  name: string;
  mimeType: string;
  fileSize?: number;
  file?: File | null;
};

type PickSquareImageOptions = {
  maxFileSizeBytes?: number;
  targetSize?: number;
  webMode?: "auto" | "raw";
};

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TARGET_SIZE = 1024;

export async function pickSquareImageAsync(options: PickSquareImageOptions = {}): Promise<PickedImage | null> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const targetSize = options.targetSize ?? DEFAULT_TARGET_SIZE;
  const webMode = options.webMode ?? "auto";

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Media library permission is required to select an image.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > maxFileSizeBytes) {
    throw new Error(`Image size must be less than ${(maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB.`);
  }

  if (Platform.OS === "web" && webMode === "raw") {
    const baseName = (asset.fileName || `image-${Date.now()}`).replace(/\.[^.]+$/, "");
    return {
      uri: asset.uri,
      name: `${baseName}.${asset.mimeType?.includes("png") ? "png" : "jpg"}`,
      mimeType: asset.mimeType || "image/jpeg",
      fileSize: asset.fileSize,
      file: asset.file ?? null,
    };
  }

  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const actions: ImageManipulator.Action[] = [];

  if (width > 0 && height > 0) {
    const squareSize = Math.min(width, height);
    const originX = Math.max(0, Math.floor((width - squareSize) / 2));
    const originY = Math.max(0, Math.floor((height - squareSize) / 2));

    if (width !== height) {
      actions.push({
        crop: {
          originX,
          originY,
          width: squareSize,
          height: squareSize,
        },
      });
    }
  }

  actions.push({
    resize: {
      width: targetSize,
      height: targetSize,
    },
  });

  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const mimeType = "image/jpeg";
  const baseName = (asset.fileName || `image-${Date.now()}`).replace(/\.[^.]+$/, "");

  return {
    uri: manipulated.uri,
    name: `${baseName}.jpg`,
    mimeType,
    fileSize: asset.fileSize,
  };
}
