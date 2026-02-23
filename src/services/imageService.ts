/**
 * imageService.ts
 * Handles image capture, compression, and optimization.
 * Target: 512×512 px, JPEG quality 0.65, < 300 KB.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { IMAGE_CONFIG } from '../constants';

export interface CapturedImage {
  uri: string;
  width: number;
  height: number;
  fileSizeBytes?: number;
}

/**
 * Opens the device camera and returns a compressed image.
 * Returns null if the user cancels.
 */
export async function captureImageFromCamera(): Promise<CapturedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission denied.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images' as ImagePicker.MediaType,
    quality: 1, // We compress ourselves below
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  return compressImage(result.assets[0].uri);
}

/**
 * Resizes to 512×512 and compresses to JPEG at configured quality.
 */
export async function compressImage(uri: string): Promise<CapturedImage> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: IMAGE_CONFIG.WIDTH, height: IMAGE_CONFIG.HEIGHT } }],
    {
      compress: IMAGE_CONFIG.COMPRESS,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    uri: manipResult.uri,
    width: manipResult.width,
    height: manipResult.height,
  };
}
