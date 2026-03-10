import React from "react";
import {
  DEFAULT_FEATURE_FLAGS,
  resolveInitialFeatureFlags,
} from "../lib/featureFlags";

const FeatureFlagsContext = React.createContext(DEFAULT_FEATURE_FLAGS);

export const FeatureFlagsProvider = ({ children }) => {
  const flags = React.useMemo(() => resolveInitialFeatureFlags(), []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => React.useContext(FeatureFlagsContext);

export const useFeatureFlag = (flag) => {
  const flags = useFeatureFlags();
  return flags[flag];
};

export default FeatureFlagsContext;
