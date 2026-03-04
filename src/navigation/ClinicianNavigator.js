/**
 * ClinicianNavigator
 *
 * Root stack for nurse / doctor / admin roles:
 *   PatientList  (default tab)
 *   PatientDetail
 *   PatientRegistration
 *   Consult  ← nested stack (6 wizard steps)
 *     ChiefComplaint → Vitals → Assessment → Diagnosis → Treatment → ReferralOutcome
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Patient screens
import PatientListScreen        from '../screens/clinician/PatientListScreen';
import PatientDetailScreen      from '../screens/clinician/PatientDetailScreen';
import PatientRegistrationScreen from '../screens/clinician/PatientRegistrationScreen';
import NurseTriageScreen        from '../screens/clinician/NurseTriageScreen';
import SyncStatusScreen         from '../screens/clinician/SyncStatusScreen';

// Consult wizard screens
import ConsultChiefComplaintScreen from '../screens/clinician/consult/ConsultChiefComplaintScreen';
import ConsultVitalsScreen         from '../screens/clinician/consult/ConsultVitalsScreen';
import ConsultAssessmentScreen     from '../screens/clinician/consult/ConsultAssessmentScreen';
import ConsultDiagnosisScreen      from '../screens/clinician/consult/ConsultDiagnosisScreen';
import ConsultTreatmentScreen      from '../screens/clinician/consult/ConsultTreatmentScreen';
import ConsultReferralOutcomeScreen from '../screens/clinician/consult/ConsultReferralOutcomeScreen';

const Stack       = createNativeStackNavigator();
const ConsultStack = createNativeStackNavigator();

const TEAL = '#0f766e';

const sharedHeaderStyle = {
  headerStyle:     { backgroundColor: '#fff' },
  headerTintColor: TEAL,
  headerTitleStyle: { fontWeight: '700', color: '#111' },
  headerShadowVisible: false,
  contentStyle:    { backgroundColor: '#f8fafc' },
};

/** Inner navigator: the 6-step consult wizard */
function ConsultNavigator() {
  return (
    <ConsultStack.Navigator screenOptions={{ ...sharedHeaderStyle, headerShown: false }}>
      <ConsultStack.Screen name="ChiefComplaint" component={ConsultChiefComplaintScreen} />
      <ConsultStack.Screen name="Vitals"         component={ConsultVitalsScreen} />
      <ConsultStack.Screen name="Assessment"     component={ConsultAssessmentScreen} />
      <ConsultStack.Screen name="Diagnosis"      component={ConsultDiagnosisScreen} />
      <ConsultStack.Screen name="Treatment"      component={ConsultTreatmentScreen} />
      <ConsultStack.Screen name="ReferralOutcome" component={ConsultReferralOutcomeScreen} />
    </ConsultStack.Navigator>
  );
}

/** Back-button helper rendered in header */
function BackBtn({ navigation, tintColor }) {
  return (
    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8 }}>
      <Feather name="arrow-left" size={22} color={tintColor ?? TEAL} />
    </TouchableOpacity>
  );
}

export default function ClinicianNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PatientList"
      screenOptions={sharedHeaderStyle}
    >
      {/* ── Patient list ─────────────────────────────────── */}
      <Stack.Screen
        name="PatientList"
        component={PatientListScreen}
        options={({ navigation }) => ({
          title: 'Patients',
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('SyncStatus')}
              style={{ marginLeft: 8 }}
            >
              <Feather name="refresh-cw" size={20} color={TEAL} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* ── Patient detail ───────────────────────────────── */}
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
        options={({ navigation }) => ({
          title: 'Patient',
          headerLeft: (props) => <BackBtn navigation={navigation} {...props} />,
        })}
      />

      {/* ── New patient registration ─────────────────────── */}
      <Stack.Screen
        name="PatientRegistration"
        component={PatientRegistrationScreen}
        options={({ navigation }) => ({
          title: 'Register patient',
          headerLeft: (props) => <BackBtn navigation={navigation} {...props} />,
        })}
      />

      {/* ── Manual sync status / trigger ─────────────────── */}
      <Stack.Screen
        name="SyncStatus"
        component={SyncStatusScreen}
        options={({ navigation }) => ({
          title: 'Sync',
          headerLeft: (props) => <BackBtn navigation={navigation} {...props} />,
        })}
      />

      {/* ── Nurse triage (standalone vitals entry) ───────── */}
      <Stack.Screen
        name="NurseTriage"
        component={NurseTriageScreen}
        options={({ navigation }) => ({
          title: 'Triage',
          headerLeft: (props) => <BackBtn navigation={navigation} {...props} />,
        })}
      />

      {/* ── Consult wizard (nested) ───────────────────────── */}
      <Stack.Screen
        name="Consult"
        component={ConsultNavigator}
        options={({ navigation }) => ({
          title: 'Consultation',
          headerShown: true,
          headerLeft: (props) => (
            <BackBtn navigation={navigation} {...props} />
          ),
        })}
      />
    </Stack.Navigator>
  );
}
