import { StyleSheet, View } from "react-native";

import AppButton from "../forms/AppButton";
import AppInput from "../forms/AppInput";

type ChangePasswordFormProps = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onChangeCurrentPassword: (value: string) => void;
  onChangeNewPassword: (value: string) => void;
  onChangeConfirmPassword: (value: string) => void;
  onSubmit: () => void;
};

export default function ChangePasswordForm({
  currentPassword,
  newPassword,
  confirmPassword,
  onChangeCurrentPassword,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onSubmit,
}: ChangePasswordFormProps) {
  return (
    <View style={styles.form}>
      <AppInput
        label="Password Saat Ini"
        value={currentPassword}
        onChangeText={onChangeCurrentPassword}
        secureTextEntry
      />
      <AppInput
        label="Password Baru"
        value={newPassword}
        onChangeText={onChangeNewPassword}
        secureTextEntry
      />
      <AppInput
        label="Konfirmasi Password"
        value={confirmPassword}
        onChangeText={onChangeConfirmPassword}
        secureTextEntry
      />
      <AppButton title="Ubah Password" onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
});
