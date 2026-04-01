import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useVehicleConfig } from '@/hooks/use-vehicle-config';

export default function FuelConfigurationScreen() {
  const router = useRouter();
  const { fuelEconomy, gallonsNeeded, saveConfig } = useVehicleConfig();
  const [gallonsInput, setGallonsInput] = useState(gallonsNeeded?.toString() ?? '');
  const [mpgInput, setMpgInput] = useState(fuelEconomy?.toString() ?? '');
  const [errorMessage, setErrorMessage] = useState('');

  const isComplete = useMemo(() => {
    const parsedGallons = Number(gallonsInput);
    const parsedMpg = Number(mpgInput);

    return (
      Number.isFinite(parsedGallons) &&
      parsedGallons > 0 &&
      Number.isFinite(parsedMpg) &&
      parsedMpg > 0
    );
  }, [gallonsInput, mpgInput]);

  const handleContinue = () => {
    const parsedGallons = Number(gallonsInput);
    const parsedMpg = Number(mpgInput);

    if (!Number.isFinite(parsedGallons) || parsedGallons <= 0) {
      setErrorMessage('Enter a valid fuel volume in gallons.');
      return;
    }

    if (!Number.isFinite(parsedMpg) || parsedMpg <= 0) {
      setErrorMessage('Enter a valid fuel efficiency in MPG.');
      return;
    }

    saveConfig({ gallonsNeeded: parsedGallons, fuelEconomy: parsedMpg });
    setErrorMessage('');
    router.replace('/location-access');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.brand}>Fuel Finder</Text>
            <Pressable
              onPress={() =>
                setErrorMessage(
                  'Enter your estimated refill amount and your vehicle MPG to personalize results.',
                )
              }
              style={styles.helpButton}>
              <Ionicons name="help-circle-outline" size={20} color="#adadad" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>
                Optimize Your{'\n'}
                <Text style={styles.heroAccent}>Journey</Text>
              </Text>
              <Text style={styles.heroBody}>
                Let&apos;s configure your vehicle data to find the most cost-effective stations on
                your route.
              </Text>
            </View>

            <View style={styles.grid}>
              <InputCard
                icon={
                  <MaterialCommunityIcons name="gas-station-outline" size={20} color="#ff9f4a" />
                }
                label="Fuel Volume"
                onChangeText={setGallonsInput}
                placeholder="00.0"
                prompt="HOW MUCH GAS DO YOU NEED?"
                suffix="GAL"
                value={gallonsInput}
              />
              <InputCard
                icon={<MaterialCommunityIcons name="speedometer" size={20} color="#ff9f4a" />}
                label="Efficiency"
                onChangeText={setMpgInput}
                placeholder="24.5"
                prompt="WHAT IS YOUR CAR'S MPG?"
                suffix="MPG"
                value={mpgInput}
              />
            </View>

            {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable
              onPress={handleContinue}
              style={[styles.continueButton, !isComplete && styles.continueButtonDisabled]}>
              <Text style={styles.continueLabel}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#442100" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type InputCardProps = {
  icon: ReactNode;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  prompt: string;
  suffix: string;
  value: string;
};

function InputCard({
  icon,
  label,
  onChangeText,
  placeholder,
  prompt,
  suffix,
  value,
}: InputCardProps) {
  return (
    <View style={styles.inputCard}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBadge}>{icon}</View>
        <Text style={styles.cardTitle}>{label}</Text>
      </View>

      <Text style={styles.cardPrompt}>{prompt}</Text>

      <View style={styles.inputRow}>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#4a4a4a"
          selectionColor="#ff9f4a"
          style={styles.input}
          value={value}
        />
        <Text style={styles.inputSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e0e0e',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#0e0e0e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  brand: {
    color: '#ff9f4a',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 214,
    gap: 24,
  },
  heroSection: {
    gap: 12,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  heroAccent: {
    color: '#ff9f4a',
  },
  heroBody: {
    color: '#adadad',
    fontSize: 16,
    lineHeight: 26,
  },
  grid: {
    gap: 24,
  },
  inputCard: {
    backgroundColor: '#131313',
    borderRadius: 12,
    padding: 24,
    gap: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
  },
  cardPrompt: {
    color: '#adadad',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 20,
    color: '#ffffff',
    backgroundColor: '#2c2c2c',
    fontSize: 30,
    lineHeight: 41,
    fontWeight: '700',
  },
  inputSuffix: {
    color: '#ff9f4a',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    paddingBottom: 12,
  },
  errorText: {
    color: '#ff7b7b',
    fontSize: 14,
    lineHeight: 20,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(38,38,38,0.4)',
  },
  continueButton: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ff9f4a',
    shadowColor: '#ff9f4a',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  continueButtonDisabled: {
    opacity: 0.72,
  },
  continueLabel: {
    color: '#442100',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
  },
});
