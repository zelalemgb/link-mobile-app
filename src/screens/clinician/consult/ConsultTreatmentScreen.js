/**
 * ConsultTreatmentScreen — Step 5 of 6
 * Drug / dose / route / frequency / duration
 * Includes a quick-pick formulary for common Ethiopian PHC drugs.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useConsult } from '../../../context/ConsultContext';
import { colors } from '../../../theme/tokens';
import ConsultStepHeader from './ConsultStepHeader';

const TEAL = '#0f766e';

// ─── Quick-pick formulary ─────────────────────────────────────────────────────

const FORMULARY = [
  { drug: 'Amoxicillin',       dose: '500 mg',  route: 'oral', frequency: 'TID', duration: 7  },
  { drug: 'Artemether/Lumef.', dose: '80/480 mg', route: 'oral', frequency: 'BD', duration: 3  },
  { drug: 'Cotrimoxazole',     dose: '480 mg',  route: 'oral', frequency: 'BD',  duration: 5  },
  { drug: 'Metronidazole',     dose: '400 mg',  route: 'oral', frequency: 'TID', duration: 5  },
  { drug: 'Paracetamol',       dose: '1000 mg', route: 'oral', frequency: 'QID', duration: 3  },
  { drug: 'Ibuprofen',         dose: '400 mg',  route: 'oral', frequency: 'TID', duration: 3  },
  { drug: 'ORS',               dose: '1 sachet / 250 mL water', route: 'oral', frequency: 'After each loose stool', duration: 3 },
  { drug: 'Iron + Folic acid', dose: 'Fe 60mg / FA 400µg', route: 'oral', frequency: 'Daily', duration: 90 },
  { drug: 'Vitamin A',         dose: '200,000 IU', route: 'oral', frequency: 'Once', duration: 1 },
  { drug: 'Mebendazole',       dose: '500 mg',  route: 'oral', frequency: 'Once', duration: 1  },
  { drug: 'Salbutamol inhaler',dose: '100 µg × 2 puffs', route: 'inhaled', frequency: 'PRN',  duration: null },
  { drug: 'Nifedipine',        dose: '10 mg',   route: 'oral', frequency: 'TID', duration: 30 },
  { drug: 'Methyldopa',        dose: '250 mg',  route: 'oral', frequency: 'TID', duration: 30 },
  { drug: 'Magnesium sulfate', dose: '4 g IV loading', route: 'iv',   frequency: 'Once', duration: 1 },
  { drug: 'Oxytocin',          dose: '10 IU IM', route: 'im',   frequency: 'Once', duration: 1 },
];

const ROUTES = ['oral', 'im', 'iv', 'topical', 'inhaled', 'sublingual', 'other'];

// ─── Treatment row ────────────────────────────────────────────────────────────

function TxRow({ tx, onRemove, onChange }) {
  return (
    <View style={styles.txCard}>
      <View style={styles.txHeader}>
        <Text style={styles.txDrug}>{tx.drug_name}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Feather name="trash-2" size={14} color="#b91c1c" />
        </TouchableOpacity>
      </View>
      <View style={styles.txGrid}>
        <View style={styles.txField}>
          <Text style={styles.txLabel}>Dose</Text>
          <TextInput style={styles.txInput} value={tx.dose} onChangeText={(v) => onChange({ dose: v })} placeholder="e.g. 500 mg" placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.txField}>
          <Text style={styles.txLabel}>Frequency</Text>
          <TextInput style={styles.txInput} value={tx.frequency ?? ''} onChangeText={(v) => onChange({ frequency: v })} placeholder="TID / BD…" placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.txField}>
          <Text style={styles.txLabel}>Duration (days)</Text>
          <TextInput style={styles.txInput} value={tx.duration_days?.toString() ?? ''} onChangeText={(v) => onChange({ duration_days: v ? parseInt(v, 10) : null })} keyboardType="numeric" placeholder="7" placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.txField}>
          <Text style={styles.txLabel}>Qty dispensed</Text>
          <TextInput style={styles.txInput} value={tx.quantity?.toString() ?? ''} onChangeText={(v) => onChange({ quantity: v ? parseInt(v, 10) : null })} keyboardType="numeric" placeholder="21" placeholderTextColor={colors.muted} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {ROUTES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.routeChip, tx.route === r && styles.routeChipActive]}
            onPress={() => onChange({ route: r })}
          >
            <Text style={[styles.routeChipText, tx.route === r && styles.routeChipTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TextInput
        style={[styles.txInput, { marginTop: 8 }]}
        value={tx.instructions ?? ''}
        onChangeText={(v) => onChange({ instructions: v })}
        placeholder="Instructions (e.g. take with food)…"
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ConsultTreatmentScreen({ navigation }) {
  const { draft, setTreatments } = useConsult();
  const [treatments, setLocal]  = useState(
    draft.treatments.length > 0
      ? draft.treatments
      : []
  );
  const [showFormulary, setShowFormulary] = useState(false);
  const [customDrug, setCustomDrug]       = useState('');

  const addFromFormulary = (item) => {
    setLocal((prev) => [
      ...prev,
      {
        id: `${item.drug}_${Date.now()}`,
        drug_name:    item.drug,
        dose:         item.dose,
        route:        item.route,
        frequency:    item.frequency,
        duration_days: item.duration,
        quantity:     null,
        instructions: null,
      },
    ]);
    setShowFormulary(false);
  };

  const addCustom = () => {
    if (!customDrug.trim()) return;
    setLocal((prev) => [...prev, {
      id: `custom_${Date.now()}`,
      drug_name: customDrug.trim(),
      dose: '', route: 'oral', frequency: '', duration_days: null, quantity: null, instructions: null,
    }]);
    setCustomDrug('');
  };

  const removeTx = (id) => setLocal((prev) => prev.filter((t) => t.id !== id));
  const updateTx = (id, updates) =>
    setLocal((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

  const handleNext = () => {
    setTreatments(treatments);
    navigation.navigate('ReferralOutcome');
  };

  return (
    <View style={styles.container}>
      <ConsultStepHeader step={5} total={6} title="Treatment" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Active treatments */}
        {treatments.map((tx) => (
          <TxRow key={tx.id} tx={tx}
            onRemove={() => removeTx(tx.id)}
            onChange={(u) => updateTx(tx.id, u)}
          />
        ))}

        {/* Add via formulary */}
        {showFormulary ? (
          <View style={styles.formulary}>
            <Text style={styles.formularyTitle}>Quick-add from formulary</Text>
            {FORMULARY.map((item) => (
              <TouchableOpacity key={item.drug} style={styles.formularyItem} onPress={() => addFromFormulary(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formularyDrug}>{item.drug}</Text>
                  <Text style={styles.formularyDetail}>{item.dose} · {item.frequency}{item.duration ? ` × ${item.duration}d` : ''}</Text>
                </View>
                <Feather name="plus" size={16} color={TEAL} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.formularyClose} onPress={() => setShowFormulary(false)}>
              <Text style={styles.formularyCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.addRow}>
            <TouchableOpacity style={styles.formularyBtn} onPress={() => setShowFormulary(true)}>
              <Feather name="list" size={15} color={TEAL} />
              <Text style={styles.formularyBtnText}>From formulary</Text>
            </TouchableOpacity>
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customDrug}
                onChangeText={setCustomDrug}
                placeholder="Custom drug name…"
                placeholderTextColor={colors.muted}
                onSubmitEditing={addCustom}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.customAddBtn} onPress={addCustom}>
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => { setTreatments([]); navigation.navigate('ReferralOutcome'); }}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next: Outcome</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.background },
  scroll:              { padding: 12, paddingBottom: 20, gap: 10 },
  txCard:              { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 12, gap: 8 },
  txHeader:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txDrug:              { fontSize: 14, fontWeight: '700', color: colors.ink, flex: 1 },
  txGrid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  txField:             { width: '47%' },
  txLabel:             { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  txInput:             { backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 8, fontSize: 13, color: colors.ink },
  routeChip:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: '#f9fafb', marginRight: 6 },
  routeChipActive:     { backgroundColor: TEAL, borderColor: TEAL },
  routeChipText:       { fontSize: 11, fontWeight: '600', color: colors.muted },
  routeChipTextActive: { color: '#fff' },
  addRow:              { gap: 10 },
  formularyBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingVertical: 12 },
  formularyBtnText:    { color: TEAL, fontWeight: '700', fontSize: 14 },
  customRow:           { flexDirection: 'row', gap: 8 },
  customInput:         { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink },
  customAddBtn:        { width: 44, height: 44, borderRadius: 12, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  formulary:           { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  formularyTitle:      { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', padding: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  formularyItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  formularyDrug:       { fontSize: 13, fontWeight: '600', color: colors.ink },
  formularyDetail:     { fontSize: 11, color: colors.muted, marginTop: 1 },
  formularyClose:      { alignItems: 'center', paddingVertical: 12 },
  formularyCloseText:  { color: colors.muted, fontWeight: '600', fontSize: 13 },
  footer:              { flexDirection: 'row', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  skipBtn:             { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  skipBtnText:         { fontWeight: '600', color: colors.muted },
  nextBtn:             { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14 },
  nextBtnText:         { color: '#fff', fontWeight: '700', fontSize: 15 },
});
