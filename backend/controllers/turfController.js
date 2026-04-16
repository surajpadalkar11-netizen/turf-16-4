const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const { asyncHandler, generateTimeSlots } = require('../utils/helpers');

// Helper to map DB row to API shape
const mapTurf = (t) => ({
  _id: t.id,
  id: t.id,
  name: t.name,
  description: t.description,
  sportTypes: t.sport_types,
  surfaceType: t.surface_type,
  location: { coordinates: [t.lng, t.lat] },
  address: { street: t.street, city: t.city, state: t.state, pincode: t.pincode },
  images: t.images || [],
  pricePerHour: t.price_per_hour,
  peakHourStart: t.peak_hour_start,
  peakHourEnd: t.peak_hour_end,
  peakPricePerHour: t.peak_price_per_hour,
  amenities: t.amenities || [],
  dimensions: { length: t.dim_length, width: t.dim_width },
  operatingHours: { open: t.operating_open, close: t.operating_close },
  rating: { average: t.rating_average, count: t.rating_count },
  owner: t.owner_id ? { _id: t.owner_id, name: t.owner_name || '', email: t.owner_email } : null,
  ownerPhone: t.owner_phone,
  ownerEmail: t.owner_email,
  razorpayKeyId: t.razorpay_key_id,
  razorpayKeySecret: t.razorpay_key_secret,
  isActive: t.is_active,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

// @desc    Get all turfs with filters
// @route   GET /api/turfs
exports.getTurfs = asyncHandler(async (req, res) => {
  const {
    city, sport, surface, amenities, minPrice, maxPrice, rating,
    search, sort, page = 1, limit = 12, lat, lng, radius,
  } = req.query;

  // Nearby search via RPC
  if (lat && lng && radius) {
    const { data, error } = await supabase.rpc('nearby_turfs', {
      user_lat: Number(lat),
      user_lng: Number(lng),
      radius_m: Number(radius),
    });
    if (error) throw error;
    const turfs = (data || []).map(mapTurf);
    return res.json({ success: true, count: turfs.length, total: turfs.length, totalPages: 1, page: 1, turfs });
  }

  let query = supabase.from('turfs').select('*', { count: 'exact' }).eq('is_active', true);

  if (city) query = query.ilike('city', `%${city}%`);
  if (surface) query = query.eq('surface_type', surface);
  if (minPrice) query = query.gte('price_per_hour', Number(minPrice));
  if (maxPrice) query = query.lte('price_per_hour', Number(maxPrice));
  if (rating) query = query.gte('rating_average', Number(rating));
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,city.ilike.%${search}%`);
  if (sport) {
    const sports = sport.split(',');
    query = query.overlaps('sport_types', sports);
  }
  if (amenities) {
    const ams = amenities.split(',');
    query = query.contains('amenities', ams);
  }

  // Sort
  if (sort === 'price-low') query = query.order('price_per_hour', { ascending: true });
  else if (sort === 'price-high') query = query.order('price_per_hour', { ascending: false });
  else if (sort === 'rating') query = query.order('rating_average', { ascending: false });
  else if (sort === 'popular') query = query.order('rating_count', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const skip = (Number(page) - 1) * Number(limit);
  query = query.range(skip, skip + Number(limit) - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  res.json({
    success: true,
    count: (data || []).length,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / Number(limit)),
    page: Number(page),
    turfs: (data || []).map(mapTurf),
  });
});

// @desc    Get single turf
// @route   GET /api/turfs/:id
exports.getTurf = asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('turfs').select('*').eq('id', req.params.id).single();
  if (error || !data) {
    return res.status(404).json({ success: false, message: 'Turf not found' });
  }
  res.json({ success: true, turf: mapTurf(data) });
});

// @desc    Get available slots for a turf on a date
// @route   GET /api/turfs/:id/slots?date=YYYY-MM-DD&interval=60
exports.getAvailableSlots = asyncHandler(async (req, res) => {
  const { data: turf, error } = await supabase.from('turfs').select('id, operating_open, operating_close').eq('id', req.params.id).single();
  if (error || !turf) {
    return res.status(404).json({ success: false, message: 'Turf not found' });
  }

  const { date, interval } = req.query;
  if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

  // Support any positive interval (30, 60, 90, 120 minutes, etc.)
  const intervalMinutes = Math.max(15, parseInt(interval, 10) || 60);
  const allSlots = generateTimeSlots(turf.operating_open, turf.operating_close, intervalMinutes);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('time_slots, notes')
    .eq('turf_id', turf.id)
    .eq('date', date)
    .in('status', ['confirmed', 'pending', 'completed']);

  const bookedRanges = [];
  (bookings || []).forEach((b) => {
    // Treat admin blocked slots identical to regular user bookings on client side
    const isAdminBlocked = false; 
    (b.time_slots || []).forEach((s) => {
      const [h1, m1] = s.start.split(':').map(Number);
      const [h2, m2] = s.end.split(':').map(Number);
      bookedRanges.push({ startMins: h1 * 60 + m1, endMins: h2 * 60 + m2, blocked: isAdminBlocked });
    });
  });

  const slots = allSlots.map((slot) => {
    const [h1, m1] = slot.start.split(':').map(Number);
    const [h2, m2] = slot.end.split(':').map(Number);
    const slotStart = h1 * 60 + m1;
    const slotEnd = h2 * 60 + m2;

    let available = true;
    let blocked = false;

    for (const r of bookedRanges) {
      const overlaps =
        (slotStart >= r.startMins && slotStart < r.endMins) ||
        (slotEnd > r.startMins && slotEnd <= r.endMins) ||
        (slotStart <= r.startMins && slotEnd >= r.endMins);
      if (overlaps) {
        available = false;
        if (r.blocked) blocked = true;
        break;
      }
    }

    return { ...slot, available, blocked };
  });

  res.json({ success: true, slots, date });
});

// @desc    Create turf (admin)
// @route   POST /api/turfs
exports.createTurf = asyncHandler(async (req, res) => {
  const {
    name, description, sportTypes, surfaceType, address, images,
    pricePerHour, peakHourStart, peakHourEnd, peakPricePerHour, amenities, dimensions, operatingHours, ownerPhone,
    ownerEmail, ownerPassword, razorpayKeyId, razorpayKeySecret, location,
  } = req.body;

  let ownerId = req.user.id;
  if (ownerEmail && ownerPassword) {
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', ownerEmail.toLowerCase()).single();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(ownerPassword, salt);
    
    if (!existingUser) {
      const { data: newUser } = await supabase.from('users').insert({
        name: name ? name + ' Owner' : 'Turf Owner',
        email: ownerEmail.toLowerCase(),
        password: hashedPassword,
        phone: ownerPhone || '',
        role: 'turf_owner'
      }).select('id').single();
      if (newUser) ownerId = newUser.id;
    } else {
      await supabase.from('users').update({ password: hashedPassword, role: 'turf_owner' }).eq('email', ownerEmail.toLowerCase());
      ownerId = existingUser.id;
    }
  }

  const insert = {
    name, description,
    sport_types: sportTypes || [],
    surface_type: surfaceType,
    street: address?.street || '',
    city: address?.city || '',
    state: address?.state || '',
    pincode: address?.pincode || '',
    images: images || [],
    price_per_hour: pricePerHour,
    peak_hour_start: peakHourStart || '18:00',
    peak_hour_end: peakHourEnd || '23:00',
    peak_price_per_hour: peakPricePerHour || null,
    amenities: amenities || [],
    dim_length: dimensions?.length || null,
    dim_width: dimensions?.width || null,
    operating_open: operatingHours?.open || '06:00',
    operating_close: operatingHours?.close || '23:00',
    lat: location?.coordinates?.[1] || 0,
    lng: location?.coordinates?.[0] || 0,
    owner_id: ownerId,
    owner_phone: ownerPhone || '',
    owner_email: ownerEmail || '',
    razorpay_key_id: razorpayKeyId || '',
    razorpay_key_secret: razorpayKeySecret || '',
  };

  const { data, error } = await supabase.from('turfs').insert(insert).select().single();
  if (error) {
    console.error('SUPABASE INSERT ERROR:', error);
    console.error('PAYLOAD ATTEMPTED:', insert);
    return res.status(500).json({ success: false, message: error.message || 'Database error' });
  }
  res.status(201).json({ success: true, turf: mapTurf(data) });
});

// @desc    Update turf (admin)
// @route   PUT /api/turfs/:id
exports.updateTurf = asyncHandler(async (req, res) => {
  const { data: existing } = await supabase.from('turfs').select('id').eq('id', req.params.id).single();
  if (!existing) return res.status(404).json({ success: false, message: 'Turf not found' });

  const {
    name, description, sportTypes, surfaceType, address, images,
    pricePerHour, peakHourStart, peakHourEnd, peakPricePerHour, amenities, dimensions, operatingHours, ownerPhone,
    ownerEmail, ownerPassword, razorpayKeyId, razorpayKeySecret, isActive, location,
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (sportTypes !== undefined) updates.sport_types = sportTypes;
  if (surfaceType !== undefined) updates.surface_type = surfaceType;
  if (address?.street !== undefined) updates.street = address.street;
  if (address?.city !== undefined) updates.city = address.city;
  if (address?.state !== undefined) updates.state = address.state;
  if (address?.pincode !== undefined) updates.pincode = address.pincode;
  if (images !== undefined) updates.images = images;
  if (pricePerHour !== undefined) updates.price_per_hour = pricePerHour;
  if (peakHourStart !== undefined) updates.peak_hour_start = peakHourStart;
  if (peakHourEnd !== undefined) updates.peak_hour_end = peakHourEnd;
  if (peakPricePerHour !== undefined) updates.peak_price_per_hour = peakPricePerHour;
  if (amenities !== undefined) updates.amenities = amenities;
  if (dimensions?.length !== undefined) updates.dim_length = dimensions.length;
  if (dimensions?.width !== undefined) updates.dim_width = dimensions.width;
  if (operatingHours?.open !== undefined) updates.operating_open = operatingHours.open;
  if (operatingHours?.close !== undefined) updates.operating_close = operatingHours.close;
  if (ownerPhone !== undefined) updates.owner_phone = ownerPhone;
  if (ownerEmail !== undefined) updates.owner_email = ownerEmail;
  if (razorpayKeyId !== undefined) updates.razorpay_key_id = razorpayKeyId;
  if (razorpayKeySecret !== undefined) updates.razorpay_key_secret = razorpayKeySecret;
  if (isActive !== undefined) updates.is_active = isActive;
  if (location?.coordinates) {
    updates.lat = location.coordinates[1];
    updates.lng = location.coordinates[0];
  }

  if (ownerEmail && ownerPassword) {
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', ownerEmail.toLowerCase()).single();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(ownerPassword, salt);
    
    if (!existingUser) {
      const { data: newUser } = await supabase.from('users').insert({
        name: name ? name + ' Owner' : 'Turf Owner',
        email: ownerEmail.toLowerCase(),
        password: hashedPassword,
        phone: ownerPhone || '',
        role: 'turf_owner'
      }).select('id').single();
      if (newUser) updates.owner_id = newUser.id;
    } else {
      await supabase.from('users').update({ password: hashedPassword, role: 'turf_owner' }).eq('email', ownerEmail.toLowerCase());
      updates.owner_id = existingUser.id;
    }
  }

  const { data, error } = await supabase.from('turfs').update(updates).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json({ success: true, turf: mapTurf(data) });
});

// @desc    Delete turf (admin)
// @route   DELETE /api/turfs/:id
exports.deleteTurf = asyncHandler(async (req, res) => {
  const { data: existing } = await supabase.from('turfs').select('id').eq('id', req.params.id).single();
  if (!existing) return res.status(404).json({ success: false, message: 'Turf not found' });

  const { error } = await supabase.from('turfs').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ success: true, message: 'Turf deleted' });
});

// @desc    Get featured turfs
// @route   GET /api/turfs/featured
exports.getFeaturedTurfs = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('turfs')
    .select('*')
    .eq('is_active', true)
    .order('rating_average', { ascending: false })
    .limit(8);
  if (error) throw error;
  res.json({ success: true, turfs: (data || []).map(mapTurf) });
});

// @desc    Get cities with turf counts
// @route   GET /api/turfs/cities
exports.getCities = asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('turfs').select('city').eq('is_active', true);
  if (error) throw error;

  const cityMap = {};
  (data || []).forEach(({ city }) => {
    cityMap[city] = (cityMap[city] || 0) + 1;
  });
  const cities = Object.entries(cityMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({ success: true, cities });
});
