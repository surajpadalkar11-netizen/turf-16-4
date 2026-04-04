const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/helpers');

const mapReview = (r) => ({
  _id: r.id,
  id: r.id,
  user: r.user ? { _id: r.user.id || r.user_id, name: r.user.name, avatar: r.user.avatar } : r.user_id,
  turf: r.turf ? { _id: r.turf.id || r.turf_id, name: r.turf.name } : r.turf_id,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const recalcRating = async (turfId) => {
  await supabase.rpc('recalculate_turf_rating', { p_turf_id: turfId });
};

// @desc    Get current user's reviews
// @route   GET /api/reviews/my
exports.getMyReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const { data, error, count } = await supabase
    .from('reviews')
    .select('*, turf:turf_id(id, name, images, street, city)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(skip, skip + Number(limit) - 1);

  if (error) throw error;

  res.json({
    success: true,
    reviews: (data || []).map(mapReview),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / Number(limit)),
  });
});

// @desc    Get reviews for a turf
// @route   GET /api/reviews/turf/:turfId
exports.getTurfReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const { data, error, count } = await supabase
    .from('reviews')
    .select('*, user:user_id(id, name, avatar)', { count: 'exact' })
    .eq('turf_id', req.params.turfId)
    .order('created_at', { ascending: false })
    .range(skip, skip + Number(limit) - 1);

  if (error) throw error;

  res.json({
    success: true,
    reviews: (data || []).map(mapReview),
    total: count || 0,
    totalPages: Math.ceil((count || 0) / Number(limit)),
  });
});

