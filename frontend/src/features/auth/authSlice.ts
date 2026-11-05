import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getLoggedInUser, type AuthenticatedUser } from "../../services/auth";

type AuthState = {
  user: AuthenticatedUser | null;
};

// Restore the saved session when the application starts.
const initialState: AuthState = {
  user: getLoggedInUser(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Save the authenticated user in Redux.
    setAuthenticatedUser(state, action: PayloadAction<AuthenticatedUser>) {
      state.user = action.payload;
    },

    // Clear the authenticated user from Redux.
    clearAuthenticatedUser(state) {
      state.user = null;
    },
  },
});

export const { setAuthenticatedUser, clearAuthenticatedUser } =
  authSlice.actions;

export default authSlice.reducer;
