import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export type WebCropState = {
  sourceUri: string;
  fileName: string;
  mimeType: string;
  objectUrl?: string;
  naturalWidth: number;
  naturalHeight: number;
};

type CropTransform = { scale: number; translateX: number; translateY: number };

const INITIAL_TRANSFORM: CropTransform = { scale: 1, translateX: 0, translateY: 0 };
// The square crop frame covers this share of the viewport.
const CROP_BOX_RATIO = 0.82;

// Square image cropper used for product, profile and staff/member photos: keeps the image
// covering the crop frame while it is dragged or zoomed, and renders the frame to a canvas.
export const useSquareImageCrop = () => {
  const [webCrop, setWebCrop] = useState<WebCropState | null>(null);
  const [cropViewportSize, setCropViewportSize] = useState(320);
  const [cropTransform, setCropTransform] = useState<CropTransform>(INITIAL_TRANSFORM);
  const cropTransformRef = useRef(cropTransform);
  const cropGestureRef = useRef({ startScale: 1, startTranslateX: 0, startTranslateY: 0, startClientX: 0, startClientY: 0 });
  const cropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);
  const cropBoxSize = Math.max(1, Math.floor(cropViewportSize * CROP_BOX_RATIO));

  useEffect(() => {
    cropTransformRef.current = cropTransform;
  }, [cropTransform]);

  const clampCropTransform = useCallback(
    (nextScale: number, nextTranslateX: number, nextTranslateY: number, sourceWidth: number, sourceHeight: number) => {
      const fitScale = Math.min(cropViewportSize / Math.max(1, sourceWidth), cropViewportSize / Math.max(1, sourceHeight));
      const minCoverScale = Math.max(
        cropBoxSize / Math.max(1, sourceWidth * fitScale),
        cropBoxSize / Math.max(1, sourceHeight * fitScale)
      );
      const safeScale = Math.max(minCoverScale, nextScale);
      const displayWidth = Math.max(1, sourceWidth * fitScale * safeScale);
      const displayHeight = Math.max(1, sourceHeight * fitScale * safeScale);
      const overflowX = Math.max(0, (displayWidth - cropBoxSize) / 2);
      const overflowY = Math.max(0, (displayHeight - cropBoxSize) / 2);
      return {
        scale: safeScale,
        translateX: Math.min(overflowX, Math.max(-overflowX, nextTranslateX)),
        translateY: Math.min(overflowY, Math.max(-overflowY, nextTranslateY)),
      };
    },
    [cropBoxSize, cropViewportSize]
  );

  const updateCropTranslation = useCallback(
    (nextTranslateX: number, nextTranslateY: number) => {
      if (!webCrop) return;
      setCropTransform((current) =>
        clampCropTransform(
          current.scale,
          nextTranslateX,
          nextTranslateY,
          webCrop.naturalWidth || cropViewportSize,
          webCrop.naturalHeight || cropViewportSize
        )
      );
    },
    [clampCropTransform, cropViewportSize, webCrop]
  );

  const setCropScale = useCallback(
    (nextScale: number) => {
      if (!webCrop) return;
      setCropTransform((current) =>
        clampCropTransform(
          nextScale,
          current.translateX,
          current.translateY,
          webCrop.naturalWidth || cropViewportSize,
          webCrop.naturalHeight || cropViewportSize
        )
      );
    },
    [clampCropTransform, cropViewportSize, webCrop]
  );

  const beginCropDrag = useCallback((clientX: number, clientY: number) => {
    cropDragRef.current = { active: true, lastX: clientX, lastY: clientY };
    cropGestureRef.current = {
      startScale: cropTransformRef.current.scale,
      startTranslateX: cropTransformRef.current.translateX,
      startTranslateY: cropTransformRef.current.translateY,
      startClientX: clientX,
      startClientY: clientY,
    };
    setIsCropDragging(true);
  }, []);

  // Mouse drag on web continues outside the crop frame until the button is released.
  useEffect(() => {
    if (Platform.OS !== "web" || !isCropDragging || !webCrop) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!cropDragRef.current.active) return;
      cropDragRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
      updateCropTranslation(
        cropGestureRef.current.startTranslateX + (event.clientX - cropGestureRef.current.startClientX),
        cropGestureRef.current.startTranslateY + (event.clientY - cropGestureRef.current.startClientY)
      );
      event.preventDefault();
    };
    const handleMouseUp = () => {
      cropDragRef.current.active = false;
      setIsCropDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isCropDragging, updateCropTranslation, webCrop]);

  const openWebCropperFromSource = useCallback((sourceUri: string, fileName: string, mimeType: string, objectUrl?: string) => {
    if (Platform.OS === "web") {
      const img = new window.Image();
      img.onload = () => setWebCrop({ sourceUri, fileName, mimeType, objectUrl, naturalWidth: img.width, naturalHeight: img.height });
      img.onerror = () => setWebCrop({ sourceUri, fileName, mimeType, objectUrl, naturalWidth: 800, naturalHeight: 800 });
      img.src = sourceUri;
    } else {
      setWebCrop({ sourceUri, fileName, mimeType, objectUrl, naturalWidth: 800, naturalHeight: 800 });
    }
  }, []);

  const closeWebCropper = useCallback(() => {
    if (webCrop?.objectUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(webCrop.objectUrl);
    }
    setWebCrop(null);
    setCropTransform(INITIAL_TRANSFORM);
  }, [webCrop]);

  // Draws the area inside the crop frame onto a square canvas of outputSize pixels (web only).
  const renderCropToCanvas = useCallback(
    async (outputSize: number) => {
      if (!webCrop) return null;
      const img = new window.Image();
      img.src = webCrop.objectUrl || webCrop.sourceUri;
      img.crossOrigin = "anonymous";
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      const fitScale = Math.min(
        cropViewportSize / Math.max(1, webCrop.naturalWidth || cropViewportSize),
        cropViewportSize / Math.max(1, webCrop.naturalHeight || cropViewportSize)
      );
      const exportScale = outputSize / cropBoxSize;
      const renderScale = fitScale * cropTransform.scale * exportScale;

      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.translate(outputSize / 2 + cropTransform.translateX * exportScale, outputSize / 2 + cropTransform.translateY * exportScale);
      ctx.scale(renderScale, renderScale);
      ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.drawImage(img, 0, 0);
      return canvas;
    },
    [cropBoxSize, cropTransform, cropViewportSize, webCrop]
  );

  return {
    webCrop,
    setWebCrop,
    cropViewportSize,
    setCropViewportSize,
    cropTransform,
    setCropTransform,
    cropTransformRef,
    cropGestureRef,
    cropDragRef,
    isCropDragging,
    setIsCropDragging,
    cropBoxSize,
    clampCropTransform,
    updateCropTranslation,
    setCropScale,
    beginCropDrag,
    openWebCropperFromSource,
    closeWebCropper,
    renderCropToCanvas,
  };
};
