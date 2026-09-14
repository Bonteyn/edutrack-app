const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

async function uploadToSupabase(file, bucketName = 'uploads') {
  const fileName = `${Date.now()}_${file.originalname}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

module.exports = { upload, uploadToSupabase, supabase };
