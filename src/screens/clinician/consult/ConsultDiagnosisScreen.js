/**
 * ConsultDiagnosisScreen — Step 4 of 6
 * ICD-lite local list + free-text search + type / certainty selectors
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useConsult } from '../../../context/ConsultContext';
import { colors } from '../../../theme/tokens';
import ConsultStepHeader from './ConsultStepHeader';

const TEAL = '#0f766e';

// ─── ICD-lite: top conditions for Ethiopian primary care ─────────────────────

const ICD_LIST = [
  // Infectious / communicable
  { code: 'A09',  name: 'Acute diarrhoea',              category: 'Infectious' },
  { code: 'A15',  name: 'Pulmonary tuberculosis',        category: 'Infectious' },
  { code: 'A90',  name: 'Dengue fever',                  category: 'Infectious' },
  { code: 'B50',  name: 'Malaria (P. falciparum)',       category: 'Infectious' },
  { code: 'B54',  name: 'Malaria (unspecified)',         category: 'Infectious' },
  { code: 'J06',  name: 'Upper respiratory tract infection', category: 'Respiratory' },
  { code: 'J18',  name: 'Pneumonia',                    category: 'Respiratory' },
  { code: 'J45',  name: 'Asthma',                       category: 'Respiratory' },
  // Maternal
  { code: 'O14',  name: 'Gestational hypertension / pre-eclampsia', category: 'Maternal' },
  { code: 'O20',  name: 'Antepartum haemorrhage',       category: 'Maternal' },
  { code: 'O36',  name: 'Maternal care — foetal problem', category: 'Maternal' },
  { code: 'O80',  name: 'Normal delivery',               category: 'Maternal' },
  // Paediatric / nutrition
  { code: 'E40',  name: 'Kwashiorkor',                  category: 'Nutrition' },
  { code: 'E41',  name: 'Nutritional marasmus',         category: 'Nutrition' },
  { code: 'E46',  name: 'Protein-energy malnutrition',  category: 'Nutrition' },
  { code: 'P07',  name: 'Low birthweight / prematurity', category: 'Paediatric' },
  // Cardiovascular
  { code: 'I10',  name: 'Essential hypertension',       category: 'Cardiovascular' },
  { code: 'I50',  name: 'Heart failure',                category: 'Cardiovascular' },
  // Metabolic
  { code: 'E11',  name: 'Type 2 diabetes mellitus',    category: 'Metabolic' },
  { code: 'E03',  name: 'Hypothyroidism',               category: 'Metabolic' },
  // Mental health
  { code: 'F20',  name: 'Schizophrenia',                category: 'Mental health' },
  { code: 'F32',  name: 'Depressive episode',           category: 'Mental health' },
  { code: 'F41',  name: 'Anxiety disorder',             category: 'Mental health' },
  // Skin
  { code: 'L30',  name: 'Dermatitis',                   category: 'Skin' },
  { code: 'B35',  name: 'Tinea (fungal skin infection)', category: 'Skin' },
  // Other
  { code: 'R50',  name: 'Fever of unknown origin',      category: 'Other' },
  { code: 'R51',  name: 'Headache',                     category: 'Other' },
  { code: 'R10',  name: 'Abdominal pain',               category: 'Other' },
  { code: 'S09',  name: 'Injury — head / unspecified',  category: 'Other' },
  { code: 'Z00',  name: 'General health check',         category: 'Other' },
];

const DX_TYPES = ['primary', 'secondary', 'complication', 'differential'];
const CERTAINTIES = ['confirmed', 'suspected', 'ruled_out'];

// ─── Diagnosis chip ───────────────────────────────────────────────────────────

function DxChip({ dx, onRemove, onUpdate }) {
  return (
    <View style={styles.dxChip}>
      <View style={styles.dxChipMain}>
        <Text style={styles.dxCode}>{dx.icd_code}</Text>
        <Text style={styles.dxName} numberOfLines={1}>{dx.display_name}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={14} color={colors.muted} />
        </TouchableOpacity>
      </View>
      <View style={styles.dxChipMeta}>
        {DX_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.metaChip, dx.diagnosis_type === t && styles.metaChipActive]}
            onPress={() => onUpdate({ diagnosis_type: t })}
          >
            <Text style={[styles.metaChipText, dx.diagnosis_type === t && styles.metaChipTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dxChipMeta}>
        {CERTAINTIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.metaChip, dx.certainty === c && styles.metaChipCert]}
            onPress={() => onUpdate({ certainty: c })}
          >
            <Text style={[styles.metaChipText, dx.certainty === c && styles.metaChipTextActive]}>
              {c.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ConsultDiagnosisScreen({ navigation }) {
  const { draft, setDiagnoses } = useConsult();
  const [selected, setSelected] = useState(draft.diagnoses ?? []);
  const [query,    setQuery]    = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ICD_LIST;
    return ICD_LIST.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
    );
  }, [query]);

  const addDx = (item) => {
    if (selected.find((d) => d.icd_code === item.code)) return;
    setSelected((prev) => [
      ...prev,
      {
        id: `${item.code}_${Date.now()}`,
        icd_code: item.code,
        display_name: item.name,
        diagnosis_type: prev.length === 0 ? 'primary' : 'secondary',
        certainty: 'confirmed',
      },
    ]);
    setQuery('');
  };

  const removeDx = (id) => setSelected((prev) => prev.filter((d) => d.id !== id));

  const updateDx = (id, updates) =>
    setSelected((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));

  const handleNext = () => {
    setDiagnoses(selected);
    navigation.navigate('Treatment');
  };

  return (
    <View style={styles.container}>
      <ConsultStepHeader step={4} total={6} title="Diagnosis" />

      {/* Selected diagnoses */}
      {selected.length > 0 && (
        <ScrollView style={styles.selectedWrap} contentContainerStyle={{ gap: 8, padding: 12 }}>
          {selected.map((dx) => (
            <DxChip
              key={dx.id} dx={dx}
              onRemove={() => removeDx(dx.id)}
              onUpdate={(u) => updateDx(dx.id, u)}
            />
          ))}
        </ScrollView>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search diagnosis or ICD code…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Feather name="x" size={15} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestion list */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const already = selected.some((d) => d.icd_code === item.code);
          return (
            <TouchableOpacity
              style={[styles.listItem, already && styles.listItemAdded]}
              onPress={() => addDx(item)}
              activeOpacity={0.7}
            >
              <View style={styles.listItemLeft}>
                <Text style={styles.listCode}>{item.code}</Text>
                <Text style={styles.listCategory}>{item.category}</Text>
              </View>
              <Text style={styles.listName}>{item.name}</Text>
              {already
                ? <Feather name="check-circle" size={16} color={TEAL} />
                : <Feather name="plus-circle" size={16} color={colors.muted} />}
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => { setDiagnoses([]); navigation.navigate('Treatment'); }}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next: Treatment</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: colors.background },
  selectedWrap:       { maxHeight: 220, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#f0fdf4' },
  dxChip:             { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#6ee7b7', padding: 10, gap: 6 },
  dxChipMain:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dxCode:             { fontSize: 11, fontWeight: '700', color: TEAL, width: 38 },
  dxName:             { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink },
  dxChipMeta:         { flexDirection: 'row', gap: 6 },
  metaChip:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: '#f9fafb' },
  metaChipActive:     { backgroundColor: TEAL, borderColor: TEAL },
  metaChipCert:       { backgroundColor: '#4d2c91', borderColor: '#4d2c91' },
  metaChipText:       { fontSize: 10, fontWeight: '600', color: colors.muted },
  metaChipTextActive: { color: '#fff' },
  searchWrap:         { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput:        { flex: 1, fontSize: 14, color: colors.ink },
  list:               { paddingHorizontal: 12, paddingBottom: 8 },
  listItem:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 6 },
  listItemAdded:      { borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' },
  listItemLeft:       { width: 52 },
  listCode:           { fontSize: 11, fontWeight: '700', color: TEAL },
  listCategory:       { fontSize: 9, color: colors.muted, marginTop: 1 },
  listName:           { flex: 1, fontSize: 13, color: colors.ink },
  footer:             { flexDirection: 'row', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  skipBtn:            { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  skipBtnText:        { fontWeight: '600', color: colors.muted },
  nextBtn:            { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14 },
  nextBtnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },
});
