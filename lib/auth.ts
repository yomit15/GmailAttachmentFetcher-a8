import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { createClient } from "@supabase/supabase-js"

// Create a service role client for server-side operations
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/gmail.metadata https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        console.log("Initial sign in - storing tokens:", {
          email: user.email,
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          expiresAt: account.expires_at,
        })

        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        token.email = user.email

        // Store tokens in Supabase using service role
        if (user.email && account.access_token) {
          try {
            const expiresAt = account.expires_at
              ? new Date(account.expires_at * 1000).toISOString()
              : new Date(Date.now() + 3600 * 1000).toISOString()

            const { data, error } = await supabaseAdmin.from("users").upsert(
              {
                email: user.email,
                access_token: account.access_token,
                refresh_token: account.refresh_token || null,
                token_expires_at: expiresAt,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "email",
              },
            )

            if (error) {
              console.error("Error storing tokens in Supabase:", error)
            } else {
              console.log("Successfully stored tokens in Supabase")
            }
          } catch (error) {
            console.error("Exception storing tokens:", error)
          }
        }
      }

      // Return previous token if the access token has not expired yet
      if (token.expiresAt && Math.floor(Date.now() / 1000) < (token.expiresAt as number)) {
        return token
      }

      // Access token has expired, try to update it
      if (token.refreshToken) {
        console.log("Token expired, attempting refresh...")
        return await refreshAccessToken(token)
      }

      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.error = token.error as string

      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
}

async function refreshAccessToken(token: any) {
  try {
    console.log("Refreshing access token...")

    const response = await fetch("https://oauth2.googleapis.com/token", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error("Token refresh failed:", refreshedTokens)
      throw refreshedTokens
    }

    const newExpiresAt = Math.floor(Date.now() / 1000) + refreshedTokens.expires_in

    // Update tokens in Supabase
    if (token.email) {
      try {
        const { error } = await supabaseAdmin
          .from("users")
          .update({
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token || token.refreshToken,
            token_expires_at: new Date(newExpiresAt * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("email", token.email)

        if (error) {
          console.error("Error updating tokens in Supabase:", error)
        } else {
          console.log("Successfully updated tokens in Supabase")
        }
      } catch (error) {
        console.error("Exception updating tokens:", error)
      }
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: newExpiresAt,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      email: token.email
    }
  } catch (error) {
    console.error("Error refreshing access token:", error)

    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}
