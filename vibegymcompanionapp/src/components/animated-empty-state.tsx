import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';

type AnimatedEmptyStateProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function AnimatedEmptyState({
  children,
  style,
}: AnimatedEmptyStateProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(280)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
