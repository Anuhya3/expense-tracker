const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Apollo context factory.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the full user document to context.
 * Returns { user: null } if no token or invalid — resolvers decide what to block.
 */
async function buildContext({ req }) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { user: null };
    }

    const token = authHeader.slice(7); // strip "Bearer "
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user (so role/currency changes take effect immediately)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return { user: null };

    return { user };
  } catch {
    // Invalid/expired token — return null, let resolvers throw if needed
    return { user: null };
  }
}

module.exports = buildContext;
