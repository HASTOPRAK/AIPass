import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findUserByGoogleId, findUserByEmail, createGoogleUser } from "../db/users.js";

export function setupPassport() {
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((userId, done) => done(null, { id: userId }));

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || "User";

          if (!email) return done(new Error("Google account has no email"));

          // 1) already linked to google
          let user = await findUserByGoogleId(googleId);
          if (user) return done(null, user);

          // 2) existing email user
          const existingByEmail = await findUserByEmail(email);
          if (existingByEmail) {
            return done(null, existingByEmail);
          }

          // 3) create new user
          user = await createGoogleUser({ name, email, googleId, role: "INDIVIDUAL" });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  return passport;
}
