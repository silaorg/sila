import { setCookie, getCookie } from "@sila/client/utils/cookies";
import { apiRequest } from "@sila/client/utils/api";

// Cookie configuration
const COOKIE_OPTIONS = {
  secure: true,
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/'
};

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class AuthStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  public user: User | null = $state(null);
  public isAuthenticated = $state(false);

  getAccessToken(): string | null {
    return this.accessToken;
  }

  constructor() {
    // Load auth state from cookies on initialization
    this.loadFromStorage();
  }

  async setAuth(tokens: AuthTokens, user: User) {
    this.accessToken = tokens.access_token;
    // Only update refresh token if it's a new one (during initial auth)
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token;
    }
    this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    this.user = user;
    this.isAuthenticated = true;


    // Store tokens in cookies
    // Convert expires_in (seconds) to days for cookie expiration
    const accessTokenDays = Math.ceil(tokens.expires_in / (24 * 60 * 60));

    setCookie(document, "access_token", tokens.access_token, accessTokenDays);

    // Only update refresh token cookie if it's a new one
    if (tokens.refresh_token) {
      const refreshTokenDays = 30; // 30 days for refresh token
      setCookie(document, "refresh_token", tokens.refresh_token, refreshTokenDays);
    }

    // Store user info in localStorage for easy access
    localStorage.setItem("user", JSON.stringify(user));

  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.user = null;
    this.isAuthenticated = false;

    // Clear cookies by setting expiration to 0 days
    setCookie(document, "access_token", null, 0);
    setCookie(document, "refresh_token", null, 0);

    // Clear localStorage
    localStorage.removeItem("user");

  }

  private loadFromStorage() {
    try {
      // Load tokens from cookies
      const accessToken = getCookie(document, "access_token");
      const refreshToken = getCookie(document, "refresh_token");

      // Load user from localStorage
      const userJson = localStorage.getItem("user");

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson);

        // Validate access token is not expired
        const payload = this.parseJWT(accessToken);
        if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
          this.accessToken = accessToken;
          this.refreshToken = refreshToken;
          this.tokenExpiry = payload.exp * 1000;
          this.user = user;
          this.isAuthenticated = true;
        } else {
          // Access token expired, try to refresh
          this.refreshTokens();
        }
      }
    } catch (error) {
      console.error("Error loading auth from storage:", error);
      this.logout();
    }
  }

  public async refreshTokens(): Promise<void> {
    if (!this.refreshToken) {
      console.log('No refresh token available, logging out');
      this.logout();
      return;
    }

    try {
      console.log('Refreshing tokens...');
      const response = await apiRequest<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.success || !response.data) {
        // If refresh endpoint isn't available, just stop trying.
        if (response.status === 404) {
          console.warn("Token refresh endpoint not found; skipping refresh.");
          return;
        }
        // Only logout if we get a 401 response
        if (response.status === 401) {
          console.error('Token refresh failed with 401, logging out');
          this.logout();
        } else {
          console.error('Token refresh failed:', response.error);
          throw new Error(response.error || "Failed to refresh tokens");
        }
        return;
      }

      console.log('Tokens refreshed, getting user info...');
      // Get fresh user info
      const userResponse = await apiRequest<User>("/auth/me", {
        headers: {
          Authorization: `Bearer ${response.data.access_token}`,
        },
      });

      if (!userResponse.success || !userResponse.data) {
        // Only logout if we get a 401 response
        if (userResponse.status === 401) {
          console.error('Failed to get user info with 401, logging out');
          this.logout();
        } else {
          console.error('Failed to get user info after token refresh');
          throw new Error("Failed to get user info");
        }
        return;
      }

      console.log('User info retrieved, updating auth state...');
      // Update auth state with new tokens
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      this.user = userResponse.data;
      this.isAuthenticated = true;

      // Update access token cookie
      const accessTokenDays = Math.ceil(response.data.expires_in / (24 * 60 * 60));
      setCookie(document, "access_token", response.data.access_token, accessTokenDays);


      console.log('Token refresh completed successfully');
    } catch (error) {
      console.error("Failed to refresh tokens:", error);
      // Don't logout on network errors or other issues
      // Just throw the error to be handled by the caller
      throw error;
    }
  }

  public async checkAuth(): Promise<boolean> {
    if (!this.refreshToken) {
      this.isAuthenticated = false;
      return false;
    }

    try {
      if (this.accessToken && this.tokenExpiry) {
        const expiresSoon = this.tokenExpiry - Date.now() < 5 * 60 * 1000;
        if (!expiresSoon) {
          this.isAuthenticated = true;
          return true;
        }
      }

      await this.refreshTokens();
      this.isAuthenticated = true;
      return true;
    } catch (error) {
      // Just clear tokens and return false instead of throwing
      this.logout();
      return false;
    }
  }

  private parseJWT(token: string) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      return null;
    }
  }

  // Get the authorization header for API requests
  async getAuthHeader(): Promise<string | null> {
    if (!this.accessToken) return null;

    // Check if token is expired or about to expire (within 5 minutes)
    if (this.tokenExpiry && this.tokenExpiry - Date.now() < 5 * 60 * 1000) {
      console.log('Token about to expire, refreshing...');
      // Token is expired or about to expire, refresh it
      await this.refreshTokens();
    }

    return `Bearer ${this.accessToken}`;
  }
}
