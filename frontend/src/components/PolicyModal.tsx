import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPANY } from '../config/company';

const STORAGE_KEY = '@sanchari_policy_accepted';

interface Props {
  visible: boolean;
  onAccept: () => void;
}

export function PolicyModal({ visible, onAccept }: Props) {
  const [internalVisible, setInternalVisible] = useState(visible);

  useEffect(() => {
    setInternalVisible(visible);
  }, [visible]);

  async function accept() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setInternalVisible(false);
    onAccept();
  }

  return (
    <Modal visible={internalVisible} animationType="slide" transparent={true}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <ScrollView>
            <Text style={styles.title} accessibilityRole="header">Before you continue</Text>
            <Text style={styles.body}>
              Sanchari uses your phone number, location during rides and the details you share with drivers and
              riders to arrange trips and keep them safe. Please read how we handle this before you continue.
            </Text>
            <Pressable onPress={() => Linking.openURL(COMPANY.termsUrl)} accessibilityRole="link" style={styles.link}>
              <Text style={styles.linkText}>Read the Terms of Service</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(COMPANY.privacyUrl)} accessibilityRole="link" style={styles.link}>
              <Text style={styles.linkText}>Read the Privacy Policy</Text>
            </Pressable>
          </ScrollView>
          <Pressable onPress={accept} accessibilityRole="button" style={styles.acceptBtn}>
            <Text style={styles.acceptText}>I agree to the Terms and Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
    marginBottom: 8,
  },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, color: '#0B7A75', fontWeight: '600', textDecorationLine: 'underline' },
  acceptBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#0B7A75',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  acceptText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
