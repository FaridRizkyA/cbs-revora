import { Image, ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ProductCardProps = {
  name: string;
  price: string;
  stock: string | number;
  imageSource: ImageSource;
  disabled?: boolean;
  onPress?: () => void;
};

export default function ProductCard({
  name,
  price,
  stock,
  imageSource,
  disabled,
  onPress,
}: ProductCardProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.imageWrap}>
        <Image source={imageSource} style={styles.image} contentFit="contain" />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.price}>{price}</Text>
      <Text style={styles.stock}>Stok: {stock}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 216,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  pressed: { borderColor: "#2563eb", backgroundColor: "#f7fbff" },
  disabled: { opacity: 0.55 },
  imageWrap: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: "#eef3f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  image: { width: 60, height: 60 },
  name: {
    color: "#061329",
    fontSize: 17,
    fontWeight: "800",
    minHeight: 46,
    textAlign: "center",
  },
  price: {
    color: "#1f5cff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
  },
  stock: { color: "#52617a", fontSize: 13, marginTop: 10 },
});
