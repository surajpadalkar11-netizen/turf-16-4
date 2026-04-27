const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Supervisor token – does NOT map to users table
    if (decoded.role === 'supervisor' && decoded.supervisorId) {
      const { data: supervisor } = await supabase
        .from('supervisors')
        .select('id, turf_id, name, email, is_active')
        .eq('id', decoded.supervisorId)
        .single();

      if (!supervisor || !supervisor.is_active) {
        return res.status(401).json({ success: false, message: 'Supervisor account not found or disabled' });
      }

      // Attach a minimal req.user so existing owner routes can still check
      req.user = {
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email,
        role: 'supervisor',
        _id: supervisor.id,
      };
      req.supervisor = supervisor; // available for supervisor-specific middleware
      return next();
    }

    // Normal user token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, avatar, favorites')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = { ...user, _id: user.id };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
};

// Block supervisors from write/mutate endpoints
const ownerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'supervisor') {
    return res.status(403).json({ success: false, message: 'Supervisor accounts have read-only access' });
  }
  next();
};

// Require supervisor token specifically
const supervisorProtect = (req, res, next) => {
  if (!req.supervisor) {
    return res.status(403).json({ success: false, message: 'Supervisor access required' });
  }
  next();
};

module.exports = { protect, adminOnly, ownerOnly, supervisorProtect };
