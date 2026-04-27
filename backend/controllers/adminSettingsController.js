const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');

// @desc    Get admin settings
// @route   GET /api/admin/settings
exports.getAdminSettings = asyncHandler(async (req, res) => {
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('razorpay_key_id')
    .single();

  res.json({
    success: true,
    settings: {
      razorpay_key_id: settings?.razorpay_key_id || '',
      razorpay_configured: !!(settings?.razorpay_key_id),
    },
  });
});

// @desc    Update admin settings
// @route   PUT /api/admin/settings
exports.updateAdminSettings = asyncHandler(async (req, res) => {
  const { razorpay_key_id, razorpay_key_secret } = req.body;

  const updateData = {
    updated_at: new Date().toISOString(),
    updated_by: req.user.id,
  };

  if (razorpay_key_id !== undefined) updateData.razorpay_key_id = razorpay_key_id;
  if (razorpay_key_secret !== undefined) updateData.razorpay_key_secret = razorpay_key_secret;

  const { data, error } = await supabase
    .from('admin_settings')
    .update(updateData)
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .select('razorpay_key_id')
    .single();

  if (error) throw error;

  res.json({
    success: true,
    message: 'Settings updated successfully',
    settings: {
      razorpay_key_id: data.razorpay_key_id || '',
      razorpay_configured: !!data.razorpay_key_id,
    },
  });
});
