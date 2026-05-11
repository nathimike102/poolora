Resolve Frontend Errors and Run Android
The goal is to fix all TypeScript errors in the React Native/Expo frontend and successfully launch the Android application using npx expo run:android.

User Review Required
IMPORTANT

I will be making changes to multiple screen components to fix TypeScript errors. These changes are mostly type-related but may involve renaming some property accesses (e.g., phone vs phoneNumber).

Proposed Changes
[Frontend TypeScript Fixes]
[MODIFY] 
ManageRequestsScreen.tsx
Ensure Gender and Status types are correctly defined and accessible.
Fix implicit 'any' types in parameters.
[MODIFY] 
BookingScreen.tsx
Change seats to seatsBooked when calling the booking service to match CreateBookingRequest interface.
[MODIFY] 
ChatListScreen.tsx
Fix unintentional comparison between overlapping enum-like types.
[MODIFY] 
ChatScreen.tsx
Resolve missing senderType property on Message type, or handle it correctly if it's supposed to be derived.
[MODIFY] 
ProfileScreen.tsx
Change phoneNumber to phone to match the User interface.
Verification Plan
Automated Tests
Run npm run typecheck (or npx tsc --noEmit) to verify that all TS errors are resolved.
Manual Verification
Run npx expo run:android to ensure the app builds and launches on the Android emulator/device.
