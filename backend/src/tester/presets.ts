export type TesterFieldType = 'text' | 'number' | 'boolean' | 'datetime-local';

export interface TesterField {
  key: string;
  label: string;
  type: TesterFieldType;
  required: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
}

export interface TesterPreset {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  useAuth: boolean;
  fields: TesterField[];
}

export const testerPresets: TesterPreset[] = [
  {
    name: 'Health Check',
    method: 'GET',
    path: '/health',
    useAuth: false,
    fields: [],
  },
  {
    name: 'Send OTP',
    method: 'POST',
    path: '/auth/send-otp',
    useAuth: false,
    fields: [
      { key: 'body.phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+919876543210' },
    ],
  },
  {
    name: 'Verify OTP',
    method: 'POST',
    path: '/auth/verify-otp',
    useAuth: false,
    fields: [
      { key: 'body.phone', label: 'Phone Number', type: 'text', required: true, placeholder: '+919876543210' },
      { key: 'body.otp', label: 'OTP', type: 'text', required: true, placeholder: '123456' },
      { key: 'body.name', label: 'Name', type: 'text', required: true, defaultValue: 'Test User' },
      { key: 'body.email', label: 'Email', type: 'text', required: false, placeholder: 'user@example.com' },
      { key: 'body.dateOfBirth', label: 'Date Of Birth (ISO)', type: 'text', required: false, placeholder: '1998-01-31' },
    ],
  },
  {
    name: 'Refresh Token',
    method: 'POST',
    path: '/auth/refresh-token',
    useAuth: false,
    fields: [
      { key: 'body.refreshToken', label: 'Refresh Token', type: 'text', required: true, placeholder: 'Paste refresh token' },
    ],
  },
  {
    name: 'Get Me (Auth)',
    method: 'GET',
    path: '/auth/me',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Submit KYC (Auth)',
    method: 'POST',
    path: '/auth/kyc',
    useAuth: true,
    fields: [
      { key: 'body.licenseNumber', label: 'License Number', type: 'text', required: true, placeholder: 'DL-XX-1234567890' },
      { key: 'body.drivingLicenseUrl', label: 'Driving License URL', type: 'text', required: true, placeholder: 'https://...' },
      { key: 'body.vehicle.make', label: 'Vehicle Make', type: 'text', required: true, defaultValue: 'Toyota' },
      { key: 'body.vehicle.model', label: 'Vehicle Model', type: 'text', required: true, defaultValue: 'Etios' },
      { key: 'body.vehicle.year', label: 'Vehicle Year', type: 'number', required: true, defaultValue: 2020 },
      { key: 'body.vehicle.color', label: 'Vehicle Color', type: 'text', required: true, defaultValue: 'White' },
      { key: 'body.vehicle.plateNumber', label: 'Plate Number', type: 'text', required: true, defaultValue: 'KA01AB1234' },
      { key: 'body.vehicle.vehicleType', label: 'Vehicle Type', type: 'text', required: true, defaultValue: 'CAR' },
      { key: 'body.vehicle.hasAC', label: 'Has AC', type: 'boolean', required: false, defaultValue: true },
      { key: 'body.vehicle.registrationDocUrl', label: 'Registration URL', type: 'text', required: true, placeholder: 'https://...' },
      { key: 'body.vehicle.insuranceDocUrl', label: 'Insurance URL', type: 'text', required: true, placeholder: 'https://...' },
      { key: 'body.vehicle.photos.0', label: 'Vehicle Photo URL', type: 'text', required: true, placeholder: 'https://...' },
    ],
  },
  {
    name: 'Search Rides (Auth)',
    method: 'GET',
    path: '/rides/search',
    useAuth: true,
    fields: [
      { key: 'query.pickupLng', label: 'Pickup Longitude', type: 'number', required: true, defaultValue: 77.5946 },
      { key: 'query.pickupLat', label: 'Pickup Latitude', type: 'number', required: true, defaultValue: 12.9716 },
      { key: 'query.dropoffLng', label: 'Dropoff Longitude', type: 'number', required: true, defaultValue: 77.6245 },
      { key: 'query.dropoffLat', label: 'Dropoff Latitude', type: 'number', required: true, defaultValue: 12.9352 },
      { key: 'query.departureTime', label: 'Departure Time', type: 'datetime-local', required: true },
      { key: 'query.page', label: 'Page', type: 'number', required: false, defaultValue: 1 },
      { key: 'query.limit', label: 'Limit', type: 'number', required: false, defaultValue: 20 },
      { key: 'query.radiusKm', label: 'Radius Km', type: 'number', required: false, defaultValue: 5 },
      { key: 'query.timeDeviationMins', label: 'Time Deviation (mins)', type: 'number', required: false, defaultValue: 120 },
      { key: 'query.maxPrice', label: 'Max Price', type: 'number', required: false },
      { key: 'query.womenOnly', label: 'Women Only', type: 'boolean', required: false },
      { key: 'query.hasAC', label: 'Has AC', type: 'boolean', required: false },
      { key: 'query.vehicleType', label: 'Vehicle Type', type: 'text', required: false, placeholder: 'BIKE | AUTO | CAR | SUV | VAN' },
      { key: 'query.minRating', label: 'Min Rating', type: 'number', required: false },
      { key: 'query.rideType', label: 'Ride Type', type: 'text', required: false, placeholder: 'CAR_POOL | PARCEL' },
    ],
  },
  {
    name: 'Get My Rides (Auth)',
    method: 'GET',
    path: '/rides/my-rides',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Create Ride (Driver Auth)',
    method: 'POST',
    path: '/rides',
    useAuth: true,
    fields: [
      { key: 'body.rideType', label: 'Ride Type', type: 'text', required: false, defaultValue: 'CAR_POOL' },
      { key: 'body.vehicleId', label: 'Vehicle ID', type: 'text', required: true, placeholder: '24-char ObjectId' },
      { key: 'body.pickup.lng', label: 'Pickup Longitude', type: 'number', required: true, defaultValue: 77.5946 },
      { key: 'body.pickup.lat', label: 'Pickup Latitude', type: 'number', required: true, defaultValue: 12.9716 },
      { key: 'body.pickup.address', label: 'Pickup Address', type: 'text', required: true, defaultValue: 'Bangalore A' },
      { key: 'body.dropoff.lng', label: 'Dropoff Longitude', type: 'number', required: true, defaultValue: 77.6245 },
      { key: 'body.dropoff.lat', label: 'Dropoff Latitude', type: 'number', required: true, defaultValue: 12.9352 },
      { key: 'body.dropoff.address', label: 'Dropoff Address', type: 'text', required: true, defaultValue: 'Bangalore B' },
      { key: 'body.departureTime', label: 'Departure Time', type: 'datetime-local', required: true },
      { key: 'body.totalSeats', label: 'Total Seats', type: 'number', required: true, defaultValue: 2 },
      { key: 'body.pricePerSeat', label: 'Price Per Seat', type: 'number', required: true, defaultValue: 120 },
      { key: 'body.recurring', label: 'Recurring', type: 'text', required: false, defaultValue: 'NONE' },
      { key: 'body.preferences.womenOnly', label: 'Women Only', type: 'boolean', required: false, defaultValue: false },
      { key: 'body.preferences.smokingAllowed', label: 'Smoking Allowed', type: 'boolean', required: false, defaultValue: false },
      { key: 'body.preferences.petsAllowed', label: 'Pets Allowed', type: 'boolean', required: false, defaultValue: false },
      { key: 'body.preferences.luggageSize', label: 'Luggage Size', type: 'text', required: false, defaultValue: 'medium' },
      { key: 'body.preferences.maxDetourMins', label: 'Max Detour Minutes', type: 'number', required: false, defaultValue: 15 },
    ],
  },
  {
    name: 'Get Ride By ID (Auth)',
    method: 'GET',
    path: '/rides/:id',
    useAuth: true,
    fields: [
      { key: 'path.id', label: 'Ride ID', type: 'text', required: true, placeholder: '24-char ObjectId' },
    ],
  },
  {
    name: 'Create Booking (Auth)',
    method: 'POST',
    path: '/bookings',
    useAuth: true,
    fields: [
      { key: 'body.rideId', label: 'Ride ID', type: 'text', required: true, placeholder: '24-char ObjectId' },
      { key: 'body.seatsBooked', label: 'Seats Booked', type: 'number', required: false, defaultValue: 1 },
      { key: 'body.pickup.lng', label: 'Pickup Longitude', type: 'number', required: true, defaultValue: 77.5946 },
      { key: 'body.pickup.lat', label: 'Pickup Latitude', type: 'number', required: true, defaultValue: 12.9716 },
      { key: 'body.pickup.address', label: 'Pickup Address', type: 'text', required: true, defaultValue: 'Bangalore A' },
      { key: 'body.dropoff.lng', label: 'Dropoff Longitude', type: 'number', required: true, defaultValue: 77.6245 },
      { key: 'body.dropoff.lat', label: 'Dropoff Latitude', type: 'number', required: true, defaultValue: 12.9352 },
      { key: 'body.dropoff.address', label: 'Dropoff Address', type: 'text', required: true, defaultValue: 'Bangalore B' },
    ],
  },
  {
    name: 'Rider Bookings (Auth)',
    method: 'GET',
    path: '/bookings/as-rider',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Driver Bookings (Auth)',
    method: 'GET',
    path: '/bookings/as-driver',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Payment History (Auth)',
    method: 'GET',
    path: '/payments/history',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Unread Chat Count (Auth)',
    method: 'GET',
    path: '/chat/unread-count',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Send Chat Message (Auth)',
    method: 'POST',
    path: '/chat/messages',
    useAuth: true,
    fields: [
      { key: 'body.bookingId', label: 'Booking ID', type: 'text', required: true, placeholder: '24-char ObjectId' },
      { key: 'body.content', label: 'Message Content', type: 'text', required: true, defaultValue: 'hello from tester' },
      { key: 'body.contentType', label: 'Content Type', type: 'text', required: false, defaultValue: 'text' },
    ],
  },
  {
    name: 'Trigger SOS (Auth)',
    method: 'POST',
    path: '/safety/sos',
    useAuth: true,
    fields: [
      { key: 'body.bookingId', label: 'Booking ID', type: 'text', required: true, placeholder: '24-char ObjectId' },
      { key: 'body.location.lng', label: 'Location Longitude', type: 'number', required: true, defaultValue: 77.5946 },
      { key: 'body.location.lat', label: 'Location Latitude', type: 'number', required: true, defaultValue: 12.9716 },
    ],
  },
  {
    name: 'Create Rating (Auth)',
    method: 'POST',
    path: '/ratings',
    useAuth: true,
    fields: [
      { key: 'body.bookingId', label: 'Booking ID', type: 'text', required: true, placeholder: '24-char ObjectId' },
      { key: 'body.score', label: 'Score (1-5)', type: 'number', required: true, defaultValue: 5 },
      { key: 'body.comment', label: 'Comment', type: 'text', required: false, defaultValue: 'Great ride' },
      { key: 'body.tags.0', label: 'Tag #1', type: 'text', required: false, placeholder: 'safety' },
    ],
  },
  {
    name: 'Wallet Summary (Auth)',
    method: 'GET',
    path: '/wallet',
    useAuth: true,
    fields: [],
  },
  {
    name: 'Wallet Tiers (Public)',
    method: 'GET',
    path: '/wallet/tiers',
    useAuth: false,
    fields: [],
  },
  {
    name: 'Wallet Topup Create (Auth)',
    method: 'POST',
    path: '/wallet/topup',
    useAuth: true,
    fields: [
      { key: 'body.amount', label: 'Topup Amount', type: 'number', required: true, defaultValue: 100 },
    ],
  },
  {
    name: 'Wallet Topup Confirm (Auth)',
    method: 'POST',
    path: '/wallet/topup/confirm',
    useAuth: true,
    fields: [
      { key: 'body.razorpayOrderId', label: 'Razorpay Order ID', type: 'text', required: true },
      { key: 'body.razorpayPaymentId', label: 'Razorpay Payment ID', type: 'text', required: true },
      { key: 'body.razorpaySignature', label: 'Razorpay Signature', type: 'text', required: true },
    ],
  },
  {
    name: 'Wallet Transactions (Auth)',
    method: 'GET',
    path: '/wallet/transactions',
    useAuth: true,
    fields: [
      { key: 'query.page', label: 'Page', type: 'number', required: false, defaultValue: 1 },
      { key: 'query.limit', label: 'Limit', type: 'number', required: false, defaultValue: 20 },
    ],
  },
  {
    name: 'Wallet Coins History (Auth)',
    method: 'GET',
    path: '/wallet/coins/history',
    useAuth: true,
    fields: [
      { key: 'query.page', label: 'Page', type: 'number', required: false, defaultValue: 1 },
      { key: 'query.limit', label: 'Limit', type: 'number', required: false, defaultValue: 20 },
    ],
  },
  {
    name: 'Wallet Convert Coins (Auth)',
    method: 'POST',
    path: '/wallet/coins/convert',
    useAuth: true,
    fields: [
      { key: 'body.coins', label: 'Coins', type: 'number', required: true, defaultValue: 100 },
    ],
  },
  {
    name: 'Maps Directions (Auth)',
    method: 'GET',
    path: '/maps/directions',
    useAuth: true,
    fields: [
      { key: 'query.originLat', label: 'Origin Latitude', type: 'number', required: true, defaultValue: 12.9716 },
      { key: 'query.originLng', label: 'Origin Longitude', type: 'number', required: true, defaultValue: 77.5946 },
      { key: 'query.destLat', label: 'Destination Latitude', type: 'number', required: true, defaultValue: 12.9352 },
      { key: 'query.destLng', label: 'Destination Longitude', type: 'number', required: true, defaultValue: 77.6245 },
      { key: 'query.mode', label: 'Mode', type: 'text', required: false, defaultValue: 'driving' },
    ],
  },
  {
    name: 'Maps Distance (Auth)',
    method: 'GET',
    path: '/maps/distance',
    useAuth: true,
    fields: [
      { key: 'query.originLat', label: 'Origin Latitude', type: 'number', required: true, defaultValue: 12.9716 },
      { key: 'query.originLng', label: 'Origin Longitude', type: 'number', required: true, defaultValue: 77.5946 },
      { key: 'query.destLat', label: 'Destination Latitude', type: 'number', required: true, defaultValue: 12.9352 },
      { key: 'query.destLng', label: 'Destination Longitude', type: 'number', required: true, defaultValue: 77.6245 },
      { key: 'query.mode', label: 'Mode', type: 'text', required: false, defaultValue: 'driving' },
    ],
  },
];
