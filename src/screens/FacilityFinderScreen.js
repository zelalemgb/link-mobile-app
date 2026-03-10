import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
  Linking,
} from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { colors, spacing, typography } from "../theme/tokens";
import { useToast } from "../context/ToastContext";
import { getFacilities, getPublicDirectoryFacilities } from "../services/patientService";

const FACILITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "hospital", label: "Hospitals" },
  { value: "health_center", label: "Health Centers" },
  { value: "clinic", label: "Clinics" },
  { value: "specialized", label: "Specialized" },
];

const formatFacilityType = (value) => {
  if (!value) return "Facility";
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const FacilityFinderScreen = ({ navigation }) => {
  const { showToast } = useToast();
  const [facilities, setFacilities] = React.useState([]);
  const [connectedFacilityIds, setConnectedFacilityIds] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState("all");

  const loadFacilities = React.useCallback(async () => {
    setLoading(true);
    try {
      const [publicResult, connectedResult] = await Promise.allSettled([
        getPublicDirectoryFacilities({ limit: 200 }),
        getFacilities(),
      ]);

      if (publicResult.status !== "fulfilled") {
        throw publicResult.reason;
      }

      const publicFacilities = Array.isArray(publicResult.value?.facilities)
        ? publicResult.value.facilities
        : [];
      setFacilities(publicFacilities);

      if (connectedResult.status === "fulfilled") {
        const connectedFacilities = Array.isArray(connectedResult.value?.facilities)
          ? connectedResult.value.facilities
          : [];
        setConnectedFacilityIds(connectedFacilities.map((facility) => facility.id));
      } else {
        setConnectedFacilityIds([]);
      }
    } catch (error) {
      setFacilities([]);
      setConnectedFacilityIds([]);
      showToast(error?.message || "Unable to load facilities.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const connectedFacilityIdSet = React.useMemo(
    () => new Set(connectedFacilityIds),
    [connectedFacilityIds]
  );

  const filteredFacilities = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return facilities.filter((facility) => {
      if (filterType !== "all" && facility.facility_type !== filterType) {
        return false;
      }
      if (!query) return true;
      return [facility.name, facility.location, facility.address, facility.phone_number]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [facilities, filterType, searchTerm]);

  const handleDirections = React.useCallback((facility) => {
    const query = [facility.name, facility.address || facility.location || ""]
      .filter(Boolean)
      .join(" ");
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  }, []);

  const handleCall = React.useCallback((phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`);
  }, []);

  const handleBookAppointment = React.useCallback((facility) => {
    navigation.navigate("PatientAppointments", {
      startBooking: true,
      prefillFacilityId: facility.id,
      prefillFacilityName: facility.name,
    });
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Find Facilities</Text>
        <Text style={styles.subtitle}>
          Discover Link-enabled clinics and providers near you.
        </Text>
      </View>

      <Card style={styles.searchCard}>
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search by facility or location"
          style={styles.searchInput}
          placeholderTextColor={colors.muted}
        />
        <View style={styles.filterRow}>
          {FACILITY_FILTERS.map((filter) => {
            const active = filterType === filter.value;
            return (
              <Pressable
                key={filter.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilterType(filter.value)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading facilities...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultsCount}>
            {filteredFacilities.length} {filteredFacilities.length === 1 ? "facility" : "facilities"} found
          </Text>

          {filteredFacilities.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>No matching facilities</Text>
              <Text style={styles.cardBody}>
                Try another search term or switch facility type filters.
              </Text>
              <View style={styles.cardActions}>
                <Button title="Refresh directory" variant="secondary" onPress={loadFacilities} />
              </View>
            </Card>
          ) : (
            filteredFacilities.map((facility) => (
              <Card style={styles.card} key={facility.id}>
                <View style={styles.facilityHeader}>
                  <Text style={styles.cardTitle}>{facility.name}</Text>
                  <Text style={styles.typeBadge}>{formatFacilityType(facility.facility_type)}</Text>
                </View>

                <Text style={styles.cardBody}>
                  {facility.address || facility.location || "Location details unavailable"}
                </Text>

                {facility.phone_number ? (
                  <Pressable onPress={() => handleCall(facility.phone_number)}>
                    <Text style={styles.phoneText}>{facility.phone_number}</Text>
                  </Pressable>
                ) : null}

                <View style={styles.metaRow}>
                  {facility.accepts_walk_ins ? (
                    <Text style={styles.metaBadge}>Accepts walk-ins</Text>
                  ) : null}
                  {facility.workspace?.workspaceType === "provider" ? (
                    <Text style={styles.metaBadge}>Solo provider</Text>
                  ) : (
                    <Text style={styles.metaBadge}>Clinic network</Text>
                  )}
                  {connectedFacilityIdSet.has(facility.id) ? (
                    <Text style={styles.metaBadge}>Connected to your care team</Text>
                  ) : null}
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title={connectedFacilityIdSet.has(facility.id) ? "Book appointment" : "Open appointments"}
                    onPress={() => {
                      if (connectedFacilityIdSet.has(facility.id)) {
                        handleBookAppointment(facility);
                        return;
                      }
                      navigation.navigate("PatientAppointments");
                    }}
                    style={styles.actionButton}
                  />
                  <Button
                    title="Directions"
                    variant="secondary"
                    onPress={() => handleDirections(facility)}
                    style={styles.actionButton}
                  />
                  {facility.phone_number ? (
                    <Button
                      title="Call"
                      variant="ghost"
                      onPress={() => handleCall(facility.phone_number)}
                      style={styles.actionButton}
                    />
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  searchCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.text,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  loadingState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.muted,
  },
  resultsCount: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  facilityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    flex: 1,
  },
  typeBadge: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  cardBody: {
    ...typography.body,
    color: colors.text,
  },
  phoneText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  metaBadge: {
    ...typography.caption,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionButton: {
    minWidth: 110,
  },
  cardActions: {
    marginTop: spacing.sm,
  },
});

export default FacilityFinderScreen;
