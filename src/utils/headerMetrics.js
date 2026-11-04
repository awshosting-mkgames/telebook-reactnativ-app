import { useSafeAreaInsets } from 'react-native-safe-area-context';

// App ke har top header ka standard size: status bar (safe-area top inset) + 60 ka main header.
// Gradient/background poore (status bar + 60) par lagta hai, content sirf 60 wale hisse me rehta hai.
export const HEADER_BODY = 60;

export const useHeaderMetrics = () => {
    const { top } = useSafeAreaInsets();
    return { top, height: top + HEADER_BODY, body: HEADER_BODY };
};
