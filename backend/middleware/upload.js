const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const path       = require('path');

// ── Cloudinary config ──────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD,
  api_key:    process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// ── Multer (memory storage for Cloudinary upload) ──────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext  = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Только изображения: jpeg, jpg, png, webp, gif'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

// ── Upload to Cloudinary ───────────────────────────────────
async function uploadToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: `wanderlog/${folder}`, ...options },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    ).end(buffer);
  });
}

async function uploadAvatar(buffer) {
  return uploadToCloudinary(buffer, 'avatars', {
    width: 300, height: 300, crop: 'fill', gravity: 'face',
    format: 'webp', quality: 'auto',
  });
}

async function uploadPhoto(buffer, tripId) {
  const [full, thumb] = await Promise.all([
    uploadToCloudinary(buffer, `trips/${tripId}`, {
      format: 'webp', quality: 'auto:good', max_width: 2000,
    }),
    uploadToCloudinary(buffer, `trips/${tripId}/thumbs`, {
      width: 400, height: 300, crop: 'fill', format: 'webp', quality: 'auto',
    }),
  ]);
  return { url: full.secure_url, thumb_url: thumb.secure_url,
           width: full.width, height: full.height };
}

module.exports = { upload, uploadAvatar, uploadPhoto, cloudinary };
