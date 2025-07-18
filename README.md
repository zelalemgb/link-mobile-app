# Link Mobile App

Link is a mobile-first digital health platform designed for low-resource settings. It aims to empower patients by integrating AI-supported triage, trusted healthcare provider recommendations, personal health records and appointment booking into one seamless experience.  

## Key Features

1. **Symptom Checker (AI‑Guided Triage)**  
   - Presents questions one at a time, adapting to the user’s age and health conditions.  
   - Uses AI to generate a summary and recommendation.  
   - Determines whether self care, a clinic visit or emergency care is needed.

2. **Smart Facility Recommendations**  
   - Recommends nearby healthcare facilities based on triage results and the patient’s location.  
   - Displays open hours, services offered, queue times, available equipment and payment or voucher status.  
   - Flags facilities that are inactive or offline.

3. **Personal Health Records (PHR)**  
   - Provides a dashboard where patients can view their triage history, uploaded documents, visit notes and medications.  
   - Allows records to be exported or shared as PDF or QR code.

4. **Appointment Booking**  
   - Books in‑person or virtual appointments with facilities or specific providers.  
   - Sends confirmations and reminders.  
   - Shares the patient’s triage summary and uploaded documents with the provider.

5. **Provider Portal**  
   - Lets providers view appointments and record encounter notes, diagnoses and treatments.  
   - Offers tools to manage clinic information, staff and equipment.

6. **Health Feed**  
   - Enables patients to ask anonymous questions and providers or sponsors to post educational content.  
   - Supports up‑voting, reputation badges and content moderation.

7. **Preventive Prompts & Challenges**  
   - Sends personalized health nudges based on the patient’s history.  
   - Integrates sponsor‑funded challenges (e.g., blood pressure checks) with rewards such as airtime or pharmacy vouchers.

8. **Privacy & Consent**  
   - Keeps users anonymous by default.  
   - Implements explicit data sharing controls so that patients own and control their records.

## Getting Started

This repository contains the initial scaffolding for the Link Mobile App. To run the application in development mode, you will need to install dependencies and set up your development environment.  

1. Ensure you have Node.js and React Native CLI installed.  
2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the application:

   ```bash
   npx react-native run-android   # for Android
   npx react-native run-ios       # for iOS
   npx expo start --web           # for web preview (requires Expo)
   ```

> **Note:** This is just the starting point for development. Each feature listed above will require detailed implementation and integration with backend services.
