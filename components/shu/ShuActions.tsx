import { Pressable, Text, View } from "react-native";
import { styles } from "./styles";

type Props = {
  runningAction: string | null;
  isFinalized: boolean;
  onReload: () => void;
  onCalculate: () => void;
  onFinalize: () => void;
};

export function ShuActions({ runningAction, isFinalized, onReload, onCalculate, onFinalize }: Props) {
  return (
    <View style={styles.actionRow}>
      <Pressable style={[styles.button, styles.buttonGhost]} onPress={onReload} disabled={!!runningAction}>
        <Text style={styles.buttonGhostText}>Reload</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.buttonPrimary]} onPress={onCalculate} disabled={!!runningAction}>
        <Text style={styles.buttonPrimaryText}>{runningAction === "calculate" ? "Calculating..." : "Recalculate"}</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.buttonWarn, (isFinalized || !!runningAction) && styles.buttonDisabled]}
        onPress={onFinalize}
        disabled={isFinalized || !!runningAction}
      >
        <Text style={styles.buttonWarnText}>{runningAction === "finalize" ? "Finalizing..." : "Finalize"}</Text>
      </Pressable>
    </View>
  );
}
