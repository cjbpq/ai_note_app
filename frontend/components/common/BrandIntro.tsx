import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const MIN_VISIBLE_MS = 1200;

interface BrandIntroProps {
  ready: boolean;
}

export function BrandIntro({ ready }: BrandIntroProps) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(Date.now()).current;

  useEffect(() => {
    if (!ready) return;

    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, remaining);

    return () => clearTimeout(timer);
  }, [opacity, ready, startedAt]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.container, { opacity }]}
    >
      <View style={styles.logoShell}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
      <Text style={styles.name}>SnapNote</Text>
      <Text style={styles.headline}>从拍照记录到知识复盘</Text>
      <Text style={styles.subtitle}>您的智能学习伙伴</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#F6FFFC",
  },
  logoShell: {
    width: 124,
    height: 124,
    borderRadius: 32,
    overflow: "hidden",
    marginBottom: 22,
    backgroundColor: "#F6FFFC",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: "#0C1F44",
    marginBottom: 14,
  },
  headline: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
    color: "#4965D8",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "#607089",
    textAlign: "center",
  },
});