// @desc    Create a review
// @route   POST /api/reviews
exports.createReview = asyncHandler(async (req, res) => {
  const { turfId, rating, comment } = req.body;

  // Check if user has booked this turf
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('turf_id', turfId)
    .in('status', ['confirmed', 'completed', 'playing'])
    .limit(1)
    .single();

  if (!booking) {
    return res.status(400).json({
      success: false,
      message: 'You can only review turfs you have booked',
    });
  }

  // Check for existing review
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('turf_id', turfId)
    .single();

  if (existing) {
    return res.status(400).json({ success: false, message: 'You have already reviewed this turf' });
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({ user_id: req.user.id, turf_id: turfId, rating, comment })
    .select('*, user:user_id(id, name, avatar)')
    .single();

  if (error) throw error;

  await recalcRating(turfId);

  res.status(201).json({ success: true, review: mapReview(review) });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
exports.deleteReview = asyncHandler(async (req, res) => {
  const { data: review, error } = await supabase.from('reviews').select('id, user_id, turf_id').eq('id', req.params.id).single();
  if (error || !review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  if (review.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const turfId = review.turf_id;
  await supabase.from('reviews').delete().eq('id', req.params.id);
  await recalcRating(turfId);

  res.json({ success: true, message: 'Review deleted' });
});

// @desc    Serve the standalone interactive review page
// @route   GET /api/reviews/review-form
exports.reviewForm = asyncHandler(async (req, res) => {
  const { bookingId, userId, turfId } = req.query;

  if (!bookingId || !userId || !turfId) {
    return res.status(400).send('<h2>Invalid link.</h2>');
  }

  // Fetch turf name for display
  const { data: turf } = await supabase.from('turfs').select('name').eq('id', turfId).single();
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Rate Your Experience — turf11</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          padding: 20px;
        }
        .card {
          background: #fff;
          border-radius: 20px;
          padding: 40px 36px;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 8px 40px rgba(0,0,0,0.08);
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .logo { color: #059669; font-size: 28px; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.5px; }
        .turf-name { color: #0f172a; font-size: 20px; font-weight: 700; margin-bottom: 6px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }

        /* Stars */
        .stars-row {
          display: flex;
          flex-direction: row-reverse;
          justify-content: center;
          gap: 4px;
          margin-bottom: 8px;
        }
        .stars-row input { display: none; }
        .stars-row label {
          font-size: 48px;
          color: #e2e8f0;
          cursor: pointer;
          transition: color 0.15s, transform 0.1s;
          line-height: 1;
        }
        .stars-row label:hover,
        .stars-row label:hover ~ label,
        .stars-row input:checked ~ label {
          color: #f59e0b;
        }
        .stars-row label:active { transform: scale(1.2); }
        
        .rating-label {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 20px;
          font-weight: 500;
          min-height: 20px;
        }

        textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 20px;
          transition: border 0.2s;
          outline: none;
          color: #0f172a;
          background: #f8fafc;
        }
        textarea:focus { border-color: #059669; background: #fff; }
        textarea::placeholder { color: #94a3b8; }

        .btn {
          width: 100%;
          background: #059669;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
        }
        .btn:hover { background: #047857; }
        .btn:active { transform: scale(0.98); }
        .btn:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; }

        .success-view { display: none; }
        .success-view h2 { color: #059669; font-size: 28px; margin-bottom: 12px; }
        .success-view p { color: #475569; font-size: 15px; line-height: 1.5; }
        .checkmark { font-size: 64px; margin-bottom: 16px; }
        .error-msg { color: #ef4444; font-size: 13px; margin-bottom: 12px; display: none; background: #fef2f2; padding: 8px 12px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div id="form-view">
          <div class="logo">turf11 ⚽</div>
          <div class="turf-name">${turf?.name || 'Your Turf Session'}</div>
          <div class="subtitle">How was your experience? Your feedback helps other players!</div>

          <div class="stars-row">
            <input type="radio" id="s5" name="rating" value="5">
            <label for="s5" title="Excellent">★</label>
            <input type="radio" id="s4" name="rating" value="4">
            <label for="s4" title="Good">★</label>
            <input type="radio" id="s3" name="rating" value="3">
            <label for="s3" title="Average">★</label>
            <input type="radio" id="s2" name="rating" value="2">
            <label for="s2" title="Poor">★</label>
            <input type="radio" id="s1" name="rating" value="1">
            <label for="s1" title="Terrible">★</label>
          </div>
          <div class="rating-label" id="rating-label">Select a star rating</div>

          <textarea id="comment" rows="3" placeholder="Write about your experience (optional)..."></textarea>
          <div class="error-msg" id="error-msg">Please select a star rating before submitting.</div>

          <button type="button" class="btn" id="submit-btn" onclick="submitReview(event); return false;">Submit Review</button>
        </div>

        <div class="success-view" id="success-view">
          <div class="checkmark">✅</div>
          <h2>Thank You!</h2>
          <p>Your review has been submitted and will appear on the turf page shortly.</p>
          <p style="margin-top:12px; color:#94a3b8; font-size:13px;">You can close this tab.</p>
        </div>
      </div>

      <script>
        // Rating labels
        const labels = { 1: 'Terrible', 2: 'Poor', 3: 'Average', 4: 'Good', 5: 'Excellent' };
        document.querySelectorAll('.stars-row input').forEach(input => {
          input.addEventListener('change', () => {
            document.getElementById('rating-label').textContent = labels[input.value] || '';
          });
        });

        async function submitReview(event) {
          if (event) event.preventDefault();

          const ratingEl = document.querySelector('input[name="rating"]:checked');
          const errorEl = document.getElementById('error-msg');

          if (!ratingEl) {
            errorEl.style.display = 'block';
            return false;
          }
          errorEl.style.display = 'none';

          const btn = document.getElementById('submit-btn');
          btn.textContent = 'Submitting...';
          btn.disabled = true;

          const params = new URLSearchParams({
            bookingId: '${bookingId}',
            userId: '${userId}',
            turfId: '${turfId}',
            rating: ratingEl.value,
            comment: document.getElementById('comment').value
          });

          try {
            const response = await fetch('${apiUrl}/api/reviews/quick?' + params.toString(), {
              method: 'GET'
            });

            if (response.ok) {
              document.getElementById('form-view').style.display = 'none';
              document.getElementById('success-view').style.display = 'block';
            } else {
              throw new Error('Submission failed');
            }
          } catch(e) {
            btn.textContent = 'Submit Review';
            btn.disabled = false;
            errorEl.textContent = 'Something went wrong. Please try again.';
            errorEl.style.display = 'block';
          }

          return false;
        }
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// @desc    Quick review from email
// @route   GET /api/reviews/quick
exports.quickReview = asyncHandler(async (req, res) => {
  const { bookingId, userId, turfId, rating, comment } = req.query;

  console.log('📧 Quick Review Request:', { bookingId, userId, turfId, rating, comment });

  const renderHTML = (title, message, isError = false) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>turf11 Feedback</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="background-color: #f1f5f9; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
        <div style="background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; border: 1px solid #e2e8f0;">
          <h1 style="color: ${isError ? '#ef4444' : '#059669'}; margin-top: 0; font-size: 56px; line-height: 1; margin-bottom: 16px;">
            ${isError ? '😕' : '✅'}
          </h1>
          <h2 style="color: #0f172a; margin-bottom: 12px; font-size: 24px;">${title}</h2>
          <p style="color: #475569; margin-bottom: 24px; font-size: 15px; line-height: 1.5;">${message}</p>
          <p style="color: #94a3b8; font-size: 13px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">You can safely close this tab.</p>
        </div>
      </body>
    </html>
  `;

  if (!bookingId || !userId || !turfId || !rating) {
    console.error('❌ Missing required parameters');
    return res.status(400).send(renderHTML('Invalid Request', 'Required information is missing.', true));
  }

  // Verify booking exists and belongs to user
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .eq('turf_id', turfId)
    .in('status', ['confirmed', 'completed', 'playing'])
    .single();

  if (bookingError || !booking) {
    console.error('❌ Booking verification failed:', bookingError);
    return res.status(400).send(renderHTML('Booking Not Found', 'We could not verify your booking to leave a review.', true));
  }

  console.log('✅ Booking verified:', booking.id);

  // Check for existing review
  const { data: existing } = await supabase
    .from('reviews')
    .select('id, comment, rating')
    .eq('user_id', userId)
    .eq('turf_id', turfId)
    .single();

  const ratingValue = Number(rating);
  const commentText = comment && comment.trim() !== '' ? comment.trim() : `Rated ${ratingValue} star${ratingValue !== 1 ? 's' : ''}`;

  if (existing) {
    console.log('📝 Updating existing review:', existing.id);
    // Update existing review
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        rating: ratingValue,
        comment: commentText,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('❌ Review update error:', updateError);
      return res.status(500).send(renderHTML('Update Failed', 'Something went wrong. Please try again later.', true));
    }

    console.log('✅ Review updated successfully');
    await recalcRating(turfId);
    return res.send(renderHTML('Review Updated!', 'Your rating has been updated successfully. Thank you for your feedback!'));
  } else {
    console.log('➕ Creating new review');
    // Insert new review
    const { data: newReview, error: insertError } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        turf_id: turfId,
        rating: ratingValue,
        comment: commentText
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Review insert error:', insertError);
      return res.status(500).send(renderHTML('Submission Failed', 'Something went wrong. Please try again later.', true));
    }

    console.log('✅ Review created successfully:', newReview.id);
    await recalcRating(turfId);
  }

  res.send(renderHTML('Review Submitted!', 'Thank you for your feedback! Your rating is now live on the turf page.'));
});

