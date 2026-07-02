import * as THREE from 'three';

/**
 * Maps MediaPipe normalized coordinates (0 to 1) from a video frame to Three.js Normalized Device Coordinates (-1 to 1)
 * taking into account "object-fit: cover" scaling, cropping, and mirroring.
 */
export function getNDCFromNormalized(
  x: number,
  y: number,
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  mirrorX: boolean = true
): THREE.Vector2 {
  const videoRatio = videoWidth / videoHeight;
  const containerRatio = containerWidth / containerHeight;

  let scaledWidth = containerWidth;
  let scaledHeight = containerHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (videoRatio > containerRatio) {
    // Video is wider than container (cropped on sides)
    scaledWidth = containerHeight * videoRatio;
    offsetX = (scaledWidth - containerWidth) / 2;
  } else {
    // Video is taller than container (cropped on top/bottom)
    scaledHeight = containerWidth / videoRatio;
    offsetY = (scaledHeight - containerHeight) / 2;
  }

  // Calculate pixel coordinates within the video overlay space
  const pixelX = x * scaledWidth - offsetX;
  const pixelY = y * scaledHeight - offsetY;

  // Convert to normalized coordinates relative to the container (0 to 1)
  const normContainerX = pixelX / containerWidth;
  const normContainerY = pixelY / containerHeight;

  // Apply mirroring for x if requested (e.g. if webcam is mirrored)
  const finalX = mirrorX ? (1 - normContainerX) : normContainerX;

  // Convert to Three.js NDC (-1 to 1)
  const ndcX = finalX * 2 - 1;
  const ndcY = 1 - 2 * normContainerY; // Three.js y goes up, screen y goes down

  return new THREE.Vector2(ndcX, ndcY);
}

/**
 * Unprojects NDC coordinates to a 3D point in Three.js world space.
 * We intersect the ray from the camera with a plane at targetPlaneZ parallel to the camera.
 */
export function get3DPosition(
  ndc: THREE.Vector2,
  camera: THREE.Camera,
  targetPlaneZ: number = 0
): THREE.Vector3 {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  
  const targetPoint = new THREE.Vector3();
  // Create a plane at targetPlaneZ pointing towards the camera (normal: 0, 0, 1)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -targetPlaneZ);
  
  raycaster.ray.intersectPlane(plane, targetPoint);
  return targetPoint;
}

/**
 * Maps MediaPipe normalized coordinates (0 to 1) from a video frame to screen percentages (0 to 100)
 * taking into account "object-fit: cover" scaling, cropping, and mirroring.
 */
export function getScreenPosition(
  x: number,
  y: number,
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  mirrorX: boolean = true
): { x: number; y: number } {
  const videoRatio = videoWidth / videoHeight;
  const containerRatio = containerWidth / containerHeight;

  let scaledWidth = containerWidth;
  let scaledHeight = containerHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (videoRatio > containerRatio) {
    // Video is wider than container (cropped on sides)
    scaledWidth = containerHeight * videoRatio;
    offsetX = (scaledWidth - containerWidth) / 2;
  } else {
    // Video is taller than container (cropped on top/bottom)
    scaledHeight = containerWidth / videoRatio;
    offsetY = (scaledHeight - containerHeight) / 2;
  }

  // Calculate pixel coordinates within the video overlay space
  const pixelX = x * scaledWidth - offsetX;
  const pixelY = y * scaledHeight - offsetY;

  // Convert to normalized coordinates relative to the container (0 to 1)
  const normContainerX = pixelX / containerWidth;
  const normContainerY = pixelY / containerHeight;

  // Apply mirroring for x if requested
  const finalX = mirrorX ? (1 - normContainerX) : normContainerX;

  return {
    x: finalX * 100,
    y: normContainerY * 100
  };
}

