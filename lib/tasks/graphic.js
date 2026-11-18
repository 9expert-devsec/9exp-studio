// Graphic Step 2 limits — pure; shared by the form (components/tasks/
// GraphicDetailsStep.jsx) and the server validation (lib/tasks/details.js).

export const GRAPHIC_ITEMS_MAX = 9999;
export const GRAPHIC_FILE_LOCATION_MAX = 500;
export const GRAPHIC_PHOTOS_MAX = 10;
export const GRAPHIC_PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const GRAPHIC_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
