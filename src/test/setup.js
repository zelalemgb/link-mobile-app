process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const SafeAreaInsetsContext = React.createContext({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });
  const SafeAreaFrameContext = React.createContext({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  return {
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    SafeAreaProvider: ({ children }) =>
      React.createElement(
        SafeAreaFrameContext.Provider,
        { value: { x: 0, y: 0, width: 0, height: 0 } },
        React.createElement(
          SafeAreaInsetsContext.Provider,
          { value: { top: 0, bottom: 0, left: 0, right: 0 } },
          React.createElement(View, null, children)
        )
      ),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  };
});
