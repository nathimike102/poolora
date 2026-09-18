import { Router } from 'express';
import { MapsController } from '../controllers/MapsController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { autocompleteSchema, geocodeSchema, reverseGeocodeSchema } from '../validators';

const router = Router();

// All maps routes require authentication
router.use(authenticate);

// Place suggestions (debounced by the client, cached here)
router.get('/autocomplete', validate(autocompleteSchema), MapsController.autocomplete);
router.get('/geocode', validate(geocodeSchema), MapsController.geocode);
router.get('/reverse-geocode', validate(reverseGeocodeSchema), MapsController.reverseGeocode);

// Directions & distance stay on the backend (secure, heavy operations)
router.get('/directions', MapsController.directions);
router.get('/distance', MapsController.distance);

// Directions API — step-by-step pickup to drop directions
router.get('/pickup-to-drop', MapsController.pickupToDrop);

// Distance Matrix API — find nearest driver from multiple driver locations
router.post('/nearest-driver', MapsController.nearestDriver);

// Routes API — traffic-aware routes for rides and parcel delivery
router.get('/traffic-route', MapsController.trafficRoute);

// Geolocation API — backup location detection when GPS is unavailable
router.post('/geolocation', MapsController.geolocation);

// Route Optimization API — optimize multi-stop delivery/ride routes
router.post('/optimize-route', MapsController.optimizeRoute);

// Navigation SDK — turn-by-turn navigation data for driving UI
router.get('/navigation', MapsController.navigation);

// Maps Grounding Lite — AI-to-Maps real place data search
router.post('/grounding', MapsController.grounding);

// Places Aggregate API — nearby places (police stations, petrol bunks, etc.)
router.get('/nearby', MapsController.nearbyPlaces);

// Address Validation API — validate and correct addresses
router.post('/validate-address', MapsController.validateAddress);

export default router;
