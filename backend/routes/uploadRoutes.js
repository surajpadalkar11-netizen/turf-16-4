const express = require('express');
const multer = require('multer');
const path = require('path');
const supabase = require('../config/supabase');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Use memory storage — file Buffer goes to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(req, file, cb) {
    const allowed = /jpg|jpeg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Images only (jpg, jpeg, png, webp)'));
  },
});

router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `turf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('turf-images')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return res.status(500).json({ success: false, message: 'Image upload failed', error: uploadError.message });
    }

    const { data: publicUrl } = supabase.storage.from('turf-images').getPublicUrl(filename);

    res.json({ success: true, url: publicUrl.publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Image upload failed', error: err.message });
  }
});

module.exports = router;
