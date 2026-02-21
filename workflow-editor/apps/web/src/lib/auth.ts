import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from 'pg';

// Auth still uses PostgreSQL — better-auth requires a SQL database.
// This is separate from the app data which has moved to Convex.
const authPool = new Pool(
  process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL
    ? {
        connectionString: process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        database: process.env.DATABASE_NAME || 'blockd3',
        user: process.env.DATABASE_USER || 'blockd3',
        password: process.env.DATABASE_PASSWORD || 'blockd3_dev_password',
        max: 5,
      }
);

export const auth = betterAuth({
  database: authPool,

  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: (profile) => ({
        image: profile.picture,
      }),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      mapProfileToUser: (profile) => ({
        image: profile.avatar_url,
      }),
    },
  },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          const accountResult = await authPool.query(
            `SELECT a."accessToken", a."providerId" FROM account a WHERE a."userId" = $1`,
            [session.userId]
          );

          if (accountResult.rows.length > 0) {
            const account = accountResult.rows[0];
            let imageUrl: string | null = null;

            if (account.providerId === 'google' && account.accessToken) {
              try {
                const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                  headers: { Authorization: `Bearer ${account.accessToken}` },
                });
                if (res.ok) {
                  const profile = await res.json();
                  imageUrl = profile.picture;
                }
              } catch (e) {
                console.error('Failed to fetch Google profile:', e);
              }
            } else if (account.providerId === 'github' && account.accessToken) {
              try {
                const res = await fetch('https://api.github.com/user', {
                  headers: { Authorization: `Bearer ${account.accessToken}` },
                });
                if (res.ok) {
                  const profile = await res.json();
                  imageUrl = profile.avatar_url;
                }
              } catch (e) {
                console.error('Failed to fetch GitHub profile:', e);
              }
            }

            if (imageUrl) {
              await authPool.query(
                `UPDATE "user" SET image = $1, "updatedAt" = NOW() WHERE id = $2`,
                [imageUrl, session.userId]
              );
            }
          }
        },
      },
    },
  },

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
