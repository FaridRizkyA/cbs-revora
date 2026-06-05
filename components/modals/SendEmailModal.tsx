import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ResponsiveModal from "../common/ResponsiveModal";
import FilterSelectField from "../inventory/FilterSelectField";
import { API_BASE_URL } from "../../utils/api";

type UserOption = {
  id_user: string;
  email: string;
  full_name: string;
};

type SendEmailModalProps = {
  visible: boolean;
  onClose: () => void;
  onSend: (email: string, message: string, fullName: string) => Promise<void>;
  reportTitle: string;
};

export default function SendEmailModal({ visible, onClose, onSend, reportTitle }: SendEmailModalProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const defaultMessage = `Hello, here is the attachment regarding the ${reportTitle}.`;

  useEffect(() => {
    if (visible) {
      fetchUsers();
      setMessage("");
    }
  }, [visible, reportTitle]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/staffs`);
      const payload = await response.json();
      if (response.ok) {
        const data = Array.isArray(payload.data) ? payload.data : [];
        // Extract unique emails from staff list
        const staffEmails = data
          .filter((s: any) => s.email && s.is_active === 'Y')
          .map((s: any) => ({
            id_user: s.id_user,
            email: s.email,
            full_name: s.full_name || s.staff_name
          }));
        setUsers(staffEmails);
      }
    } catch (err) {
      console.error("Failed to fetch staffs for email:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSend = async () => {
    if (!selectedEmail) return;
    const selectedUser = users.find(u => u.email === selectedEmail);
    const fullName = selectedUser ? selectedUser.full_name : "";
    const finalMessage = message.trim() || defaultMessage;

    setSending(true);
    try {
      await onSend(selectedEmail, finalMessage, fullName);
      onClose();
      setSelectedEmail("");
      setMessage("");
    } catch {
      // Error handled by parent
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      maxWidthDesktop={480}
      cardStyle={styles.modalCard}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons name="email-fast-outline" size={28} color="#1d4ed8" />
        <Text style={styles.title}>Send via Email</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Recipient</Text>
        {loadingUsers ? (
          <ActivityIndicator size="small" color="#1d4ed8" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />
        ) : (
          <FilterSelectField
            label="Select recipient"
            value={selectedEmail}
            options={users.map(u => ({ label: `${u.full_name} (${u.email})`, value: u.email }))}
            onChange={setSelectedEmail}
          />
        )}

        <Text style={[styles.label, { marginTop: 12 }]}>Message (Optional)</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          value={message}
          onChangeText={setMessage}
          placeholder={defaultMessage}
          placeholderTextColor="#94a3b8"
        />
        
        <View style={styles.infoBox}>
          <Feather name="info" size={14} color="#1e40af" />
          <Text style={styles.infoText}>The report will be attached automatically as a {reportTitle.includes('Detail') ? 'PDF' : 'file'}.</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={onClose} disabled={sending}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable 
          style={[styles.sendBtn, (!selectedEmail || sending) && styles.sendBtnDisabled]} 
          onPress={handleSend}
          disabled={!selectedEmail || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send Report</Text>}
        </Pressable>
      </View>
    </ResponsiveModal>
  );
}

const styles = StyleSheet.create({
  modalCard: {
    padding: 20,
    gap: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  body: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569' },
  textArea: {
    minHeight: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    color: '#0f172a',
    fontSize: 14,
  },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', padding: 10, borderRadius: 8, marginTop: 8 },
  infoText: { fontSize: 12, color: '#1e40af', flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },
  sendBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1d4ed8', minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
