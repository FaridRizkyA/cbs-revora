import { StyleSheet, Text, TextInput, View } from "react-native";

type SearchInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

export default function SearchInput({
  value,
  onChangeText,
  placeholder = "Cari data...",
}: SearchInputProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.icon}>Q</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#61708a"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 38,
    alignItems: "center",
    backgroundColor: "#eef3f9",
    borderRadius: 8,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  icon: { color: "#53657f", fontSize: 19, marginRight: 8 },
  input: { flex: 1, color: "#061329", fontSize: 15 },
});
