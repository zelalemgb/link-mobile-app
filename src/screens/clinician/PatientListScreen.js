/**
 * PatientListScreen — Patient search + "New patient" entry point
 *
 * ≤3-tap path to start a consult:
 *   Tap 1 → tap any patient card  → PatientDetail
 *   Tap 2 → "Start consult"       → ChiefComplaint  (2 taps total ✓)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { patientRepo } from '../../repositories/patientRepo';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme/tokens';

const TEAL = '#0f766e';

// ─── Patient card ─────────────────────────────────────────────────────────────

function PatientCard({ patient, onPress }) {
  const initials = (patient.full_name || '?')
    .split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const age = patient.date_of_birth
    ? `${Math.floor((Date.now() - new Date(patient.date_of_birth)) / 3.156e10)}y`
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{patient.full_name}</Text>
        <Text style={styles.cardMeta}>
          {[age, patient.sex, patient.village].filter(Boolean).join(' · ')}
        </Text>
        {patient.phone ? (
          <Text style={styles.cardPhone}>{patient.phone}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PatientListScreen({ navigation }) {
  const { user } = useAuth();
  const [query, setQuery]       = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const search = useCallback(async (q = query, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const results = await patientRepo.search({
        query: q,
        facilityId: user?.facility_id ?? null,
        limit: 40,
      });
      setPatients(results);
    } catch (err) {
      console.error('[PatientList] search error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, user]);

  // Load all on first focus / re-focus
  useFocusEffect(useCallback(() => { search('', false); }, []));

  // Debounced search on query change
  useEffect(() => {
    const t = setTimeout(() => search(query, false), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); search('', false); }} />}
          renderItem={({ item }) => (
            <PatientCard
              patient={item}
              onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color="#d1fae5" />
              <Text style={styles.emptyTitle}>
                {query ? 'No patients found' : 'No patients yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {query ? 'Try a different name or phone number.' : 'Register the first patient to get started.'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB — register new patient */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('PatientRegistration')}
        activeOpacity={0.85}
      >
        <Feather name="user-plus" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  searchIcon:   {},
  searchInput:  { flex: 1, fontSize: 14, color: colors.ink },
  list:         { paddingHorizontal: 14, paddingBottom: 80 },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 13, marginBottom: 10, gap: 12 },
  avatar:       { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d7c8f5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { fontSize: 15, fontWeight: '700', color: '#4d2c91' },
  cardBody:     { flex: 1, gap: 2 },
  cardName:     { fontSize: 14, fontWeight: '700', color: colors.ink },
  cardMeta:     { fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
  cardPhone:    { fontSize: 11, color: colors.muted },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  empty:        { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyBody:    { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  fab:          { position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
