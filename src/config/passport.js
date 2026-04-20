import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
      callbackURL: "/api/auth/google/callback",
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;

        let user = await User.findOne({ googleId });
        if (user) {
          if (user.role !== "student") {
            return done(null, false, { message: "Google login is only available for students." });
          }
          return done(null, user);
        }

        user = await User.findOne({ email });
        if (user) {
          if (user.role !== "student") {
            return done(null, false, { message: "Google login is only available for students." });
          }
          user.googleId = googleId;
          await user.save();
          return done(null, user);
        }

        user = await User.create({
          name,
          email,
          googleId,
          authType: "google",
          role: "student", // Explicitly enforce student role
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;

