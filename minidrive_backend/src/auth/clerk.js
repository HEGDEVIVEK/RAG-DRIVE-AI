const { clerkMiddleware, requireAuth } = require("@clerk/express");

const clerkMw = clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
});

module.exports = { clerkMw, requireAuth };