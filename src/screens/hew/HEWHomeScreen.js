/**
 * HEWHomeScreen — Main dashboard for Health Extension Workers
 *
 * Two tabs:
 *  - Search: find patient by name/phone, open note form
 *  - Caseload: patients with upcoming/overdue follow-ups
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { searchPatients, getCaseload, getPatientNotes, getFacilityPatients } from '../../services/hewService';
import { tokens } from '../../theme/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-ET', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

// ─── Patient card ──────────────────────────────────────────────────────────

function PatientCard({ patient, onLogVisit }) {
  const [notes, setNotes] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getPatientNotes(patient.id, 2).then(setNotes).catch(() => {});
  }, [patient.id]);

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.patientName}>{patient.full_name}</Text>
          {patient.phone ? (
            <Text style={styles.patientMeta}>{patient.phone}</Text>
          ) : null}
          {patient.date_of_birth ? (
            <Text style={styles.patientMeta}>DOB {patient.date_of_birth}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => onLogVisit(patient)}
          accessibilityLabel="Log visit"
        >
          <Feather name="plus-circle" size={14} color="#fff" />
          <Text style={styles.logBtnText}>Log visit</Text>
        </TouchableOpacity>
      </View>

      {notes.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.notesToggle}
            onPress={() => setExpanded((v) => !v)}
          >
            <Feather name="clipboard" size={12} color={tokens.colors.muted} />
            <Text style={styles.notesToggleText}>
              {notes.length} HEW note{notes.length > 1 ? 's' : ''}
            </Text>
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={tokens.colors.muted}
            />
          </TouchableOpacity>

          {expanded && notes.map((n) => (
            <View key={n.id} style={styles.notePreview}>
              <Text style={styles.noteType}>{n.note_type?.replace(/_/g, ' ')}</Text>
              <Text style={styles.noteText} numberOfLines={2}>{n.note_text}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ─── Caseload item ────────────────────────────────────────────────────────

function CaseloadItem({ patient, onLogVisit }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = patient.follow_up_due && patient.follow_up_due < today;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.patientName}>{patient.full_name}</Text>
          {patient.phone ? <Text style={styles.patientMeta}>{patient.phone}</Text> : null}
          {patient.follow_up_due ? (
            <View style={[styles.dueBadge, isOverdue ? styles.dueBadgeOverdue : styles.dueBadgeOk]}>
              <Feather name="calendar" size={11} color={isOverdue ? '#b91c1c' : '#0f766e'} />
              <Text style={[styles.dueBadgeText, { color: isOverdue ? '#b91c1c' : '#0f766e' }]}>
                {isOverdue ? 'Overdue: ' : 'Due: '}{formatDate(patient.follow_up_due)}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => onLogVisit(patient)}
          accessibilityLabel="Log visit"
        >
          <Feather name="plus-circle" size={14} color="#fff" />
          <Text style={styles.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function HEWHomeScreen({ navigation }) {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query);

  const [facilityPatients, setFacilityPatients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingFacility, setLoadingFacility] = useState(true);

  const [caseload, setCaseload] = useState([]);
  const [loadingCaseload, setLoadingCaseload] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load all facility patients on mount
  useEffect(() => {
    setLoadingFacility(true);
    getFacilityPatients()
      .then(setFacilityPatients)
      .catch(() => setFacilityPatients([]))
      .finally(() => setLoadingFacility(false));
  }, []);

  // Search — filter facility patients locally, or hit API for broader search
  useEffect(() => {
    if (debouncedQuery.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    // First try local filter on facility patients
    const q = debouncedQuery.toLowerCase();
    const localMatches = facilityPatients.filter(
      (p) => p.full_name?.toLowerCase().includes(q) || p.phone?.includes(debouncedQuery)
    );
    if (localMatches.length > 0) {
      setSearchResults(localMatches);
      setSearching(false);
    } else {
      // Fall back to API search
      searchPatients(debouncedQuery)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }
  }, [debouncedQuery, facilityPatients]);

  // Caseload — reload on tab focus
  const loadCaseload = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingCaseload(true);
    try {
      const data = await getCaseload();
      setCaseload(data);
    } catch { /* keep stale */ } finally {
      setLoadingCaseload(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (tab === 'caseload') loadCaseload();
  }, [tab, loadCaseload]));

  useEffect(() => {
    if (tab === 'caseload') loadCaseload();
  }, [tab]);

  const goLog = (patient) => navigation.navigate('HEWRecordNote', { patient });

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {[['search', 'Patient search'], ['caseload', 'My caseload']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search tab */}
      {tab === 'search' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={tokens.colors.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patient name or phone…"
              placeholderTextColor={tokens.colors.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="words"
            />
            {searching && (
              <ActivityIndicator size="small" color={tokens.colors.primary} style={{ marginRight: 10 }} />
            )}
          </View>

          {loadingFacility && debouncedQuery.length < 2 && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={tokens.colors.primary} />
            </View>
          )}

          {!loadingFacility && debouncedQuery.length < 2 && facilityPatients.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="users" size={40} color="#e2e8f0" />
              <Text style={styles.emptyText}>No patients registered at your facility.</Text>
            </View>
          )}

          {debouncedQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <Text style={styles.noResults}>No patients found for "{debouncedQuery}"</Text>
          )}

          {debouncedQuery.length < 2 && !loadingFacility && facilityPatients.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>
                Zelalem Hospital — {facilityPatients.length} patients
              </Text>
              <FlatList
                data={facilityPatients}
                keyExtractor={(p) => p.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <PatientCard patient={item} onLogVisit={goLog} />
                )}
              />
            </>
          )}

          {debouncedQuery.length >= 2 && (
            <FlatList
              data={searchResults}
              keyExtractor={(p) => p.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <PatientCard patient={item} onLogVisit={goLog} />
              )}
            />
          )}
        </View>
      )}

      {/* Caseload tab */}
      {tab === 'caseload' && (
        <View style={{ flex: 1 }}>
          {loadingCaseload && (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={tokens.colors.primary} />
            </View>
          )}
          {!loadingCaseload && caseload.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color="#e2e8f0" />
              <Text style={styles.emptyText}>No upcoming follow-ups on your caseload.</Text>
            </View>
          )}
          <FlatList
            data={caseload}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadCaseload(true)} />
            }
            renderItem={({ item }) => (
              <CaseloadItem patient={item} onLogVisit={goLog} />
            )}
          />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: tokens.colors.background },

  // Tabs
  tabs:            { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  tab:             { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:       { borderBottomColor: '#0f766e' },
  tabLabel:        { fontSize: 14, fontWeight: '500', color: tokens.colors.muted },
  tabLabelActive:  { color: '#0f766e' },

  // Search
  searchBox:       { margin: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.border },
  searchIcon:      { marginLeft: 12 },
  searchInput:     { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: tokens.colors.ink },

  // Empty / no results
  emptyState:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyText:       { fontSize: 14, color: tokens.colors.muted, textAlign: 'center', paddingHorizontal: 32 },
  noResults:       { textAlign: 'center', color: tokens.colors.muted, fontSize: 14, marginTop: 24 },
  sectionHeader:   { fontSize: 13, fontWeight: '600', color: tokens.colors.muted, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },

  // List
  listContent:     { padding: 14, gap: 12 },

  // Card
  card:            { backgroundColor: '#fff', borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.border, overflow: 'hidden' },
  cardRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14, gap: 10 },
  cardInfo:        { flex: 1, gap: 2 },
  patientName:     { fontSize: 14, fontWeight: '600', color: tokens.colors.ink },
  patientMeta:     { fontSize: 12, color: tokens.colors.muted },

  // Due badge
  dueBadge:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  dueBadgeOk:      { backgroundColor: '#ccfbf1' },
  dueBadgeOverdue: { backgroundColor: '#fee2e2' },
  dueBadgeText:    { fontSize: 11, fontWeight: '500' },

  // Log button
  logBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0f766e', paddingVertical: 7, paddingHorizontal: 12, borderRadius: tokens.radii.sm },
  logBtnText:      { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Note preview
  notesToggle:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  notesToggleText: { fontSize: 12, color: tokens.colors.muted },
  notePreview:     { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10 },
  noteType:        { fontSize: 11, fontWeight: '600', color: tokens.colors.ink, textTransform: 'capitalize', marginBottom: 2 },
  noteText:        { fontSize: 12, color: tokens.colors.muted },
});
